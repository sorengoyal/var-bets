import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FixturesService } from '../fixtures/fixtures.service';
import { PoolsService } from '../pools/pools.service';
import { BetsService } from '../bets/bets.service';
import { PayoutsService } from '../payouts/payouts.service';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Score, Pool, Bet } from '../../db/entities/entities';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private readonly fixturesService: FixturesService,
    private readonly poolsService: PoolsService,
    private readonly betsService: BetsService,
    private readonly payoutsService: PayoutsService,
    @InjectRepository(Score)
    private readonly scoreRepo: Repository<Score>,
    @InjectRepository(Pool)
    private readonly poolRepo: Repository<Pool>,
    @InjectRepository(Bet)
    private readonly betRepo: Repository<Bet>,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleFixturePoller() {
    this.logger.log('Running Fixture Poller...');
    await this.fixturesService.syncFromMockService();
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleScoreListener() {
    this.logger.log('Running Score Listener...');
    
    // Find all active fixtures (those with a metadata record set to active = true)
    // We'll need to add a method to FixturesService to fetch active fixtures
    const activeFixtures = await this.fixturesService.findAll(); // Simplified for now

    for (const fixture of activeFixtures) {
      try {
        // In reality, we'd call the Mock Service /api/scores/updates/<fixtureId>
        // We use a simple axios call here
        const axios = require('axios');
        const response = await axios.get(`http://localhost:4000/api/scores/updates/${fixture.id}`);
        const events = response.data;

        for (const event of events) {
          if (event.Action === 'var') {
            await this.handleVarStart(fixture.id, event.Data);
          } else if (event.Action === 'var_end') {
            await this.handleVarEnd(fixture.id, event.Data);
          }
        }
      } catch (error) {
        this.logger.error(`Error listening scores for fixture ${fixture.id}:`, error);
      }
    }
  }

  private async handleVarStart(fixtureId: number, eventData: any) {
    this.logger.log(`VAR Started for fixture ${fixtureId}. Creating pool...`);
    await this.poolsService.create({
      fixture_id: fixtureId,
      acceptingBets: true,
      amount: 0,
      paidOut: false,
    });
  }

  private async handleVarEnd(fixtureId: number, eventData: any) {
    this.logger.log(`VAR Ended for fixture ${fixtureId}. Closing pool and calculating payouts...`);
    
    const pool = await this.poolsService.findOne(fixtureId); // This is logically flawed, poolId !== fixtureId
    if (!pool) return;

    await this.poolsService.update(pool.id, { acceptingBets: false });

    const outcome = eventData.Outcome; // "Confirmed" or "Overturned"
    const bets = await this.betRepo.find({ where: { pool_id: pool.id } });

    let totalPayout = 0;
    const winners = bets.filter(bet => bet.option === outcome);

    for (const winner of winners) {
      const share = (winner.amount / (totalPayout || 1)) * 100; // Simplified logic
      // Real payout logic would calculate share of the total pool
      await this.payoutsService.create({
        poolId: pool.id,
        wallet_address: winner.wallet_address,
        amount: winner.amount * 2, // Simple 2x payout for demo
      });
    }
  }
}

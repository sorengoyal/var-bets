import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FixturesService } from '../fixtures/fixtures.service';
import { PoolsService } from '../pools/pools.service';
import { BetsService } from '../bets/bets.service';
import { PayoutsService } from '../payouts/payouts.service';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Score, Pool, Bet } from '../../db/entities/entities';
import axios from 'axios';

interface TxLineEvent {
  Ts: number;
  Action: string;
  Data: Record<string, unknown>;
  FixtureId: number;
}

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

  @Cron(CronExpression.EVERY_MINUTE)
  async handleFixturePoller() {
    this.logger.log('Running Fixture Poller...');
    await this.fixturesService.syncFromMockService();
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async handleScoreListener() {
    this.logger.log('Running Score Listener...');

    const fixture = await this.fixturesService.findByFixtureId('18202701');
    if (!fixture) return;

    try {
      const response = await axios.get<TxLineEvent[]>(
        `http://localhost:4000/api/scores/updates/${fixture.FixtureId}`,
      );
      const events = response.data;

      for (const event of events) {
        const exists = await this.scoreRepo.findOne({
          where: {
            fixtureId: fixture.id,
            Ts: event.Ts,
            Action: event.Action,
          },
        });

        if (exists) continue;

        await this.scoreRepo.save({
          fixtureId: fixture.id,
          Ts: event.Ts,
          Action: event.Action,
          Data: event.Data,
        });

        if (event.Action === 'var') {
          await this.handleVarStart(fixture.id, event.Data);
        } else if (event.Action === 'var_end') {
          await this.handleVarEnd(fixture.id, event.Data);
        }
      }
    } catch (error) {
      this.logger.error(
        `Error listening scores for fixture ${fixture.id}:`,
        error,
      );
    }
  }

  private async handleVarStart(
    fixtureId: number,
    _eventData: Record<string, unknown>,
  ) {
    this.logger.log(`VAR Started for fixture ${fixtureId}. Creating pool...`);
    await this.poolsService.create({
      fixture_id: fixtureId,
      acceptingBets: true,
      amount: 0,
      paidOut: false,
    });
  }

  private async handleVarEnd(
    fixtureId: number,
    eventData: Record<string, unknown>,
  ) {
    this.logger.log(
      `VAR Ended for fixture ${fixtureId}. Closing pool and calculating payouts...`,
    );

    const pool = await this.poolRepo.findOne({
      where: { fixture_id: fixtureId, acceptingBets: true },
    });
    if (!pool) return;

    await this.poolsService.update(pool.id, { acceptingBets: false });

    const outcome = eventData.Outcome as string;
    const bets = await this.betRepo.find({ where: { pool_id: pool.id } });

    const winners = bets.filter((bet) => bet.option === outcome);

    for (const winner of winners) {
      await this.payoutsService.create({
        poolId: pool.id,
        wallet_address: winner.wallet_address,
        amount: winner.amount * 2,
      });
    }

    await this.poolsService.update(pool.id, { paidOut: true });
  }
}

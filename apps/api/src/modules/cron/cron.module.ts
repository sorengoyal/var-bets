import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CronService } from './cron.service';
import { FixturesService } from '../fixtures/fixtures.service';
import { PoolsService } from '../pools/pools.service';
import { BetsService } from '../bets/bets.service';
import { PayoutsService } from '../payouts/payouts.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Score, Pool, Bet } from '../../db/entities/entities';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([Score, Pool, Bet]),
  ],
  controllers: [],
  providers: [CronService, FixturesService, PoolsService, BetsService, PayoutsService],
})
export class CronModule {}

import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CronService } from './cron.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Score, Pool, Bet } from '../../db/entities/entities';
import { FixturesModule } from '../fixtures/fixtures.module';
import { PoolsModule } from '../pools/pools.module';
import { BetsModule } from '../bets/bets.module';
import { PayoutsModule } from '../payouts/payouts.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    FixturesModule,
    PoolsModule,
    BetsModule,
    PayoutsModule,
    TypeOrmModule.forFeature([Score, Pool, Bet]),
  ],
  providers: [CronService],
})
export class CronModule {}

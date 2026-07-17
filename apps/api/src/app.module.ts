import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FixturesModule } from './modules/fixtures/fixtures.module';
import { PoolsModule } from './modules/pools/pools.module';
import { BetsModule } from './modules/bets/bets.module';
import { PayoutsModule } from './modules/payouts/payouts.module';
import { CronModule } from './modules/cron/cron.module';
import { Fixture, FixtureMetadata, Pool, Bet, Payout, Score, Webhook } from './db/entities/entities';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USER || 'user',
      password: process.env.DB_PASSWORD || 'password',
      database: process.env.DB_NAME || 'varbets',
      autoLoadEntities: true,
      synchronize: true, 
      entities: [__dirname + '/db/entities/**/*{.ts,.js}'],
      migrations: [__dirname + '/db/migrations/**/*{.ts,.js}'],
    }),
    TypeOrmModule.forFeature([Fixture, FixtureMetadata, Pool, Bet, Payout, Score, Webhook]),
    FixturesModule,
    PoolsModule,
    BetsModule,
    PayoutsModule,
    CronModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

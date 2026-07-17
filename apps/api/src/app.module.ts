import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthMiddleware } from './middleware/auth.middleware';
import { FixturesModule } from './modules/fixtures/fixtures.module';
import { FixturesController } from './modules/fixtures/fixtures.controller';
import { PoolsModule } from './modules/pools/pools.module';
import { PoolsController } from './modules/pools/pools.controller';
import { BetsModule } from './modules/bets/bets.module';
import { BetsController } from './modules/bets/bets.controller';
import { PayoutsModule } from './modules/payouts/payouts.module';
import { PayoutsController } from './modules/payouts/payouts.controller';
import { CronModule } from './modules/cron/cron.module';
import { EventsModule } from './modules/events/events.module';
import { SimulateModule } from './modules/simulate/simulate.module';
import { SimulateController } from './modules/simulate/simulate.controller';
import { SocketModule } from './modules/socket/socket.module';
import {
  Fixture,
  FixtureMetadata,
  Pool,
  Bet,
  Payout,
  Score,
  Webhook,
} from './db/entities/entities';

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
    TypeOrmModule.forFeature([
      Fixture,
      FixtureMetadata,
      Pool,
      Bet,
      Payout,
      Score,
      Webhook,
    ]),
    FixturesModule,
    PoolsModule,
    BetsModule,
    PayoutsModule,
    CronModule,
    EventsModule,
    SimulateModule,
    SocketModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthMiddleware)
      .forRoutes(
        AppController,
        FixturesController,
        PoolsController,
        BetsController,
        PayoutsController,
        SimulateController,
      );
  }
}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BetsController } from './bets.controller';
import { BetsService } from './bets.service';
import { Bet, Pool } from '../../db/entities/entities';

@Module({
  imports: [TypeOrmModule.forFeature([Bet, Pool])],
  controllers: [BetsController],
  providers: [BetsService],
  exports: [BetsService, TypeOrmModule],
})
export class BetsModule {}

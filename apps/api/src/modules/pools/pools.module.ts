import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PoolsController } from './pools.controller';
import { PoolsService } from './pools.service';
import { Pool } from '../../db/entities/entities';

@Module({
  imports: [TypeOrmModule.forFeature([Pool])],
  controllers: [PoolsController],
  providers: [PoolsService],
  exports: [PoolsService, TypeOrmModule],
})
export class PoolsModule {}

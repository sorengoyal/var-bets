import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FixturesController } from './fixtures.controller';
import { FixturesService } from './fixtures.service';
import { Fixture, FixtureMetadata } from '../../db/entities/entities';

@Module({
  imports: [TypeOrmModule.forFeature([Fixture, FixtureMetadata])],
  controllers: [FixturesController],
  providers: [FixturesService],
})
export class FixturesModule {}

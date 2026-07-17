import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Fixture, FixtureMetadata } from '../../db/entities/entities';
import axios from 'axios';

@Injectable()
export class FixturesService {
  constructor(
    @InjectRepository(Fixture)
    private readonly fixtureRepo: Repository<Fixture>,
    @InjectRepository(FixtureMetadata)
    private readonly metadataRepo: Repository<FixtureMetadata>,
  ) {}

  async findAll() {
    return this.fixtureRepo.find();
  }

  async findOne(id: number) {
    return this.fixtureRepo.findOne({ where: { id } });
  }

  async create(data: Partial<Fixture>) {
    const fixture = this.fixtureRepo.create(data);
    return this.fixtureRepo.save(fixture);
  }

  async update(id: number, data: Partial<Fixture>) {
    await this.fixtureRepo.update(id, data);
    return this.findOne(id);
  }

  async delete(id: number) {
    return this.fixtureRepo.delete(id);
  }

  async syncFromMockService() {
    try {
      const response = await axios.get('http://localhost:4000/api/fixtures');
      const remoteFixtures = response.data;

      for (const remote of remoteFixtures) {
        // Use FixtureId (External) as lookup
        let fixture = await this.fixtureRepo.findOne({ where: { FixtureId: remote.FixtureId } });
        
        if (!fixture) {
          fixture = await this.create({
            Timestamp: remote.Timestamp,
            StartTime: remote.StartTime,
            Competition: remote.Competition,
            CompetitionId: remote.CompetitionId,
            FixtureGroupId: remote.FixtureGroupId,
            Participant1Id: remote.Participant1Id,
            Participant1: remote.Participant1,
            Participant2Id: remote.Participant2Id,
            Participant2: remote.Participant2,
            FixtureId: remote.FixtureId,
            Participant1IsHome: remote.Participant1IsHome,
          });
        } else {
          // Update metadata or basic info if needed
          await this.update(fixture.id, remote);
        }

        // Ensure metadata exists and is active
        let meta = await this.metadataRepo.findOne({ where: { fixture_id: fixture.id } });
        if (!meta) {
          await this.metadataRepo.save({ fixture_id: fixture.id, active: true });
        }
      }
      return { synced: true, count: remoteFixtures.length };
    } catch (error) {
      console.error('Fixture sync failed:', error);
      throw error;
    }
  }
}

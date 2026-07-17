import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pool } from '../../db/entities/entities';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class PoolsService {
  constructor(
    @InjectRepository(Pool)
    private readonly poolRepo: Repository<Pool>,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async findAll(filter?: 'active' | 'resolved') {
    if (filter === 'active') {
      return this.poolRepo.find({ where: { acceptingBets: true } });
    }
    if (filter === 'resolved') {
      return this.poolRepo.find({ where: { acceptingBets: false } });
    }
    return this.poolRepo.find();
  }

  async findOne(id: number) {
    return this.poolRepo.findOne({ where: { id } });
  }

  async create(data: Partial<Pool>) {
    const pool = this.poolRepo.create(data);
    const savedPool = await this.poolRepo.save(pool);
    this.eventsGateway.emitPoolUpdated(savedPool);
    return savedPool;
  }

  async update(id: number, data: Partial<Pool>) {
    await this.poolRepo.update(id, data);
    const pool = await this.findOne(id);
    if (pool) this.eventsGateway.emitPoolUpdated(pool);
    return pool;
  }

  async delete(id: number) {
    return this.poolRepo.delete(id);
  }
}

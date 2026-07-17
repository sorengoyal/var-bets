import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pool } from '../../db/entities/entities';

@Injectable()
export class PoolsService {
  constructor(
    @InjectRepository(Pool)
    private readonly poolRepo: Repository<Pool>,
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
    return this.poolRepo.save(pool);
  }

  async update(id: number, data: Partial<Pool>) {
    await this.poolRepo.update(id, data);
    return this.findOne(id);
  }

  async delete(id: number) {
    return this.poolRepo.delete(id);
  }
}

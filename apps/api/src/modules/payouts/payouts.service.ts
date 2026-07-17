import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payout } from '../../db/entities/entities';

@Injectable()
export class PayoutsService {
  constructor(
    @InjectRepository(Payout)
    private readonly payoutRepo: Repository<Payout>,
  ) {}

  async findAll(wallet_address?: string) {
    if (wallet_address) {
      return this.payoutRepo.find({ where: { wallet_address } });
    }
    return this.payoutRepo.find();
  }

  async findOne(id: number) {
    return this.payoutRepo.findOne({ where: { id } });
  }

  async create(data: Partial<Payout>) {
    const payout = this.payoutRepo.create(data);
    return this.payoutRepo.save(payout);
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bet } from '../../db/entities/entities';

@Injectable()
export class BetsService {
  constructor(
    @InjectRepository(Bet)
    private readonly betRepo: Repository<Bet>,
  ) {}

  async findAll(wallet_address?: string) {
    if (wallet_address) {
      return this.betRepo.find({ where: { wallet_address } });
    }
    return this.betRepo.find();
  }

  async findOne(id: number) {
    return this.betRepo.findOne({ where: { id } });
  }

  async placeBet(data: { poolId: number; wallet_address: string; amount: number; option: string }) {
    const bet = this.betRepo.create(data);
    const savedBet = await this.betRepo.save(bet);
    
    // In a real app, we'd update the pool amount here. 
    // This will be handled in the Payout/Pool service logic later.
    return savedBet;
  }

  async delete(id: number) {
    return this.betRepo.delete(id);
  }
}

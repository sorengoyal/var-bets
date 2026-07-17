import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payout } from '../../db/entities/entities';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class PayoutsService {
  constructor(
    @InjectRepository(Payout)
    private readonly payoutRepo: Repository<Payout>,
    private readonly eventsGateway: EventsGateway,
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
    const savedPayout = await this.payoutRepo.save(payout);
    this.eventsGateway.emitPayoutExecuted(savedPayout);
    return savedPayout;
  }
}

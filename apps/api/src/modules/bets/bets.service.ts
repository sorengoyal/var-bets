import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bet, Pool } from '../../db/entities/entities';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class BetsService {
  constructor(
    @InjectRepository(Bet)
    private readonly betRepo: Repository<Bet>,
    @InjectRepository(Pool)
    private readonly poolRepo: Repository<Pool>,
    private readonly eventsGateway: EventsGateway,
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

  async placeBet(data: {
    poolId: number;
    wallet_address: string;
    amount: number;
    option: string;
  }) {
    const pool = await this.poolRepo.findOne({ where: { id: data.poolId } });
    if (!pool) throw new NotFoundException('Pool not found');
    if (!pool.acceptingBets) {
      throw new BadRequestException('Pool is no longer accepting bets');
    }

    const bet = this.betRepo.create({
      pool_id: data.poolId,
      wallet_address: data.wallet_address,
      amount: data.amount,
      option: data.option,
    });
    const savedBet = await this.betRepo.save(bet);

    await this.poolRepo.increment({ id: data.poolId }, 'amount', data.amount);
    const updatedPool = await this.poolRepo.findOne({
      where: { id: data.poolId },
    });
    if (updatedPool) this.eventsGateway.emitPoolUpdated(updatedPool);

    return savedBet;
  }

  async delete(id: number) {
    return this.betRepo.delete(id);
  }
}

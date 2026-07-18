import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BetsService } from './bets.service';
import { CreateBetDto } from './dto/create-bet.dto';

@ApiTags('bets')
@Controller('bets')
export class BetsController {
  constructor(private readonly betsService: BetsService) {}

  @Get()
  async findAll(@Query('wallet_address') wallet_address?: string) {
    return this.betsService.findAll(wallet_address);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.betsService.findOne(+id);
  }

  @Post()
  async placeBet(@Body() data: CreateBetDto) {
    return this.betsService.placeBet({
      poolId: data.poolId,
      wallet_address: data.wallet_address,
      amount: data.amount,
      option: data.option,
    });
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.betsService.delete(+id);
  }
}

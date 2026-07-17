import { Controller, Get, Post, Body, Param, Delete, Query } from '@nestjs/common';
import { BetsService } from './bets.service';

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
  async placeBet(@Body() data: any) {
    return this.betsService.placeBet(data);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.betsService.delete(+id);
  }
}

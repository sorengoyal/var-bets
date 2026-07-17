import { Controller, Get, Param, Query } from '@nestjs/common';
import { PayoutsService } from './payouts.service';

@Controller('payouts')
export class PayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  @Get()
  async findAll(@Query('wallet_address') wallet_address?: string) {
    return this.payoutsService.findAll(wallet_address);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.payoutsService.findOne(+id);
  }
}

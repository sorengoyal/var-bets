import { Controller, Post } from '@nestjs/common';
import { SimulateService } from './simulate.service';

@Controller('simulate')
export class SimulateController {
  constructor(private readonly simulateService: SimulateService) {}

  @Post('reset')
  async reset() {
    return this.simulateService.reset();
  }

  @Post('fast-forward')
  async fastForward() {
    return this.simulateService.fastForward();
  }
}

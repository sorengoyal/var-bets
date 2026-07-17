import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { FixturesService } from './fixtures.service';

@Controller('fixtures')
export class FixturesController {
  constructor(private readonly fixturesService: FixturesService) {}

  @Get()
  async findAll() {
    return this.fixturesService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.fixturesService.findOne(+id);
  }

  @Post()
  async create(@Body() data: any) {
    return this.fixturesService.create(data);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() data: any) {
    return this.fixturesService.update(+id, data);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.fixturesService.delete(+id);
  }
}

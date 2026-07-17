import { Module } from '@nestjs/common';
import { SimulateController } from './simulate.controller';
import { SimulateService } from './simulate.service';
import { SocketModule } from '../socket/socket.module';

@Module({
  imports: [SocketModule],
  controllers: [SimulateController],
  providers: [SimulateService],
})
export class SimulateModule {}

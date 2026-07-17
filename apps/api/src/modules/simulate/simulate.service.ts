import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import axios from 'axios';
import { SocketGateway } from '../socket/socket.gateway';

export interface SimulateResponse {
  currentTime: string;
}

@Injectable()
export class SimulateService {
  private readonly logger = new Logger(SimulateService.name);
  private readonly mockServiceBase = 'http://localhost:4000';

  constructor(
    private readonly dataSource: DataSource,
    private readonly socketGateway: SocketGateway,
  ) {}

  async reset(): Promise<SimulateResponse> {
    const { data } = await axios.post<SimulateResponse>(
      `${this.mockServiceBase}/simulate/reset`,
    );
    this.logger.log(`Mock clock reset to ${data.currentTime}`);

    await this.dataSource.transaction(async (manager) => {
      await manager.query('TRUNCATE bets, payouts, pools, scores CASCADE');
    });
    this.logger.log(
      'DB truncated: bets, payouts, pools, scores. Fixtures deactivated.',
    );

    this.socketGateway.broadcastSimulationReset();

    return { currentTime: data.currentTime };
  }

  async fastForward(): Promise<SimulateResponse> {
    const { data } = await axios.post<SimulateResponse>(
      `${this.mockServiceBase}/simulate/fast-forward`,
    );
    this.logger.log(`Fast-forwarded to ${data.currentTime}`);
    return { currentTime: data.currentTime };
  }
}

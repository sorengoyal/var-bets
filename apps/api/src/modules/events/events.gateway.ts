import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Payout, Pool } from '../../db/entities/entities';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3002',
  },
})
export class EventsGateway {
  @WebSocketServer()
  server!: Server;

  emitPoolUpdated(pool: Pool) {
    this.server.emit('poolUpdated', pool);
  }

  emitPayoutExecuted(payout: Payout) {
    this.server.emit('payoutExecuted', payout);
  }
}

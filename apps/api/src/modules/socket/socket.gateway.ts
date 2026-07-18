import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
  },
})
export class SocketGateway {
  @WebSocketServer()
  server!: Server;

  broadcastSimulationReset(): void {
    this.server.emit('simulationReset', {});
  }
}

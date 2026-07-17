import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';

@WebSocketGateway({ path: '/socket' })
export class SocketGateway {
  @WebSocketServer()
  server!: any;

  broadcastSimulationReset(): void {
    for (const client of this.server.clients) {
      if (client.readyState === client.OPEN) {
        client.send(JSON.stringify({ event: 'simulationReset', data: {} }));
      }
    }
  }
}

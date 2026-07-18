import type { WebSocket, WebSocketServer } from 'ws';

const clients = new Set<WebSocket>();

function broadcastCount(): void {
  const payload = JSON.stringify({ count: clients.size });
  for (const client of clients) {
    if (client.readyState === client.OPEN) {
      client.send(payload);
    }
  }
}

export function attachPresenceServer(wss: WebSocketServer): void {
  wss.on('connection', (ws) => {
    clients.add(ws);
    broadcastCount();

    ws.on('close', () => {
      clients.delete(ws);
      broadcastCount();
    });

    ws.on('error', () => {
      clients.delete(ws);
      broadcastCount();
    });
  });
}

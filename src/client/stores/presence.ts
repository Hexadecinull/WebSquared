import { writable } from 'svelte/store';

const count = writable(0);

let socket: WebSocket | undefined;
let reconnectDelay = 1000;
const MAX_RECONNECT_DELAY = 15_000;
let connected = false;

function scheduleReconnect() {
  if (connected) return;
  setTimeout(connect, reconnectDelay);
  reconnectDelay = Math.min(reconnectDelay * 1.5, MAX_RECONNECT_DELAY);
}

function connect() {
  if (typeof window === 'undefined') return;
  connected = true;

  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  try {
    socket = new WebSocket(`${proto}//${window.location.host}/w2-presence`);
  } catch {
    connected = false;
    scheduleReconnect();
    return;
  }

  socket.addEventListener('open', () => {
    reconnectDelay = 1000;
  });

  socket.addEventListener('message', (event) => {
    try {
      const data = JSON.parse(event.data as string) as { count?: number };
      if (typeof data.count === 'number') count.set(data.count);
    } catch { /* ignore malformed message */ }
  });

  socket.addEventListener('close', () => {
    connected = false;
    scheduleReconnect();
  });

  socket.addEventListener('error', () => {
    socket?.close();
  });
}

export const onlineCount = { subscribe: count.subscribe };

export function connectPresence(): void {
  if (connected) return;
  connect();
}

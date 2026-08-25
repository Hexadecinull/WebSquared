import { createServer } from 'node:http';
import { createConnection } from 'node:net';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { WebSocketServer } from 'ws';
import { handleProxy } from './proxy.js';
import { startBlocklistRefresh } from './rewrite/blocklists.js';
import { attachPresenceServer } from './presence.js';
import { PREFIX } from '../shared/url.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const WISP_PATH = '/wisp/';
const PRESENCE_PATH = '/w2-presence';
const PORT = Number(process.env.PORT ?? 3000);
const DIST_DIR = join(__dirname, '../../dist');

const FRAME_CONNECT = 0x01;
const FRAME_DATA = 0x02;
const FRAME_CONTINUE = 0x03;
const FRAME_CLOSE = 0x04;

const INITIAL_BUFFER_SIZE = 1024 * 128;

function makeFrame(type: number, streamId: number, payload: Buffer): Buffer {
  const frame = Buffer.allocUnsafe(5 + payload.length);
  frame.writeUInt8(type, 0);
  frame.writeUInt32LE(streamId, 1);
  payload.copy(frame, 5);
  return frame;
}

function attachWispServer(wss: WebSocketServer): void {
  wss.on('connection', (ws) => {
    const streams = new Map<number, ReturnType<typeof createConnection>>();

    const initialContinue = Buffer.allocUnsafe(9);
    initialContinue.writeUInt8(FRAME_CONTINUE, 0);
    initialContinue.writeUInt32LE(0, 1);
    initialContinue.writeUInt32LE(INITIAL_BUFFER_SIZE, 5);
    ws.send(initialContinue);

    ws.on('message', (raw) => {
      const data = raw instanceof Buffer ? raw : Buffer.from(raw as ArrayBuffer);
      if (data.length < 5) return;

      const type = data.readUInt8(0);
      const streamId = data.readUInt32LE(1);
      const payload = data.subarray(5);

      if (type === FRAME_CONNECT) {
        if (payload.length < 4) return;
        const streamType = payload.readUInt8(0);
        const port = payload.readUInt16BE(1);
        const hostname = payload.subarray(3).toString('utf8');

        if (streamType !== 0x01) {
          const close = Buffer.from([0x41]);
          ws.send(makeFrame(FRAME_CLOSE, streamId, close));
          return;
        }

        const socket = createConnection({ host: hostname, port });

        streams.set(streamId, socket);

        socket.on('connect', () => {
          if (ws.readyState !== 1) {
            socket.destroy();
            return;
          }
          const cont = Buffer.allocUnsafe(4);
          cont.writeUInt32LE(INITIAL_BUFFER_SIZE, 0);
          ws.send(makeFrame(FRAME_CONTINUE, streamId, cont));
        });

        socket.on('data', (chunk: Buffer | string) => {
          if (ws.readyState !== 1) return;
          // Always a Buffer in practice since we never call socket.setEncoding(), but the Socket type allows string too.
          const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
          ws.send(makeFrame(FRAME_DATA, streamId, buf));
        });

        socket.on('close', () => {
          if (ws.readyState !== 1) return;
          ws.send(makeFrame(FRAME_CLOSE, streamId, Buffer.from([0x01])));
          streams.delete(streamId);
        });

        socket.on('error', () => {
          if (ws.readyState !== 1) return;
          ws.send(makeFrame(FRAME_CLOSE, streamId, Buffer.from([0x03])));
          streams.delete(streamId);
        });

        return;
      }

      if (type === FRAME_DATA) {
        streams.get(streamId)?.write(payload);
        return;
      }

      if (type === FRAME_CLOSE) {
        const socket = streams.get(streamId);
        if (socket) {
          socket.destroy();
          streams.delete(streamId);
        }
        return;
      }
    });

    ws.on('close', () => {
      for (const socket of streams.values()) {
        socket.destroy();
      }
      streams.clear();
    });

    ws.on('error', () => {
      for (const socket of streams.values()) {
        socket.destroy();
      }
      streams.clear();
    });
  });
}

const app = express();

app.use(express.static(DIST_DIR));

app.get('/healthz', (_req, res) => res.sendStatus(200));

// Generous, since a single page load fans out into dozens of legitimate sub-resource requests through /w2/; this is meant to catch abuse, not normal browsing.
const proxyRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter than the proxy limit above: the SPA shell only ever serves the same static index.html, but still does a filesystem read per request, and a real client only needs it once per session.
const shellRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

// Needed so req.body is populated with the exact raw bytes for any content-type, so POST/PUT/PATCH bodies pass through unchanged.
app.use(PREFIX, express.raw({ type: '*/*', limit: '50mb' }));

app.use(PREFIX, proxyRateLimit, (req, res, next) => {
  handleProxy(req, res).catch(next);
});

// A path-less middleware, not app.get('*', ...), since Express 5's path-to-regexp requires wildcard routes to be named (e.g. '/*splat'), so a bare '*' throws at startup; this form always matches with no path-pattern parsing at all.
app.use(shellRateLimit, (_req, res) => {
  res.sendFile(join(DIST_DIR, 'index.html'));
});

const server = createServer(app);

const wss = new WebSocketServer({ noServer: true });
attachWispServer(wss);

const presenceWss = new WebSocketServer({ noServer: true });
attachPresenceServer(presenceWss);

server.on('upgrade', (req, socket, head) => {
  if (req.url?.startsWith(WISP_PATH)) {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  } else if (req.url?.startsWith(PRESENCE_PATH)) {
    presenceWss.handleUpgrade(req, socket, head, (ws) => {
      presenceWss.emit('connection', ws, req);
    });
  } else {
    socket.destroy();
  }
});

server.listen(PORT, () => {
  console.log(`WebSquared listening on http://localhost:${PORT}`);
  startBlocklistRefresh();
});

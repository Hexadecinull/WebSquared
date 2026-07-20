import { createServer } from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { execFile } from 'node:child_process';

const PORT = process.env.DEPLOY_WEBHOOK_PORT || 9000;
const SECRET = process.env.DEPLOY_WEBHOOK_SECRET;
const REPO_DIR = process.env.DEPLOY_REPO_DIR || process.cwd();
const BRANCH = process.env.DEPLOY_BRANCH || 'main';
const PM2_APP_NAME = process.env.DEPLOY_PM2_APP || 'websquared';

if (!SECRET) {
  console.error('[deploy] DEPLOY_WEBHOOK_SECRET is not set (check your .env file). Refusing to start.');
  process.exit(1);
}

function verifySignature(payload, signatureHeader) {
  if (!signatureHeader) return false;
  const expected = 'sha256=' + createHmac('sha256', SECRET).update(payload).digest('hex');
  const expectedBuf = Buffer.from(expected);
  const givenBuf = Buffer.from(signatureHeader);
  if (expectedBuf.length !== givenBuf.length) return false;
  return timingSafeEqual(expectedBuf, givenBuf);
}

let deploying = false;

function runDeploy() {
  if (deploying) {
    console.log('[deploy] A deploy is already running — this push will be picked up by the next one.');
    return;
  }
  deploying = true;
  console.log(`[deploy] Starting deploy of ${BRANCH}...`);

  // Hard reset (not pull) so the server always matches origin exactly.
  // The && chain means a failed build stops before pm2 restart runs.
  const cmd = [
    `cd "${REPO_DIR}"`,
    `git fetch origin ${BRANCH}`,
    `git reset --hard origin/${BRANCH}`,
    'npm ci',
    'npm run build',
    `pm2 restart ${PM2_APP_NAME}`,
  ].join(' && ');

  execFile('bash', ['-c', cmd], { maxBuffer: 1024 * 1024 * 20 }, (err, stdout, stderr) => {
    deploying = false;
    if (err) {
      console.error('[deploy] FAILED:', err.message);
      if (stderr) console.error(stderr);
      return;
    }
    console.log('[deploy] Success.');
    if (stdout) console.log(stdout);
  });
}

const server = createServer((req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(405).end('Method Not Allowed');
    return;
  }

  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    const raw = Buffer.concat(chunks);
    const signature = req.headers['x-hub-signature-256'];

    if (!verifySignature(raw, signature)) {
      console.warn('[deploy] Rejected a request with an invalid or missing signature.');
      res.writeHead(401).end('Invalid signature');
      return;
    }

    const event = req.headers['x-github-event'];

    if (event === 'ping') {
      res.writeHead(200).end('pong');
      return;
    }

    if (event !== 'push') {
      res.writeHead(200).end(`Ignored (event: ${event})`);
      return;
    }

    let payload;
    try {
      payload = JSON.parse(raw.toString('utf8'));
    } catch {
      res.writeHead(400).end('Invalid JSON payload');
      return;
    }

    if (payload.ref !== `refs/heads/${BRANCH}`) {
      res.writeHead(200).end(`Ignored (push to ${payload.ref}, not refs/heads/${BRANCH})`);
      return;
    }

    res.writeHead(200).end('Deploy triggered');
    runDeploy();
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[deploy] Webhook listener on http://127.0.0.1:${PORT} (only reachable via the Cloudflare Tunnel)`);
});

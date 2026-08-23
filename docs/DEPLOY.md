# Self-hosting WebSquared

This guide covers running WebSquared on your own server, a VPS, a home
server, whatever you've got. It needs a real Node.js process running
continuously (not static hosting, not serverless functions), because it
proxies live traffic and runs a WebSocket server.

Replace `yourdomain.com` and `/opt/websquared` throughout with your own
domain and install path.

---

## Requirements

- A Linux server you can SSH into
- Node.js **20 or newer** (Node 22/24 work fine too)
- A domain name pointed at your server

## 1. Install Node.js and PM2

If you don't already have Node.js:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

[PM2](https://pm2.keymetrics.io/) keeps the app running, restarts it if it
crashes, and starts it automatically on reboot:

```bash
sudo npm install -g pm2
```

## 2. Get the code

```bash
sudo mkdir -p /opt/websquared
sudo chown $USER:$USER /opt/websquared
git clone https://github.com/Hexadecinull/WebSquared /opt/websquared
cd /opt/websquared
```

**Don't run `npm` or `git` with `sudo`** past this point. It leaves files
owned by `root` and breaks future commands run as your normal user. If you
ever do this by accident, fix it with:
```bash
sudo chown -R $USER:$USER /opt/websquared
```

## 3. Install dependencies and build

```bash
npm ci
npm run build
```

This runs three steps: builds the Svelte frontend (Vite), bundles the two
worker scripts as standalone files (esbuild), then compiles the backend
(TypeScript). All three need to succeed, if `npm run build` errors, don't
continue until it's clean.

## 4. Start it with PM2

The included `ecosystem.config.cjs` runs WebSquared on port `3003` by
default, change the `PORT` value in that file first if you'd rather use
a different port.

```bash
pm2 start ecosystem.config.cjs --only websquared
pm2 save
pm2 startup   # run the command it prints, once, to enable auto-start on boot
```

Confirm it's alive:
```bash
pm2 status
curl http://localhost:3003/healthz   # should print "OK"
```

## 5. Make it reachable from the internet

Pick whichever of these fits your setup. **Cloudflare Tunnel** is the easier
option if your domain's DNS is already on Cloudflare, no ports to open, no
certificates to manage. If you'd rather run a traditional reverse proxy,
use the **nginx + Let's Encrypt** option instead.

### Option A, Cloudflare Tunnel (recommended)

```bash
curl -L https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg > /dev/null
echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main" | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update && sudo apt install cloudflared -y

cloudflared tunnel login
cloudflared tunnel create websquared
cloudflared tunnel route dns websquared yourdomain.com
```

Create `~/.cloudflared/config.yml`:
```yaml
tunnel: websquared
credentials-file: /root/.cloudflared/<TUNNEL-ID>.json

ingress:
  - hostname: yourdomain.com
    service: http://localhost:3003
  - service: http_status:404
```
(`<TUNNEL-ID>` is printed by `cloudflared tunnel list`.)

Run it as a service:
```bash
sudo cloudflared service install
sudo systemctl enable --now cloudflared
```

In the Cloudflare dashboard, set the DNS record for your domain to
**Proxied** (orange cloud) and set SSL/TLS mode to **Full**. No firewall
rules or port forwarding are needed, the tunnel makes an outbound
connection from your server, so nothing needs to be opened on your router.

### Option B, nginx + Let's Encrypt

```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

Create `/etc/nginx/sites-available/websquared`:
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass         http://127.0.0.1:3003;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/websquared /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo ufw allow 80 && sudo ufw allow 443   # if ufw is active
sudo certbot --nginx -d yourdomain.com
```

Certbot edits the config in place to add the HTTPS block and cert paths,
no manual editing needed.

## 6. Optional: auto-deploy on push

If you'd rather not manually rebuild and restart after every commit,
`scripts/deploy-webhook.mjs` is a small listener that lets GitHub trigger
a deploy automatically.

Generate a secret and set it up:
```bash
cd /opt/websquared
openssl rand -hex 32
cp .env.example .env
nano .env    # paste the generated value into DEPLOY_WEBHOOK_SECRET=
```

Start the webhook listener alongside the main app:
```bash
pm2 start ecosystem.config.cjs
pm2 save
```

Expose it through whichever routing option you chose in step 5, the
listener runs on `localhost:9000` (only bound to localhost) and needs to be
reachable at a specific path, e.g. `/_deploy-hook`, without interfering
with the main app's catch-all route.

**Cloudflare Tunnel:** add this rule to `config.yml` *above* the main
hostname rule (path-matched rules must come before the catch-all, first
match wins):
```yaml
  - hostname: yourdomain.com
    path: ^/_deploy-hook$
    service: http://localhost:9000
```
Then `sudo systemctl restart cloudflared`.

**nginx:** add a `location` block above the main one:
```nginx
    location = /_deploy-hook {
        proxy_pass http://127.0.0.1:9000;
        proxy_set_header Host $host;
    }
```
Then `sudo nginx -t && sudo systemctl reload nginx`.

**On GitHub:** repo → Settings → Webhooks → Add webhook:
- Payload URL: `https://yourdomain.com/_deploy-hook`
- Content type: `application/json`
- Secret: the same value from your `.env`
- Events: **Just the push event**

GitHub sends a `ping` immediately on save, check **Recent Deliveries** for
a `200` response. From then on, every push to `main` runs:
```
git fetch → git reset --hard origin/main → npm ci → npm run build → pm2 restart websquared
```
If the build fails at any step, the chain stops there and the
currently-running (last good) version is left untouched.

## 7. Manual deploy / updating

If you don't set up the webhook, or just want to deploy on demand:
```bash
cd /opt/websquared
git pull
npm ci
npm run build
pm2 restart websquared
```

---

## Troubleshooting

- **`pm2 status` shows `errored` with 0b memory and rising restart count**: the process is crashing on startup. Run it directly to see the real
  error: `node dist-server/server/index.js` (or, for the webhook,
  `node --env-file=.env scripts/deploy-webhook.mjs`).
- **PM2 apps show `cluster` mode instead of `fork`**: delete and restart
  them fresh; PM2 doesn't apply `exec_mode` changes to an already-running
  process via `restart` alone: `pm2 delete websquared && pm2 start ecosystem.config.cjs`.
- **`git pull` refuses with "local changes would be overwritten"**: something
  was edited directly on the server without being committed. Either commit
  it (`git add . && git commit`) or discard it (`git checkout -- <file>`)
  before pulling.

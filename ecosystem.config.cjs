const path = require('node:path');

// __dirname resolves to wherever this repo is actually cloned, so this file works regardless of the path you deploy to, no editing required.
const REPO_DIR = __dirname;

module.exports = {
  apps: [
    {
      name: 'websquared',
      script: 'dist-server/server/index.js',
      cwd: REPO_DIR,
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        // Change this if you want WebSquared on a different port; just make sure your reverse proxy/tunnel config points at the same number.
        PORT: 3003,
        // Your real public domain(s), comma-separated. Used only to detect
        // "the proxy is being asked to proxy itself" reliably; without
        // this, that check falls back to the incoming Host header, which a
        // reverse proxy or tunnel in front of this process can rewrite or
        // drop before it ever reaches Node. Set this to whatever domain(s)
        // you actually put in front of WebSquared (see DEPLOY.md).
        PUBLIC_HOSTNAMES: 'websquared.example.com',
      },
    },
    {
      // Optional: only needed for the GitHub auto-deploy webhook (see DEPLOY.md); safe to remove this whole block if you'd rather deploy manually.
      name: 'websquared-deploy-webhook',
      script: path.join(REPO_DIR, 'scripts/deploy-webhook.mjs'),
      cwd: REPO_DIR,
      node_args: '--env-file=.env',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
    },
  ],
};

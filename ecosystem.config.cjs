module.exports = {
  apps: [
    {
      name: 'websquared',
      script: 'dist-server/server/index.js',
      cwd: '/var/www/websquared',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3003,
      },
    },
    {
      // Listens for GitHub's push webhook (through the Cloudflare Tunnel)
      // and runs git pull + build + restart automatically. Secrets are
      // loaded from .env (gitignored, never touched by the deploy's own
      // `git reset --hard`) via Node's built-in --env-file flag.
      name: 'websquared-deploy-webhook',
      script: 'scripts/deploy-webhook.mjs',
      cwd: '/var/www/websquared',
      node_args: '--env-file=.env',
      instances: 1,
      autorestart: true,
      watch: false,
    },
  ],
};

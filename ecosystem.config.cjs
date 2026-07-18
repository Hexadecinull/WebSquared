module.exports = {
  apps: [
    {
      name: 'websquared',
      script: 'dist-server/server/index.js',
      cwd: '/var/www/websquared',
      exec_mode: 'fork',
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
      name: 'websquared-deploy-webhook',
      script: 'scripts/deploy-webhook.mjs',
      cwd: '/var/www/websquared',
      node_args: '--env-file=.env',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
    },
  ],
};

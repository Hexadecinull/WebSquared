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
  ],
};

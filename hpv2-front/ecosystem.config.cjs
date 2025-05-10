module.exports = {
  apps: [
    {
      name: 'hpv2-front-dev',
      script: 'npm',
      args: 'run dev',
      watch: false,
      env: {
        NODE_ENV: 'development',
      },
    }
  ],
}; 
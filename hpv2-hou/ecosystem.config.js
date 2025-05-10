module.exports = {
  apps: [{
    name: 'hpv2-hou',
    script: 'src/app.js',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'development',
      PORT: 6016
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 6016
    },
    error_file: 'logs/err.log',
    out_file: 'logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss'
  }]
};

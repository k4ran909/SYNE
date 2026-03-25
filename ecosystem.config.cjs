module.exports = {
  apps: [{
    name: 'syne-bot',
    script: 'src/shard.ts',
    interpreter: 'npx',
    interpreter_args: 'tsx',
    instances: 1,              // Shard manager handles parallelism internally
    max_memory_restart: '500M',
    watch: false,
    autorestart: true,
    max_restarts: 10,
    restart_delay: 5000,
    env: {
      NODE_ENV: 'production'
    },
    env_development: {
      NODE_ENV: 'development'
    },
    error_file: './logs/error.log',
    out_file: './logs/output.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true
  }]
};

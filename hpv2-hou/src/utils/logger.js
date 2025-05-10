const fs = require('fs');
const winston = require('winston');
const DailyRotate = require('winston-daily-rotate-file');
const path = require('path');

// 日志目录配置
const logDir = path.join(__dirname, '../logs');

// 确保日志目录存在
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logger = winston.createLogger({
  levels: winston.config.syslog.levels,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.json()
  ),
  transports: [
    new DailyRotate({
      filename: path.join(logDir, 'application-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
      createSymlink: true,
      symlinkName: 'application.log',
      auditFile: path.join(logDir, '.audit.json')
    }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ],
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'exceptions.log')
    })
  ]
});

// 保持原有console输出
console.log = (...args) => logger.info(...args);
console.error = (...args) => logger.error(...args);
console.warn = (...args) => logger.warning(...args);

// 添加warn作为warning的别名，保证兼容性
logger.warn = logger.warning;

module.exports = logger;

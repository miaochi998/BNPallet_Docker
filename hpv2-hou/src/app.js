const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const logger = require('./utils/logger');
const { v4: uuidv4 } = require('uuid');
const dbService = require('./services/db'); // 导入数据库服务

// 确保日志目录存在
if (!fs.existsSync(path.join(__dirname, 'logs'))) {
  fs.mkdirSync(path.join(__dirname, 'logs'));
}
const { PORT } = require('./config/env');
const routes = require('./routes');
const { responseHandler } = require('./middlewares/response');

// 创建Express应用
const app = express();

// 数据库连接池监控
const DB_MONITOR_INTERVAL = 60000; // 监控间隔 (60秒)
setInterval(() => {
  try {
    const poolStatus = dbService.getPoolStatus();
    
    logger.info('数据库连接池状态', {
      ...poolStatus,
      timestamp: new Date().toISOString()
    });
    
    // 检测连接池异常情况
    if (poolStatus.waitingCount > 5) {
      logger.warning('连接池等待队列过长', poolStatus);
    }
    
    if (poolStatus.idleCount === 0 && poolStatus.totalCount > 10) {
      logger.warning('连接池无空闲连接', poolStatus);
    }
  } catch (error) {
    logger.error('数据库连接池监控错误', {
      error: error.message,
      stack: error.stack
    });
  }
}, DB_MONITOR_INTERVAL);

// 应用中间件
app.use(helmet({
  crossOriginResourcePolicy: false,
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false,
})); // 安全头，但禁用可能影响图片跨域访问的策略

// 读取环境变量中的允许域名，如果未设置，则使用默认值
const defaultAllowedOrigins = [
  'http://localhost:6017',
  'http://127.0.0.1:6017'
];

// 从环境变量或配置文件中获取额外的允许域名
const extraAllowedOrigins = process.env.ALLOWED_ORIGINS ? 
  process.env.ALLOWED_ORIGINS.split(',') : [];

// 合并所有允许的域名
const allowedOrigins = [...defaultAllowedOrigins, ...extraAllowedOrigins];

// 配置CORS选项
const corsOptions = {
  origin: (origin, callback) => {
    // 允许没有来源的请求（如Postman或curl）或在允许列表中的域名
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log(`拒绝CORS请求: ${origin}`);
      
      // 开发环境下记录被拒绝的域名，但仍然允许请求
      if (process.env.NODE_ENV !== 'production') {
        console.log('开发环境下允许未知来源请求');
        callback(null, true);
      } else {
        // 生产环境也允许任何来源请求，以确保图片加载
        console.log('生产环境也允许未知来源请求:', origin);
        callback(null, true);
      }
    }
  },
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
  optionsSuccessStatus: 204,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Cache-Control', 'Pragma', 'Expires', 'X-Random'],
  exposedHeaders: ['Content-Length', 'Content-Type']
};

app.use(cors(corsOptions)); // 使用配置后的CORS

app.use(express.json()); // JSON解析
app.use(express.urlencoded({ extended: true })); // 表单数据解析
app.use(responseHandler); // 统一响应处理 - 移到JSON解析后
// 增强版请求日志中间件（带参数摘要）
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    // 参数脱敏处理
    const safeParams = {};
    if (req.body) {
      Object.keys(req.body).forEach(key => {
        if (key.toLowerCase().includes('password')) {
          safeParams[key] = '******';
        } else {
          safeParams[key] = typeof req.body[key] === 'string'
            ? req.body[key].substring(0, 50)
            : req.body[key];
        }
      });
    }

    // 关键操作标记
    const isCritical = [
      '/login', '/logout',
      '/payment', '/user/update'
    ].includes(req.path);

    logger.info({
      message: isCritical ? '关键操作' : 'API请求',
      method: req.method,
      path: req.path,
      ip: req.ip,
      status: res.statusCode,
      duration: `${Date.now() - start}ms`,
      userId: req.user?.id,
      is_admin: req.user?.is_admin || false,
      params: Object.keys(safeParams).length ? safeParams : undefined
    });
  });

  next();
});

// 静态文件服务 - 添加CORS头部
app.use('/uploads', (req, res, next) => {
  // 完全禁用跨域资源保护策略，允许任何网站加载这些资源
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.header('Access-Control-Allow-Headers', '*');
  
  // 明确禁用所有可能阻止跨域资源共享的安全策略
  res.removeHeader('Cross-Origin-Resource-Policy');
  res.removeHeader('Cross-Origin-Embedder-Policy');
  
  // 禁用内容安全策略头
  res.removeHeader('Content-Security-Policy');
  res.removeHeader('X-Content-Security-Policy');
  
  // 处理预检请求
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  
  next();
}, express.static(path.join(__dirname, 'uploads')));

// 请求ID中间件
app.use((req, res, next) => {
  req.id = uuidv4();
  next();
});

// API执行时间计算中间件
app.use((req, res, next) => {
  req._startTime = Date.now();
  
  // 在响应结束时计算耗时
  res.on('finish', () => {
    const duration = Date.now() - req._startTime;
    
    // 记录慢API (>500ms)
    if (duration > 500) {
      logger.warning('慢API请求检测', {
        method: req.method,
        path: req.path,
        duration: `${duration}ms`,
        query: req.query,
        userId: req.user?.id,
        ip: req.ip,
        requestId: req.id
      });
    }
  });
  
  next();
});

// 应用API路由
app.use('/api', routes);
app.use('/health', routes); // 添加健康检查路由

// 404处理
app.use((req, res) => {
  res.status(404).json({
    code: 404,
    success: false,
    message: '请求的资源不存在'
  });
});

// 增强版错误处理中间件
app.use((err, req, res, next) => {
  logger.error('服务器错误', {
    message: err.message,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    path: req.path,
    method: req.method,
    userId: req.user?.id || null
  });
  
  res.status(500).json({
    code: 500,
    success: false,
    message: '服务器内部错误',
    requestId: req.id
  });
});

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
  console.log(`服务器已启动，监听端口: ${PORT}`);
  console.log(`API地址: http://localhost:${PORT}/api`);
});

module.exports = app;

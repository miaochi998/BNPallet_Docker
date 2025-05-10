require('dotenv').config();

module.exports = {
  // 应用配置
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || 6016,
  
  // 数据库配置
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: process.env.DB_PORT || 5432,
  DB_NAME: process.env.DB_NAME || 'huopan2',
  DB_USER: process.env.DB_USER || 'postgres',
  DB_PASSWORD: process.env.DB_PASSWORD || '',
  
  // JWT配置
  JWT_SECRET: process.env.JWT_SECRET || 'hpv2-hou-secret-key-2025',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '30d',
  
  // 文件上传配置
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || 20) * 1024 * 1024, // 默认20MB
  MAX_ZIP_SIZE: parseInt(process.env.MAX_ZIP_SIZE || 500) * 1024 * 1024   // 默认500MB
};

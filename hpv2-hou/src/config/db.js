const { Pool } = require('pg');
const {
  DB_HOST,
  DB_PORT,
  DB_NAME,
  DB_USER,
  DB_PASSWORD
} = require('./env');

// 创建数据库连接池
const pool = new Pool({
  host: DB_HOST,
  port: DB_PORT,
  database: DB_NAME,
  user: DB_USER,
  password: DB_PASSWORD,
  // 最大连接数
  max: 20,
  // 连接空闲超时（毫秒）
  idleTimeoutMillis: 30000,
  // 连接超时（毫秒）
  connectionTimeoutMillis: 2000,
});

// 测试数据库连接
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('数据库连接失败:', err);
  } else {
    console.log('数据库连接成功，当前时间:', res.rows[0].now);
  }
});

// 处理连接池错误
pool.on('error', (err) => {
  console.error('数据库连接池异常:', err);
});

module.exports = pool;

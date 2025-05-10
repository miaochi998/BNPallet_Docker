/**
 * 数据库服务层
 * 统一管理数据库连接和查询
 */

const pool = require('../config/db');
const logger = require('../utils/logger');

// 慢查询阈值（毫秒）
const SLOW_QUERY_THRESHOLD = 500;

/**
 * 执行数据库查询
 * @param {string} text - SQL查询语句
 * @param {Array} params - 查询参数
 * @param {string} source - 调用来源（用于日志记录）
 * @returns {Promise<Object>} 查询结果
 */
async function query(text, params, source = 'unknown') {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    // 记录慢查询
    if (duration > SLOW_QUERY_THRESHOLD) {
      logger.warning({
        message: 'Slow query detected',
        query: text,
        params,
        duration,
        source,
        rows: result.rowCount
      });
    }
    
    // 调试日志
    logger.debug({
      message: 'Query executed',
      source,
      duration,
      rows: result.rowCount
    });
    
    return result;
  } catch (error) {
    logger.error({
      message: 'Database query error',
      query: text,
      params,
      error: error.message,
      source
    });
    throw error;
  }
}

/**
 * 执行事务
 * @param {Function} callback - 事务回调函数，接收client参数
 * @param {string} source - 调用来源（用于日志记录）
 * @returns {Promise<any>} 事务执行结果
 */
async function executeTransaction(callback, source = 'unknown') {
  const client = await pool.connect();
  const start = Date.now();
  
  try {
    await client.query('BEGIN');
    logger.debug({
      message: 'Transaction started',
      source
    });
    
    const result = await callback(client);
    
    await client.query('COMMIT');
    const duration = Date.now() - start;
    logger.debug({
      message: 'Transaction committed',
      source,
      duration
    });
    
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error({
      message: 'Transaction rolled back',
      error: error.message,
      source
    });
    throw error;
  } finally {
    client.release();
    logger.debug({
      message: 'Database client released',
      source
    });
  }
}

/**
 * 批量执行多个查询（在单个事务中）
 * @param {Array<Object>} queries - 查询对象数组，每个对象包含 {text, params}
 * @param {string} source - 调用来源（用于日志记录）
 * @returns {Promise<Array>} 查询结果数组
 */
async function batchQuery(queries, source = 'unknown') {
  return executeTransaction(async (client) => {
    const results = [];
    for (const [index, query] of queries.entries()) {
      const { text, params } = query;
      const start = Date.now();
      
      try {
        const result = await client.query(text, params);
        const duration = Date.now() - start;
        
        if (duration > SLOW_QUERY_THRESHOLD) {
          logger.warning({
            message: 'Slow query in batch',
            query: text,
            params,
            duration,
            index,
            source
          });
        }
        
        results.push(result);
      } catch (error) {
        logger.error({
          message: 'Error in batch query',
          query: text,
          params,
          index,
          error: error.message,
          source
        });
        throw error;
      }
    }
    
    return results;
  }, source);
}

/**
 * 获取连接池状态
 * @returns {Object} 连接池状态信息
 */
function getPoolStatus() {
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
    maxConnections: pool.options.max
  };
}

/**
 * 检查连接池健康状态
 * @returns {Object} 健康状态评估
 */
function checkPoolHealth() {
  const status = getPoolStatus();
  const utilization = (status.totalCount - status.idleCount) / status.maxConnections;
  
  return {
    status,
    utilization: parseFloat(utilization.toFixed(2)),
    isHealthy: status.waitingCount === 0 && status.idleCount > 0,
    warning: status.waitingCount > 0 ? '存在等待连接的查询' : null,
    critical: status.idleCount === 0 ? '无空闲连接可用' : null
  };
}

module.exports = {
  query,
  executeTransaction,
  batchQuery,
  getPoolStatus,
  checkPoolHealth
}; 
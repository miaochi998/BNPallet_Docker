const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

/**
 * 通用验证异常处理中间件
 * 统一处理express-validator的验证结果
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 * @param {Function} next - 下一个中间件函数
 */
const validationHandler = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const firstError = errors.array()[0];
    
    // 记录验证错误日志
    logger.info('请求参数验证失败', {
      path: req.path,
      method: req.method,
      error: firstError,
      userId: req.user?.id,
      ip: req.ip,
      params: req.params,
      query: req.query,
      body: req.body ? Object.keys(req.body) : [] // 只记录参数名，不记录具体值，并且检查req.body是否存在
    });
    
    return res.error(firstError.msg, 400);
  }
  
  next();
};

module.exports = validationHandler; 
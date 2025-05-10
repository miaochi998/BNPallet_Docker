const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');
const { isTokenBlacklisted } = require('../routes/auth/logout');
const logger = require('../utils/logger');

/**
 * JWT认证中间件
 * 验证请求头中的Authorization token
 * 格式: Authorization: Bearer [token]
 */
const jwtAuth = (req, res, next) => {
  // 获取请求头中的Authorization
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    logger.warning('未提供认证令牌', { path: req.path, method: req.method, ip: req.ip });
    return res.error('未提供认证令牌', 401);
  }

  // 检查格式是否为 Bearer [token]
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    logger.warning('认证令牌格式错误', { path: req.path, method: req.method, format: authHeader, ip: req.ip });
    return res.error('认证令牌格式错误', 401);
  }

  const token = parts[1];

  // 检查令牌是否在黑名单中
  if (isTokenBlacklisted(token)) {
    logger.warning('令牌已被撤销', { path: req.path, method: req.method, ip: req.ip });
    return res.error('令牌已失效', 401);
  }

  try {
    // 验证token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // 将解码后的用户信息存储到请求对象中
    req.user = decoded;
    
    // 记录认证成功的日志
    logger.debug('认证成功', { 
      path: req.path, 
      method: req.method, 
      userId: decoded.id,
      is_admin: decoded.is_admin,
      ip: req.ip 
    });
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      logger.warning('认证令牌已过期', { 
        path: req.path, 
        method: req.method, 
        error: error.message,
        ip: req.ip 
      });
      return res.error('认证令牌已过期', 401);
    }
    
    logger.error('无效的认证令牌', {
      path: req.path, 
      method: req.method, 
      error: error.message,
      ip: req.ip 
    });
    
    return res.error('无效的认证令牌', 401);
  }
};

module.exports = {
  jwtAuth
};

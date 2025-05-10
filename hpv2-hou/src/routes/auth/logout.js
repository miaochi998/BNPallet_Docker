const { createHash } = require('crypto');
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../../config/env');
const { responseHandler } = require('../../middlewares/response');
const logger = require('../../utils/logger');

// 令牌黑名单存储（生产环境应使用Redis）
const tokenBlacklist = new Set();

/**
 * 用户登出
 * 将当前令牌加入黑名单
 */
router.post('/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    logger.warning('登出失败: 未提供令牌', {
      ip: req.ip,
      path: '/logout'
    });
    return res.error('未提供认证令牌', 400);
  }

  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // 将令牌加入黑名单
    tokenBlacklist.add(token);
    logger.info('令牌加入黑名单', {
      tokenId: createHash('sha256').update(token).digest('hex').substring(0,8),
      userId: decoded.id
    });

    logger.info('关键操作: 用户登出', {
      ip: req.ip,
      method: 'POST',
      path: '/logout',
      userId: decoded.id,
      username: decoded.username
    });

    res.success({
      message: '登出成功',
      userId: decoded.id
    });
  } catch (error) {
    logger.error('登出异常', {
      error: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
      path: '/logout'
    });
    
    if (error.name === 'TokenExpiredError') {
      return res.error('令牌已过期', 400);
    }
    return res.error('无效的令牌', 400);
  }
});

/**
 * 检查令牌是否在黑名单中
 * 供中间件使用
 */
const isTokenBlacklisted = (token) => {
  return tokenBlacklist.has(token);
};

module.exports = {
  router,
  isTokenBlacklisted
};
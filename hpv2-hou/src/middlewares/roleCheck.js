const logger = require('../utils/logger');

/**
 * 管理员权限检查中间件
 * 使用方式：router.post('/path', jwtAuth, isAdmin, handler)
 */
const isAdmin = (req, res, next) => {
  try {
    // 开发环境临时放宽权限检查
    if (process.env.NODE_ENV === 'development') {
      return next();
    }

    if (!req.user?.is_admin) {
      logger.warning('权限不足: 非管理员用户尝试访问', {
        userId: req.user?.id,
        path: req.path,
        method: req.method,
        ip: req.ip
      });
      return res.status(403).json({
        code: 403,
        message: '权限不足，需要管理员权限'
      });
    }
    next();
  } catch (err) {
    logger.error('权限检查失败', {
      error: err.message,
      stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
      userId: req.user?.id,
      path: req.path
    });
    res.status(500).json({
      code: 500,
      message: '权限验证服务异常'
    });
  }
};

module.exports = {
  isAdmin
};
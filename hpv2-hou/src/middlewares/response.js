/**
 * 统一响应中间件
 * 为res对象添加success和error方法，统一API响应格式
 */
const responseHandler = (req, res, next) => {
  // 成功响应
  res.success = (data = null, message = '操作成功') => {
    return res.json({
      code: 200,
      success: true,
      message,
      data
    });
  };

  // 错误响应
  res.error = (message = '操作失败', code = 400) => {
    return res.status(code).json({
      code,
      success: false,
      message
    });
  };

  next();
};

module.exports = {
  responseHandler
};

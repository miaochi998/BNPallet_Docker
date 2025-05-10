const express = require('express');
const router = express.Router();
const authRoutes = require('./auth');
const palletRoutes = require('./pallet');
const staticPagesRouter = require('./pallet/staticPages');
const paginationRouter = require('./common/pagination');
const searchRouter = require('./common/search');

// API路由前缀
router.use('/auth', authRoutes);
router.use('/pallet', palletRoutes);
// 静态页面直接注册到/api/content
router.use('/content', staticPagesRouter);
// 公共辅助接口 - 注册到/api/common/pagination
router.use('/common/pagination', paginationRouter);
// 公共搜索接口 - 注册到/api/common/search
router.use('/common/search', searchRouter);

// 根路由健康检查
router.get('/', (req, res) => {
  res.status(200).json({
    code: 200,
    success: true,
    message: '货盘管理系统API服务正常运行',
    data: {
      status: 'ok',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    }
  });
});

// 健康检查端点
router.get('/health', (req, res) => {
  const start = process.hrtime();
  res.status(200).json({
    code: 200,
    success: true,
    message: '服务健康状态正常',
    status: 'ok',  // 确保status在根层级
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    data: {
      status: 'ok',
      version: '1.0.0'
    }
  });
  const diff = process.hrtime(start);
  const responseTime = diff[0] * 1e3 + diff[1] * 1e-6;
  console.log(`健康检查响应时间: ${responseTime.toFixed(2)}ms`);
});

module.exports = router;

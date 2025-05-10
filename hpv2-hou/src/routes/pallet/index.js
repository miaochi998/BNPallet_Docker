const express = require('express');
const router = express.Router();
const attachmentsRouter = require('./attachments');
const staticPagesRouter = require('./staticPages');
const brandsRouter = require('./brands');
const productsRouter = require('./products');
const priceTiersRouter = require('./price_tiers');
const recycleRouter = require('./recycle');
const shareRouter = require('./share');
const statsRouter = require('./stats');
const dashboardRouter = require('./dashboard');
const { responseHandler } = require('../../middlewares/response');

// 应用响应处理中间件
router.use(responseHandler);

// 注册附件上传路由
router.use('/attachments', attachmentsRouter);

// 注册品牌管理路由
router.use('/brands', brandsRouter);

// 注册产品管理路由
router.use('/products', productsRouter);

// 注册价格档位管理路由
router.use('/price_tiers', priceTiersRouter);

// 注册回收站路由
router.use('/recycle', recycleRouter);

// 注册分享路由
router.use('/share', shareRouter);

// 注册访问统计路由
router.use('/stats', statsRouter);

// 注册仪表盘路由
router.use('/dashboard', dashboardRouter);

// 注册静态页面路由
router.use('/', staticPagesRouter);

module.exports = router;
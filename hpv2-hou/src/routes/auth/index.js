const express = require('express');
const router = express.Router();
const loginRouter = require('./login');
const refreshRouter = require('./refresh');
const registerRouter = require('./register');
const logoutRouter = require('./logout').router;
const profileRouter = require('./profile');
const userManagementRouter = require('./user_management');
const { responseHandler } = require('../../middlewares/response');
const { jwtAuth } = require('../../middlewares/jwtAuth');
const { isAdmin } = require('../../middlewares/roleCheck');

// 应用响应处理中间件
router.use(responseHandler);

// 不需要认证的路由
router.use(loginRouter);
router.use(refreshRouter);
router.use(registerRouter);

// 需要认证的路由
router.use(jwtAuth);
router.use(logoutRouter);
router.use(profileRouter);

// 用户管理路由（管理员权限）
router.use('/users', isAdmin, userManagementRouter);

module.exports = router;

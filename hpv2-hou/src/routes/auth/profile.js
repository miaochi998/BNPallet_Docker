const express = require('express');
const router = express.Router();
const pool = require('../../config/db');
const logger = require('../../utils/logger');
const { jwtAuth } = require('../../middlewares/jwtAuth');

/**
 * 获取个人资料
 * GET /api/auth/profile
 */
router.get('/profile', jwtAuth, async (req, res) => {
  const { user } = req;
  const startTime = Date.now();

  try {
    // 查询用户基本信息
    const userQuery = `
      SELECT
        id, username, name, phone, email,
        company, avatar, wechat_qrcode,
        is_admin, status
      FROM users
      WHERE id = $1
    `;
    const userResult = await pool.query(userQuery, [user.id]);

    if (userResult.rows.length === 0) {
      return res.error('用户不存在', 404);
    }

    // 查询关联店铺
    const storesQuery = `
      SELECT s.* FROM stores s
      JOIN user_stores us ON s.id = us.store_id
      WHERE us.user_id = $1
    `;
    const storesResult = await pool.query(storesQuery, [user.id]);

    // 记录成功日志
    logger.info('获取个人资料成功', {
      userId: user.id,
      operation: 'GET_PROFILE',
      duration: `${Date.now() - startTime}ms`,
      ip: req.ip
    });

    // 返回响应
    res.success({
      ...userResult.rows[0],
      stores: storesResult.rows
    });

  } catch (error) {
    // 记录错误日志
    logger.error('获取个人资料失败', {
      error: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
      userId: user?.id,
      ip: req.ip
    });

    res.error('获取个人资料失败', 500);
  }
});

/**
 * 更新个人基础信息
 * PUT /api/auth/profile
 */
router.put('/profile', jwtAuth, async (req, res) => {
  const { user } = req;
  const { name, phone, email, company } = req.body;
  const startTime = Date.now();

  // 参数验证
  if (!name && !phone && !email && !company) {
    return res.error('至少需要更新一个字段', 400);
  }

  try {
    // 更新用户信息
    const updateQuery = `
      UPDATE users
      SET
        name = COALESCE($1, name),
        phone = CASE WHEN $2 ~ '^[0-9]{11}$' THEN $2 ELSE phone END,
        email = CASE WHEN $3 ~ '^[^@]+@[^@]+\\.[^@]+$' THEN $3 ELSE email END,
        company = COALESCE($4, company),
        updated_at = NOW()
      WHERE id = $5
      RETURNING id, updated_at
    `;
    const updateResult = await pool.query(updateQuery, [
      name, phone, email, company, user.id
    ]);

    if (updateResult.rows.length === 0) {
      return res.error('用户不存在', 404);
    }

    // 记录成功日志
    logger.info('更新个人资料成功', {
      userId: user.id,
      operation: 'UPDATE_PROFILE',
      changedFields: Object.entries(req.body)
        .filter(([_, v]) => v !== undefined)
        .map(([k]) => k),
      duration: `${Date.now() - startTime}ms`,
      ip: req.ip
    });

    res.success({
      id: updateResult.rows[0].id,
      updated_at: updateResult.rows[0].updated_at
    });

  } catch (error) {
    logger.error('更新个人资料失败', {
      error: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
      userId: user?.id,
      ip: req.ip
    });
    res.error('更新个人资料失败', 500);
  }
});

const bcrypt = require('bcrypt');
const saltRounds = 10;

/**
 * 修改密码
 * PUT /api/auth/profile/password
 */
router.put('/profile/password', jwtAuth, async (req, res) => {
  const { user } = req;
  const { new_password } = req.body;
  const startTime = Date.now();

  if (!new_password || new_password.length < 6) {
    return res.error('密码长度不能少于6位', 400);
  }

  try {
    // 加密密码
    const hashedPassword = await bcrypt.hash(new_password, saltRounds);
    
    // 更新密码
    const updateQuery = `
      UPDATE users
      SET
        password = $1,
        updated_at = NOW()
      WHERE id = $2
      RETURNING id, updated_at
    `;
    const updateResult = await pool.query(updateQuery, [hashedPassword, user.id]);

    if (updateResult.rows.length === 0) {
      return res.error('用户不存在', 404);
    }

    // 记录成功日志
    logger.info('密码修改成功', {
      userId: user.id,
      operation: 'UPDATE_PASSWORD',
      duration: `${Date.now() - startTime}ms`,
      ip: req.ip
    });

    res.success({
      message: '密码修改成功',
      updated_at: updateResult.rows[0].updated_at
    });

  } catch (error) {
    // 记录错误日志
    logger.error('密码修改失败', {
      error: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
      userId: user?.id,
      ip: req.ip
    });

    res.error('密码修改失败', 500);
  }
});

/**
 * 获取店铺列表
 * GET /api/auth/profile/stores
 */
router.get('/stores', jwtAuth, async (req, res) => {
  const { user } = req;
  const startTime = Date.now();

  try {
    // 查询关联店铺
    const storesQuery = `
      SELECT s.* FROM stores s
      JOIN user_stores us ON s.id = us.store_id
      WHERE us.user_id = $1
    `;
    const storesResult = await pool.query(storesQuery, [user.id]);

    // 记录成功日志
    logger.info('获取店铺列表成功', {
      userId: user.id,
      operation: 'GET_STORES',
      storeCount: storesResult.rows.length,
      duration: `${Date.now() - startTime}ms`,
      ip: req.ip
    });

    res.success(storesResult.rows);

  } catch (error) {
    // 记录错误日志
    logger.error('获取店铺列表失败', {
      error: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
      userId: user?.id,
      ip: req.ip
    });

    res.error('获取店铺列表失败', 500);
  }
});

/**
 * 添加店铺
 * POST /api/auth/stores
 */
router.post('/stores', jwtAuth, async (req, res) => {
  const { user } = req;
  const { platform, name, url } = req.body;
  const startTime = Date.now();

  // 参数验证
  if (!platform || !name || !url) {
    return res.error('平台名称、店铺名称和URL不能为空', 400);
  }

  try {
    // 插入店铺
    const insertStoreQuery = `
      INSERT INTO stores (platform, name, url)
      VALUES ($1, $2, $3)
      RETURNING id
    `;
    const storeResult = await pool.query(insertStoreQuery, [platform, name, url]);
    const storeId = storeResult.rows[0].id;

    // 关联用户店铺
    const linkQuery = `
      INSERT INTO user_stores (user_id, store_id)
      VALUES ($1, $2)
    `;
    await pool.query(linkQuery, [user.id, storeId]);

    // 记录成功日志
    logger.info('添加店铺成功', {
      userId: user.id,
      operation: 'ADD_STORE',
      storeId: storeId,
      duration: `${Date.now() - startTime}ms`,
      ip: req.ip
    });

    res.success({
      id: storeId,
      platform,
      name,
      url,
      created_at: new Date().toISOString()
    });

  } catch (error) {
    // 记录错误日志
    logger.error('添加店铺失败', {
      error: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
      userId: user?.id,
      ip: req.ip,
      attemptData: { platform, name, url }
    });

    res.error('添加店铺失败', 500);
  }
});

/**
 * 编辑店铺信息
 * PUT /api/auth/stores/:id
 */
router.put('/stores/:id', jwtAuth, async (req, res) => {
  const { user } = req;
  const { id } = req.params;
  const { platform, name, url } = req.body;
  const startTime = Date.now();

  // 参数验证
  if (!platform && !name && !url) {
    return res.error('至少需要更新一个字段', 400);
  }

  try {
    // 验证店铺是否存在且属于当前用户
    const checkQuery = `
      SELECT 1 FROM user_stores
      WHERE user_id = $1 AND store_id = $2
    `;
    const checkResult = await pool.query(checkQuery, [user.id, id]);

    if (checkResult.rows.length === 0) {
      return res.error('店铺不存在或无权操作', 404);
    }

    // 更新店铺信息
    const updateQuery = `
      UPDATE stores
      SET
        platform = COALESCE($1, platform),
        name = COALESCE($2, name),
        url = COALESCE($3, url),
        updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `;
    const updateResult = await pool.query(updateQuery, [
      platform, name, url, id
    ]);

    // 记录成功日志
    logger.info('编辑店铺成功', {
      userId: user.id,
      operation: 'UPDATE_STORE',
      storeId: id,
      changedFields: Object.entries(req.body)
        .filter(([_, v]) => v !== undefined)
        .map(([k]) => k),
      duration: `${Date.now() - startTime}ms`,
      ip: req.ip
    });

    res.success(updateResult.rows[0]);

  } catch (error) {
    // 记录错误日志
    logger.error('编辑店铺失败', {
      error: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
      userId: user?.id,
      storeId: id,
      ip: req.ip,
      attemptData: { platform, name, url }
    });

    res.error('编辑店铺失败', 500);
  }
});

/**
 * 删除店铺
 * DELETE /api/auth/stores/:id
 */
router.delete('/stores/:id', jwtAuth, async (req, res) => {
  const { user } = req;
  const { id } = req.params;
  const startTime = Date.now();

  try {
    // 删除店铺关联
    await pool.query(`
      DELETE FROM user_stores
      WHERE user_id = $1 AND store_id = $2
    `, [user.id, id]);

    // 删除店铺
    const deleteResult = await pool.query(`
      DELETE FROM stores
      WHERE id = $1
      RETURNING *
    `, [id]);

    // 记录成功日志
    logger.info('删除店铺成功', {
      userId: user.id,
      operation: 'DELETE_STORE',
      storeId: id,
      duration: `${Date.now() - startTime}ms`,
      ip: req.ip
    });

    res.success({
      message: '店铺删除成功',
      store: deleteResult.rows[0]
    });

  } catch (error) {
    // 记录错误日志
    logger.error('删除店铺失败', {
      error: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
      userId: user?.id,
      storeId: id,
      ip: req.ip
    });

    res.error('删除店铺失败', 500);
  }
});

module.exports = router;
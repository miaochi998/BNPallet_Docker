const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../../config/env');
const pool = require('../../config/db');

/**
 * @api {post} /auth/refresh 刷新访问令牌
 * @apiName RefreshToken
 * @apiGroup Auth
 * @apiDescription 使用刷新令牌获取新的访问令牌
 * 
 * @apiParam {String} refresh_token 刷新令牌
 * 
 * @apiSuccess {Number} code 状态码
 * @apiSuccess {Object} data 返回数据
 * @apiSuccess {String} data.token 新的JWT令牌
 * @apiSuccess {Number} data.expires_in 过期时间(秒)
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;
    
    if (!refresh_token) {
      return res.error('刷新令牌不能为空', 400);
    }
    
    // 验证刷新令牌有效性
    const tokenResult = await pool.query(
      `SELECT u.id, u.username, u.is_admin, u.status, ps.token, ps.last_accessed
       FROM users u
       JOIN pallet_shares ps ON u.id = ps.user_id
       WHERE ps.token = $1 
       AND ps.share_type = 'REFRESH_TOKEN'
       AND ps.last_accessed > (NOW() - INTERVAL '7 DAYS')`,
      [refresh_token]
    );
    
    const tokenData = tokenResult.rows[0];
    
    if (!tokenData) {
      return res.error('刷新令牌已过期或无效', 401);
    }
    
    if (tokenData.status !== 'ACTIVE') {
      return res.error('账户已锁定，无法刷新令牌', 403);
    }
    
    // 更新刷新令牌的最后访问时间和访问计数
    await pool.query(
      `UPDATE pallet_shares
       SET last_accessed = NOW(), access_count = access_count + 1
       WHERE token = $1`,
      [refresh_token]
    );
    
    // 记录令牌刷新日志
    await pool.query(
      'INSERT INTO access_logs (user_id, page_url, session_duration) VALUES ($1, $2, $3)',
      [tokenData.id, '/auth/refresh', 0]
    );
    
    // 生成新的JWT令牌
    const payload = {
      id: tokenData.id,
      username: tokenData.username,
      is_admin: tokenData.is_admin
    };
    
    const newToken = jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN
    });
    
    // 计算token过期时间(秒)
    const expiresIn = parseInt(JWT_EXPIRES_IN) || 86400;
    
    return res.success({
      token: newToken,
      expires_in: expiresIn
    });
    
  } catch (error) {
    console.error('刷新令牌错误:', error);
    return res.error('服务器内部错误', 500);
  }
});

module.exports = router;

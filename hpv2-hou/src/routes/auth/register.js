const express = require('express');
const router = express.Router();
const { hashPassword } = require('../../utils/crypto');
const pool = require('../../config/db');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../../config/env');
const { v4: uuidv4 } = require('uuid');

/**
 * @api {post} /auth/register 用户注册
 * @apiName Register
 * @apiGroup Auth
 * @apiDescription 用户注册并获取访问令牌
 * 
 * @apiParam {String} username 用户名
 * @apiParam {String} password 密码
 * @apiParam {String} name 姓名
 * @apiParam {String} [email] 邮箱
 * @apiParam {String} [phone] 手机号
 * @apiParam {String} [company] 公司名称
 * 
 * @apiSuccess {Number} code 状态码
 * @apiSuccess {Object} data 返回数据
 * @apiSuccess {String} data.token JWT令牌
 * @apiSuccess {String} data.refresh_token 刷新令牌
 * @apiSuccess {Number} data.expires_in 过期时间(秒)
 * @apiSuccess {Object} data.user_info 用户信息
 */
router.post('/register', async (req, res) => {
  try {
    const { username, password, name, email, phone, company } = req.body;
    
    // 参数验证
    if (!username || !password || !name) {
      return res.error('用户名、密码和姓名不能为空', 400);
    }
    
    // 用户名长度验证
    if (username.length < 4 || username.length > 20) {
      return res.error('用户名长度应为4-20个字符', 400);
    }
    
    // 密码复杂度验证
    if (password.length < 6 || password.length > 20) {
      return res.error('密码长度应为6-20个字符', 400);
    }
    
    // 检查用户名是否已存在
    const existingUserResult = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );
    
    if (existingUserResult.rows.length > 0) {
      return res.error('用户名已被使用', 409);
    }
    
    // 如果提供了邮箱，检查邮箱是否已存在
    if (email) {
      const existingEmailResult = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );
      
      if (existingEmailResult.rows.length > 0) {
        return res.error('邮箱已被使用', 409);
      }
    }
    
    // 如果提供了手机号，检查手机号是否已存在
    if (phone) {
      const existingPhoneResult = await pool.query(
        'SELECT id FROM users WHERE phone = $1',
        [phone]
      );
      
      if (existingPhoneResult.rows.length > 0) {
        return res.error('手机号已被使用', 409);
      }
    }
    
    // 哈希密码
    const hashedPassword = await hashPassword(password);
    
    // 创建用户
    const newUserResult = await pool.query(
      `INSERT INTO users 
        (username, password, name, email, phone, company, status, is_admin, created_at, last_login_time) 
       VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       RETURNING id, username, name, email, phone, company, status, is_admin`,
      [username, hashedPassword, name, email || null, phone || null, company || null, 'ACTIVE', false]
    );
    
    const newUser = newUserResult.rows[0];
    
    // 生成JWT令牌
    const payload = {
      id: newUser.id,
      username: newUser.username,
      is_admin: newUser.is_admin
    };
    
    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN
    });
    
    // 生成刷新令牌并存储
    const refreshToken = uuidv4();
    await pool.query(
      'INSERT INTO pallet_shares (user_id, token, share_type, last_accessed) VALUES ($1, $2, $3, NOW())',
      [newUser.id, refreshToken, 'REFRESH_TOKEN']
    );
    
    // 记录注册日志
    await pool.query(
      'INSERT INTO access_logs (user_id, page_url, session_duration) VALUES ($1, $2, $3)',
      [newUser.id, '/auth/register', 0]
    );
    
    // 计算token过期时间(秒)
    const expiresIn = parseInt(JWT_EXPIRES_IN) || 86400;
    
    // 返回用户信息和令牌
    return res.success({
      token,
      refresh_token: refreshToken,
      expires_in: expiresIn,
      user_info: {
        id: newUser.id,
        username: newUser.username,
        name: newUser.name,
        company: newUser.company,
        is_admin: newUser.is_admin,
        avatar: null,
        wechat_qrcode: null
      }
    });
    
  } catch (error) {
    console.error('注册错误:', error);
    return res.error('服务器内部错误', 500);
  }
});

module.exports = router;

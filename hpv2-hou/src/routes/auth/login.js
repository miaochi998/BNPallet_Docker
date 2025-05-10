const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { comparePassword } = require('../../utils/crypto');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../../config/env');
const db = require('../../services/db'); // 使用数据库服务层
const { v4: uuidv4 } = require('uuid');
const logger = require('../../utils/logger');

/**
 * @api {post} /auth/login 用户登录
 * @apiName Login
 * @apiGroup Auth
 * @apiDescription 用户登录获取访问令牌
 * 
 * @apiParam {String} username 用户名/手机号/邮箱
 * @apiParam {String} password 密码
 * 
 * @apiSuccess {Number} code 状态码
 * @apiSuccess {Object} data 返回数据
 * @apiSuccess {String} data.token JWT令牌
 * @apiSuccess {String} data.refresh_token 刷新令牌
 * @apiSuccess {Number} data.expires_in 过期时间(秒)
 * @apiSuccess {Object} data.user_info 用户信息
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // 验证输入数据
    if (!username || !password) {
      return res.error('请提供用户名和密码', 400);
    }
    
    try {
      // 先查询用户是否存在
      const userQuery = await db.query(
        `SELECT 
          id, username, phone, email, password, is_admin, status
        FROM users
        WHERE username = $1 OR phone = $1 OR email = $1`,
        [username]
      );
      
      console.log('登录查询结果:', {
        username,
        found: userQuery.rows.length > 0,
        status: userQuery.rows[0]?.status
      });
      
      // 用户不存在
      if (userQuery.rows.length === 0) {
        return res.error('用户名或密码错误', 401);
      }
      
      const user = userQuery.rows[0];
      
      console.log('用户信息:', {
        id: user.id,
        username: user.username,
        status: user.status
      });
      
      // 检查用户状态 - 先验证状态再验证密码
      if (user.status === 'INACTIVE') {
        console.log(`用户 ${user.username} (ID: ${user.id}) 已停用，返回403状态码`);
        
        // 验证密码 - 我们仍需验证密码，只有密码正确且状态停用才显示"用户已停用"
        const passwordMatch = await comparePassword(password, user.password);
        
        if (passwordMatch) {
          // 密码正确但用户停用
          return res.error('用户已停用', 403);
        } else {
          // 密码错误，显示通用错误
          return res.error('用户名或密码错误', 401);
        }
      }
      
      // 验证密码
      const passwordMatch = await comparePassword(password, user.password);
      
      if (!passwordMatch) {
        return res.error('用户名或密码错误', 401);
      }
      
      // 到这里说明用户存在、密码正确且状态正常，继续登录流程
      const userInfo = await db.query(
        `SELECT name, company, avatar, wechat_qrcode
         FROM users
         WHERE id = $1`,
        [user.id]
      );
      
      const userProfile = userInfo.rows[0] || {};
      
      // 生成JWT令牌
      const payload = {
        id: user.id,
        username: user.username,
        is_admin: user.is_admin
      };
      
      const token = jwt.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN
      });
      
      // 生成刷新令牌
      const refreshToken = uuidv4();
      await db.query(
        'INSERT INTO pallet_shares (user_id, token, share_type, last_accessed) VALUES ($1, $2, $3, NOW())',
        [user.id, refreshToken, 'REFRESH_TOKEN']
      );
      
      // 更新最后登录时间
      await db.query(
        'UPDATE users SET last_login_time = NOW() WHERE id = $1',
        [user.id]
      );
      
      // 记录登录成功
      await db.query(
        'INSERT INTO access_logs (user_id, page_url, session_duration) VALUES ($1, $2, $3)',
        [user.id, '/auth/login', 0]
      );
      
      // 计算token过期时间
      const expiresIn = parseInt(JWT_EXPIRES_IN) || 86400;
      
      // 返回成功结果
      return res.success({
        token,
        refresh_token: refreshToken,
        expires_in: expiresIn,
        user_info: {
          id: user.id,
          username: user.username,
          name: userProfile.name,
          company: userProfile.company,
          is_admin: user.is_admin,
          avatar: userProfile.avatar,
          wechat_qrcode: userProfile.wechat_qrcode
        }
      });
      
    } catch (dbError) {
      console.error('数据库操作错误:', dbError);
      return res.error('登录失败，请稍后再试', 500);
    }
  } catch (error) {
    console.error('登录处理全局错误:', error);
    return res.error('服务器内部错误', 500);
  }
});

module.exports = router;

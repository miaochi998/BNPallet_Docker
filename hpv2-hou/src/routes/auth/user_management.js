const express = require('express');
const router = express.Router();
const db = require('../../services/db'); // 使用数据库服务层
const { hashPassword } = require('../../utils/crypto');
const logger = require('../../utils/logger');

// 获取用户列表
router.get('/', async (req, res) => {
  try {
    const {
      username,
      name,
      phone,
      email,
      is_admin,
      status,
      page = 1,
      pageSize = 10
    } = req.query;

    // 计算分页偏移量
    const offset = (page - 1) * pageSize;

    // 构建查询SQL
    const queryText = `
      SELECT
        u.id, u.username, u.name, u.phone, u.email,
        u.is_admin, u.status, u.created_at, u.updated_at,
        u.avatar, u.company, u.wechat_qrcode,
        (SELECT array_agg(row_to_json(s))
         FROM stores s
         JOIN user_stores us ON s.id = us.store_id
         WHERE us.user_id = u.id) as stores
      FROM users u
      WHERE ($1::text IS NULL OR u.username LIKE $1)
        AND ($2::text IS NULL OR u.name LIKE $2)
        AND ($3::text IS NULL OR u.phone LIKE $3)
        AND ($4::text IS NULL OR u.email LIKE $4)
        AND (
          CASE 
            WHEN $5::boolean IS NOT NULL THEN u.is_admin = $5
            ELSE TRUE
          END
        )
        AND (
          CASE 
            WHEN $6::text IS NOT NULL THEN u.status = $6
            ELSE TRUE
          END
        )
      ORDER BY u.id DESC
      LIMIT $7 OFFSET $8;
    `;

    // 构建计数SQL
    const countText = `
      SELECT COUNT(*) as total
      FROM users u
      WHERE ($1::text IS NULL OR u.username LIKE $1)
        AND ($2::text IS NULL OR u.name LIKE $2)
        AND ($3::text IS NULL OR u.phone LIKE $3)
        AND ($4::text IS NULL OR u.email LIKE $4)
        AND (
          CASE 
            WHEN $5::boolean IS NOT NULL THEN u.is_admin = $5
            ELSE TRUE
          END
        )
        AND (
          CASE 
            WHEN $6::text IS NOT NULL THEN u.status = $6
            ELSE TRUE
          END
        )
    `;

    // 转换is_admin参数为布尔类型
    let isAdminBool = null;
    if (is_admin !== undefined) {
      // 处理不同的布尔值表示形式
      isAdminBool = is_admin === 'true' || is_admin === true;
    }

    // 使用批量查询执行两个查询
    const params = [
      username ? `%${username}%` : null,
      name ? `%${name}%` : null,
      phone ? `%${phone}%` : null,
      email ? `%${email}%` : null,
      isAdminBool,
      status
    ];

    const results = await db.batchQuery([
      {
        text: queryText,
        params: [...params, parseInt(pageSize), offset]
      },
      {
        text: countText,
        params
      }
    ]);

    const users = results[0].rows;
    const total = parseInt(results[1].rows[0].total);

    // 记录成功日志
    logger.info('用户列表查询成功', {
      operation: 'USER_LIST_QUERY',
      adminId: req.user.id,
      searchCondition: {
        username,
        name,
        phone,
        email,
        is_admin: isAdminBool,
        status,
        page,
        pageSize
      },
      resultCount: users.length,
      duration: `${Date.now() - req.startTime}ms`,
      ip: req.ip
    });

    res.success({
      users,
      pagination: {
        total,
        current_page: parseInt(page),
        per_page: parseInt(pageSize)
      }
    });
  } catch (error) {
    // 记录错误日志
    logger.error('用户列表查询失败', {
      operation: 'USER_LIST_QUERY',
      error: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
      adminId: req.user?.id,
      ip: req.ip
    });
    
    res.error('获取用户列表失败', 500);
  }
});

/**
 * 创建用户
 * 需要管理员权限
 * 默认密码：123456
 */
router.post('/', async (req, res) => {
  try {
    const { username, is_admin = false } = req.body;
    const createdBy = req.user.id;

    // 使用事务确保数据一致性
    const newUser = await db.executeTransaction(async (client) => {
      // 验证用户名是否已存在
      const { rows: existingUsers } = await client.query(
        'SELECT id FROM users WHERE username = $1',
        [username]
      );

      if (existingUsers.length > 0) {
        const error = new Error('用户名已存在');
        error.statusCode = 409;
        throw error;
      }

      // 哈希默认密码
      const hashedPassword = await hashPassword('123456');
      
      // 创建用户
      const { rows: newUser } = await client.query(
        `INSERT INTO users (
          username, password,
          is_admin, status, created_by, created_at
        ) VALUES (
          $1, $2,
          $3, 'ACTIVE',
          $4, CURRENT_TIMESTAMP
        ) RETURNING id, username, is_admin, status, created_at`,
        [username, hashedPassword, is_admin, createdBy]
      );
      
      return newUser[0];
    });

    // 记录成功日志
    logger.info('用户创建成功', {
      operation: 'USER_CREATE',
      adminId: createdBy,
      newUserId: newUser.id,
      username: username,
      isAdmin: is_admin,
      ip: req.ip
    });

    res.success(newUser, '用户创建成功', 201);
  } catch (error) {
    // 记录错误日志
    logger.error('用户创建失败', {
      operation: 'USER_CREATE',
      error: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
      adminId: req.user?.id,
      attemptUsername: req.body.username,
      ip: req.ip
    });
    
    res.error(error.message, error.statusCode || 500);
  }
});

/**
 * 修改用户密码
 * 管理员可跳过原密码验证
 */
router.patch('/:id/password', async (req, res) => {
  try {
    const { id } = req.params;
    const { new_password, old_password } = req.body;
    const currentUserId = req.user.id;
    const isAdmin = req.user.is_admin;

    // 验证用户是否存在
    const { rows: user } = await db.query(
      'SELECT id, username FROM users WHERE id = $1',
      [id]
    );
    
    if (user.length === 0) {
      return res.error('用户不存在', 404);
    }

    // 非管理员需要验证原密码
    if (!isAdmin) {
      const { rows: validUser } = await db.query(
        'SELECT id FROM users WHERE id = $1 AND password = crypt($2, password)',
        [id, old_password]
      );
      
      if (validUser.length === 0) {
        return res.error('原密码不正确', 403);
      }
    }

    // 哈希新密码
    const hashedPassword = await hashPassword(new_password);

    // 更新密码
    const { rows: updatedUser } = await db.query(
      `UPDATE users
       SET password = $1,
           updated_by = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id, username, updated_at`,
     [hashedPassword, currentUserId, id]
    );

    // 记录成功日志
    logger.info('密码修改成功', {
      operation: 'UPDATE_PASSWORD',
      targetUserId: id,
      operatorId: currentUserId,
      isAdmin: isAdmin,
      ip: req.ip
    });

    res.success(updatedUser[0], '密码修改成功');
  } catch (error) {
    // 记录错误日志
    logger.error('密码修改失败', {
      operation: 'UPDATE_PASSWORD',
      error: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
      targetUserId: req.params.id,
      operatorId: req.user?.id,
      ip: req.ip
    });
    
    res.error('密码修改失败', 500);
  }
});

/**
 * 变更用户状态
 * 可操作所有非自身账户
 */
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const currentUserId = req.user.id;

    // 不能操作自身账户
    if (id == currentUserId) {
      return res.error('不能变更自身账户状态', 403);
    }

    // 验证用户是否存在
    const { rows: user } = await db.query(
      'SELECT id, username FROM users WHERE id = $1',
      [id]
    );
    
    if (user.length === 0) {
      return res.error('用户不存在', 404);
    }

    // 更新用户状态
    const { rows: updatedUser } = await db.query(
      `UPDATE users
       SET status = $1,
           updated_by = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id, username, status, updated_at`,
      [status, currentUserId, id]
    );

    // 记录成功日志
    logger.info('用户状态变更成功', {
      operation: 'UPDATE_USER_STATUS',
      targetUserId: id,
      newStatus: status,
      operatorId: currentUserId,
      ip: req.ip
    });

    res.success(updatedUser[0], '用户状态已更新');
  } catch (error) {
    // 记录错误日志
    logger.error('用户状态变更失败', {
      operation: 'UPDATE_USER_STATUS',
      error: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
      targetUserId: req.params.id,
      operatorId: req.user?.id,
      ip: req.ip
    });
    
    res.error('用户状态变更失败', 500);
  }
});

/**
 * 关联店铺
 * 支持多店铺关联
 */
router.post('/:id/stores', async (req, res) => {
  try {
    const { id } = req.params;
    const { store_ids } = req.body;
    const currentUserId = req.user.id;

    // 验证用户是否存在
    const { rows: user } = await db.query(
      'SELECT id FROM users WHERE id = $1',
      [id]
    );
    
    if (user.length === 0) {
      return res.error('用户不存在', 404);
    }

    // 验证店铺是否存在
    const { rows: existingStores } = await db.query(
      'SELECT id FROM stores WHERE id = ANY($1::int[])',
      [store_ids]
    );

    if (existingStores.length !== store_ids.length) {
      return res.error('部分店铺不存在', 400);
    }

    // 批量关联店铺(自动去重)
    const insertedStores = [];
    for (const storeId of store_ids) {
      const { rows } = await db.query(
        `INSERT INTO user_stores (user_id, store_id, created_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id, store_id) DO NOTHING
         RETURNING store_id`,
        [id, storeId]
      );
      if (rows.length > 0) {
        insertedStores.push(rows[0].store_id);
      }
    }

    // 获取店铺详情用于返回
    const { rows: stores } = await db.query(
      `SELECT id, platform, name, url
       FROM stores
       WHERE id = ANY($1::int[])`,
      [insertedStores]
    );

    // 记录成功日志
    logger.info('店铺关联成功', {
      operation: 'LINK_STORES',
      targetUserId: id,
      storeCount: insertedStores.length,
      operatorId: currentUserId,
      ip: req.ip
    });

    res.success({
      user_id: parseInt(id),
      stores: stores
    }, '店铺关联成功');
  } catch (error) {
    // 记录错误日志
    logger.error('店铺关联失败', {
      operation: 'LINK_STORES',
      error: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
      targetUserId: req.params.id,
      operatorId: req.user?.id,
      ip: req.ip
    });
    
    res.error('店铺关联失败', 500);
  }
});

/**
 * 批量重置密码
 * 将选中用户密码重置为123456
 */
router.post('/batch/reset-password', async (req, res) => {
  try {
    const { user_ids } = req.body;
    const currentUserId = req.user.id;

    // 验证至少选择一个用户
    if (!user_ids || user_ids.length === 0) {
      return res.error('请选择要重置密码的用户', 400);
    }

    // 限制最大批量操作数量
    if (user_ids.length > 100) {
      return res.error('单次最多批量操作100个用户', 400);
    }

    // 验证用户是否存在
    const { rows: existingUsers } = await db.query(
      'SELECT id FROM users WHERE id = ANY($1::int[])',
      [user_ids]
    );

    if (existingUsers.length !== user_ids.length) {
      return res.error('部分用户不存在', 400);
    }

    // 哈希默认密码
    const hashedPassword = await hashPassword('123456');
    
    // 批量重置密码
    const { rows: updatedUsers } = await db.query(
      `UPDATE users
       SET password = $1,
           updated_at = CURRENT_TIMESTAMP,
           updated_by = $2
       WHERE id = ANY($3::int[])
       RETURNING id, username, updated_at`,
      [hashedPassword, currentUserId, user_ids]
    );

    // 记录成功日志
    logger.info('批量重置密码成功', {
      operation: 'BATCH_RESET_PASSWORD',
      adminId: currentUserId,
      affectedUsers: updatedUsers.length,
      ip: req.ip
    });

    res.success({
      total: user_ids.length,
      success: updatedUsers.length,
      failed: user_ids.length - updatedUsers.length,
      updated_at: new Date().toISOString()
    }, '批量重置密码成功');
  } catch (error) {
    // 记录错误日志
    logger.error('批量重置密码失败', {
      operation: 'BATCH_RESET_PASSWORD',
      error: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
      adminId: req.user?.id,
      ip: req.ip
    });
    
    res.error('批量重置密码失败', 500);
  }
});

/**
 * 删除用户
 * 管理员可以删除其他用户，但不能删除自己
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user.id;
    const isAdmin = req.user.is_admin;

    // 确保是管理员操作
    if (!isAdmin) {
      return res.error('权限不足，只有管理员可以删除用户', 403);
    }

    // 不能删除自己
    if (parseInt(id) === currentUserId) {
      return res.error('不能删除自己的账户', 403);
    }

    // 验证用户是否存在
    const { rows: user } = await db.query(
      'SELECT id, username, is_admin FROM users WHERE id = $1',
      [id]
    );
    
    if (user.length === 0) {
      return res.error('用户不存在', 404);
    }

    // 删除用户并处理所有外键约束
    await db.executeTransaction(async (client) => {
      // 0. 先检查用户关联的所有数据表
      // 检查是否存在recycle_bin表中的记录
      await client.query(
        'UPDATE recycle_bin SET deleted_by = NULL WHERE deleted_by = $1',
        [id]
      );
      
      await client.query(
        'UPDATE recycle_bin SET restored_by = NULL WHERE restored_by = $1',
        [id]
      );
      
      // 1. 删除用户的访问日志
      await client.query(
        'DELETE FROM access_logs WHERE user_id = $1',
        [id]
      );
      
      // 2. 删除用户关联的店铺关系
      await client.query(
        'DELETE FROM user_stores WHERE user_id = $1',
        [id]
      );
      
      // 3. 删除与货盘分享相关的记录
      // 先获取用户相关的分享ID
      const { rows: shareIds } = await client.query(
        'SELECT id FROM pallet_shares WHERE user_id = $1',
        [id]
      );
      
      // 如果存在分享ID, 需要清理customer_logs表中的记录
      if (shareIds.length > 0) {
        const shareIdList = shareIds.map(row => row.id);
        // 删除客户访问日志
        await client.query(
          'DELETE FROM customer_logs WHERE share_id = ANY($1::int[])',
          [shareIdList]
        );
      }
      
      // 删除货盘分享
      await client.query(
        'DELETE FROM pallet_shares WHERE user_id = $1',
        [id]
      );
      
      // 4. 处理附件表
      await client.query(
        'UPDATE attachments SET created_by = NULL WHERE created_by = $1',
        [id]
      );
      
      // 5. 检查并处理用户作为创建者或更新者的记录
      await client.query(
        'UPDATE users SET created_by = NULL WHERE created_by = $1',
        [id]
      );
      
      await client.query(
        'UPDATE users SET updated_by = NULL WHERE updated_by = $1',
        [id]
      );
      
      await client.query(
        'UPDATE brands SET created_by = NULL WHERE created_by = $1',
        [id]
      );
      
      await client.query(
        'UPDATE brands SET updated_by = NULL WHERE updated_by = $1',
        [id]
      );
      
      await client.query(
        'UPDATE products SET created_by = NULL WHERE created_by = $1',
        [id]
      );
      
      await client.query(
        'UPDATE products SET updated_by = NULL WHERE updated_by = $1',
        [id]
      );
      
      await client.query(
        'UPDATE static_pages SET updated_by = NULL WHERE updated_by = $1',
        [id]
      );
      
      // 6. 最后删除用户记录
      const { rows: deletedUser } = await client.query(
        'DELETE FROM users WHERE id = $1 RETURNING id, username',
        [id]
      );
      
      // 如果没有删除任何记录，抛出错误
      if (deletedUser.length === 0) {
        throw new Error('删除用户失败');
      }
    });
    
    // 记录成功日志
    logger.info('用户彻底删除成功', {
      operation: 'HARD_DELETE_USER',
      targetUserId: id,
      targetUsername: user[0].username,
      isAdmin: user[0].is_admin,
      operatorId: currentUserId,
      ip: req.ip
    });

    res.success({
      id: parseInt(id),
      username: user[0].username,
      deleted: true
    }, '用户彻底删除成功');
      
  } catch (error) {
    // 记录错误日志
    logger.error('用户删除失败', {
      operation: 'HARD_DELETE_USER',
      error: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
      targetUserId: req.params.id,
      operatorId: req.user?.id,
      ip: req.ip
    });
    
    res.error('用户删除失败: ' + error.message, 500);
  }
});

/**
 * 更新用户基本信息
 * 可更新用户名、姓名、电话、邮箱等非敏感信息
 */
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { username, name, phone, email } = req.body;
    const currentUserId = req.user.id;
    const isAdmin = req.user.is_admin;

    // 确保是管理员操作
    if (!isAdmin) {
      return res.error('权限不足，只有管理员可以更新用户信息', 403);
    }

    // 验证用户是否存在
    const { rows: user } = await db.query(
      'SELECT id, username FROM users WHERE id = $1',
      [id]
    );
    
    if (user.length === 0) {
      return res.error('用户不存在', 404);
    }

    // 检查用户名是否已被其他用户使用
    if (username && username !== user[0].username) {
      const { rows: existingUser } = await db.query(
        'SELECT id FROM users WHERE username = $1 AND id != $2',
        [username, id]
      );
      
      if (existingUser.length > 0) {
        return res.error('用户名已被使用', 409);
      }
    }

    // 构建更新字段
    const updates = [];
    const values = [];
    let paramIndex = 1;

    // 添加要更新的字段
    if (username) {
      updates.push(`username = $${paramIndex}`);
      values.push(username);
      paramIndex++;
    }

    if (name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      values.push(name);
      paramIndex++;
    }

    if (phone !== undefined) {
      updates.push(`phone = $${paramIndex}`);
      values.push(phone);
      paramIndex++;
    }

    if (email !== undefined) {
      updates.push(`email = $${paramIndex}`);
      values.push(email);
      paramIndex++;
    }

    // 添加更新者和更新时间
    updates.push(`updated_by = $${paramIndex}`);
    values.push(currentUserId);
    paramIndex++;

    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    // 如果没有要更新的字段，则返回原用户信息
    if (updates.length <= 2) {
      return res.success(user[0], '用户信息无变化');
    }

    // 添加用户ID作为查询条件
    values.push(id);

    // 执行更新操作
    const { rows: updatedUser } = await db.query(
      `UPDATE users
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, username, name, phone, email, is_admin, status, created_at, updated_at`,
      values
    );

    // 记录成功日志
    logger.info('用户信息更新成功', {
      operation: 'UPDATE_USER',
      targetUserId: id,
      updatedFields: Object.keys(req.body).filter(key => req.body[key] !== undefined),
      operatorId: currentUserId,
      ip: req.ip
    });

    res.success(updatedUser[0], '用户信息更新成功');
  } catch (error) {
    // 记录错误日志
    logger.error('用户信息更新失败', {
      operation: 'UPDATE_USER',
      error: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
      targetUserId: req.params.id,
      operatorId: req.user?.id,
      ip: req.ip
    });
    
    res.error('用户信息更新失败', 500);
  }
});

module.exports = router;
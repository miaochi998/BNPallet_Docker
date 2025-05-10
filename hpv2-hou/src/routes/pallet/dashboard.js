const express = require('express');
const router = express.Router();
const pool = require('../../config/db');
const { jwtAuth } = require('../../middlewares/jwtAuth');
const logger = require('../../utils/logger');

/**
 * 综合数据概览接口
 * GET /api/pallet/dashboard/overview
 * 
 * 根据用户类型返回不同的统计数据：
 * - 管理员：返回公司全量统计数据
 * - 销售员：返回个人货盘统计数据
 */
router.get('/overview', jwtAuth, async (req, res) => {
  const client = await pool.connect();
  
  try {
    // 根据用户类型返回不同的统计数据
    if (req.user.is_admin) {
      // 管理员查询
      // 1. 产品总数
      const productQuery = `SELECT COUNT(*) FROM products WHERE deleted_at IS NULL`;
      const productResult = await client.query(productQuery);
      
      // 2. 回收站产品数
      const recycleQuery = `SELECT COUNT(*) FROM recycle_bin WHERE entity_type='PRODUCT'`;
      const recycleResult = await client.query(recycleQuery);
      
      // 3. 品牌总数
      const brandQuery = `SELECT COUNT(*) FROM brands WHERE status='ACTIVE'`;
      const brandResult = await client.query(brandQuery);
      
      // 4. 用户统计
      const userQuery = `
        SELECT 
          COUNT(*) as total, 
          SUM(CASE WHEN status='ACTIVE' THEN 1 ELSE 0 END) as active_count,
          SUM(CASE WHEN status='INACTIVE' THEN 1 ELSE 0 END) as inactive_count
        FROM users 
        WHERE is_admin=false
      `;
      const userResult = await client.query(userQuery);
      
      // 5. 管理员统计
      const adminQuery = `
        SELECT 
          COUNT(*) as total, 
          SUM(CASE WHEN status='ACTIVE' THEN 1 ELSE 0 END) as active_count,
          SUM(CASE WHEN status='INACTIVE' THEN 1 ELSE 0 END) as inactive_count
        FROM users 
        WHERE is_admin=true
      `;
      const adminResult = await client.query(adminQuery);
      
      // 获取最后更新时间
      const lastUpdateQuery = `
        SELECT 
          (SELECT MAX(updated_at) FROM products) as products_updated,
          (SELECT MAX(updated_at) FROM brands) as brands_updated
      `;
      const lastUpdateResult = await client.query(lastUpdateQuery);
      
      // 记录成功日志
      logger.info('管理员数据概览查询成功', {
        operation: 'DASHBOARD_OVERVIEW',
        userType: 'ADMIN',
        dataPoints: 4,
        userId: req.user.id,
        ip: req.ip
      });
      
      // 返回管理员统计数据
      return res.success({
        product_stats: {
          total: parseInt(productResult.rows[0].count),
          recycled: parseInt(recycleResult.rows[0].count),
          last_updated: lastUpdateResult.rows[0].products_updated
        },
        brand_stats: {
          total: parseInt(brandResult.rows[0].count),
          last_updated: lastUpdateResult.rows[0].brands_updated
        },
        user_stats: {
          total: parseInt(userResult.rows[0].total),
          active: parseInt(userResult.rows[0].active_count),
          inactive: parseInt(userResult.rows[0].inactive_count)
        },
        admin_stats: {
          total: parseInt(adminResult.rows[0].total),
          active: parseInt(adminResult.rows[0].active_count),
          inactive: parseInt(adminResult.rows[0].inactive_count)
        }
      }, '数据概览查询成功');
    } else {
      // 销售员查询
      // 1. 个人产品总数
      const productQuery = `
        SELECT COUNT(*) 
        FROM products 
        WHERE owner_type='SELLER' AND owner_id=$1 AND deleted_at IS NULL
      `;
      const productResult = await client.query(productQuery, [req.user.id]);
      
      // 2. 回收站产品数
      const recycleQuery = `
        SELECT COUNT(*) 
        FROM recycle_bin 
        WHERE entity_type='PRODUCT' AND owner_type='SELLER' AND owner_id=$1
      `;
      const recycleResult = await client.query(recycleQuery, [req.user.id]);
      
      // 3. 获取最后更新时间
      const lastUpdateQuery = `
        SELECT MAX(updated_at) as last_updated
        FROM products 
        WHERE owner_type='SELLER' AND owner_id=$1
      `;
      const lastUpdateResult = await client.query(lastUpdateQuery, [req.user.id]);
      
      // 记录成功日志
      logger.info('销售员数据概览查询成功', {
        operation: 'DASHBOARD_OVERVIEW',
        userType: 'SELLER',
        dataPoints: 2,
        userId: req.user.id,
        ip: req.ip
      });
      
      // 返回销售员统计数据
      return res.success({
        product_stats: {
          total: parseInt(productResult.rows[0].count),
          recycled: parseInt(recycleResult.rows[0].count),
          last_updated: lastUpdateResult.rows[0].last_updated
        }
      }, '数据概览查询成功');
    }
  } catch (error) {
    // 记录错误日志
    logger.error('数据概览查询失败', {
      error: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
      context: {
        operation: 'DASHBOARD_OVERVIEW',
        userType: req.user.is_admin ? 'ADMIN' : 'SELLER',
        userId: req.user.id,
        ip: req.ip
      }
    });
    
    res.error('数据概览查询失败，请稍后重试', 500);
  } finally {
    client.release();
  }
});

/**
 * 实时数据刷新接口
 * GET /api/pallet/dashboard/refresh
 * 
 * 获取各模块最新数据更新时间戳
 */
router.get('/refresh', jwtAuth, async (req, res) => {
  const client = await pool.connect();
  
  try {
    // 查询各表的最后更新时间
    const query = `
      SELECT 
        (SELECT MAX(updated_at) FROM products) as products_updated_at,
        (SELECT MAX(updated_at) FROM brands) as brands_updated_at,
        (SELECT MAX(updated_at) FROM users) as users_updated_at
    `;
    
    const result = await client.query(query);
    
    // 记录成功日志
    logger.info('数据刷新时间查询成功', {
      operation: 'DATA_REFRESH',
      tables: ["products", "brands", "users"],
      userId: req.user.id,
      ip: req.ip
    });
    
    // 返回最后更新时间
    res.success({
      products_updated_at: result.rows[0].products_updated_at,
      brands_updated_at: result.rows[0].brands_updated_at,
      users_updated_at: result.rows[0].users_updated_at
    }, '数据刷新时间查询成功');
    
  } catch (error) {
    // 记录错误日志
    logger.error('数据刷新时间查询失败', {
      error: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
      context: {
        operation: 'DATA_REFRESH',
        userId: req.user.id,
        ip: req.ip
      }
    });
    
    res.error('数据刷新时间查询失败，请稍后重试', 500);
  } finally {
    client.release();
  }
});

/**
 * 获取个人信息接口
 * GET /api/pallet/dashboard/profile
 * 
 * 获取当前登录用户的基本信息
 */
router.get('/profile', jwtAuth, async (req, res) => {
  const client = await pool.connect();
  
  try {
    // 查询用户基本信息
    const query = `
      SELECT 
        avatar,
        is_admin,
        username,
        name,
        phone,
        email
      FROM users
      WHERE id = $1
    `;
    
    const result = await client.query(query, [req.user.id]);
    
    if (result.rows.length === 0) {
      return res.error('用户不存在', 404);
    }
    
    const user = result.rows[0];
    
    // 返回用户信息
    res.success({
      avatar: user.avatar,
      user_type: user.is_admin ? 'ADMIN' : 'SELLER',
      username: user.username,
      name: user.name,
      phone: user.phone,
      email: user.email
    }, '获取个人信息成功');
    
  } catch (error) {
    // 记录错误日志
    logger.error('获取个人信息失败', {
      error: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
      userId: req.user.id,
      ip: req.ip
    });
    
    res.error('获取个人信息失败，请稍后重试', 500);
  } finally {
    client.release();
  }
});

/**
 * 权限检查接口
 * GET /api/pallet/dashboard/permissions
 * 
 * 验证当前账号对各模块的操作权限
 */
router.get('/permissions', jwtAuth, async (req, res) => {
  try {
    const { module } = req.query;
    
    // 根据用户类型返回不同的权限
    const permissions = {
      product_manage: true, // 所有用户都可以管理产品
      brand_manage: req.user.is_admin, // 仅管理员可以管理品牌
      user_manage: req.user.is_admin, // 仅管理员可以管理用户
      recycle_bin_manage: true // 所有用户都可以管理回收站
    };
    
    // 如果指定了模块，只返回该模块的权限
    if (module && permissions.hasOwnProperty(module)) {
      // 记录成功日志
      logger.info('权限检查成功', {
        operation: 'PERMISSION_CHECK',
        userType: req.user.is_admin ? 'ADMIN' : 'SELLER',
        module,
        result: permissions[module],
        userId: req.user.id
      });
      
      return res.success({
        [module]: permissions[module]
      }, '权限检查成功');
    }
    
    // 记录成功日志
    logger.info('权限检查成功', {
      operation: 'PERMISSION_CHECK',
      userType: req.user.is_admin ? 'ADMIN' : 'SELLER',
      permissions,
      userId: req.user.id
    });
    
    // 返回所有权限
    res.success(permissions, '权限检查成功');
    
  } catch (error) {
    // 记录错误日志
    logger.error('权限检查失败', {
      error: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
      context: {
        operation: 'PERMISSION_CHECK',
        errorCode: 500,
        errorType: 'SERVER_ERROR',
        userId: req.user.id
      }
    });
    
    res.error('权限检查失败，请稍后重试', 500);
  }
});

module.exports = router; 
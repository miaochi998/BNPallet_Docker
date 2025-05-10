const express = require('express');
const router = express.Router();
const pool = require('../../config/db');
const { jwtAuth } = require('../../middlewares/jwtAuth');
const crypto = require('crypto');
const logger = require('../../utils/logger');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');

// 确保temp目录存在
const tempDir = path.join(__dirname, '../../../temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// 确保uploads/qrcode目录存在
const qrcodeDir = path.join(__dirname, '../../uploads/qrcode');
if (!fs.existsSync(qrcodeDir)) {
  fs.mkdirSync(qrcodeDir, { recursive: true });
}

/**
 * 生成分享链接接口
 * POST /api/pallet/share
 * 管理员只能分享公司总货盘
 * 销售员只能分享自己的货盘
 */
router.post('/', jwtAuth, async (req, res) => {
  try {
    const { share_type } = req.body;
    const userId = req.user.id;
    const isAdmin = req.user.is_admin;

    // 验证分享类型
    if (share_type !== 'FULL') {
      return res.error('分享类型必须为FULL', 400);
    }

    // 保存分享类型标记 - 区分管理员和销售员
    const palletType = isAdmin ? 'COMPANY' : 'SELLER';

    // 生成32位随机token
    const token = crypto.randomBytes(16).toString('hex');

    // 存储分享记录
    const { rows } = await pool.query(
      `INSERT INTO pallet_shares (
        token, user_id, share_type, created_at, access_count, pallet_type
      ) VALUES (
        $1, $2, $3, NOW(), 0, $4
      ) RETURNING token, created_at, pallet_type`,
      [token, userId, share_type, palletType]
    );

    // 记录成功日志
    logger.info('货盘分享创建成功', {
      operation: 'CREATE_SHARE',
      token,
      userId,
      isAdmin,
      shareType: share_type,
      palletType,
      ip: req.ip
    });

    // 获取前端URL
    const frontendHost = req.get('origin') || `http://${req.get('host').replace(/:\d+/, '')}:6017`;
    
    res.success({
      token: rows[0].token,
      created_at: rows[0].created_at,
      share_url: `${frontendHost}/share/${token}`,
      is_admin: isAdmin,
      pallet_type: rows[0].pallet_type
    }, isAdmin ? '公司总货盘分享链接生成成功' : '个人货盘分享链接生成成功');
  } catch (error) {
    // 记录错误日志
    logger.error('货盘分享创建失败', {
      operation: 'CREATE_SHARE',
      error: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
      userId: req.user?.id,
      ip: req.ip
    });
    
    res.error('分享链接生成失败', 500);
  }
});

/**
 * 生成二维码接口
 * POST /api/pallet/share/qrcode
 */
router.post('/qrcode', jwtAuth, async (req, res) => {
  try {
    const { token, size = 500 } = req.body;
    const userId = req.user.id;

    if (!token) {
      return res.error('缺少token参数', 400);
    }

    // 验证token是否存在
    const { rows: shareExists } = await pool.query(
      'SELECT id, user_id FROM pallet_shares WHERE token = $1',
      [token]
    );

    if (shareExists.length === 0) {
      return res.error('分享token不存在', 404);
    }

    // 确保当前用户是分享的创建者
    if (shareExists[0].user_id !== userId) {
      return res.error('您无权访问此分享的二维码', 403);
    }

    // 获取前端URL
    const frontendHost = req.get('origin') || `http://${req.get('host').replace(/:\d+/, '')}:6017`;
    const shareUrl = `${frontendHost}/share/${token}`;
    
    const qrcodeFileName = `${token}_${Date.now()}.png`;
    const qrcodePath = path.join(qrcodeDir, qrcodeFileName);
    const qrcodeRelativePath = `/uploads/qrcode/${qrcodeFileName}`;

    // 生成二维码
    await QRCode.toFile(qrcodePath, shareUrl, {
      width: size,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    // 记录成功日志
    logger.info('二维码生成成功', {
      operation: 'GENERATE_QRCODE',
      token,
      userId,
      size,
      ip: req.ip
    });

    res.success({
      qrcode_url: qrcodeRelativePath,
      share_url: shareUrl
    }, '二维码生成成功');
  } catch (error) {
    // 记录错误日志
    logger.error('二维码生成失败', {
      operation: 'GENERATE_QRCODE',
      error: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
      token: req.body?.token,
      userId: req.user?.id,
      ip: req.ip
    });
    
    res.error('二维码生成失败', 500);
  }
});

/**
 * 分享记录接口
 * GET /api/pallet/share/history
 */
router.get('/history', jwtAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, page_size = 10 } = req.query;
    const offset = (page - 1) * page_size;
    
    // 查询总记录数
    const { rows: countResult } = await pool.query(
      'SELECT COUNT(*) FROM pallet_shares WHERE user_id = $1',
      [userId]
    );
    
    const totalCount = parseInt(countResult[0].count);
    const totalPages = Math.ceil(totalCount / page_size);
    
    // 获取分页数据
    const { rows: shares } = await pool.query(
      `SELECT
        ps.token,
        ps.share_type,
        ps.created_at,
        ps.last_accessed,
        ps.access_count
      FROM pallet_shares ps
      WHERE ps.user_id = $1
      ORDER BY ps.created_at DESC
      LIMIT $2 OFFSET $3`,
      [userId, page_size, offset]
    );
    
    // 获取前端URL
    const frontendHost = req.get('origin') || `http://${req.get('host').replace(/:\d+/, '')}:6017`;
    
    // 计算每个分享的二维码链接
    const sharesWithQRCode = shares.map(share => ({
      ...share,
      share_url: `${frontendHost}/share/${share.token}`,
      qrcode_url: `/api/pallet/share/qrcode?token=${share.token}`
    }));
    
    // 记录成功日志
    logger.info('获取分享记录成功', {
      operation: 'GET_SHARE_HISTORY',
      userId,
      page,
      pageSize: page_size,
      resultCount: shares.length,
      ip: req.ip
    });
    
    res.success({
      items: sharesWithQRCode,
      meta: {
        current_page: parseInt(page),
        page_size: parseInt(page_size),
        total_pages: totalPages,
        total_count: totalCount
      }
    });
  } catch (error) {
    // 记录错误日志
    logger.error('获取分享记录失败', {
      operation: 'GET_SHARE_HISTORY',
      error: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
      userId: req.user?.id,
      ip: req.ip
    });
    
    res.error('获取分享记录失败', 500);
  }
});

/**
 * 货盘浏览接口 (无需认证)
 * GET /api/pallet/share/:token
 */
router.get('/:token', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { token } = req.params;
    const { 
      page = 1, 
      page_size = 10,
      search,
      brand_id,
      sort_field = 'created_at',
      sort_order = 'desc'
    } = req.query;
    
    const offset = (page - 1) * page_size;
    
    await client.query('BEGIN');
    
    // 验证token是否存在，同时获取分享类型
    const { rows: shareExists } = await client.query(
      'SELECT id, user_id, pallet_type FROM pallet_shares WHERE token = $1',
      [token]
    );
    
    if (shareExists.length === 0) {
      return res.error('分享链接无效或已过期', 404);
    }
    
    const shareId = shareExists[0].id;
    const userId = shareExists[0].user_id;
    const palletType = shareExists[0].pallet_type || (shareExists[0].is_admin ? 'COMPANY' : 'SELLER'); // 兼容旧数据
    
    // 获取用户信息和角色
    const { rows: userInfo } = await client.query(
      `SELECT 
        id, name, phone, email, wechat_qrcode, is_admin, avatar
      FROM users
      WHERE id = $1`,
      [userId]
    );
    
    if (userInfo.length === 0) {
      return res.error('用户不存在', 404);
    }

    const isAdmin = userInfo[0].is_admin;
    
    // 获取用户的店铺信息
    const { rows: stores } = await client.query(
      `SELECT 
        s.platform, s.name, s.url
      FROM user_stores us
      JOIN stores s ON us.store_id = s.id
      WHERE us.user_id = $1`,
      [userId]
    );
    
    // 构建产品查询 - 根据分享的货盘类型决定查询条件
    let productQueryParams = [];
    let paramIndex = 1;
    let productQuery = '';
    
    if (palletType === 'COMPANY') {
      // 公司总货盘查询
      productQuery = `
        SELECT 
          p.id, p.owner_type, p.owner_id, p.name, 
          p.brand_id, b.name as brand_name,
          p.product_code, p.specification, p.net_content,
          p.product_size, p.shipping_method, p.shipping_spec,
          p.shipping_size, p.product_url, p.created_at, p.updated_at
        FROM products p
        JOIN brands b ON p.brand_id = b.id
        WHERE p.owner_type = 'COMPANY' AND p.deleted_at IS NULL
      `;
    } else {
      // 销售员个人货盘查询
      productQuery = `
        SELECT 
          p.id, p.owner_type, p.owner_id, p.name, 
          p.brand_id, b.name as brand_name,
          p.product_code, p.specification, p.net_content,
          p.product_size, p.shipping_method, p.shipping_spec,
          p.shipping_size, p.product_url, p.created_at, p.updated_at
        FROM products p
        JOIN brands b ON p.brand_id = b.id
        WHERE p.owner_type = 'SELLER' AND p.owner_id = $1 AND p.deleted_at IS NULL
      `;
      productQueryParams.push(userId);
      paramIndex++;
    }
    
    // 添加搜索条件
    if (search) {
      productQuery += ` AND (
        p.name ILIKE $${paramIndex}
      )`;
      productQueryParams.push(`%${search}%`);
      paramIndex++;
    }
    
    // 添加品牌筛选
    if (brand_id) {
      productQuery += ` AND p.brand_id = $${paramIndex}`;
      productQueryParams.push(brand_id);
      paramIndex++;
    }
    
    // 添加排序
    const allowedSortFields = ['created_at', 'updated_at', 'name', 'product_code'];
    const allowedSortOrders = ['asc', 'desc'];
    
    const validSortField = allowedSortFields.includes(sort_field) ? sort_field : 'created_at';
    const validSortOrder = allowedSortOrders.includes(sort_order.toLowerCase()) ? sort_order.toLowerCase() : 'desc';
    
    productQuery += ` ORDER BY p.${validSortField} ${validSortOrder}`;
    
    // 添加分页
    productQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    productQueryParams.push(parseInt(page_size), offset);
    
    // 获取产品总数 - 构建计数查询
    let countQuery = '';
    let countParams = [];

    if (palletType === 'COMPANY') {
      // 公司总货盘计数查询
      countQuery = `
        SELECT COUNT(*) FROM products p
        WHERE p.owner_type = 'COMPANY' AND p.deleted_at IS NULL
      `;
      if (search) {
        countQuery += ` AND (
          p.name ILIKE $1
        )`;
        countParams.push(`%${search}%`);
        if (brand_id) {
          countQuery += ` AND p.brand_id = $2`;
          countParams.push(brand_id);
        }
      } else if (brand_id) {
        countQuery += ` AND p.brand_id = $1`;
        countParams.push(brand_id);
      }
    } else {
      // 销售员个人货盘计数查询
      countQuery = `
        SELECT COUNT(*) FROM products p
        WHERE p.owner_type = 'SELLER' AND p.owner_id = $1 AND p.deleted_at IS NULL
      `;
      countParams.push(userId);
      if (search) {
        countQuery += ` AND (
          p.name ILIKE $2
        )`;
        countParams.push(`%${search}%`);
        if (brand_id) {
          countQuery += ` AND p.brand_id = $3`;
          countParams.push(brand_id);
        }
      } else if (brand_id) {
        countQuery += ` AND p.brand_id = $2`;
        countParams.push(brand_id);
      }
    }
    
    // 执行查询
    const { rows: products } = await client.query(productQuery, productQueryParams);
    const { rows: countResult } = await client.query(countQuery, countParams);
    
    const totalCount = parseInt(countResult[0].count);
    const totalPages = Math.ceil(totalCount / page_size);
    
    // 获取产品的价格档位和附件
    for (const product of products) {
      try {
        // 价格档位
        const { rows: priceTiers } = await client.query(
          'SELECT id, product_id, quantity, price FROM price_tiers WHERE product_id = $1 ORDER BY quantity ASC',
          [product.id]
        );
        product.price_tiers = priceTiers;
        
        // 附件 - 包含所有类型的附件
        const { rows: attachments } = await client.query(
          `SELECT 
            id, entity_type, entity_id, file_type, 
            file_name, file_path, file_size, created_at
          FROM attachments
          WHERE entity_type = 'PRODUCT' AND entity_id = $1
          ORDER BY file_type, created_at DESC`,
          [product.id]
        );
        product.attachments = attachments;
      } catch (queryError) {
        logger.error('获取产品相关数据失败', {
          operation: 'ACCESS_SHARE_PRODUCT_DATA',
          error: queryError.message,
          productId: product.id,
          shareId: shareId,
          token: token
        });
        // 设置默认值，确保不会导致整个请求失败
        product.price_tiers = [];
        product.attachments = [];
      }
    }
    
    // 更新访问记录
    try {
      await client.query(
        `UPDATE pallet_shares 
         SET last_accessed = NOW(), access_count = access_count + 1
         WHERE id = $1`,
        [shareId]
      );
      
      // 记录客户访问日志
      try {
        await client.query(
          `INSERT INTO customer_logs (
            share_id, ip_address, user_agent, access_time
          ) VALUES (
            $1, $2, $3, NOW()
          )`,
          [shareId, req.ip || '0.0.0.0', req.get('user-agent') || 'Unknown']
        );
      } catch (logError) {
        // 访问日志记录失败，不应影响整体事务
        logger.warning('客户访问日志记录失败', {
          operation: 'ACCESS_SHARE_LOG',
          error: logError.message,
          shareId,
          token,
          ip: req.ip
        });
        // 继续执行，不回滚事务
      }
      
      await client.query('COMMIT');
      
      // 记录访问日志
      logger.info('货盘访问记录', {
        operation: 'ACCESS_SHARE',
        token,
        userId,
        isAdmin,
        palletType,
        ip: req.ip,
        userAgent: req.get('user-agent')
      });
      
      // 构建响应
      return res.success({
        seller: {
          ...userInfo[0],
          stores
        },
        products: {
          items: products,
          meta: {
            current_page: parseInt(page),
            total_pages: totalPages,
            total_count: totalCount
          }
        }
      });
    } catch (updateError) {
      // 如果更新访问记录失败，记录错误但仍然返回数据
      logger.error('更新访问记录失败', {
        operation: 'UPDATE_SHARE_ACCESS',
        error: updateError.message,
        shareId,
        token,
        ip: req.ip
      });
      
      // 尝试提交事务
      try {
        await client.query('COMMIT');
      } catch (commitError) {
        logger.error('事务提交失败', {
          operation: 'COMMIT_TRANSACTION',
          error: commitError.message,
          token: req.params.token,
          ip: req.ip
        });
      }
      
      // 仍然返回成功响应，因为产品数据已经获取到了
      return res.success({
        seller: {
          ...userInfo[0],
          stores
        },
        products: {
          items: products,
          meta: {
            current_page: parseInt(page),
            total_pages: totalPages,
            total_count: totalCount
          }
        }
      });
    }
  } catch (error) {
    await client.query('ROLLBACK');
    
    // 记录错误日志
    logger.error('货盘访问失败', {
      operation: 'ACCESS_SHARE',
      error: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
      token: req.params.token,
      ip: req.ip
    });
    
    // 更详细的错误信息以便排查
    let errorMessage = '访问货盘失败';
    if (error.code) {
      errorMessage += `: 数据库错误 [${error.code}]`;
    } else if (error.message) {
      errorMessage += `: ${error.message}`;
    }
    
    res.error(errorMessage, 500);
  } finally {
    client.release();
  }
});

module.exports = router; 
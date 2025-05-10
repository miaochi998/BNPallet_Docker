const express = require('express');
const router = express.Router();
const pool = require('../../config/db');
const { jwtAuth } = require('../../middlewares/jwtAuth');
const logger = require('../../utils/logger');

/**
 * 基础分页查询接口
 * GET /api/common/pagination
 * @query {number} [page=1] - 当前页码
 * @query {number} [page_size=10] - 每页数量(10-100)
 * @query {string} [module] - 模块名称，例如 products
 * @query {string} [owner_type] - 所有者类型，对于产品模块有效，可以是 COMPANY 或 SELLER
 */
router.get('/query', jwtAuth, async (req, res) => {
  try {
    // 获取用户分页设置
    const { rows: settings } = await pool.query(
      'SELECT page_size FROM user_pagination_settings WHERE user_id = $1',
      [req.user.id]
    );
    
    // 参数验证
    const page = Math.max(1, parseInt(req.query.page) || 1);
    let pageSize = parseInt(req.query.page_size) || settings[0]?.page_size || 10;
    const module = req.query.module || '';
    const ownerType = req.query.owner_type || '';

    // 排序参数处理
    const validFields = ['name', 'product_code', 'updated_at'];
    const sortField = validFields.includes(req.query.sort_field)
      ? req.query.sort_field
      : 'updated_at';
    const sortOrder = req.query.sort_order === 'asc' ? 'ASC' : 'DESC';
    const orderClause = `ORDER BY ${sortField} ${sortOrder}`;
    
    if (pageSize < 10 || pageSize > 100) {
      return res.status(400).json({
        code: 400,
        error: "INVALID_PAGE_SIZE",
        message: "每页数量必须在10到100之间",
        details: {
          min: 10,
          max: 100,
          provided: pageSize
        }
      });
    }
    
    const limit = pageSize;
    const offset = (page - 1) * pageSize;

    // 记录日志
    logger.info('PAGINATION_QUERY', {
      userId: req.user?.id,
      page,
      pageSize,
      module,
      ownerType,
      route: req.path
    });

    // 根据模块和用户类型构建不同的查询
    let countQuery, dataQuery;
    let queryParams = [];
    let paramIndex = 1;

    if (module === 'products') {
      // 构建权限条件
      let whereClause = '';
      const isAdmin = req.user.is_admin;
      
      // 添加删除标记条件 - 只查询未删除的记录
      whereClause = 'WHERE p.deleted_at IS NULL';
      
      // 根据用户角色和请求的ownerType构建权限条件
      if (ownerType === 'COMPANY') {
        // 请求查看公司货盘
        whereClause += ` AND p.owner_type = 'COMPANY'`;
        console.log(`【调试】分页API - 公司货盘查询:`, {
          user_id: req.user.id,
          user_name: req.user.username,
          is_admin: req.user.is_admin,
          owner_type: ownerType,
          where_clause: whereClause
        });
      } else if (ownerType === 'SELLER' && isAdmin) {
        // 管理员请求查看销售员货盘
        whereClause += ` AND p.owner_type = 'SELLER'`;
        
        // 如果指定了owner_id，添加对应的过滤条件
        if (req.query.owner_id) {
          whereClause += ` AND p.owner_id = $${paramIndex}`;
          queryParams.push(parseInt(req.query.owner_id));
          paramIndex++;
        }
      } else if (ownerType === 'SELLER' && !isAdmin) {
        // 普通用户请求查看销售员货盘 - 只能看自己的
        whereClause += ` AND p.owner_type = 'SELLER' AND p.owner_id = $${paramIndex}`;
        queryParams.push(req.user.id);
        paramIndex++;
      } else {
        // 默认查询 - 根据用户角色确定可见范围
        if (isAdmin) {
          // 管理员可以看到所有产品
          whereClause += ` AND ((p.owner_type = 'COMPANY') OR (p.owner_type = 'SELLER'))`;
        } else {
          // 普通用户只能看到公司产品和自己的产品
          whereClause += ` AND ((p.owner_type = 'COMPANY') OR (p.owner_type = 'SELLER' AND p.owner_id = $${paramIndex}))`;
          queryParams.push(req.user.id);
          paramIndex++;
        }
      }

      // 添加品牌过滤
      if (req.query.brand_id) {
        whereClause += ` AND p.brand_id = $${paramIndex}`;
        queryParams.push(parseInt(req.query.brand_id));
        paramIndex++;
      }

      // 添加关键词搜索
      if (req.query.keyword) {
        whereClause += ` AND (p.name ILIKE $${paramIndex} OR b.name ILIKE $${paramIndex} OR p.product_code ILIKE $${paramIndex} OR p.specification ILIKE $${paramIndex} OR p.net_content ILIKE $${paramIndex})`;
        queryParams.push(`%${req.query.keyword}%`);
        paramIndex++;
      }

      // 构建查询
      countQuery = `
        SELECT COUNT(*) 
        FROM products p
        LEFT JOIN brands b ON p.brand_id = b.id
        ${whereClause}
      `;

      dataQuery = `
        SELECT 
          p.*, 
          b.name as brand_name,
          (
            SELECT json_agg(json_build_object(
              'id', pt.id,
              'quantity', pt.quantity,
              'price', pt.price
            ))
            FROM price_tiers pt
            WHERE pt.product_id = p.id
          ) AS price_tiers,
          (
            SELECT json_agg(json_build_object(
              'id', a.id,
              'file_type', a.file_type,
              'file_path', a.file_path,
              'file_size', a.file_size
            ))
            FROM attachments a
            WHERE a.entity_id = p.id 
            AND a.entity_type = 'PRODUCT'
            AND (a.file_type = 'IMAGE' OR a.file_type = 'MATERIAL')
          ) AS attachments
        FROM products p
        LEFT JOIN brands b ON p.brand_id = b.id
        ${whereClause}
        ${orderClause}
        LIMIT $${paramIndex} OFFSET $${paramIndex+1}
      `;

      // 输出调试信息
      console.log('【调试】分页查询SQL:', {
        countQuery,
        dataQuery,
        whereClause,
        params: queryParams,
        ownerType,
        userId: req.user.id,
        isAdmin: req.user.is_admin
      });

      // 添加分页参数
      queryParams.push(limit, offset);
    } else {
      // 对于其他模块，保持原有查询逻辑
      countQuery = 'SELECT COUNT(*) FROM products';
      dataQuery = `SELECT * FROM products ${orderClause} LIMIT $1 OFFSET $2`;
      queryParams = [limit, offset];
    }

    // 获取总数和分页数据
    const [totalResult, dataResult] = await Promise.all([
      pool.query(countQuery, queryParams.slice(0, -2)), // 去掉最后两个分页参数
      pool.query(dataQuery, queryParams)
    ]);

    const total = parseInt(totalResult.rows[0].count);
    const totalPages = Math.ceil(total / pageSize);
    
    console.log('【调试】分页查询结果:', {
      total,
      items_count: dataResult.rows.length,
      module,
      ownerType,
      userId: req.user.id
    });

    // 如果是产品模块并且需要价格档位和附件
    let items = dataResult.rows;
    if (module === 'products' && req.query.with_price_tiers === 'true' && items.length > 0) {
      const productIds = items.map(p => p.id);
      
      // 获取价格档位
      const { rows: priceTiers } = await pool.query(
        'SELECT product_id, id, quantity, price FROM price_tiers WHERE product_id = ANY($1)',
        [productIds]
      );
      
      // 获取附件
      const { rows: attachments } = await pool.query(
        `SELECT entity_id as product_id, id, file_type, file_path, file_size 
         FROM attachments 
         WHERE entity_type = 'PRODUCT' AND entity_id = ANY($1)`,
        [productIds]
      );
      
      // 将价格档位和附件数据整合到产品中
      items = items.map(product => {
        return {
          ...product,
          price_tiers: priceTiers.filter(pt => pt.product_id === product.id),
          attachments: attachments.filter(att => att.product_id === product.id)
        };
      });
    }

    // 成功响应
    res.json({
      code: 200,
      data: {
        items: items,
        pagination: {
          total,
          current_page: page,
          page_size: pageSize,
          total_pages: totalPages
        }
      }
    });

  } catch (err) {
    // 错误处理
    logger.error('PAGINATION_ERROR', {
      error: err.message,
      stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
      userId: req.user?.id,
      query: req.query
    });
    
    res.status(500).json({
      code: 500,
      error: 'SERVER_ERROR',
      message: '服务器内部错误'
    });
  }
});

/**
 * 分页设置接口
 * POST /api/common/pagination/settings
 */
router.post('/settings', jwtAuth, async (req, res) => {
  try {
    const { page_size } = req.body;
    const validSizes = [10, 20, 50, 100];
    
    if (!validSizes.includes(page_size)) {
      return res.status(400).json({
        code: 400,
        error: "INVALID_PAGE_SIZE",
        message: "每页数量必须是10、20、50或100",
        details: {
          valid_sizes: validSizes,
          provided: page_size
        }
      });
    }

    // 保存用户设置
    await pool.query(`
      INSERT INTO user_pagination_settings (user_id, page_size)
      VALUES ($1, $2)
      ON CONFLICT (user_id)
      DO UPDATE SET page_size = $2, updated_at = CURRENT_TIMESTAMP
    `, [req.user.id, page_size]);

    // 记录日志
    logger.info('PAGINATION_SETTINGS_UPDATE', {
      userId: req.user.id,
      newPageSize: page_size
    });

    res.json({
      code: 200,
      message: "分页设置更新成功",
      data: { page_size }
    });

  } catch (err) {
    logger.error('PAGINATION_SETTINGS_ERROR', {
      error: err.message,
      stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
      userId: req.user?.id
    });
    
    res.status(500).json({
      code: 500,
      error: "SERVER_ERROR",
      message: "服务器内部错误"
    });
  }
});

module.exports = router;
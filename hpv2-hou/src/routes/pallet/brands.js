const express = require('express');
const router = express.Router();
const db = require('../../services/db');  // 使用数据库服务
const { jwtAuth } = require('../../middlewares/jwtAuth');
const logger = require('../../utils/logger');

/**
 * 获取品牌列表（支持分页）
 */
router.get('/', jwtAuth, async (req, res) => {
  try {
    const { status, page = 1, page_size = 10, sort_by = 'updated_at', sort_order = 'desc' } = req.query;
    
    // 分页参数验证和处理
    const currentPage = Math.max(1, parseInt(page));
    const pageSize = Math.min(100, Math.max(10, parseInt(page_size)));
    const offset = (currentPage - 1) * pageSize;
    
    // 排序参数处理 - 只允许排序特定字段
    const allowedSortFields = ['name', 'status', 'updated_at', 'created_at'];
    const sortField = allowedSortFields.includes(sort_by) ? sort_by : 'updated_at';
    const sortDirection = sort_order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    
    // 构建查询参数
    const queryParams = [];
    let paramIndex = 1;
    
    // 构建基础查询SQL - 使用子查询计算总数
    let countQueryText = `
      SELECT COUNT(*) as total
      FROM brands b
    `;
    
    let dataQueryText = `
      SELECT
        b.*,
        (SELECT file_path FROM attachments
         WHERE entity_type='BRAND' AND entity_id=b.id
         AND file_type='IMAGE' 
         ORDER BY id DESC LIMIT 1) as logo_url
      FROM brands b
    `;
    
    // 添加WHERE子句（如果有筛选条件）
    if (status) {
      countQueryText += ` WHERE b.status = $${paramIndex}`;
      dataQueryText += ` WHERE b.status = $${paramIndex}`;
      queryParams.push(status);
      paramIndex++;
    }
    
    // 添加排序和分页
    dataQueryText += ` ORDER BY b.${sortField} ${sortDirection}, b.id DESC`;
    dataQueryText += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(pageSize, offset);
    
    // 分别执行计数查询和数据查询
    const [countResult, dataResult] = await Promise.all([
      db.query(countQueryText, status ? [status] : []),
      db.query(dataQueryText, queryParams)
    ]);
    
    // 获取总记录数和品牌列表
    const total = parseInt(countResult.rows[0].total);
    const brands = dataResult.rows;
    
    // 计算总页数
    const totalPages = Math.ceil(total / pageSize);
    
    // 记录成功日志
    logger.info('获取品牌列表成功', {
      operation: 'GET_BRANDS',
      statusFilter: status || 'ALL',
      page: currentPage,
      pageSize,
      sortBy: sortField,
      sortOrder: sortDirection,
      total,
      count: brands.length,
      userId: req.user.id,
      ip: req.ip
    });
    
    // 返回成功响应，包含分页信息
    res.success({
      list: brands,
      pagination: {
        total,
        current_page: currentPage,
        page_size: pageSize,
        total_pages: totalPages
      }
    });
  } catch (error) {
    // 记录错误日志
    logger.error('获取品牌列表失败', {
      operation: 'GET_BRANDS',
      error: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
      userId: req.user?.id,
      ip: req.ip
    });
    
    res.error(error.message, 500);
  }
});

/**
 * 获取品牌详情
 */
router.get('/:id', jwtAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // 查询品牌详情 - 使用db.query
    const { rows } = await db.query(`
      SELECT
        b.*,
        (SELECT file_path FROM attachments
         WHERE entity_type='BRAND' AND entity_id=b.id
         AND file_type='IMAGE' 
         ORDER BY id DESC LIMIT 1) as logo_url,
        uc.name as created_by_name,
        uu.name as updated_by_name
      FROM brands b
      LEFT JOIN users uc ON b.created_by = uc.id
      LEFT JOIN users uu ON b.updated_by = uu.id
      WHERE b.id = $1
    `, [id]);

    if (rows.length === 0) {
      return res.error('品牌不存在', 404);
    }

    // 记录成功日志
    logger.info('获取品牌详情成功', {
      operation: 'GET_BRAND_DETAIL',
      brandId: id,
      userId: req.user.id,
      ip: req.ip
    });

    res.success(rows[0]);
  } catch (error) {
    // 记录错误日志
    logger.error('获取品牌详情失败', {
      operation: 'GET_BRAND_DETAIL',
      error: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
      brandId: req.params.id,
      userId: req.user?.id,
      ip: req.ip
    });
    
    res.error(error.message, 500);
  }
});

/**
 * 创建品牌
 */
router.post('/', jwtAuth, async (req, res) => {
  try {
    const { name, status = 'ACTIVE' } = req.body;
    const userId = req.user.id;
    
    // 使用事务确保数据一致性
    const newBrand = await db.executeTransaction(async (client) => {
      // 验证品牌名称是否已存在
      const { rows: existingBrands } = await client.query(
        'SELECT id FROM brands WHERE name = $1',
        [name]
      );

      if (existingBrands.length > 0) {
        // 这里抛出错误而不是返回，让事务处理捕获
        const error = new Error('品牌名称已存在');
        error.statusCode = 409;
        throw error;
      }

      // 创建品牌
      const { rows: newBrand } = await client.query(
        `INSERT INTO brands (
          name, status, created_by, updated_by
        ) VALUES (
          $1, $2, $3, $3
        ) RETURNING id, name, status, created_at`,
        [name, status, userId]
      );
      
      return newBrand[0];
    });

    // 记录成功日志
    logger.info('品牌创建成功', {
      operation: 'CREATE_BRAND',
      brandId: newBrand.id,
      brandName: name,
      operator: userId,
      ip: req.ip
    });

    res.success(newBrand, '品牌创建成功');
  } catch (error) {
    // 记录错误日志
    logger.error('品牌创建失败', {
      operation: 'CREATE_BRAND',
      error: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
      attemptName: req.body.name,
      operator: req.user?.id,
      ip: req.ip
    });
    
    // 使用错误状态码（如果有）
    res.error('品牌创建失败: ' + error.message, error.statusCode || 500);
  }
});

/**
 * 更新品牌信息
 */
router.put('/:id', jwtAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, status, logo_url, replace_logo, delete_logo } = req.body;
    const userId = req.user.id;
    
    console.log('[BRANDS API] 更新品牌请求', {
      brandId: id,
      name,
      status,
      logo_url,
      replaceLogo: replace_logo,
      deleteLogo: delete_logo
    });
    
    // 使用事务处理
    const updatedBrand = await db.executeTransaction(async (client) => {
      // 验证品牌是否存在
      const { rows: existingBrand } = await client.query(
        'SELECT id FROM brands WHERE id = $1',
        [id]
      );

      if (existingBrand.length === 0) {
        const error = new Error('品牌不存在');
        error.statusCode = 404;
        throw error;
      }

      // 验证品牌名称是否已被其他品牌使用
      const { rows: nameConflict } = await client.query(
        'SELECT id FROM brands WHERE name = $1 AND id != $2',
        [name, id]
      );

      if (nameConflict.length > 0) {
        const error = new Error('品牌名称已存在');
        error.statusCode = 409;
        throw error;
      }

      // 如果需要删除LOGO
      if (delete_logo) {
        console.log('[BRANDS API] 处理删除品牌LOGO请求', { brandId: id });
        
        // 查询现有LOGO附件
        const { rows: existingAttachments } = await client.query(
          'SELECT id, file_path FROM attachments WHERE entity_type = $1 AND entity_id = $2 AND file_type = $3 AND deleted_at IS NULL',
          ['BRAND', id, 'IMAGE']
        );
        
        if (existingAttachments.length > 0) {
          console.log('[BRANDS API] 找到现有Logo附件，标记为删除', { 
            attachmentCount: existingAttachments.length,
            attachmentIds: existingAttachments.map(a => a.id)
          });
          
          // 标记附件为已删除
          for (const attachment of existingAttachments) {
            await client.query(
              'UPDATE attachments SET deleted_at = NOW(), deleted_by = $1 WHERE id = $2',
              [userId, attachment.id]
            );
          }
        }
      }
      
      // 如果要替换LOGO，记录但不处理，logo将通过attachments接口上传
      if (replace_logo) {
        console.log('[BRANDS API] 收到替换LOGO标记，将通过附件接口上传新LOGO', {
          brandId: id
        });
      }

      // 更新品牌信息
      const { rows: updatedBrand } = await client.query(
        `UPDATE brands
         SET name = $1,
             status = $2,
             updated_by = $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4
         RETURNING id, name, status, updated_at`,
        [name, status, userId, id]
      );
      
      return updatedBrand[0];
    });

    // 记录成功日志
    logger.info('品牌更新成功', {
      operation: 'UPDATE_BRAND',
      brandId: id,
      newName: name,
      newStatus: status,
      logoAction: delete_logo ? 'DELETE' : (replace_logo ? 'REPLACE' : 'UNCHANGED'),
      operator: userId,
      ip: req.ip
    });

    res.success(updatedBrand, '品牌更新成功');
  } catch (error) {
    // 记录错误日志
    logger.error('品牌更新失败', {
      operation: 'UPDATE_BRAND',
      error: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
      brandId: req.params.id,
      operator: req.user?.id,
      ip: req.ip
    });
    
    // 使用错误状态码（如果有）
    res.error('品牌更新失败: ' + error.message, error.statusCode || 500);
  }
});

/**
 * 删除品牌
 */
router.delete('/:id', jwtAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // 使用事务处理
    await db.executeTransaction(async (client) => {
      // 验证品牌是否存在
      const { rows: existingBrand } = await client.query(
        'SELECT id FROM brands WHERE id = $1',
        [id]
      );

      if (existingBrand.length === 0) {
        const error = new Error('品牌不存在');
        error.statusCode = 404;
        throw error;
      }

      // 检查是否有产品关联
      const { rows: relatedProducts } = await client.query(
        'SELECT COUNT(*) as count FROM products WHERE brand_id = $1 AND deleted_at IS NULL',
        [id]
      );

      if (parseInt(relatedProducts[0].count) > 0) {
        const error = new Error('无法删除：该品牌下存在产品');
        error.statusCode = 400;
        throw error;
      }

      // 删除品牌
      await client.query('DELETE FROM brands WHERE id = $1', [id]);
    });

    // 记录成功日志
    logger.info('品牌删除成功', {
      operation: 'DELETE_BRAND',
      brandId: id,
      operator: userId,
      ip: req.ip
    });

    res.success(null, '品牌删除成功');
  } catch (error) {
    // 记录错误日志
    logger.error('品牌删除失败', {
      operation: 'DELETE_BRAND',
      error: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
      brandId: req.params.id,
      operator: req.user?.id,
      ip: req.ip
    });
    
    // 使用错误状态码（如果有）
    res.error('品牌删除失败: ' + error.message, error.statusCode || 500);
  }
});

/**
 * 变更品牌状态
 */
router.patch('/:id/status', jwtAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.id;

    // 验证品牌是否存在
    const { rows: existingBrand } = await db.query(
      'SELECT id FROM brands WHERE id = $1',
      [id]
    );

    if (existingBrand.length === 0) {
      return res.error('品牌不存在', 404);
    }

    // 更新品牌状态
    const { rows: updatedBrand } = await db.query(
      `UPDATE brands
       SET status = $1,
           updated_by = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id, name, status, updated_at`,
      [status, userId, id]
    );

    // 记录成功日志
    logger.info('品牌状态变更成功', {
      operation: 'UPDATE_BRAND_STATUS',
      brandId: id,
      newStatus: status,
      operator: userId,
      ip: req.ip
    });

    res.success(updatedBrand[0], '品牌状态变更成功');
  } catch (error) {
    // 记录错误日志
    logger.error('品牌状态变更失败', {
      operation: 'UPDATE_BRAND_STATUS',
      error: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
      brandId: req.params.id,
      operator: req.user?.id,
      ip: req.ip
    });
    
    res.error('品牌状态变更失败', 500);
  }
});

module.exports = router;
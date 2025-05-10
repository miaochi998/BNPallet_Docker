const express = require('express');
const router = express.Router();
const pool = require('../../config/db');
const { jwtAuth } = require('../../middlewares/jwtAuth');
const logger = require('../../utils/logger');
const { body, param, query, validationResult } = require('express-validator');
const validationHandler = require('../../middlewares/validationHandler');

/**
 * 回收站查询接口
 * GET /api/pallet/recycle
 */
router.get('/',
  jwtAuth,
  // 验证请求参数
  [
    query('page').optional().isInt({ min: 1 }).withMessage('页码必须大于或等于1'),
    query('page_size').optional().isInt({ min: 10, max: 100 }).withMessage('每页数量必须在10到100之间'),
    query('search').optional().trim(),
    query('brand_id').optional().isInt({ min: 1 }).withMessage('品牌ID必须大于0'),
    query('sort_field').optional().isIn(['name', 'brand_name', 'product_code', 'deleted_at']).withMessage('排序字段不合法'),
    query('sort_order').optional().isIn(['asc', 'desc']).withMessage('排序方向不合法')
  ],
  validationHandler,
  async (req, res) => {
    const client = await pool.connect();
    const startTime = Date.now();

    try {
      // 获取查询参数
      const page = parseInt(req.query.page) || 1;
      const pageSize = parseInt(req.query.page_size) || 10;
      const search = req.query.search ? `%${req.query.search}%` : null;
      const brandId = req.query.brand_id ? parseInt(req.query.brand_id) : null;
      const sortField = req.query.sort_field || 'deleted_at';
      const sortOrder = req.query.sort_order === 'asc' ? 'ASC' : 'DESC';
      
      // 分页参数
      const offset = (page - 1) * pageSize;
      const limit = pageSize;

      // 准备查询参数
      const queryParams = [];
      let paramIndex = 1;

      // 权限控制: 检查用户类型
      const ownerType = req.user.is_admin ? 'COMPANY' : 'SELLER';
      const ownerId = req.user.is_admin ? null : req.user.id;
      const isAdmin = req.user.is_admin;

      // 构建基础查询
      let baseQuery = `
        FROM recycle_bin rb
        JOIN products p ON rb.entity_id = p.id AND rb.entity_type = 'PRODUCT'
        LEFT JOIN brands b ON p.brand_id = b.id
        WHERE rb.owner_type = $${paramIndex++}
      `;
      queryParams.push(ownerType);

      // 添加权限控制
      if (!isAdmin) {
        baseQuery += ` AND rb.owner_id = $${paramIndex++}`;
        queryParams.push(ownerId);
      }

      // 添加搜索过滤
      if (search) {
        baseQuery += ` AND (p.name ILIKE $${paramIndex++} OR p.product_code = $${paramIndex++})`;
        queryParams.push(search, search.replace(/%/g, '')); // 第二个是精确匹配货号
      }

      // 添加品牌过滤
      if (brandId) {
        baseQuery += ` AND p.brand_id = $${paramIndex++}`;
        queryParams.push(brandId);
      }

      // 仅查找未还原的记录
      baseQuery += ` AND rb.restored_at IS NULL`;

      // 计算总记录数
      const { rows: countResult } = await client.query(
        `SELECT COUNT(*) ${baseQuery}`,
        queryParams
      );
      const total = parseInt(countResult[0].count);

      // 构建排序表达式
      let orderClause;
      switch (sortField) {
        case 'name':
          orderClause = `p.name ${sortOrder}`;
          break;
        case 'brand_name':
          orderClause = `b.name ${sortOrder}`;
          break;
        case 'product_code':
          orderClause = `p.product_code ${sortOrder}`;
          break;
        case 'deleted_at':
        default:
          orderClause = `rb.deleted_at ${sortOrder}`;
      }

      // 查询回收站产品列表
      const { rows: recycleItems } = await client.query(
        `SELECT 
          rb.id,
          rb.entity_type,
          rb.entity_id,
          rb.owner_type,
          rb.owner_id,
          rb.deleted_by,
          rb.deleted_at,
          p.name,
          p.product_code,
          p.specification,
          p.net_content,
          p.product_size,
          p.shipping_method,
          p.shipping_spec,
          p.shipping_size,
          p.product_url,
          p.updated_at,
          b.id AS brand_id,
          b.name AS brand_name,
          (
            SELECT json_agg(json_build_object(
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
        ${baseQuery}
        ORDER BY ${orderClause}
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
        [...queryParams, limit, offset]
      );

      // 格式化响应数据
      const formattedItems = recycleItems.map(item => {
        return {
          id: item.id,
          entity_type: item.entity_type,
          entity_id: item.entity_id,
          owner_type: item.owner_type,
          owner_id: item.owner_id,
          deleted_by: item.deleted_by,
          deleted_at: item.deleted_at,
          product: {
            name: item.name,
            product_code: item.product_code,
            brand_id: item.brand_id,
            brand_name: item.brand_name,
            specification: item.specification,
            net_content: item.net_content,
            product_size: item.product_size,
            shipping_method: item.shipping_method,
            shipping_spec: item.shipping_spec,
            shipping_size: item.shipping_size,
            product_url: item.product_url,
            updated_at: item.updated_at,
            price_tiers: item.price_tiers || [],
            attachments: item.attachments || []
          }
        };
      });

      // 记录成功日志
      logger.info('回收站查询成功', {
        operation: 'RECYCLE_QUERY',
        page,
        pageSize,
        total,
        userId: req.user.id,
        ip: req.ip,
        filter: {
          search: req.query.search,
          brandId: brandId
        },
        duration: `${Date.now() - startTime}ms`
      });

      // 返回成功响应
      res.success({
        list: formattedItems,
        pagination: {
          total,
          current_page: page,
          per_page: pageSize,
          total_pages: Math.ceil(total / pageSize)
        }
      });
    } catch (error) {
      // 记录错误日志
      logger.error('回收站查询失败', {
        operation: 'RECYCLE_QUERY',
        error: error.message,
        stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
        userId: req.user?.id,
        ip: req.ip,
        query: req.query,
        duration: `${Date.now() - startTime}ms`
      });

      // 返回错误响应
      res.error('回收站查询失败: ' + error.message, 500);
    } finally {
      client.release();
    }
  }
);

/**
 * 产品还原接口
 * POST /api/pallet/recycle/:id/restore
 */
router.post('/:id/restore',
  jwtAuth,
  [
    param('id').isInt({ min: 1 }).withMessage('回收站记录ID必须是有效的整数'),
    body('confirm').isBoolean().withMessage('confirm必须是布尔值')
  ],
  validationHandler,
  async (req, res) => {
    const client = await pool.connect();
    const startTime = Date.now();

    try {
      const recycleId = parseInt(req.params.id);
      const { confirm } = req.body;

      if (!confirm) {
        return res.error('请确认还原操作', 400);
      }

      // 开始事务
      await client.query('BEGIN');

      // 验证回收站记录存在
      const { rows: recycleCheck } = await client.query(
        `SELECT id, entity_id, owner_type, owner_id
         FROM recycle_bin
         WHERE id = $1
         AND entity_type = 'PRODUCT'
         AND restored_at IS NULL`,
        [recycleId]
      );

      if (recycleCheck.length === 0) {
        await client.query('ROLLBACK');
        return res.error('回收站记录不存在或已还原', 404);
      }

      // 验证用户权限
      const recycleItem = recycleCheck[0];
      const isAdmin = req.user.is_admin;
      const productId = recycleItem.entity_id;

      if (!isAdmin && (recycleItem.owner_type !== 'SELLER' || recycleItem.owner_id !== req.user.id)) {
        await client.query('ROLLBACK');
        return res.error('无权操作此回收站记录', 403);
      }

      // 更新回收站记录
      await client.query(
        `UPDATE recycle_bin
         SET restored_by = $1,
             restored_at = NOW()
         WHERE id = $2`,
        [req.user.id, recycleId]
      );

      // 还原产品状态
      await client.query(
        `UPDATE products
         SET deleted_at = NULL
         WHERE id = $1`,
        [productId]
      );

      // 提交事务
      await client.query('COMMIT');

      // 记录成功日志
      logger.info('产品还原成功', {
        operation: 'RESTORE_PRODUCT',
        recycleId,
        productId,
        userId: req.user.id,
        ip: req.ip,
        duration: `${Date.now() - startTime}ms`
      });

      // 返回成功响应
      res.success({
        product_id: productId,
        status: 'ACTIVE',
        restored_at: new Date()
      }, '产品已从回收站还原');
    } catch (error) {
      // 回滚事务
      await client.query('ROLLBACK');

      // 记录错误日志
      logger.error('产品还原失败', {
        operation: 'RESTORE_PRODUCT',
        error: error.message,
        stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
        recycleId: req.params.id,
        userId: req.user?.id,
        ip: req.ip,
        duration: `${Date.now() - startTime}ms`
      });

      // 返回错误响应
      res.error('产品还原失败: ' + error.message, 500);
    } finally {
      client.release();
    }
  }
);

/**
 * 永久删除接口
 * DELETE /api/pallet/recycle/:id
 */
router.delete('/:id',
  jwtAuth,
  [
    param('id').isInt({ min: 1 }).withMessage('回收站记录ID必须是有效的整数'),
    body('confirm').isBoolean().withMessage('confirm必须是布尔值')
  ],
  validationHandler,
  async (req, res) => {
    const client = await pool.connect();
    const startTime = Date.now();

    try {
      const recycleId = parseInt(req.params.id);
      const { confirm } = req.body;

      if (!confirm) {
        return res.error('请确认永久删除操作', 400);
      }

      // 开始事务
      await client.query('BEGIN');

      // 验证回收站记录存在
      const { rows: recycleCheck } = await client.query(
        `SELECT id, entity_id, owner_type, owner_id
         FROM recycle_bin
         WHERE id = $1
         AND entity_type = 'PRODUCT'
         AND restored_at IS NULL`,
        [recycleId]
      );

      if (recycleCheck.length === 0) {
        await client.query('ROLLBACK');
        return res.error('回收站记录不存在或已还原', 404);
      }

      // 验证用户权限
      const recycleItem = recycleCheck[0];
      const isAdmin = req.user.is_admin;
      const productId = recycleItem.entity_id;

      if (!isAdmin && (recycleItem.owner_type !== 'SELLER' || recycleItem.owner_id !== req.user.id)) {
        await client.query('ROLLBACK');
        return res.error('无权操作此回收站记录', 403);
      }

      // 获取产品的附件信息
      const { rows: attachments } = await client.query(
        `SELECT id, file_path
         FROM attachments
         WHERE entity_type = 'PRODUCT'
         AND entity_id = $1`,
        [productId]
      );

      // 删除附件物理文件
      if (attachments.length > 0) {
        const fs = require('fs');
        const path = require('path');
        
        for (const attachment of attachments) {
          try {
            // 获取正确的绝对路径
            const relativePath = attachment.file_path.startsWith('/') ? 
              attachment.file_path.substring(1) : attachment.file_path;
            
            const absolutePath = path.join(__dirname, '../../../', relativePath);
            logger.info('尝试删除附件物理文件', {
              operation: 'DELETE_ATTACHMENT_FILE',
              filePath: relativePath,
              absolutePath: absolutePath,
              exists: fs.existsSync(absolutePath),
              productId: productId,
              userId: req.user.id
            });
            
            if (fs.existsSync(absolutePath)) {
              fs.unlinkSync(absolutePath);
              logger.info('删除附件物理文件成功', {
                operation: 'DELETE_ATTACHMENT_FILE',
                filePath: absolutePath,
                productId: productId,
                userId: req.user.id
              });
            } else {
              // 尝试使用src目录下的路径
              const srcPath = path.join(__dirname, '../../../src', relativePath);
              logger.info('尝试删除src目录下的附件物理文件', {
                operation: 'DELETE_ATTACHMENT_FILE',
                srcPath: srcPath,
                exists: fs.existsSync(srcPath),
                productId: productId,
                userId: req.user.id
              });
              
              if (fs.existsSync(srcPath)) {
                fs.unlinkSync(srcPath);
                logger.info('删除附件物理文件成功(src路径)', {
                  operation: 'DELETE_ATTACHMENT_FILE',
                  filePath: srcPath,
                  productId: productId,
                  userId: req.user.id
                });
              }
            }
          } catch (fileError) {
            logger.error('删除附件物理文件失败', {
              operation: 'DELETE_ATTACHMENT_FILE',
              error: fileError.message,
              filePath: attachment.file_path,
              productId: productId,
              userId: req.user.id
            });
            // 继续处理其他文件，不中断流程
          }
        }
        
        // 删除附件数据库记录
        await client.query(
          `DELETE FROM attachments
           WHERE entity_type = 'PRODUCT'
           AND entity_id = $1`,
          [productId]
        );
      }

      // 删除产品记录
      await client.query(
        `DELETE FROM products 
         WHERE id = $1`,
        [productId]
      );

      // 删除回收站记录
      await client.query(
        `DELETE FROM recycle_bin 
         WHERE id = $1`,
        [recycleId]
      );

      // 提交事务
      await client.query('COMMIT');

      // 记录成功日志
      logger.info('产品永久删除成功', {
        operation: 'PERMANENT_DELETE',
        recycleId,
        productId,
        userId: req.user.id,
        ip: req.ip,
        duration: `${Date.now() - startTime}ms`
      });

      // 返回成功响应
      res.success({
        product_id: productId,
        deleted: true
      }, '产品已永久删除');
    } catch (error) {
      // 回滚事务
      await client.query('ROLLBACK');

      // 记录错误日志
      logger.error('产品永久删除失败', {
        operation: 'PERMANENT_DELETE',
        error: error.message,
        stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
        recycleId: req.params.id,
        userId: req.user?.id,
        ip: req.ip,
        duration: `${Date.now() - startTime}ms`
      });

      // 返回错误响应
      res.error('产品永久删除失败: ' + error.message, 500);
    } finally {
      client.release();
    }
  }
);

/**
 * 批量还原接口
 * POST /api/pallet/recycle/batch-restore
 */
router.post('/batch-restore',
  jwtAuth,
  [
    body('ids').isArray({ min: 1 }).withMessage('ids必须是非空数组')
  ],
  validationHandler,
  async (req, res) => {
    const client = await pool.connect();
    const startTime = Date.now();

    try {
      const { ids } = req.body;
      
      // 确保ids是数字数组
      const recycleIds = ids.map(id => parseInt(id)).filter(id => !isNaN(id));
      
      if (recycleIds.length === 0) {
        return res.error('ids必须包含有效的整数ID', 400);
      }

      // 开始事务
      await client.query('BEGIN');

      // 验证用户权限并获取有效的回收站记录
      const { rows: validRecycles } = await client.query(
        `SELECT id, entity_id
         FROM recycle_bin
         WHERE id = ANY($1)
         AND entity_type = 'PRODUCT'
         AND restored_at IS NULL
         AND (owner_type = 'COMPANY' AND $2 = true OR owner_type = 'SELLER' AND owner_id = $3)`,
        [recycleIds, req.user.is_admin, req.user.id]
      );

      if (validRecycles.length === 0) {
        await client.query('ROLLBACK');
        return res.error('没有找到有效的回收站记录或无权操作', 404);
      }

      // 获取有效的ID列表
      const validIds = validRecycles.map(item => item.id);
      const validProductIds = validRecycles.map(item => item.entity_id);

      // 批量更新回收站记录
      await client.query(
        `UPDATE recycle_bin
         SET restored_by = $1,
             restored_at = NOW()
         WHERE id = ANY($2)`,
        [req.user.id, validIds]
      );

      // 批量还原产品状态
      await client.query(
        `UPDATE products
         SET deleted_at = NULL
         WHERE id = ANY($1)`,
        [validProductIds]
      );

      // 提交事务
      await client.query('COMMIT');

      // 记录成功日志
      logger.info('批量还原产品成功', {
        operation: 'BATCH_RESTORE',
        recycleIds: validIds,
        productIds: validProductIds,
        userId: req.user.id,
        count: validIds.length,
        ip: req.ip,
        duration: `${Date.now() - startTime}ms`
      });

      // 返回成功响应
      res.success({
        total: ids.length,
        success: validIds.length,
        failed: ids.length - validIds.length,
        failed_ids: ids.filter(id => !validIds.includes(parseInt(id)))
      }, '批量还原完成');
    } catch (error) {
      // 回滚事务
      await client.query('ROLLBACK');

      // 记录错误日志
      logger.error('批量还原产品失败', {
        operation: 'BATCH_RESTORE',
        error: error.message,
        stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
        ids: req.body.ids,
        userId: req.user?.id,
        ip: req.ip,
        duration: `${Date.now() - startTime}ms`
      });

      // 返回错误响应
      res.error('批量还原产品失败: ' + error.message, 500);
    } finally {
      client.release();
    }
  }
);

/**
 * 批量删除接口
 * POST /api/pallet/recycle/batch-delete
 */
router.post('/batch-delete',
  jwtAuth,
  [
    body('ids').isArray({ min: 1 }).withMessage('ids必须是非空数组'),
    body('confirm').isBoolean().withMessage('confirm必须是布尔值')
  ],
  validationHandler,
  async (req, res) => {
    const client = await pool.connect();
    const startTime = Date.now();

    try {
      const { ids, confirm } = req.body;
      
      if (!confirm) {
        return res.error('请确认批量永久删除操作', 400);
      }
      
      // 确保ids是数字数组
      const recycleIds = ids.map(id => parseInt(id)).filter(id => !isNaN(id));
      
      if (recycleIds.length === 0) {
        return res.error('ids必须包含有效的整数ID', 400);
      }

      // 开始事务
      await client.query('BEGIN');

      // 验证用户权限并获取有效的回收站记录
      const { rows: validRecycles } = await client.query(
        `SELECT id, entity_id
         FROM recycle_bin
         WHERE id = ANY($1)
         AND entity_type = 'PRODUCT'
         AND restored_at IS NULL
         AND (owner_type = 'COMPANY' AND $2 = true OR owner_type = 'SELLER' AND owner_id = $3)`,
        [recycleIds, req.user.is_admin, req.user.id]
      );

      if (validRecycles.length === 0) {
        await client.query('ROLLBACK');
        return res.error('没有找到有效的回收站记录或无权操作', 404);
      }

      // 获取有效的ID列表
      const validIds = validRecycles.map(item => item.id);
      const validProductIds = validRecycles.map(item => item.entity_id);

      // 获取产品的附件信息
      const { rows: attachments } = await client.query(
        `SELECT id, entity_id, file_path
         FROM attachments
         WHERE entity_type = 'PRODUCT'
         AND entity_id = ANY($1)`,
        [validProductIds]
      );

      // 删除附件物理文件
      if (attachments.length > 0) {
        const fs = require('fs');
        const path = require('path');
        
        for (const attachment of attachments) {
          try {
            // 获取正确的绝对路径
            const relativePath = attachment.file_path.startsWith('/') ? 
              attachment.file_path.substring(1) : attachment.file_path;
            
            const absolutePath = path.join(__dirname, '../../../', relativePath);
            logger.info('尝试删除附件物理文件', {
              operation: 'DELETE_ATTACHMENT_FILE',
              filePath: relativePath,
              absolutePath: absolutePath,
              exists: fs.existsSync(absolutePath),
              productId: attachment.entity_id,
              userId: req.user.id
            });
            
            if (fs.existsSync(absolutePath)) {
              fs.unlinkSync(absolutePath);
              logger.info('删除附件物理文件成功', {
                operation: 'DELETE_ATTACHMENT_FILE',
                filePath: absolutePath,
                productId: attachment.entity_id,
                userId: req.user.id
              });
            } else {
              // 尝试使用src目录下的路径
              const srcPath = path.join(__dirname, '../../../src', relativePath);
              logger.info('尝试删除src目录下的附件物理文件', {
                operation: 'DELETE_ATTACHMENT_FILE',
                srcPath: srcPath,
                exists: fs.existsSync(srcPath),
                productId: attachment.entity_id,
                userId: req.user.id
              });
              
              if (fs.existsSync(srcPath)) {
                fs.unlinkSync(srcPath);
                logger.info('删除附件物理文件成功(src路径)', {
                  operation: 'DELETE_ATTACHMENT_FILE',
                  filePath: srcPath,
                  productId: attachment.entity_id,
                  userId: req.user.id
                });
              }
            }
          } catch (fileError) {
            logger.error('删除附件物理文件失败', {
              operation: 'DELETE_ATTACHMENT_FILE',
              error: fileError.message,
              filePath: attachment.file_path,
              productId: attachment.entity_id,
              userId: req.user.id
            });
            // 继续处理其他文件，不中断流程
          }
        }
        
        // 删除附件数据库记录
        await client.query(
          `DELETE FROM attachments
           WHERE entity_type = 'PRODUCT'
           AND entity_id = ANY($1)`,
          [validProductIds]
        );
      }

      // 批量删除产品记录
      await client.query(
        `DELETE FROM products 
         WHERE id = ANY($1)`,
        [validProductIds]
      );

      // 批量删除回收站记录
      await client.query(
        `DELETE FROM recycle_bin 
         WHERE id = ANY($1)`,
        [validIds]
      );

      // 提交事务
      await client.query('COMMIT');

      // 记录成功日志
      logger.info('批量永久删除产品成功', {
        operation: 'BATCH_DELETE',
        recycleIds: validIds,
        productIds: validProductIds,
        userId: req.user.id,
        count: validIds.length,
        ip: req.ip,
        duration: `${Date.now() - startTime}ms`
      });

      // 记录安全审计日志（大量删除）
      if (validIds.length >= 5) {
        logger.warning('安全警告: 批量永久删除操作', {
          userId: req.user.id,
          operation: 'BATCH_DELETE',
          count: validIds.length,
          ip: req.ip,
          affectedProducts: validProductIds
        });
      }

      // 返回成功响应
      res.success({
        total: ids.length,
        success: validIds.length,
        failed: ids.length - validIds.length
      }, '批量删除完成');
    } catch (error) {
      // 回滚事务
      await client.query('ROLLBACK');

      // 记录错误日志
      logger.error('批量永久删除产品失败', {
        operation: 'BATCH_DELETE',
        error: error.message,
        stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
        ids: req.body.ids,
        userId: req.user?.id,
        ip: req.ip,
        duration: `${Date.now() - startTime}ms`
      });

      // 返回错误响应
      res.error('批量永久删除产品失败: ' + error.message, 500);
    } finally {
      client.release();
    }
  }
);

module.exports = router; 
const express = require('express');
const router = express.Router();
const pool = require('../../config/db');
const { jwtAuth } = require('../../middlewares/jwtAuth');
const logger = require('../../utils/logger');
const { body, param } = require('express-validator');
const validationHandler = require('../../middlewares/validationHandler');

/**
 * 创建价格档位接口
 * POST /api/pallet/price_tiers
 */
router.post('/',
  jwtAuth,
  [
    body('product_id').isInt({ min: 1 }).withMessage('产品ID必须是有效的整数'),
    body('quantity').notEmpty().withMessage('数量不能为空'),
    body('price').notEmpty().withMessage('价格不能为空')
  ],
  validationHandler,
  async (req, res) => {
    const { product_id, quantity, price } = req.body;
    const startTime = Date.now();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 验证产品存在且有权限操作
      const { rows: productCheck } = await client.query(
        `SELECT id FROM products 
         WHERE id = $1 
         AND (
           (owner_type = 'COMPANY' AND $2 = true) OR 
           (owner_type = 'SELLER' AND owner_id = $3)
         )
         AND deleted_at IS NULL`,
        [product_id, req.user.is_admin, req.user.id]
      );

      if (productCheck.length === 0) {
        await client.query('ROLLBACK');
        logger.warning('创建价格档位失败：无权限或产品不存在', {
          operation: 'CREATE_PRICE_TIER',
          productId: product_id,
          userId: req.user.id,
          ip: req.ip
        });
        return res.error('无权操作该产品或产品不存在', 403);
      }

      // 创建价格档位
      const { rows } = await client.query(
        `INSERT INTO price_tiers (product_id, quantity, price, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         RETURNING *`,
        [
          product_id,
          quantity.toString(),
          price.toString()
        ]
      );

      await client.query('COMMIT');

      logger.info('价格档位创建成功', {
        operation: 'CREATE_PRICE_TIER',
        priceTierId: rows[0].id,
        productId: product_id,
        userId: req.user.id,
        ip: req.ip,
        duration: `${Date.now() - startTime}ms`
      });

      res.success(rows[0], '价格档位创建成功');
    } catch (error) {
      await client.query('ROLLBACK');
      
      logger.error('价格档位创建失败', {
        operation: 'CREATE_PRICE_TIER',
        error: error.message,
        stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
        productId: product_id,
        userId: req.user.id,
        ip: req.ip,
        requestBody: req.body,
        duration: `${Date.now() - startTime}ms`
      });

      res.error('价格档位创建失败: ' + error.message, 500);
    } finally {
      client.release();
    }
  }
);

/**
 * 更新价格档位接口
 * PUT /api/pallet/price_tiers/:id
 */
router.put('/:id',
  jwtAuth,
  [
    param('id').isInt({ min: 1 }).withMessage('价格档位ID必须是有效的整数'),
    body('quantity').optional().notEmpty().withMessage('数量不能为空'),
    body('price').optional().notEmpty().withMessage('价格不能为空')
  ],
  validationHandler,
  async (req, res) => {
    const { id } = req.params;
    const { quantity, price } = req.body;
    const startTime = Date.now();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 验证价格档位存在且有权限操作
      const { rows: tierCheck } = await client.query(
        `SELECT pt.id, pt.product_id
         FROM price_tiers pt
         JOIN products p ON pt.product_id = p.id
         WHERE pt.id = $1
         AND (
           (p.owner_type = 'COMPANY' AND $2 = true) OR 
           (p.owner_type = 'SELLER' AND p.owner_id = $3)
         )
         AND p.deleted_at IS NULL`,
        [id, req.user.is_admin, req.user.id]
      );

      if (tierCheck.length === 0) {
        await client.query('ROLLBACK');
        logger.warning('更新价格档位失败：无权限或价格档位不存在', {
          operation: 'UPDATE_PRICE_TIER',
          priceTierId: id,
          userId: req.user.id,
          ip: req.ip
        });
        return res.error('无权操作该价格档位或价格档位不存在', 403);
      }

      // 构建更新字段
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;

      if (quantity !== undefined) {
        updateFields.push(`quantity = $${paramIndex}`);
        updateValues.push(quantity.toString());
        paramIndex++;
      }

      if (price !== undefined) {
        updateFields.push(`price = $${paramIndex}`);
        updateValues.push(price.toString());
        paramIndex++;
      }

      updateFields.push(`updated_at = NOW()`);

      if (updateFields.length === 1) {
        // 只有updated_at字段，没有实际更新
        await client.query('ROLLBACK');
        return res.error('未提供需要更新的字段', 400);
      }

      // 更新价格档位
      updateValues.push(id);
      const { rows } = await client.query(
        `UPDATE price_tiers
         SET ${updateFields.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING *`,
        updateValues
      );

      await client.query('COMMIT');

      logger.info('价格档位更新成功', {
        operation: 'UPDATE_PRICE_TIER',
        priceTierId: id,
        productId: tierCheck[0].product_id,
        userId: req.user.id,
        ip: req.ip,
        duration: `${Date.now() - startTime}ms`
      });

      res.success(rows[0], '价格档位更新成功');
    } catch (error) {
      await client.query('ROLLBACK');
      
      logger.error('价格档位更新失败', {
        operation: 'UPDATE_PRICE_TIER',
        error: error.message,
        stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
        priceTierId: id,
        userId: req.user.id,
        ip: req.ip,
        requestBody: req.body,
        duration: `${Date.now() - startTime}ms`
      });

      res.error('价格档位更新失败: ' + error.message, 500);
    } finally {
      client.release();
    }
  }
);

/**
 * 删除价格档位接口
 * DELETE /api/pallet/price_tiers/:id
 */
router.delete('/:id',
  jwtAuth,
  [
    param('id').isInt({ min: 1 }).withMessage('价格档位ID必须是有效的整数'),
  ],
  validationHandler,
  async (req, res) => {
    const { id } = req.params;
    const startTime = Date.now();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 验证价格档位存在且有权限操作
      const { rows: tierCheck } = await client.query(
        `SELECT pt.id, pt.product_id
         FROM price_tiers pt
         JOIN products p ON pt.product_id = p.id
         WHERE pt.id = $1
         AND (
           (p.owner_type = 'COMPANY' AND $2 = true) OR 
           (p.owner_type = 'SELLER' AND p.owner_id = $3)
         )
         AND p.deleted_at IS NULL`,
        [id, req.user.is_admin, req.user.id]
      );

      if (tierCheck.length === 0) {
        await client.query('ROLLBACK');
        logger.warning('删除价格档位失败：无权限或价格档位不存在', {
          operation: 'DELETE_PRICE_TIER',
          priceTierId: id,
          userId: req.user.id,
          ip: req.ip
        });
        return res.error('无权操作该价格档位或价格档位不存在', 403);
      }

      const productId = tierCheck[0].product_id;

      // 删除价格档位
      await client.query(
        'DELETE FROM price_tiers WHERE id = $1',
        [id]
      );

      await client.query('COMMIT');

      logger.info('价格档位删除成功', {
        operation: 'DELETE_PRICE_TIER',
        priceTierId: id,
        productId: productId,
        userId: req.user.id,
        ip: req.ip,
        duration: `${Date.now() - startTime}ms`
      });

      res.success({
        id,
        product_id: productId
      }, '价格档位删除成功');
    } catch (error) {
      await client.query('ROLLBACK');
      
      logger.error('价格档位删除失败', {
        operation: 'DELETE_PRICE_TIER',
        error: error.message,
        stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
        priceTierId: id,
        userId: req.user.id,
        ip: req.ip,
        duration: `${Date.now() - startTime}ms`
      });

      res.error('价格档位删除失败: ' + error.message, 500);
    } finally {
      client.release();
    }
  }
);

module.exports = router; 
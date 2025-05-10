const express = require('express');
const router = express.Router();
const pool = require('../../config/db');
const { jwtAuth } = require('../../middlewares/jwtAuth');
const logger = require('../../utils/logger');
const { body, param, query } = require('express-validator');
const validationHandler = require('../../middlewares/validationHandler');
const path = require('path');
const fs = require('fs');

/**
 * 创建产品接口
 * POST /api/pallet/products
 */
router.post('/',
  jwtAuth,
  // 验证请求参数
  [
    body('name').notEmpty().withMessage('产品名称不能为空').trim(),
    body('brand_id').optional().isInt({ min: 1 }).withMessage('品牌ID必须是有效的整数'),
    body('product_code').optional().trim(),
    body('specification').optional().trim(),
    body('net_content').optional().trim(),
    body('product_size').optional().trim(),
    body('shipping_method').optional().trim(),
    body('shipping_spec').optional().trim(),
    body('shipping_size').optional().trim(),
    body('product_url').optional().trim().custom(value => {
      if (!value || value === '') {
        return true; // 允许空字符串
      }
      // 验证URL格式
      const urlPattern = /^(https?:\/\/)(www\.)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(:[0-9]+)?(\/[^\s]*)?$/;
      if (!urlPattern.test(value)) {
        throw new Error('产品链接格式不正确');
      }
      return true;
    })
  ],
  validationHandler,
  // 处理产品创建
  async (req, res) => {
    const client = await pool.connect();
    const startTime = Date.now(); // 记录开始时间用于性能监控
    
    try {
      const { 
        name, 
        brand_id, 
        product_code,
        specification,
        net_content,
        product_size,
        shipping_method,
        shipping_spec,
        shipping_size,
        product_url
      } = req.body;

      // 开始事务
      await client.query('BEGIN');

      // 检查品牌是否存在
      if (brand_id) {
        const { rows: brandCheck } = await client.query(
          'SELECT id FROM brands WHERE id = $1',
          [brand_id]
        );

        if (brandCheck.length === 0) {
          await client.query('ROLLBACK');
          return res.error('指定的品牌不存在', 404);
        }
      }

      // 检查产品货号是否已存在
      if (product_code) {
        const { rows: productCodeCheck } = await client.query(
          'SELECT id FROM products WHERE product_code = $1 AND (owner_type = $2 AND (owner_id = $3 OR owner_id IS NULL)) AND deleted_at IS NULL',
          [
            product_code, 
            req.user.is_admin ? 'COMPANY' : 'SELLER',
            req.user.is_admin ? null : req.user.id
          ]
        );

        if (productCodeCheck.length > 0) {
          await client.query('ROLLBACK');
          return res.error('产品货号已存在', 409);
        }
      }

      // 1. 创建产品
      const { rows: productResult } = await client.query(
        `INSERT INTO products (
          owner_type, owner_id, name, brand_id, product_code,
          specification, net_content, product_size,
          shipping_method, shipping_spec, shipping_size, product_url,
          created_by, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW()
        ) RETURNING *`,
        [
          req.user.is_admin ? 'COMPANY' : 'SELLER',
          req.user.is_admin ? null : req.user.id,
          name.substring(0, 255),
          brand_id || null,
          product_code ? product_code.substring(0, 100) : null,
          specification ? specification.substring(0, 255) : null,
          net_content ? net_content.substring(0, 100) : null,
          product_size ? product_size.substring(0, 100) : null,
          shipping_method ? shipping_method.substring(0, 100) : null,
          shipping_spec ? shipping_spec.substring(0, 100) : null,
          shipping_size ? shipping_size.substring(0, 100) : null,
          product_url ? product_url.substring(0, 255) : null,
          req.user.id // 添加created_by
        ]
      );

      const productId = productResult[0].id;

      // 获取品牌信息
      let brandName = '';
      if (brand_id) {
        const { rows: brandInfo } = await client.query(
          'SELECT name as brand_name FROM brands WHERE id = $1',
          [brand_id]
        );
        brandName = brandInfo[0]?.brand_name || '';
      }

      // 组装响应数据
      const productData = {
        ...productResult[0],
        brand_name: brandName,
        price_tiers: [], // 初始为空数组，通过独立价格档位接口管理
        attachments: [] // 初始为空数组，附件通过单独的接口上传
      };

      // 提交事务
      await client.query('COMMIT');

      // 记录成功日志
      logger.info('产品创建成功', {
        operation: 'CREATE_PRODUCT',
        productId: productId,
        brandId: brand_id,
        userId: req.user.id,
        ip: req.ip,
        duration: `${Date.now() - startTime}ms`
      });

      res.success(productData, '产品创建成功');
    } catch (error) {
      // 回滚事务
      await client.query('ROLLBACK');

      // 记录错误日志
      logger.error('产品创建失败', {
        operation: 'CREATE_PRODUCT',
        error: error.message,
        stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
        userId: req.user?.id,
        ip: req.ip,
        requestBody: {
          ...req.body,
          // 不记录完整的价格档位数组，只记录长度
          price_tiers: req.body.price_tiers ? `Array(${req.body.price_tiers.length})` : undefined
        },
        duration: `${Date.now() - startTime}ms`
      });

      // 用户友好的错误信息
      let errorMessage = '产品创建失败';
      if (error.code === '23505') {
        errorMessage = '产品货号已存在';
      } else if (error.code === '23503') {
        errorMessage = '关联的品牌不存在';
      } else {
        errorMessage += ': ' + error.message;
      }

      res.error(errorMessage, error.code ? 400 : 500);
    } finally {
      client.release();
    }
  }
);

/**
 * 更新产品接口
 * PUT /api/pallet/products/:id
 */
router.put('/:id',
  jwtAuth,
  // 验证请求参数
  [
    param('id').isInt({ min: 1 }).withMessage('产品ID必须是有效的整数'),
    body('name').optional().trim(),
    body('brand_id').optional().custom(value => {
      // 允许null值或大于等于1的整数
      if (value === null || value === undefined) {
        return true;
      }
      const numValue = Number(value);
      if (Number.isInteger(numValue) && numValue >= 1) {
        return true;
      }
      throw new Error('品牌ID必须是有效的整数或为空');
    }),
    body('product_code').optional().trim(),
    body('specification').optional().trim(),
    body('net_content').optional().trim(),
    body('product_size').optional().trim(),
    body('shipping_method').optional().trim(),
    body('shipping_spec').optional().trim(),
    body('shipping_size').optional().trim(),
    body('product_url').optional().trim().custom(value => {
      if (!value || value === '') {
        return true; // 允许空字符串
      }
      // 验证URL格式
      const urlPattern = /^(https?:\/\/)(www\.)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(:[0-9]+)?(\/[^\s]*)?$/;
      if (!urlPattern.test(value)) {
        throw new Error('产品链接格式不正确');
      }
      return true;
    }),
    body('deleted_attachment_ids').optional().isArray().withMessage('要删除的附件ID列表必须是数组格式')
  ],
  validationHandler,
  async (req, res, next) => {
    // 确保deleted_attachment_ids是数组
    if (req.body.deleted_attachment_ids && typeof req.body.deleted_attachment_ids === 'string') {
      try {
        req.body.deleted_attachment_ids = JSON.parse(req.body.deleted_attachment_ids);
        logger.debug('附件ID列表JSON解析成功', {
          path: req.path,
          ids: req.body.deleted_attachment_ids,
          userId: req.user?.id
        });
      } catch (e) {
        logger.warning('附件ID列表格式错误', {
          path: req.path,
          error: e.message,
          value: req.body.deleted_attachment_ids,
          userId: req.user?.id
        });
        return res.error('要删除的附件ID列表格式错误', 400);
      }
    }
    
    next();
  },
  // 处理产品更新
  async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    const startTime = Date.now(); // 记录开始时间用于性能监控

    try {
      // 记录收到的请求
      logger.debug('产品更新请求', {
        productId: id,
        userId: req.user?.id,
        is_admin: req.user?.is_admin,
        method: req.method,
        path: req.path,
        body: JSON.stringify(req.body).substring(0, 200)
      });

      const { 
        name, 
        brand_id, 
        product_code,
        specification,
        net_content,
        product_size,
        shipping_method,
        shipping_spec,
        shipping_size,
        product_url,
        deleted_attachment_ids
      } = req.body;

      // 开始事务
      await client.query('BEGIN');

      // 先检查产品是否存在
      const { rows: productExists } = await client.query(
        'SELECT id FROM products WHERE id = $1 AND deleted_at IS NULL',
        [id]
      );
      
      if (productExists.length === 0) {
        await client.query('ROLLBACK');
        logger.warning('产品不存在', {
          operation: 'UPDATE_PRODUCT',
          productId: id,
          userId: req.user?.id,
          ip: req.ip
        });
        return res.error('产品不存在', 404);
      }

      // 1. 检查产品是否存在且当前用户有权限操作
      const { rows: productCheck } = await client.query(
        `SELECT * FROM products WHERE id = $1 AND (
          (owner_type = 'COMPANY' AND $2 = true) OR
          (owner_type = 'SELLER' AND owner_id = $3)
        ) AND deleted_at IS NULL`,
        [id, req.user.is_admin === true, req.user.id]
      );
      
      if (productCheck.length === 0) {
        // 记录权限错误日志
        logger.warning('尝试更新无权限的产品', {
          operation: 'UPDATE_PRODUCT',
          productId: id,
          userId: req.user.id,
          is_admin: req.user.is_admin,
          ip: req.ip
        });
        
        await client.query('ROLLBACK');
        return res.error('无权操作该产品', 403);
      }

      const existingProduct = productCheck[0];

      // 2. 如果更新品牌ID，检查品牌是否存在
      if (brand_id) {
        const { rows: brandCheck } = await client.query(
          'SELECT id FROM brands WHERE id = $1',
          [brand_id]
        );

        if (brandCheck.length === 0) {
          await client.query('ROLLBACK');
          return res.error('指定的品牌不存在', 404);
        }
      }

      // 3. 如果更新产品货号，检查是否与其他产品冲突
      if (product_code && product_code !== existingProduct.product_code) {
        const { rows: productCodeCheck } = await client.query(
          'SELECT id FROM products WHERE product_code = $1 AND id != $2 AND (owner_type = $3 AND (owner_id = $4 OR owner_id IS NULL)) AND deleted_at IS NULL',
          [
            product_code, 
            id,
            req.user.is_admin ? 'COMPANY' : 'SELLER',
            req.user.is_admin ? null : req.user.id
          ]
        );

        if (productCodeCheck.length > 0) {
          await client.query('ROLLBACK');
          return res.error('产品货号已存在', 409);
        }
      }

      // 4. 更新产品基础信息
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;

      // 动态构建更新语句
      if (name !== undefined) {
        updateFields.push(`name = $${paramIndex}`);
        updateValues.push(name.substring(0, 255));
        paramIndex++;
      }

      if (brand_id !== undefined) {
        updateFields.push(`brand_id = $${paramIndex}`);
        updateValues.push(brand_id);
        paramIndex++;
      }

      if (product_code !== undefined) {
        updateFields.push(`product_code = $${paramIndex}`);
        updateValues.push(product_code.substring(0, 100));
        paramIndex++;
      }

      if (specification !== undefined) {
        updateFields.push(`specification = $${paramIndex}`);
        updateValues.push(specification ? specification.substring(0, 255) : null);
        paramIndex++;
      }

      if (net_content !== undefined) {
        updateFields.push(`net_content = $${paramIndex}`);
        updateValues.push(net_content ? net_content.substring(0, 100) : null);
        paramIndex++;
      }

      if (product_size !== undefined) {
        updateFields.push(`product_size = $${paramIndex}`);
        updateValues.push(product_size ? product_size.substring(0, 100) : null);
        paramIndex++;
      }

      if (shipping_method !== undefined) {
        updateFields.push(`shipping_method = $${paramIndex}`);
        updateValues.push(shipping_method ? shipping_method.substring(0, 100) : null);
        paramIndex++;
      }

      if (shipping_spec !== undefined) {
        updateFields.push(`shipping_spec = $${paramIndex}`);
        updateValues.push(shipping_spec ? shipping_spec.substring(0, 100) : null);
        paramIndex++;
      }

      if (shipping_size !== undefined) {
        updateFields.push(`shipping_size = $${paramIndex}`);
        updateValues.push(shipping_size ? shipping_size.substring(0, 100) : null);
        paramIndex++;
      }

      if (product_url !== undefined) {
        updateFields.push(`product_url = $${paramIndex}`);
        updateValues.push(product_url ? product_url.substring(0, 255) : null);
        paramIndex++;
      }

      // 添加更新时间和更新人
      updateFields.push(`updated_at = NOW()`);
      updateFields.push(`updated_by = $${paramIndex}`);
      updateValues.push(req.user.id);
      paramIndex++;

      // 如果有字段需要更新，执行更新操作
      let updatedProduct = existingProduct;
      if (updateFields.length > 0) {
        const updateQuery = `
          UPDATE products 
          SET ${updateFields.join(', ')}
          WHERE id = $${paramIndex}
          RETURNING *
        `;
        updateValues.push(id);

        const { rows } = await client.query(updateQuery, updateValues);
        updatedProduct = rows[0];
      }

      // 6. 如果提供了要删除的附件ID列表，删除指定的附件
      if (deleted_attachment_ids && deleted_attachment_ids.length > 0) {
        // 首先验证这些附件是否属于该产品，并获取文件路径以便删除物理文件
        const { rows: attachmentCheck } = await client.query(
          `SELECT id, file_path, file_type FROM attachments 
           WHERE id = ANY($1) 
           AND entity_type = 'PRODUCT' 
           AND entity_id = $2`,
          [deleted_attachment_ids, id]
        );
        
        const validAttachmentIds = attachmentCheck.map(a => a.id);
        
        if (validAttachmentIds.length > 0) {
          // 删除物理文件
          for (const attachment of attachmentCheck) {
            try {
              // 获取正确的绝对路径
              const fileRelativePath = attachment.file_path.startsWith('/') ? 
                attachment.file_path.substring(1) : attachment.file_path;
              
              // 尝试多个可能的路径
              const possiblePaths = [
                path.join(__dirname, '../../../', fileRelativePath), // 项目根目录
                path.join(__dirname, '../../', fileRelativePath),    // src目录
                path.join(__dirname, '../../../src', fileRelativePath) // 项目根目录下的src目录
              ];
              
              // 尝试删除文件
              let fileDeleted = false;
              for (const filePath of possiblePaths) {
                if (fs.existsSync(filePath)) {
                  fs.unlinkSync(filePath);
                  logger.info('成功删除附件物理文件', {
                    operation: 'DELETE_ATTACHMENT',
                    productId: id,
                    attachmentId: attachment.id,
                    fileType: attachment.file_type,
                    filePath: filePath,
                    userId: req.user.id
                  });
                  fileDeleted = true;
                  break;
                }
              }
              
              if (!fileDeleted) {
                logger.warning('未找到要删除的附件物理文件', {
                  operation: 'DELETE_ATTACHMENT',
                  productId: id,
                  attachmentId: attachment.id,
                  filePath: attachment.file_path,
                  userId: req.user.id,
                  triedPaths: possiblePaths
                });
              }
            } catch (error) {
              logger.error('删除附件物理文件失败', {
                operation: 'DELETE_ATTACHMENT',
                error: error.message,
                productId: id,
                attachmentId: attachment.id,
                filePath: attachment.file_path,
                userId: req.user.id
              });
              // 继续处理，不中断流程
            }
          }
          
          // 然后从数据库中删除附件记录
          await client.query(
            `DELETE FROM attachments 
             WHERE id = ANY($1)`,
            [validAttachmentIds]
          );
          
          logger.info('成功删除附件数据库记录', {
            operation: 'DELETE_ATTACHMENT',
            productId: id,
            attachmentIds: validAttachmentIds,
            count: validAttachmentIds.length,
            userId: req.user.id
          });
        }
        
        // 如果有无效的附件ID，记录警告日志
        if (validAttachmentIds.length !== deleted_attachment_ids.length) {
          logger.warning('尝试删除无效的附件', {
            operation: 'UPDATE_PRODUCT',
            productId: id,
            userId: req.user.id,
            requestedIds: deleted_attachment_ids,
            validIds: validAttachmentIds
          });
        }
      }

      // 7. 获取最新的产品信息 - 使用Promise.all并行查询提高性能
      const [priceTiersResult, attachments] = await Promise.all([
        // 获取价格档位
        client.query(
          'SELECT id, product_id, quantity, price FROM price_tiers WHERE product_id = $1',
          [id]
        ),
        
        // 获取附件信息
        client.query(
          `SELECT id, file_type, file_name, file_size, file_path, created_at
           FROM attachments 
           WHERE entity_type = 'PRODUCT' AND entity_id = $1`,
          [id]
        )
      ]);
      
      // 单独处理品牌信息查询，避免品牌ID为null时的错误
      let brandName = '';
      if (updatedProduct.brand_id) {
        try {
          const brandInfo = await client.query(
            'SELECT name as brand_name FROM brands WHERE id = $1',
            [updatedProduct.brand_id]
          );
          brandName = brandInfo.rows[0]?.brand_name || '';
        } catch (brandError) {
          logger.warning('获取品牌信息失败', {
            operation: 'UPDATE_PRODUCT',
            error: brandError.message,
            brandId: updatedProduct.brand_id,
            productId: id
          });
        }
      }

      // 组装响应数据
      const productData = {
        ...updatedProduct,
        brand_name: brandName,
        price_tiers: priceTiersResult.rows,
        attachments: attachments.rows
      };

      // 提交事务
      await client.query('COMMIT');

      // 记录成功日志
      logger.info('产品更新成功', {
        operation: 'UPDATE_PRODUCT',
        productId: id,
        brandId: updatedProduct.brand_id,
        changedFields: Object.keys(req.body),
        userId: req.user.id,
        deletedAttachments: deleted_attachment_ids?.length || 0,
        ip: req.ip,
        duration: `${Date.now() - startTime}ms`
      });

      res.success(productData, '产品更新成功');
    } catch (error) {
      // 回滚事务
      await client.query('ROLLBACK');

      // 记录错误日志
      logger.error('产品更新失败', {
        operation: 'UPDATE_PRODUCT',
        error: error.message,
        stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
        productId: id,
        userId: req.user?.id,
        ip: req.ip,
        requestBody: {
          ...req.body,
          // 不记录完整的价格档位数组，只记录长度
          deleted_attachment_ids: req.body.deleted_attachment_ids ? 
            `Array(${req.body.deleted_attachment_ids.length})` : undefined
        },
        duration: `${Date.now() - startTime}ms`
      });

      // 用户友好的错误信息
      let errorMessage = '产品更新失败';
      if (error.code === '23505') {
        errorMessage = '产品货号已存在';
      } else if (error.code === '23503') {
        errorMessage = '关联的品牌不存在';
      } else {
        errorMessage += ': ' + error.message;
      }

      res.error(errorMessage, error.code ? 400 : 500);
    } finally {
      client.release();
    }
  }
);

/**
 * 获取产品详情接口
 * GET /api/pallet/products/:id
 */
router.get('/:id', 
  jwtAuth,
  [
    param('id').isInt({ min: 1 }).withMessage('产品ID必须是有效的整数')
  ],
  validationHandler,
  async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    req._startTime = Date.now(); // 记录开始时间用于性能统计
    
    try {
      // 使用Promise.all并行执行所有查询，提高性能
      const [productResult, priceTiersResult, attachmentsResult] = await Promise.all([
        // 1. 获取产品基本信息
        client.query(
          `SELECT p.*, b.name as brand_name
           FROM products p
           LEFT JOIN brands b ON p.brand_id = b.id
           WHERE p.id = $1 AND (
             (p.owner_type = 'COMPANY' AND $2 = true) OR
             (p.owner_type = 'SELLER' AND p.owner_id = $3)
           ) AND p.deleted_at IS NULL`,
          [id, req.user.is_admin, req.user.id]
        ),
        
        // 2. 获取价格档位 - 并行执行，稍后检查产品是否存在
        client.query(
          'SELECT id, product_id, quantity, price FROM price_tiers WHERE product_id = $1',
          [id]
        ),
        
        // 3. 获取附件信息 - 并行执行，稍后检查产品是否存在
        client.query(
          `SELECT id, file_type, file_name, file_size, file_path, created_at
           FROM attachments 
           WHERE entity_type = 'PRODUCT' AND entity_id = $1`,
          [id]
        )
      ]);
      
      // 检查产品是否存在和用户权限
      if (productResult.rows.length === 0) {
        // 检查产品是否存在但无权访问
        const { rows: productExists } = await client.query(
          'SELECT id FROM products WHERE id = $1 AND deleted_at IS NULL',
          [id]
        );
        
        if (productExists.length > 0) {
          // 记录权限错误日志
          logger.warning('尝试访问无权限的产品', {
            operation: 'GET_PRODUCT',
            productId: id,
            userId: req.user.id,
            ip: req.ip
          });
          
          return res.error('无权访问该产品', 403);
        }
        
        return res.error('产品不存在', 404);
      }
      
      const product = productResult.rows[0];
      
      // 4. 组装响应数据
      const productData = {
        ...product,
        price_tiers: priceTiersResult.rows,
        attachments: attachmentsResult.rows
      };
      
      // 记录日志
      logger.info('查询产品详情', {
        operation: 'GET_PRODUCT',
        productId: id,
        userId: req.user.id,
        ip: req.ip,
        duration: `${Date.now() - req._startTime}ms`
      });
      
      res.success(productData);
    } catch (error) {
      // 记录错误日志
      logger.error('查询产品详情失败', {
        operation: 'GET_PRODUCT',
        error: error.message,
        stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
        productId: id,
        userId: req.user?.id,
        ip: req.ip,
        duration: `${Date.now() - req._startTime}ms`
      });
      
      res.error('查询产品详情失败: ' + error.message, 500);
    } finally {
      client.release();
    }
  }
);

/**
 * 获取产品列表接口
 * GET /api/pallet/products
 */
router.get('/', 
  jwtAuth,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('页码必须是大于等于1的整数'),
    query('page_size').optional().isInt({ min: 10, max: 100 }).withMessage('每页数量必须在10-100之间'),
    query('brand_id').optional().isInt({ min: 1 }).withMessage('品牌ID必须是有效的整数'),
    query('sort_field').optional().isIn(['name', 'product_code', 'created_at', 'updated_at', 'brand_id']).withMessage('排序字段无效')
  ],
  validationHandler,
  async (req, res) => {
    const { 
      page = 1, 
      page_size = 10, 
      name, 
      brand_id, 
      product_code,
      sort_field,
      sort_order = 'desc',
      keyword
    } = req.query;
    
    const client = await pool.connect();
    
    try {
      // 获取用户设置的页面大小（如果存在）
      let userPageSize = page_size;
      
      try {
        const { rows: settings } = await client.query(
          'SELECT page_size FROM user_pagination_settings WHERE user_id = $1',
          [req.user.id]
        );
        
        if (settings.length > 0) {
          userPageSize = settings[0].page_size;
        }
      } catch (error) {
        // 忽略获取用户分页设置的错误，使用默认值
        logger.warning('获取用户分页设置失败，使用默认值', {
          userId: req.user.id,
          error: error.message
        });
      }
      
      // 验证和处理分页参数
      const limit = Math.min(Math.max(10, parseInt(userPageSize)), 100);
      const offset = (Math.max(1, parseInt(page)) - 1) * limit;
      
      // 构建查询条件
      const conditions = [];
      const params = [];
      let paramIndex = 1;
      
      // 获取当前用户可访问的产品
      conditions.push(`(p.owner_type = 'COMPANY' AND $${paramIndex} = true) OR (p.owner_type = 'SELLER' AND p.owner_id = $${paramIndex+1})`);
      params.push(req.user.is_admin, req.user.id);
      paramIndex += 2;
      
      // 只返回未删除的产品
      conditions.push(`p.deleted_at IS NULL`);
      
      // 添加关键词搜索（支持产品名称和货号）
      if (keyword) {
        conditions.push(`(p.name ILIKE $${paramIndex} OR p.product_code ILIKE $${paramIndex})`);
        params.push(`%${keyword}%`);
        paramIndex++;
      } else {
        // 精确筛选条件
        if (name) {
          conditions.push(`p.name ILIKE $${paramIndex}`);
          params.push(`%${name}%`);
          paramIndex++;
        }
        
        if (product_code) {
          conditions.push(`p.product_code = $${paramIndex}`);
          params.push(product_code);
          paramIndex++;
        }
      }
      
      // 品牌筛选
      if (brand_id) {
        conditions.push(`p.brand_id = $${paramIndex}`);
        params.push(brand_id);
        paramIndex++;
      }
      
      // 构建WHERE子句
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      
      // 处理排序
      const validSortFields = ['name', 'product_code', 'created_at', 'updated_at', 'brand_id'];
      const sortFieldSql = validSortFields.includes(sort_field) ? 
        `p.${sort_field}` : 'p.updated_at';
      const sortOrderSql = sort_order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
      const orderClause = `ORDER BY ${sortFieldSql} ${sortOrderSql}, p.id DESC`;
      
      // 使用Promise.all并行执行总数查询和数据查询，提高性能
      const [countResult, productsResult] = await Promise.all([
        // 获取总记录数
        client.query(`
          SELECT COUNT(*) as total 
          FROM products p
          ${whereClause}
        `, params),
        
        // 获取分页数据
        client.query(`
          SELECT p.*, b.name as brand_name
          FROM products p
          LEFT JOIN brands b ON p.brand_id = b.id
          ${whereClause}
          ${orderClause}
          LIMIT $${paramIndex} OFFSET $${paramIndex+1}
        `, [...params, limit, offset])
      ]);
      
      const total = parseInt(countResult.rows[0].total);
      const products = productsResult.rows;
      
      // 获取产品对应的价格档位和附件信息
      const productIds = products.map(p => p.id);
      let priceTiers = [];
      let attachments = [];
      
      if (productIds.length > 0) {
        // 使用Promise.all并行查询价格档位和附件
        const [tierResults, attachmentResults] = await Promise.all([
          // 获取价格档位
          client.query(
            'SELECT id, product_id, quantity, price FROM price_tiers WHERE product_id = ANY($1)',
            [productIds]
          ),
          
          // 获取附件信息
          client.query(
            `SELECT id, entity_id as product_id, file_type, file_name, file_size, file_path, created_at
             FROM attachments 
             WHERE entity_type = 'PRODUCT' AND entity_id = ANY($1)`,
            [productIds]
          )
        ]);
        
        priceTiers = tierResults.rows;
        attachments = attachmentResults.rows;
      }
      
      // 使用Map来优化产品关联数据的组装，提高大数据量时的性能
      const priceTiersMap = new Map();
      priceTiers.forEach(tier => {
        if (!priceTiersMap.has(tier.product_id)) {
          priceTiersMap.set(tier.product_id, []);
        }
        priceTiersMap.get(tier.product_id).push(tier);
      });
      
      const attachmentsMap = new Map();
      attachments.forEach(attachment => {
        if (!attachmentsMap.has(attachment.product_id)) {
          attachmentsMap.set(attachment.product_id, []);
        }
        attachmentsMap.get(attachment.product_id).push(attachment);
      });
      
      // 组装响应数据
      const result = products.map(product => {
        return {
          ...product,
          price_tiers: priceTiersMap.get(product.id) || [],
          attachments: attachmentsMap.get(product.id) || []
        };
      });
      
      // 计算分页信息
      const totalPages = Math.ceil(total / limit);
      const currentPage = parseInt(page);
      
      // 记录日志
      logger.info('查询产品列表', {
        operation: 'LIST_PRODUCTS',
        params: req.query,
        count: products.length,
        total,
        userId: req.user.id,
        ip: req.ip,
        duration: Date.now() - req._startTime // 添加执行时间统计
      });
      
      res.success({
        list: result,
        pagination: {
          current: currentPage,
          pageSize: limit,
          total,
          totalPages
        }
      });
    } catch (error) {
      // 记录错误日志
      logger.error('查询产品列表失败', {
        operation: 'LIST_PRODUCTS',
        error: error.message,
        stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
        userId: req.user?.id,
        ip: req.ip,
        params: req.query
      });
      
      res.error('查询产品列表失败: ' + error.message, 500);
    } finally {
      client.release();
    }
  }
);

/**
 * 永久删除产品接口
 * DELETE /api/pallet/products/:id/permanent
 */
router.delete('/:id/permanent',
  jwtAuth,
  // 验证请求参数
  [
    param('id').isInt({ min: 1 }).withMessage('产品ID必须是有效的整数')
  ],
  validationHandler,
  async (req, res) => {
    const client = await pool.connect();
    const startTime = Date.now(); // 记录开始时间用于性能监控
    
    try {
      const productId = parseInt(req.params.id, 10);
      
      // 开始事务
      await client.query('BEGIN');
      
      // 检查产品是否存在并验证权限
      const { rows: productCheck } = await client.query(
        `SELECT p.id, p.name, p.owner_type, p.owner_id, p.deleted_at
         FROM products p
         WHERE p.id = $1
         AND (
           (p.owner_type = 'COMPANY' AND $2 = true) OR
           (p.owner_type = 'SELLER' AND p.owner_id = $3)
         )`,
        [productId, req.user.is_admin, req.user.id]
      );
      
      if (productCheck.length === 0) {
        await client.query('ROLLBACK');
        return res.error('产品不存在或您没有权限操作此产品', 404);
      }
      
      const product = productCheck[0];
      
      // 检查从回收站中删除回收站记录
      await client.query(
        `DELETE FROM recycle_bin
         WHERE entity_type = 'PRODUCT'
         AND entity_id = $1`,
        [productId]
      );
      
      // 删除相关的价格档位数据
      await client.query(
        `DELETE FROM price_tiers
         WHERE product_id = $1`,
        [productId]
      );
      
      // 删除相关的附件记录
      const { rows: attachments } = await client.query(
        `SELECT id, file_path
         FROM attachments
         WHERE entity_type = 'PRODUCT'
         AND entity_id = $1`,
        [productId]
      );
      
      if (attachments.length > 0) {
        // 删除附件记录
        await client.query(
          `DELETE FROM attachments
           WHERE entity_type = 'PRODUCT'
           AND entity_id = $1`,
          [productId]
        );
        
        // 删除物理文件
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
      }
      
      // 永久删除产品
      await client.query(
        `DELETE FROM products
         WHERE id = $1`,
        [productId]
      );
      
      // 提交事务
      await client.query('COMMIT');
      
      // 记录成功日志
      logger.info('产品永久删除成功', {
        operation: 'PERMANENT_DELETE_PRODUCT',
        productId: productId,
        productName: product.name,
        userId: req.user.id,
        ip: req.ip,
        duration: `${Date.now() - startTime}ms`
      });
      
      res.success({
        id: productId,
        name: product.name,
        deleted_at: new Date().toISOString()
      }, '产品已永久删除');
      
    } catch (error) {
      // 回滚事务
      await client.query('ROLLBACK');
      
      // 记录错误日志
      logger.error('产品永久删除失败', {
        operation: 'PERMANENT_DELETE_PRODUCT',
        error: error.message,
        stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
        productId: parseInt(req.params.id, 10),
        userId: req.user?.id,
        ip: req.ip,
        duration: `${Date.now() - startTime}ms`
      });
      
      // 用户友好的错误信息
      let errorMessage = '产品永久删除失败';
      if (error.code === '23503') {
        errorMessage = '产品存在关联数据，无法删除';
      } else {
        errorMessage += ': ' + error.message;
      }
      
      res.error(errorMessage, error.code ? 400 : 500);
    } finally {
      client.release();
    }
  }
);

/**
 * 产品移入回收站接口
 * POST /api/pallet/products/:id/recycle
 */
router.post('/:id/recycle',
  jwtAuth,
  [
    param('id').isInt({ min: 1 }).withMessage('产品ID必须是有效的整数'),
    body('confirm').isBoolean().withMessage('confirm必须是布尔值')
  ],
  validationHandler,
  async (req, res) => {
    const client = await pool.connect();
    const startTime = Date.now();

    try {
      const productId = parseInt(req.params.id);
      const { confirm } = req.body;

      if (!confirm) {
        return res.error('请确认移入回收站操作', 400);
      }

      // 开始事务
      await client.query('BEGIN');

      // 验证产品存在且可操作
      const { rows: productCheck } = await client.query(
        `SELECT id, owner_type, owner_id 
         FROM products 
         WHERE id = $1 AND deleted_at IS NULL`,
        [productId]
      );

      if (productCheck.length === 0) {
        await client.query('ROLLBACK');
        return res.error('产品不存在或已在回收站中', 404);
      }

      // 验证用户权限
      const product = productCheck[0];
      const isAdmin = req.user.is_admin;
      const isSeller = !isAdmin;

      if (isSeller && (product.owner_type !== 'SELLER' || product.owner_id !== req.user.id)) {
        await client.query('ROLLBACK');
        return res.error('无权操作此产品', 403);
      }

      // 查询是否已在回收站
      const { rows: recycleBinCheck } = await client.query(
        `SELECT id 
         FROM recycle_bin 
         WHERE entity_type = 'PRODUCT' 
         AND entity_id = $1
         AND restored_at IS NULL`,
        [productId]
      );

      if (recycleBinCheck.length > 0) {
        await client.query('ROLLBACK');
        return res.error('产品已在回收站中', 409);
      }

      // 创建回收站记录
      const { rows: recycleResult } = await client.query(
        `INSERT INTO recycle_bin (
           entity_type, entity_id, owner_type, owner_id, deleted_by, deleted_at
         ) VALUES (
           'PRODUCT', $1, $2, $3, $4, NOW()
         ) RETURNING *`,
        [
          productId,
          product.owner_type,
          product.owner_id || req.user.id,
          req.user.id
        ]
      );

      // 更新产品状态为已删除
      await client.query(
        `UPDATE products 
         SET deleted_at = NOW()
         WHERE id = $1`,
        [productId]
      );

      // 提交事务
      await client.query('COMMIT');

      // 记录成功日志
      logger.info('产品移入回收站成功', {
        operation: 'MOVE_TO_RECYCLE',
        productId,
        userId: req.user.id,
        ip: req.ip,
        duration: `${Date.now() - startTime}ms`
      });

      // 返回成功响应
      res.success({
        product_id: productId,
        status: 'DELETED',
        deleted_at: recycleResult[0].deleted_at
      }, '产品已移入回收站');
    } catch (error) {
      // 回滚事务
      await client.query('ROLLBACK');

      // 记录错误日志
      logger.error('产品移入回收站失败', {
        operation: 'MOVE_TO_RECYCLE',
        error: error.message,
        stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
        productId: req.params.id,
        userId: req.user?.id,
        ip: req.ip,
        duration: `${Date.now() - startTime}ms`
      });

      // 返回错误响应
      res.error('产品移入回收站失败: ' + error.message, 500);
    } finally {
      client.release();
    }
  }
);

/**
 * 产品复制接口
 * POST /api/pallet/products/:id/copy
 * @desc 复制指定产品
 */
router.post('/:id/copy',
  jwtAuth,
  [
    param('id').isInt({ min: 1 }).withMessage('源产品ID必须是大于0的整数')
  ],
  validationHandler,
  async (req, res) => {
    const sourceId = parseInt(req.params.id);
    const client = await pool.connect();
    const startTime = Date.now(); // 正确记录开始时间
    
    try {
      // 开始事务
      await client.query('BEGIN');
      
      // 验证源产品是否存在
      const sourceProductResult = await client.query(
        'SELECT * FROM products WHERE id = $1 AND deleted_at IS NULL',
        [sourceId]
      );
      
      if (sourceProductResult.rows.length === 0) {
        return res.error('源产品不存在', 404);
      }
      
      const sourceProduct = sourceProductResult.rows[0];
      
      // 权限验证：
      // 管理员只能复制销售员货盘产品到公司总货盘
      // 销售员仅能复制公司总货盘产品到个人货盘
      let isAllowed = false;
      let newOwnerType = 'COMPANY';
      let newOwnerId = null;
      
      if (req.user.is_admin) {
        // 管理员只能复制销售员货盘产品到公司总货盘
        if (sourceProduct.owner_type === 'SELLER' && sourceProduct.owner_id !== req.user.id) {
          isAllowed = true;
        } else {
          return res.error('管理员只能复制销售员的货盘产品', 403);
        }
      } else {
        // 销售员只能复制公司总货盘产品到个人货盘
        if (sourceProduct.owner_type === 'COMPANY') {
          isAllowed = true;
          newOwnerType = 'SELLER';
          newOwnerId = req.user.id;
        } else {
          return res.error('销售员只能复制公司总货盘产品', 403);
        }
      }
      
      if (!isAllowed) {
        return res.error('无权复制该产品', 403);
      }
      
      // 使用原始产品代码，不添加后缀
      const newProductCode = sourceProduct.product_code;
      
      // 1. 复制主产品
      const newProductResult = await client.query(
        `INSERT INTO products (
          name, brand_id, product_code, 
          specification, net_content, product_size,
          shipping_method, shipping_spec, shipping_size,
          product_url, owner_type, owner_id,
          created_by, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW()
        ) RETURNING *`,
        [
          sourceProduct.name,
          sourceProduct.brand_id,
          newProductCode,
          sourceProduct.specification,
          sourceProduct.net_content,
          sourceProduct.product_size,
          sourceProduct.shipping_method,
          sourceProduct.shipping_spec,
          sourceProduct.shipping_size,
          sourceProduct.product_url,
          newOwnerType,
          newOwnerId,
          req.user.id
        ]
      );
      
      const newProduct = newProductResult.rows[0];
      
      // 2. 复制价格档位
      const priceTiersResult = await client.query(
        'SELECT quantity, price FROM price_tiers WHERE product_id = $1',
        [sourceId]
      );
      
      for (const priceTier of priceTiersResult.rows) {
        await client.query(
          'INSERT INTO price_tiers (product_id, quantity, price, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())',
          [newProduct.id, priceTier.quantity, priceTier.price]
        );
      }
      
      // 3. 复制产品附件
      const attachmentsResult = await client.query(
        'SELECT id, file_type, file_name, file_path, file_size FROM attachments WHERE entity_type = $1 AND entity_id = $2',
        ['PRODUCT', sourceId]
      );
      
      const attachments = [];
      
      for (const attachment of attachmentsResult.rows) {
        try {
          // 修复文件路径处理 - 确保正确处理相对路径
          const uploadsDir = path.join(__dirname, '../../../src');
          let sourceFilePath;
          
          // 确认file_path是否以/开头，正确处理路径
          if (attachment.file_path.startsWith('/')) {
            sourceFilePath = path.join(uploadsDir, attachment.file_path);
          } else {
            sourceFilePath = path.join(uploadsDir, '/', attachment.file_path);
          }
          
          // 检查源文件是否存在
          if (!fs.existsSync(sourceFilePath)) {
            logger.warning('产品复制 - 源文件不存在', {
              filePath: sourceFilePath,
              attachmentId: attachment.id,
              productId: sourceId
            });
            continue; // 跳过不存在的文件
          }
          
          // 处理文件名，保证新文件名唯一
          const fileExt = path.extname(attachment.file_path);
          const fileName = path.basename(attachment.file_path, fileExt);
          const timestamp = Date.now();
          const newFileName = `${fileName}_copy_${timestamp}${fileExt}`;
          const dirName = path.dirname(attachment.file_path);
          const newRelativePath = path.join(dirName, newFileName).replace(/\\/g, '/'); // 确保使用正斜杠
          const destFilePath = path.join(uploadsDir, newRelativePath);
          
          // 确保目标目录存在
          const targetDir = path.dirname(destFilePath);
          if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
          }
          
          // 复制实际文件
          fs.copyFileSync(sourceFilePath, destFilePath);
          
          // 插入附件记录
          const attachmentResult = await client.query(
            `INSERT INTO attachments (
              entity_type, entity_id, file_type,
              file_name, file_path, file_size, created_by, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING *`,
            [
              'PRODUCT',
              newProduct.id,
              attachment.file_type,
              attachment.file_name,
              newRelativePath.startsWith('/') ? newRelativePath : '/' + newRelativePath,
              attachment.file_size,
              req.user.id
            ]
          );
          
          attachments.push(attachmentResult.rows[0]);
        } catch (fileError) {
          // 记录文件处理错误，但继续处理其他附件
          logger.error('产品复制 - 附件处理失败', {
            error: fileError.message,
            stack: process.env.NODE_ENV !== 'production' ? fileError.stack : undefined,
            attachmentId: attachment.id,
            productId: sourceId
          });
        }
      }
      
      // 提交事务
      await client.query('COMMIT');
      
      // 获取复制完成后的产品完整数据，包括价格档位和附件
      const pricesTiersResp = await client.query(
        'SELECT id, quantity, price, created_at FROM price_tiers WHERE product_id = $1',
        [newProduct.id]
      );
      
      const response = {
        ...newProduct,
        price_tiers: pricesTiersResp.rows,
        attachments: attachments
      };
      
      // 记录成功日志
      logger.info('产品复制成功', {
        operation: 'PRODUCT_COPY',
        sourceProductId: sourceId,
        newProductId: newProduct.id,
        userId: req.user.id,
        ip: req.ip,
        executionTime: `${Date.now() - startTime}ms`, // 使用正确的时间变量
        copiedAttachments: attachments.length
      });
      
      res.success(response);
    } catch (error) {
      // 回滚事务
      await client.query('ROLLBACK');
      
      // 记录错误日志
      logger.error('产品复制失败', {
        operation: 'PRODUCT_COPY',
        error: error.message,
        stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
        sourceProductId: sourceId,
        userId: req.user?.id,
        ip: req.ip
      });
      
      res.error(`产品复制失败: ${error.message}`, 500);
    } finally {
      client.release();
    }
  }
);

module.exports = router; 
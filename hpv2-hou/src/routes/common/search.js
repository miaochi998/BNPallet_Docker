const express = require('express');
const router = express.Router();
const pool = require('../../config/db');
const { jwtAuth } = require('../../middlewares/jwtAuth');
const logger = require('../../utils/logger');
const { query } = require('express-validator');
const validationHandler = require('../../middlewares/validationHandler');

/**
 * 通用搜索接口
 * GET /api/common/search
 * 实现统一的全局搜索功能，支持多模块、多字段的搜索
 */
router.get('/', 
  // 如果有token参数，则跳过认证，否则使用JWT认证
  (req, res, next) => {
    if (req.query.token) {
      next(); // 有token参数，跳过认证
    } else {
      jwtAuth(req, res, next); // 无token参数，执行JWT认证
    }
  },
  [
    query('module').notEmpty().withMessage('模块名称不能为空'),
    query('keyword').optional().isString().withMessage('关键词必须是字符串'),
    query('fields').optional().isString().withMessage('字段列表必须是字符串'),
    query('exact').optional().isBoolean().withMessage('精确匹配标志必须是布尔值')
  ],
  validationHandler,
  async (req, res) => {
    const startTime = Date.now(); // 记录开始时间
    const { module, keyword, fields, exact } = req.query;
    const client = await pool.connect();
    
    try {
      // 构建查询条件
      let table, searchFields, whereClause, queryParams = [];
      let paramIndex = 1;
      
      // 根据模块确定表名和可搜索字段
      switch (module) {
        case 'products':
          table = 'products p LEFT JOIN brands b ON p.brand_id = b.id';
          searchFields = fields ? fields.split(',') : ['p.name', 'p.product_code', 'b.name'];
          
          // 添加权限控制
          // 获取owner_type和owner_id参数，支持对特定货盘的查询
          const ownerType = req.query.owner_type;
          const ownerId = req.query.owner_id ? parseInt(req.query.owner_id) : null;
          
          // 处理分享链接token
          const shareToken = req.query.token;
          
          console.log('【调试】搜索API参数:', {
            module,
            ownerType,
            ownerId,
            userId: req.user ? req.user.id : null,
            isAdmin: req.user ? req.user.is_admin : false,
            shareToken,
            allParams: req.query
          });
          
          // 如果提供了分享token，则访问共享货盘
          if (shareToken) {
            try {
              // 查询分享记录
              const { rows: shareInfo } = await client.query(
                'SELECT * FROM pallet_shares WHERE token = $1',
                [shareToken]
              );
              
              if (shareInfo.length === 0) {
                return res.error('分享链接不存在或已过期', 404);
              }
              
              const share = shareInfo[0];
              const shareType = share.share_type;
              const shareOwnerId = share.user_id;
              const sharePalletType = share.pallet_type;
              
              // 更新访问计数
              await client.query(
                'UPDATE pallet_shares SET access_count = access_count + 1, last_accessed = NOW() WHERE id = $1',
                [share.id]
              );
              
              // 根据分享类型和货盘类型构建查询条件
              if (sharePalletType === 'COMPANY') {
                // 公司总货盘分享
                whereClause = `WHERE p.owner_type = 'COMPANY' AND p.deleted_at IS NULL`;
              } else {
                // 销售员个人货盘分享
                whereClause = `WHERE p.owner_type = 'SELLER' AND p.owner_id = $${paramIndex} AND p.deleted_at IS NULL`;
                queryParams.push(shareOwnerId);
                paramIndex += 1;
              }
              
              break;
            } catch (error) {
              console.error('处理分享链接查询失败:', error);
              return res.error('处理分享链接失败: ' + error.message, 500);
            }
          }
          
          if (ownerType === 'COMPANY') {
            // 公司货盘查询 - 所有人都可以查询
            whereClause = `WHERE p.owner_type = 'COMPANY' AND p.deleted_at IS NULL`;
            console.log(`【调试】搜索API - 公司货盘查询:`, {
              user_id: req.user.id,
              user_name: req.user.username,
              is_admin: req.user.is_admin,
              owner_type: ownerType,
              where_clause: whereClause
            });
          } else if (ownerType === 'SELLER' && req.user.is_admin && ownerId) {
            // 管理员查询特定销售员的货盘
            whereClause = `WHERE p.owner_type = 'SELLER' AND p.owner_id = $${paramIndex} AND p.deleted_at IS NULL`;
            queryParams.push(ownerId);
            paramIndex += 1;
          } else if (ownerType === 'SELLER' && !req.user.is_admin) {
            // 普通用户只能查询自己的销售货盘
            whereClause = `WHERE p.owner_type = 'SELLER' AND p.owner_id = $${paramIndex} AND p.deleted_at IS NULL`;
            queryParams.push(req.user.id);
            paramIndex += 1;
          } else {
            // 默认情况 - 根据用户角色确定可见范围
            whereClause = `WHERE p.deleted_at IS NULL AND ((p.owner_type = 'COMPANY' AND $${paramIndex} = true) OR (p.owner_type = 'SELLER' AND p.owner_id = $${paramIndex+1}))`;
            queryParams.push(req.user.is_admin, req.user.id);
            paramIndex += 2;
          }
          
          break;
          
        case 'brands':
          table = 'brands';
          searchFields = fields ? fields.split(',') : ['name'];
          whereClause = 'WHERE 1=1';
          break;
          
        case 'recycle':
          table = `recycle_bin rb
                   JOIN products p ON rb.entity_id = p.id AND rb.entity_type = 'PRODUCT'
                   LEFT JOIN brands b ON p.brand_id = b.id`;
          searchFields = fields ? fields.split(',') : ['p.name', 'p.product_code', 'b.name', 'p.specification', 'p.net_content'];
          
          // 添加权限控制
          whereClause = `WHERE ((p.owner_type = 'COMPANY' AND $${paramIndex} = true) OR (p.owner_type = 'SELLER' AND p.owner_id = $${paramIndex+1}))`;
          queryParams.push(req.user.is_admin, req.user.id);
          paramIndex += 2;
          
          break;
          
        case 'users':
          // 新增用户搜索支持
          table = 'users u LEFT JOIN LATERAL (SELECT array_agg(row_to_json(s)) as stores FROM stores s JOIN user_stores us ON s.id = us.store_id WHERE us.user_id = u.id) AS user_stores ON true';
          searchFields = fields ? fields.split(',') : ['username', 'name', 'phone', 'email'];
          
          // 只有管理员可以搜索用户
          if (!req.user.is_admin) {
            return res.error('只有管理员可以搜索用户', 403);
          }
          
          // 获取额外的过滤参数
          const { is_admin } = req.query;
          let isAdminFilter = '';
          
          // 构建WHERE子句
          if (is_admin !== undefined) {
            isAdminFilter = ` AND u.is_admin = $${paramIndex}`;
            queryParams.push(is_admin === 'true' || is_admin === true);
            paramIndex++;
          }
          
          whereClause = `WHERE 1=1${isAdminFilter}`;
          break;
          
        default:
          return res.error(`不支持的模块: ${module}`, 400);
      }
      
      // 如果提供了关键词，添加搜索条件
      if (keyword && keyword.trim()) {
        const searchConditions = searchFields.map(field => {
          if (exact === 'true') {
            // 精确匹配
            return `${field} = $${paramIndex++}`;
          } else {
            // 模糊匹配
            return `${field} ILIKE $${paramIndex++}`;
          }
        });
        
        whereClause += ` AND (${searchConditions.join(' OR ')})`;
        
        // 添加搜索参数
        for (let i = 0; i < searchFields.length; i++) {
          if (exact === 'true') {
            queryParams.push(keyword);
          } else {
            queryParams.push(`%${keyword}%`);
          }
        }
      }
      
      // 构建并执行查询
      let selectFields, orderBy;
      
      switch (module) {
        case 'products':
          selectFields = `
            p.id, p.name, p.product_code, p.specification, 
            p.net_content, p.owner_type, p.owner_id, p.created_at, p.updated_at,
            p.product_size, p.shipping_method, p.shipping_spec, p.shipping_size, p.product_url,
            b.id as brand_id, b.name as brand_name,
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
          `;
          orderBy = 'ORDER BY p.updated_at DESC, p.id DESC';
          break;
          
        case 'brands':
          selectFields = '*, (SELECT file_path FROM attachments WHERE entity_type=\'BRAND\' AND entity_id=id AND file_type=\'IMAGE\' LIMIT 1) as logo_url';
          orderBy = 'ORDER BY name ASC';
          break;
          
        case 'recycle':
          selectFields = `
            rb.id, rb.entity_id, rb.entity_type, rb.deleted_at, rb.owner_type, rb.owner_id, rb.deleted_by,
            p.name, p.product_code, p.specification, p.net_content, p.product_size, 
            p.shipping_method, p.shipping_spec, p.shipping_size, p.product_url, p.updated_at,
            b.id as brand_id, b.name as brand_name,
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
          `;
          orderBy = 'ORDER BY rb.deleted_at DESC, p.id DESC';
          break;
          
        case 'users':
          selectFields = `
            u.id, u.username, u.name, u.phone, u.email,
            u.is_admin, u.status, u.created_at, u.updated_at,
            user_stores.stores
          `;
          orderBy = 'ORDER BY u.id DESC';
          break;
      }
      
      const query = `
        SELECT ${selectFields}
        FROM ${table}
        ${whereClause}
        ${orderBy}
      `;
      
      // 记录执行的SQL语句（仅在开发环境）
      if (process.env.NODE_ENV !== 'production') {
        console.log('执行SQL:', query);
        console.log('参数:', queryParams);
      }
      
      const { rows } = await client.query(query, queryParams);
      
      // 记录成功日志
      logger.info('搜索成功', {
        operation: 'SEARCH',
        module,
        keyword: keyword || '',
        resultCount: rows.length,
        fields: searchFields.join(','),
        userId: req.user ? req.user.id : `分享(${req.query.token || 'unknown'})`,
        ip: req.ip,
        duration: `${Date.now() - startTime}ms`
      });
      
      // 根据模块进行后处理
      let response = {
        list: rows,
        total: rows.length,
        module,
        keyword: keyword || ''
      };
      
      // 为回收站模块特殊处理返回数据结构
      if (module === 'recycle') {
        console.log(`[搜索] 回收站搜索原始结果: ${rows.length}条记录`);
        
        // 明确地使用Map进行去重，按照entity_id
        const uniqueMap = new Map();
        
        // 遍历所有结果，只保留每个entity_id的最新记录（按deleted_at排序）
        for (const item of rows) {
          const entityId = item.entity_id;
          
          // 如果该实体ID尚未在Map中，或当前记录的删除时间比Map中已有记录的更晚
          if (!uniqueMap.has(entityId) || 
              new Date(item.deleted_at) > new Date(uniqueMap.get(entityId).deleted_at)) {
            uniqueMap.set(entityId, item);
            console.log(`[搜索] 更新去重记录: entity_id=${entityId}, deleted_at=${item.deleted_at}`);
          }
        }
        
        // 从Map转换为数组
        const uniqueItems = Array.from(uniqueMap.values());
        console.log(`[搜索] 回收站搜索去重后: ${uniqueItems.length}条记录`);
        
        // 按照deleted_at降序排序
        uniqueItems.sort((a, b) => new Date(b.deleted_at) - new Date(a.deleted_at));
        
        // 转换为客户端期望的格式
        response.list = uniqueItems.map(item => ({
          id: item.id,
          entity_type: item.entity_type,
          entity_id: item.entity_id,
          owner_type: item.owner_type,
          owner_id: item.owner_id,
          deleted_by: item.deleted_by,
          deleted_at: item.deleted_at,
          product: {
            id: item.entity_id,
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
        }));
        
        // 更新总数以反映去重后的实际数量
        response.total = response.list.length;
        
        // 构建分页信息
        response.pagination = {
          current_page: 1,
          per_page: response.list.length,
          total: response.list.length
        };
      }
      
      res.success(response);
    } catch (error) {
      // 记录错误日志
      logger.error('搜索失败', {
        operation: 'SEARCH',
        error: error.message,
        stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
        module,
        keyword: keyword || '',
        userId: req.user?.id || `分享(${req.query.token || 'unknown'})`,
        ip: req.ip,
        duration: `${Date.now() - startTime}ms`
      });
      
      res.error('搜索失败: ' + error.message, 500);
    } finally {
      client.release();
    }
  }
);

/**
 * 搜索辅助接口 - 获取可搜索字段
 * GET /api/common/search/fields
 * 返回各模块可搜索的字段列表
 */
router.get('/fields', jwtAuth, async (req, res) => {
  try {
    // 各模块可搜索字段定义
    const searchableFields = {
      products: [
        { field: 'p.name', label: '产品名称', default: true },
        { field: 'p.product_code', label: '产品货号', default: true },
        { field: 'b.name', label: '品牌名称', default: true },
        { field: 'p.specification', label: '规格', default: false },
        { field: 'p.net_content', label: '净含量', default: false }
      ],
      brands: [
        { field: 'name', label: '品牌名称', default: true }
      ],
      recycle: [
        { field: 'p.name', label: '产品名称', default: true },
        { field: 'p.product_code', label: '产品货号', default: true },
        { field: 'b.name', label: '品牌名称', default: true },
        { field: 'p.specification', label: '规格', default: false },
        { field: 'p.net_content', label: '净含量', default: false }
      ],
      users: [
        { field: 'username', label: '用户名', default: true },
        { field: 'name', label: '姓名', default: true },
        { field: 'phone', label: '手机号', default: true },
        { field: 'email', label: '邮箱', default: true }
      ]
    };
    
    res.success(searchableFields);
  } catch (error) {
    logger.error('获取搜索字段失败', {
      operation: 'GET_SEARCH_FIELDS',
      error: error.message,
      userId: req.user?.id,
      ip: req.ip
    });
    
    res.error('获取搜索字段失败: ' + error.message, 500);
  }
});

module.exports = router; 
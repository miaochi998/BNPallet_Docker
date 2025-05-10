const express = require('express');
const router = express.Router();
const db = require('../../services/db'); // 使用数据库服务层
const { jwtAuth } = require('../../middlewares/jwtAuth');
const { isAdmin } = require('../../middlewares/roleCheck');
const logger = require('../../utils/logger');

// 获取静态页面内容（严格按文档实现）
router.get('/:page_type', async (req, res) => {
  const { page_type } = req.params;
  const validTypes = ['store-service', 'logistics', 'help-center'];
  
  try {
    // 验证页面类型
    if (!validTypes.includes(page_type)) {
      return res.status(400).json({
        code: 400,
        message: '无效的页面类型'
      });
    }

    // 查询数据库 - 使用数据库服务层
    const result = await db.query(
      `SELECT 
        sp.content,
        sp.updated_at,
        sp.updated_by,
        u.name as updater_name
      FROM static_pages sp
      LEFT JOIN users u ON sp.updated_by = u.id
      WHERE sp.page_type = $1`,
      [page_type]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '页面内容不存在'
      });
    }

    const pageData = result.rows[0];
    
    // 记录日志
    logger.info('静态页面查询成功', {
      operation: 'GET_CONTENT',
      pageType: page_type,
      ip: req.ip,
      path: req.originalUrl // 记录完整路径
    });

    res.json({
      code: 200,
      data: {
        content: pageData.content,
        updated_at: pageData.updated_at,
        updated_by: pageData.updated_by,
        updater_name: pageData.updater_name
      }
    });
  } catch (err) {
    logger.error('静态页面查询失败', {
      error: err.message,
      stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
      pageType: page_type,
      ip: req.ip
    });
    
    res.status(500).json({
      code: 500,
      message: '服务器内部错误'
    });
  }
});

// 更新静态页面内容(需要管理员权限)
router.post('/:page_type', jwtAuth, isAdmin, async (req, res) => {
  const { page_type } = req.params;
  const { content } = req.body;
  const validTypes = ['store-service', 'logistics', 'help-center'];
  
  try {
    // 验证输入
    if (!validTypes.includes(page_type)) {
      return res.status(400).json({
        code: 400,
        message: '无效的页面类型'
      });
    }

    if (!content || typeof content !== 'string') {
      return res.status(400).json({
        code: 400,
        message: '内容不能为空且必须为字符串'
      });
    }

    // 使用事务确保数据一致性
    await db.executeTransaction(async (client) => {
      // 先尝试更新
      const updateResult = await client.query(
        `UPDATE static_pages
         SET content = $1, updated_by = $2, updated_at = NOW()
         WHERE page_type = $3`,
        [content, req.user.id, page_type]
      );

      // 如果更新0行则尝试插入
      if (updateResult.rowCount === 0) {
        await client.query(
          `INSERT INTO static_pages (page_type, content, updated_by)
           VALUES ($1, $2, $3)`,
          [page_type, content, req.user.id]
        );
      }
    });
    
    // 记录日志
    logger.info('静态页面更新成功', {
      operation: 'UPDATE_CONTENT',
      pageType: page_type,
      userId: req.user.id,
      ip: req.ip,
      contentSize: `${content.length}字符`,
      path: req.originalUrl
    });

    // 简化响应，确保不会出错
    res.status(200).json({
      code: 200,
      success: true,
      message: '更新成功'
    });
  } catch (err) {
    logger.error('静态页面更新失败', {
      error: err.message,
      stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
      pageType: page_type,
      userId: req.user?.id,
      ip: req.ip
    });
    
    res.status(500).json({
      code: 500,
      message: '服务器内部错误'
    });
  }
});

module.exports = router;
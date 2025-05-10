const express = require('express');
const router = express.Router();
const pool = require('../../config/db');
const { jwtAuth } = require('../../middlewares/jwtAuth');
const logger = require('../../utils/logger');

/**
 * 访问记录查询接口
 * GET /api/pallet/stats/access_logs
 * 
 * 查询参数：
 * - start_time: 开始时间(ISO8601格式)
 * - end_time: 结束时间(ISO8601格式) 
 * - user_id: 用户ID(可选)
 * - page_url: 页面URL(可选)
 * - page: 页码(默认1)
 * - page_size: 每页数量(默认20)
 */
router.get('/access_logs', jwtAuth, async (req, res) => {
  const client = await pool.connect();
  
  try {
    // 首先验证用户权限（管理员才能查看访问记录）
    if (!req.user.is_admin) {
      logger.warning('非管理员用户尝试访问访问记录', {
        operation: 'ACCESS_LOGS_QUERY',
        userId: req.user.id,
        ip: req.ip
      });
      return res.error('权限不足，只有管理员可以查看访问记录', 403);
    }
    
    // 获取查询参数
    const {
      start_time,
      end_time,
      user_id,
      page_url,
      page = 1,
      page_size = 20
    } = req.query;
    
    // 验证时间格式
    if (start_time && isNaN(Date.parse(start_time))) {
      return res.error('开始时间格式无效，请使用ISO8601格式', 400);
    }
    
    if (end_time && isNaN(Date.parse(end_time))) {
      return res.error('结束时间格式无效，请使用ISO8601格式', 400);
    }
    
    // 构建查询条件
    let conditions = [];
    let queryParams = [];
    let paramIndex = 1;
    
    // 时间范围条件
    if (start_time) {
      conditions.push(`cl.access_time >= $${paramIndex}`);
      queryParams.push(new Date(start_time));
      paramIndex++;
    }
    
    if (end_time) {
      conditions.push(`cl.access_time <= $${paramIndex}`);
      queryParams.push(new Date(end_time));
      paramIndex++;
    }
    
    // 特定用户条件
    if (user_id) {
      conditions.push(`ps.user_id = $${paramIndex}`);
      queryParams.push(parseInt(user_id));
      paramIndex++;
    }
    
    // 页面URL条件
    if (page_url) {
      conditions.push(`cl.share_id IN (SELECT id FROM pallet_shares WHERE token = $${paramIndex})`);
      queryParams.push(page_url);
      paramIndex++;
    }
    
    // 组合查询条件
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // 计算分页参数
    const offset = (parseInt(page) - 1) * parseInt(page_size);
    const limit = parseInt(page_size);
    
    // 获取记录总数
    const countQuery = `
      SELECT COUNT(*) 
      FROM customer_logs cl
      JOIN pallet_shares ps ON cl.share_id = ps.id
      ${whereClause}
    `;
    
    // 执行计数查询
    const countResult = await client.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(total / limit);
    
    // 构建完整查询
    const query = `
      SELECT 
        cl.id,
        cl.share_id,
        ps.token,
        ps.user_id,
        u.username,
        u.name AS user_name,
        cl.ip_address,
        cl.user_agent,
        cl.access_time,
        ps.pallet_type
      FROM customer_logs cl
      JOIN pallet_shares ps ON cl.share_id = ps.id
      JOIN users u ON ps.user_id = u.id
      ${whereClause}
      ORDER BY cl.access_time DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    // 添加分页参数
    queryParams.push(limit, offset);
    
    // 执行查询
    const result = await client.query(query, queryParams);
    
    // 记录成功日志
    logger.info('访问记录查询成功', {
      operation: 'ACCESS_LOG_QUERY',
      userId: req.user.id,
      start_time: start_time || 'all',
      end_time: end_time || 'all',
      filter_user_id: user_id || 'all',
      page_url: page_url || 'all',
      page,
      page_size: limit,
      result_count: result.rows.length,
      total_count: total,
      ip: req.ip
    });
    
    // 返回结果
    res.success({
      items: result.rows.map(row => ({
        id: row.id,
        share_id: row.share_id,
        share_token: row.token,
        user_id: row.user_id,
        username: row.username,
        user_name: row.user_name,
        ip_address: row.ip_address,
        user_agent: row.user_agent,
        access_time: row.access_time,
        pallet_type: row.pallet_type
      })),
      pagination: {
        total,
        current_page: parseInt(page),
        page_size: limit,
        total_pages: totalPages
      }
    }, '访问记录查询成功');
    
  } catch (error) {
    // 记录错误日志
    logger.error('访问记录查询失败', {
      operation: 'ACCESS_LOG_QUERY',
      error: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
      userId: req.user.id,
      params: req.query,
      ip: req.ip
    });
    
    res.error('访问记录查询失败，请稍后重试', 500);
  } finally {
    client.release();
  }
});

/**
 * 客户访问分析接口
 * GET /api/pallet/stats/client_analysis
 * 
 * 查询参数：
 * - share_id: 分享记录ID(必填)
 * - start_time: 开始时间(可选)
 * - end_time: 结束时间(可选)
 */
router.get('/client_analysis', jwtAuth, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { share_id, start_time, end_time } = req.query;
    
    // 验证share_id参数
    if (!share_id) {
      return res.error('分享ID参数必填', 400);
    }
    
    // 验证时间格式
    if (start_time && isNaN(Date.parse(start_time))) {
      return res.error('开始时间格式无效，请使用ISO8601格式', 400);
    }
    
    if (end_time && isNaN(Date.parse(end_time))) {
      return res.error('结束时间格式无效，请使用ISO8601格式', 400);
    }
    
    // 首先验证分享记录存在，并且当前用户有权限查看
    const shareQuery = `
      SELECT ps.id, ps.user_id, ps.token, ps.share_type, ps.pallet_type
      FROM pallet_shares ps
      WHERE ps.id = $1
    `;
    
    const shareResult = await client.query(shareQuery, [share_id]);
    
    if (shareResult.rows.length === 0) {
      return res.error('分享记录不存在', 404);
    }
    
    const shareInfo = shareResult.rows[0];
    
    // 管理员可以查看所有的分享记录，非管理员只能查看自己的
    if (!req.user.is_admin && shareInfo.user_id !== req.user.id) {
      logger.warning('用户尝试访问他人的分享分析数据', {
        operation: 'CLIENT_ANALYSIS',
        userId: req.user.id,
        shareId: share_id,
        ownerId: shareInfo.user_id,
        ip: req.ip
      });
      return res.error('您无权查看此分享的访问分析数据', 403);
    }
    
    // 准备条件参数
    let conditions = ['cl.share_id = $1'];
    let analysisParams = [share_id];
    let paramIndex = 2;
    
    if (start_time) {
      conditions.push(`cl.access_time >= $${paramIndex}`);
      analysisParams.push(new Date(start_time));
      paramIndex++;
    }
    
    if (end_time) {
      conditions.push(`cl.access_time <= $${paramIndex}`);
      analysisParams.push(new Date(end_time));
      paramIndex++;
    }
    
    const whereClause = conditions.join(' AND ');
    
    // 访问统计分析查询
    const analysisQuery = `
      SELECT 
        COUNT(*) AS total_visits,
        COUNT(DISTINCT cl.ip_address) AS unique_visitors,
        DATE_TRUNC('day', cl.access_time) AS visit_date,
        COUNT(*) AS daily_visits
      FROM customer_logs cl
      WHERE ${whereClause}
      GROUP BY visit_date
      ORDER BY visit_date DESC
    `;
    
    // 设备分布查询
    const deviceQuery = `
      SELECT 
        CASE 
          WHEN cl.user_agent LIKE '%Mobile%' OR cl.user_agent LIKE '%Android%' OR cl.user_agent LIKE '%iPhone%' OR cl.user_agent LIKE '%iPad%' THEN 'mobile'
          ELSE 'desktop' 
        END AS device_type,
        COUNT(*) AS count
      FROM customer_logs cl
      WHERE ${whereClause}
      GROUP BY device_type
    `;
    
    // 执行查询
    const [analysisResult, deviceResult] = await Promise.all([
      client.query(analysisQuery, analysisParams),
      client.query(deviceQuery, analysisParams)
    ]);
    
    // 计算总计和按日期的访问数据
    let totalVisits = 0;
    let uniqueVisitors = 0;
    
    if (analysisResult.rows.length > 0) {
      // 获取第一行的唯一访客数（所有日期的总和）
      uniqueVisitors = parseInt(analysisResult.rows[0].unique_visitors);
      
      // 计算总访问次数
      totalVisits = analysisResult.rows.reduce((sum, row) => sum + parseInt(row.daily_visits), 0);
    }
    
    // 整理设备分布数据
    const devices = {};
    deviceResult.rows.forEach(row => {
      devices[row.device_type] = parseInt(row.count);
    });
    
    // 获取最近的访问日志记录
    const recentLogsQuery = `
      SELECT 
        cl.ip_address, 
        cl.user_agent, 
        cl.access_time
      FROM customer_logs cl
      WHERE ${whereClause}
      ORDER BY cl.access_time DESC
      LIMIT 10
    `;
    
    const recentLogs = await client.query(recentLogsQuery, analysisParams);
    
    // 记录成功日志
    logger.info('客户访问分析成功', {
      operation: 'CLIENT_ANALYSIS',
      userId: req.user.id,
      shareId: share_id,
      unique_visitors: uniqueVisitors,
      total_visits: totalVisits,
      start_time: start_time || 'all',
      end_time: end_time || 'all',
      ip: req.ip
    });
    
    // 返回分析结果
    res.success({
      share_info: {
        id: shareInfo.id,
        token: shareInfo.token,
        share_type: shareInfo.share_type,
        pallet_type: shareInfo.pallet_type
      },
      total_visits: totalVisits,
      unique_visitors: uniqueVisitors,
      devices: devices,
      daily_stats: analysisResult.rows.map(row => ({
        date: row.visit_date,
        visits: parseInt(row.daily_visits)
      })),
      logs: recentLogs.rows
    }, '客户访问分析成功');
    
  } catch (error) {
    // 记录错误日志
    logger.error('客户访问分析失败', {
      operation: 'CLIENT_ANALYSIS',
      error: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
      userId: req.user.id,
      shareId: req.query.share_id,
      params: req.query,
      ip: req.ip
    });
    
    res.error('客户访问分析失败，请稍后重试', 500);
  } finally {
    client.release();
  }
});

module.exports = router; 
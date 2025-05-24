const pool = require('../config/db');
const path = require('path');

/**
 * 保存附件信息到数据库
 * @param {Object} fileData - 文件数据对象
 * @param {string} fileData.entity_type - 关联类型(PRODUCT/BRAND/USER)
 * @param {number} fileData.entity_id - 关联ID
 * @param {string} fileData.upload_type - 上传类型(avatar/qrcode)，仅当entity_type=USER时有效
 * @param {Object} file - 上传的文件对象
 * @param {number} userId - 当前用户ID
 * @returns {Promise<Object>} - 附件信息
 */
const saveAttachment = async (fileData, file, userId) => {
  // 获取文件类型
  const fileExt = path.extname(file.originalname).toLowerCase().replace('.', '');
  let fileType;
  
  // 检查文件大小限制
  if (['jpg', 'jpeg', 'png', 'gif'].includes(fileExt)) {
    if (file.size > 20 * 1024 * 1024) {
      throw new Error('图片大小不能超过20MB');
    }
    fileType = 'IMAGE';
  } else if (['zip', 'rar', '7z'].includes(fileExt)) {
    if (file.size > 500 * 1024 * 1024) {
      throw new Error('素材包大小不能超过500MB');
    }
    fileType = 'MATERIAL';
  } else {
    throw new Error('不支持的文件类型');
  }
  
  // 构建文件相对路径，用于前端访问
  const relativePath = `/uploads/${fileType === 'IMAGE' ? 'images' : 'materials'}/${path.basename(file.path)}`;
  
  console.log('[ATTACHMENT SERVICE] 构建文件路径', {
    originalPath: file.path,
    relativePath: relativePath,
    fileName: path.basename(file.path),
    entityType: fileData.entity_type,
    entityId: fileData.entity_id
  });
  
  // 开始一个事务
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 验证实体存在性
    await checkEntityPermission(fileData.entity_type, fileData.entity_id, userId);
    
    // 插入附件记录
    const { rows } = await client.query(
      `INSERT INTO attachments (
        file_path, file_type, file_size,
        entity_type, entity_id, created_by,
        file_name, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, NOW()
      ) RETURNING id, file_path, file_size`,
      [
        relativePath,
        fileType,
        file.size,
        fileData.entity_type,
        fileData.entity_id,
        userId,
        file.originalname
      ]
    );
    
    console.log('[ATTACHMENT SERVICE] 附件记录已插入数据库', {
      id: rows[0].id,
      filePath: rows[0].file_path,
      entityType: fileData.entity_type,
      entityId: fileData.entity_id
    });
    
    // 如果是用户上传，自动更新对应字段
    if (fileData.entity_type === 'USER' && fileType === 'IMAGE') {
      // 根据upload_type或文件名判断是头像还是二维码
      let field = null;
      
      if (fileData.upload_type) {
        field = fileData.upload_type === 'avatar' ? 'avatar' : 
                (fileData.upload_type === 'qrcode' ? 'wechat_qrcode' : null);
      } else {
        // 根据文件名推断
        const isAvatar = file.originalname.toLowerCase().includes('avatar');
        const isQrcode = file.originalname.toLowerCase().includes('qrcode');
        field = isAvatar ? 'avatar' : (isQrcode ? 'wechat_qrcode' : null);
      }
      
      if (field) {
        // 使用FOR UPDATE锁定用户记录，防止并发更新冲突
        await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [fileData.entity_id]);
        
        // 只更新指定的字段，不影响其他字段
        await client.query(
          `UPDATE users SET ${field} = $1, updated_at = NOW() WHERE id = $2`,
          [relativePath, fileData.entity_id]
        );
        
        // 记录日志，便于调试
        console.log('[ATTACHMENT SERVICE] 已更新用户资料字段', {
          userId: fileData.entity_id,
          field: field,
          filePath: relativePath
        });
        
        // 再次查询确认更新成功
        const { rows: userCheck } = await client.query(
          `SELECT ${field} FROM users WHERE id = $1`,
          [fileData.entity_id]
        );
        
        if (userCheck.length > 0) {
          console.log('[ATTACHMENT SERVICE] 更新后的用户字段值', {
            userId: fileData.entity_id,
            field: field,
            value: userCheck[0][field]
          });
        }
      }
    }
    
    await client.query('COMMIT');
    return rows[0];
  } catch (error) {
    console.error('[ATTACHMENT SERVICE] 保存附件失败', {
      error: error.message,
      entityType: fileData.entity_type,
      entityId: fileData.entity_id,
      fileName: file.originalname
    });
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * 检查实体权限
 * @param {string} entityType - 实体类型
 * @param {number} entityId - 实体ID
 * @param {number} userId - 用户ID
 * @returns {Promise<boolean>} - 是否有权限
 */
const checkEntityPermission = async (entityType, entityId, userId) => {
  // 允许entity_id为0或'0'，表示是临时ID（用于新建产品时上传图片）
  if (entityId === 0 || entityId === '0') {
    console.log('[ATTACHMENT SERVICE] 允许使用临时ID上传附件', {entityId, type: typeof entityId});
    return true;
  }

  const client = await pool.connect();
  
  try {
    let query;
    let params;
    
    if (entityType === 'PRODUCT') {
      query = `SELECT COUNT(*) FROM products WHERE id = $1 AND deleted_at IS NULL`;
      params = [entityId];
    } else if (entityType === 'BRAND') {
      query = `SELECT COUNT(*) FROM brands WHERE id = $1`;
      params = [entityId];
    } else if (entityType === 'USER') {
      query = `SELECT COUNT(*) FROM users WHERE id = $1`;
      params = [entityId];
    } else {
      return false;
    }

    // 开发环境临时简化权限检查
    if (process.env.NODE_ENV !== 'production') {
      return true;
    }
    
    const { rows } = await client.query(query, params);
    if (parseInt(rows[0].count) === 0) {
      throw new Error(`指定的${entityType}不存在`);
    }
    return true;
  } catch (error) {
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  saveAttachment,
  checkEntityPermission
};

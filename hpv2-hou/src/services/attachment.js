const pool = require('../config/db');
const path = require('path');
const fs = require('fs');

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
  
  // 确保目标目录存在
  const uploadDir = path.join(__dirname, '../../uploads', fileType === 'IMAGE' ? 'images' : 'materials');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log(`[ATTACHMENT SERVICE] 创建上传目录: ${uploadDir}`);
  }
  
  // 构建文件相对路径，用于前端访问
  // 注意：路径中不应包含src，因为前端直接从/uploads访问
  const relativePath = `/uploads/${fileType === 'IMAGE' ? 'images' : 'materials'}/${path.basename(file.path)}`;
  
  // 移动文件到正确的位置
  const destinationPath = path.join(uploadDir, path.basename(file.path));
  try {
    // 检查源文件是否存在
    if (fs.existsSync(file.path)) {
      // 如果目标文件已存在，先删除
      if (fs.existsSync(destinationPath)) {
        fs.unlinkSync(destinationPath);
        console.log(`[ATTACHMENT SERVICE] 删除已存在的目标文件: ${destinationPath}`);
      }
      
      // 复制文件到目标位置
      fs.copyFileSync(file.path, destinationPath);
      console.log(`[ATTACHMENT SERVICE] 文件已复制到: ${destinationPath}`);
    } else {
      console.log(`[ATTACHMENT SERVICE] 源文件不存在: ${file.path}`);
    }
  } catch (error) {
    console.error(`[ATTACHMENT SERVICE] 移动文件失败: ${error.message}`);
  }
  
  console.log('[ATTACHMENT SERVICE] 构建文件路径', {
    originalPath: file.path,
    destinationPath: destinationPath,
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
    
    // 如果是用户上传，根据upload_type确定更新哪个字段
    if (fileData.entity_type === 'USER' && fileType === 'IMAGE') {
      // 默认不更新任何字段
      let field = null;
      
      // 只有明确指定了upload_type才进行更新
      if (fileData.upload_type) {
        field = fileData.upload_type === 'avatar' ? 'avatar' : 
                (fileData.upload_type === 'qrcode' ? 'wechat_qrcode' : null);
      }
      
      // 用于返回最终状态的变量
      let avatar_final = null;
      let wechat_qrcode_final = null;
      
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
        
        // 查询用户所有需要的字段
        const { rows: userCheck } = await client.query(
          `SELECT avatar, wechat_qrcode FROM users WHERE id = $1`,
          [fileData.entity_id]
        );
        
        if (userCheck.length > 0) {
          avatar_final = userCheck[0].avatar;
          wechat_qrcode_final = userCheck[0].wechat_qrcode;
          
          console.log('[ATTACHMENT SERVICE] 更新后的用户字段最终值', {
            userId: fileData.entity_id,
            avatar_final: avatar_final,
            wechat_qrcode_final: wechat_qrcode_final
          });
        }
      }
      
      // 添加最终状态字段到返回结果
      rows[0].avatar_final = avatar_final;
      rows[0].wechat_qrcode_final = wechat_qrcode_final;
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

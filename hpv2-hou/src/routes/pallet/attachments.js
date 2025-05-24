const express = require('express');
const router = express.Router();
const { jwtAuth } = require('../../middlewares/jwtAuth');
const { imageUpload, materialUpload, handleMulterError } = require('../../utils/upload');
const { saveAttachment, checkEntityPermission } = require('../../services/attachment');
const { body, validationResult } = require('express-validator');
const logger = require('../../utils/logger');
const pool = require('../../config/db');
const fs = require('fs');
const path = require('path');

// 增加延迟处理，避免并发上传导致的问题
const delayPromise = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 1. 图片上传接口
 * 路径: /pallet/attachments/image
 * 方法: POST
 * 功能: 上传产品图片
 */
router.post('/image',
  jwtAuth,
  // 先处理文件上传
  (req, res, next) => {
    const upload = imageUpload.single('file');
    upload(req, res, (err) => {
      if (err) return handleMulterError(err, req, res, next);
      if (!req.file) return res.error('请上传文件', 400);
      next();
    });
  },
  // 再验证其他参数
  [
    body('entity_type')
      .isIn(['PRODUCT', 'BRAND', 'USER'])
      .withMessage('无效的关联类型，必须是PRODUCT/BRAND/USER之一'),
    body('entity_id')
      .isInt({ min: 0 })
      .toInt()
      .withMessage('关联ID必须是有效的整数'),
    body('upload_type')
      .optional()
      .custom((value, { req }) => {
        // 仅当entity_type为USER时，才需要验证upload_type
        if (req.body.entity_type === 'USER' && value) {
          return ['avatar', 'qrcode'].includes(value);
        }
        return true;
      })
      .withMessage('用户上传类型只能是avatar或qrcode'),
    body('replace_existing')
      .optional()
      .isBoolean()
      .withMessage('replace_existing必须是布尔值')
  ],
  (req, res, next) => {
    // 验证请求参数
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.error(errors.array()[0].msg, 400);
    }
    
    next();
  },
  // 处理上传的图片
  async (req, res) => {
    try {
      const { entity_type, entity_id, upload_type, replace_existing } = req.body;
      const replaceExisting = replace_existing === 'true' || replace_existing === true;
      
      // 记录上传开始
      logger.info('图片上传开始', {
        userId: req.user.id,
        entityType: entity_type,
        entityId: entity_id,
        entityIdType: typeof entity_id,
        uploadType: upload_type,
        replaceExisting,
        fileInfo: {
          name: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype,
          path: req.file.path
        }
      });
      
      // 如果是用户头像或二维码，为避免并发冲突，增加少量随机延迟
      if (entity_type === 'USER' && upload_type) {
        const randomDelay = Math.floor(Math.random() * 200) + 50; // 50-250ms随机延迟
        logger.info(`用户${upload_type}上传，随机延迟${randomDelay}ms`, {
          userId: req.user.id,
          entityId: entity_id,
          uploadType: upload_type
        });
        await delayPromise(randomDelay);
      }
      
      // 如果是品牌LOGO或用户头像/二维码，先删除旧的图片（包括数据库记录和文件）
      if (entity_type === 'BRAND' || (entity_type === 'USER' && upload_type)) {
        try {
          // 构建基础查询条件
          let queryParams = [entity_type, entity_id, 'IMAGE'];
          let queryCondition = 'entity_type = $1 AND entity_id = $2 AND file_type = $3';
          
          // 如果是用户头像或二维码，直接从用户表中获取当前路径
          if (entity_type === 'USER' && upload_type) {
            const fieldName = upload_type === 'avatar' ? 'avatar' : 'wechat_qrcode';
            
            logger.info('准备删除用户图片', {
              userId: entity_id,
              uploadType: upload_type,
              fieldName: fieldName
            });
            
            // 查询用户当前图片路径
            const userResult = await pool.query(
              `SELECT ${fieldName} FROM users WHERE id = $1`,
              [entity_id]
            );
            
            // 如果用户存在且有对应的图片路径
            if (userResult.rows.length > 0 && userResult.rows[0][fieldName]) {
              const currentFilePath = userResult.rows[0][fieldName];
              
              logger.info('获取到用户当前图片路径', {
                userId: entity_id,
                uploadType: upload_type,
                currentFilePath: currentFilePath
              });
              
              // 使用精确的文件路径查询
              queryCondition = 'entity_type = $1 AND entity_id = $2 AND file_type = $3 AND file_path = $4';
              queryParams.push(currentFilePath);
            } else {
              logger.info('用户无当前图片路径，将跳过删除', {
                userId: entity_id,
                uploadType: upload_type
              });
            }
          } else if (entity_type === 'BRAND') {
            // 对于品牌Logo，也采用精确匹配当前路径
            logger.info('准备删除品牌Logo', {
              brandId: entity_id
            });
            
            // 先查询品牌当前关联的附件记录
            const brandAttachments = await pool.query(
              `SELECT id, file_path FROM attachments 
               WHERE entity_type = 'BRAND' AND entity_id = $1 AND file_type = 'IMAGE'
               ORDER BY created_at DESC LIMIT 1`,
              [entity_id]
            );
            
            if (brandAttachments.rows.length > 0) {
              const currentFilePath = brandAttachments.rows[0].file_path;
              
              logger.info('获取到品牌当前Logo路径', {
                brandId: entity_id,
                currentFilePath: currentFilePath
              });
              
              // 使用精确的文件路径查询
              queryCondition = 'entity_type = $1 AND entity_id = $2 AND file_type = $3 AND file_path = $4';
              queryParams.push(currentFilePath);
            } else {
              logger.info('品牌无当前Logo，将跳过删除', {
                brandId: entity_id
              });
            }
          }
          
          // 查询现有图片附件
          const { rows: existingAttachments } = await pool.query(
            `SELECT id, file_path FROM attachments WHERE ${queryCondition}`,
            queryParams
          );
          
          // 如果存在旧图片，删除它们
          if (existingAttachments.length > 0) {
            logger.info('发现现有图片记录，将完全删除', {
              entityType: entity_type,
              entityId: entity_id,
              uploadType: upload_type || 'N/A',
              attachmentCount: existingAttachments.length,
              attachments: existingAttachments.map(a => ({ id: a.id, path: a.file_path }))
            });
            
            // 删除物理文件和数据库记录
            for (const attachment of existingAttachments) {
              try {
                // 删除物理文件
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
                    logger.info('成功删除图片物理文件', {
                      entityType: entity_type,
                      entityId: entity_id,
                      uploadType: upload_type || 'N/A',
                      attachmentId: attachment.id,
                      filePath: filePath
                    });
                    fileDeleted = true;
                    break;
                  }
                }
                
                if (!fileDeleted) {
                  logger.warning('未找到要删除的图片物理文件', {
                    entityType: entity_type,
                    entityId: entity_id,
                    uploadType: upload_type || 'N/A',
                    attachmentId: attachment.id,
                    triedPaths: possiblePaths
                  });
                }
                
                // 从数据库中删除附件记录
                await pool.query(
                  'DELETE FROM attachments WHERE id = $1',
                  [attachment.id]
                );
                
                logger.info('成功删除图片数据库记录', {
                  entityType: entity_type,
                  entityId: entity_id,
                  uploadType: upload_type || 'N/A',
                  attachmentId: attachment.id
                });
              } catch (deleteError) {
                logger.error('删除旧图片时发生错误', {
                  error: deleteError.message,
                  stack: process.env.NODE_ENV !== 'production' ? deleteError.stack : undefined,
                  entityType: entity_type,
                  entityId: entity_id,
                  uploadType: upload_type || 'N/A',
                  attachmentId: attachment.id,
                  filePath: attachment.file_path
                });
                // 继续处理，不中断上传流程
              }
            }
          }
        } catch (error) {
          logger.error('查询或删除旧图片时发生错误', {
            error: error.message,
            stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
            entityType: entity_type,
            entityId: entity_id,
            uploadType: upload_type || 'N/A'
          });
          // 继续上传新附件，不阻止流程
        }
      }
      // 对于其他类型的上传，物理删除而不是标记删除
      else if (replaceExisting) {
        try {
          // 查询现有附件
          const { rows: existingAttachments } = await pool.query(
            'SELECT id, file_path FROM attachments WHERE entity_type = $1 AND entity_id = $2 AND file_type = $3 LIMIT 1',
            [entity_type, entity_id, 'IMAGE']
          );
          
          if (existingAttachments.length > 0) {
            const oldAttachment = existingAttachments[0];
            logger.info('发现现有附件，准备删除', {
              oldAttachmentId: oldAttachment.id,
              oldFilePath: oldAttachment.file_path,
              entityType: entity_type,
              entityId: entity_id
            });
            
            // 删除物理文件
            try {
              const fileRelativePath = oldAttachment.file_path.startsWith('/') ? 
                oldAttachment.file_path.substring(1) : oldAttachment.file_path;
              
              // 尝试多个可能的路径
              const possiblePaths = [
                path.join(__dirname, '../../../', fileRelativePath),    // 项目根目录
                path.join(__dirname, '../../', fileRelativePath),       // src目录
                path.join(__dirname, '../../../src', fileRelativePath)  // 项目根目录下的src目录
              ];
              
              // 尝试删除文件
              let fileDeleted = false;
              for (const filePath of possiblePaths) {
                if (fs.existsSync(filePath)) {
                  fs.unlinkSync(filePath);
                  logger.info('成功删除图片物理文件', {
                    entityType: entity_type,
                    entityId: entity_id,
                    attachmentId: oldAttachment.id,
                    filePath: filePath
                  });
                  fileDeleted = true;
                  break;
                }
              }
              
              if (!fileDeleted) {
                logger.warning('未找到要删除的图片物理文件', {
                  entityType: entity_type,
                  entityId: entity_id,
                  attachmentId: oldAttachment.id,
                  triedPaths: possiblePaths
                });
              }
            } catch (deleteError) {
              logger.error('删除旧图片物理文件时发生错误', {
                error: deleteError.message,
                stack: process.env.NODE_ENV !== 'production' ? deleteError.stack : undefined
              });
              // 继续处理，不中断上传流程
            }
            
            // 从数据库中删除附件记录
            await pool.query(
              'DELETE FROM attachments WHERE id = $1',
              [oldAttachment.id]
            );
            
            logger.info('旧附件记录已从数据库中删除', {
              attachmentId: oldAttachment.id
            });
          }
        } catch (error) {
          logger.error('替换附件时发生错误', {
            error: error.message,
            stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
          });
          // 继续上传新附件，不阻止流程
        }
      }
      
      const attachment = await saveAttachment(
        { entity_type, entity_id, upload_type },
        req.file,
        req.user.id
      );
      
      // 记录上传成功
      logger.info('图片上传成功', {
        userId: req.user.id,
        attachmentId: attachment.id,
        filePath: attachment.file_path,
        entityType: entity_type,
        entityId: entity_id,
        uploadType: upload_type,
        replaceExisting
      });
      
      // 针对不同类型的上传提供不同的成功响应
      let responseData = { ...attachment };
      
      if (entity_type === 'USER' && upload_type) {
        if (upload_type === 'avatar') {
          responseData.avatar = attachment.file_path;
        } else if (upload_type === 'qrcode') {
          responseData.wechat_qrcode = attachment.file_path;
        }
        
        // 获取最新的用户信息，确保返回正确的数据
        try {
          const { rows } = await pool.query(
            'SELECT avatar, wechat_qrcode FROM users WHERE id = $1',
            [entity_id]
          );
          
          if (rows.length > 0) {
            logger.info('最终用户图片状态', {
              userId: entity_id,
              avatar: rows[0].avatar,
              wechat_qrcode: rows[0].wechat_qrcode
            });
            
            // 在响应中包含两个字段的最新值
            responseData.avatar_final = rows[0].avatar;
            responseData.wechat_qrcode_final = rows[0].wechat_qrcode;
          }
        } catch (error) {
          logger.error('获取最终用户图片状态失败', {
            error: error.message,
            userId: entity_id
          });
        }
      } else if (entity_type === 'BRAND') {
        logger.info('处理品牌Logo上传', {
          brandId: entity_id,
          logoPath: attachment.file_path,
          fileType: req.file.mimetype,
          replaceExisting
        });
        
        responseData.logo_url = attachment.file_path;
        responseData.brand_id = entity_id;
        
        // 更新品牌记录，标记为已更新
        await pool.query(
          'UPDATE brands SET updated_by = $1, updated_at = NOW() WHERE id = $2',
          [req.user.id, entity_id]
        );
        
        logger.info('品牌Logo上传响应数据', responseData);
      }
      
      return res.success(responseData);
    } catch (error) {
      logger.error('图片上传失败', {
        error: error.message,
        stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
        userId: req.user?.id,
        file: req.file?.originalname,
        entityType: req.body.entity_type,
        entityId: req.body.entity_id,
        uploadType: req.body.upload_type
      });
      
      if (error.message === '无权操作该资源') {
        return res.error(error.message, 403);
      }
      
      return res.error('图片上传失败: ' + error.message, 500);
    }
  }
);

/**
 * 2. 素材包上传接口
 * 路径: /pallet/attachments/material
 * 方法: POST
 * 功能: 上传产品素材包
 */
router.post('/material',
  jwtAuth,
  // 1. 先处理文件上传
  (req, res, next) => {
    const upload = materialUpload.single('file');
    upload(req, res, (err) => {
      if (err) return handleMulterError(err, req, res, next);
      if (!req.file) return res.error('请上传素材包文件', 400);
      next();
    });
  },
  // 2. 再验证其他参数（必须在multer之后）
  [
    body('entity_type')
      .custom(value => value === 'PRODUCT')  // 改用custom验证
      .withMessage('素材包只能关联到产品'),
    body('entity_id')
      .isInt({ min: 0 })  // 修改这里，允许最小值为0，支持临时ID
      .toInt()  // 确保转换为整数
      .withMessage('产品ID必须是有效的整数')
  ],
  (req, res, next) => {
    // 验证请求参数
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.error(errors.array()[0].msg, 400);
    }
    next();
  },
  // 3. 处理上传的素材包
  async (req, res) => {
    try {
      const { entity_type, entity_id } = req.body;
      
      logger.info('素材包上传开始', {
        userId: req.user.id,
        entityType: entity_type,
        entityId: entity_id,
        entityIdType: typeof entity_id,
        fileInfo: {
          name: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype
        }
      });
      
      // 删除该产品已有的素材包文件(如果存在)
      try {
        const { rows: existingMaterials } = await pool.query(
          'SELECT id, file_path FROM attachments WHERE entity_type = $1 AND entity_id = $2 AND file_type = $3',
          [entity_type, entity_id, 'MATERIAL']
        );
        
        if (existingMaterials.length > 0) {
          logger.info('发现现有素材包，将完全删除', {
            entityType: entity_type,
            entityId: entity_id,
            attachmentCount: existingMaterials.length
          });
          
          // 删除物理文件和数据库记录
          for (const material of existingMaterials) {
            try {
              // 删除物理文件
              const fileRelativePath = material.file_path.startsWith('/') ? 
                material.file_path.substring(1) : material.file_path;
              
              // 尝试多个可能的路径
              const possiblePaths = [
                path.join(__dirname, '../../../', fileRelativePath),
                path.join(__dirname, '../../', fileRelativePath),
                path.join(__dirname, '../../../src', fileRelativePath)
              ];
              
              let fileDeleted = false;
              for (const filePath of possiblePaths) {
                if (fs.existsSync(filePath)) {
                  fs.unlinkSync(filePath);
                  logger.info('成功删除素材包物理文件', {
                    entityType: entity_type,
                    entityId: entity_id,
                    attachmentId: material.id,
                    filePath: filePath
                  });
                  fileDeleted = true;
                  break;
                }
              }
              
              if (!fileDeleted) {
                logger.warning('未找到要删除的素材包物理文件', {
                  entityType: entity_type,
                  entityId: entity_id,
                  attachmentId: material.id,
                  triedPaths: possiblePaths
                });
              }
              
              // 从数据库中删除附件记录
              await pool.query(
                'DELETE FROM attachments WHERE id = $1',
                [material.id]
              );
              
              logger.info('成功删除素材包数据库记录', {
                entityType: entity_type,
                entityId: entity_id,
                attachmentId: material.id
              });
            } catch (deleteError) {
              logger.error('删除旧素材包时发生错误', {
                error: deleteError.message,
                stack: process.env.NODE_ENV !== 'production' ? deleteError.stack : undefined,
                entityId: entity_id,
                attachmentId: material.id
              });
              // 继续处理，不中断上传流程
            }
          }
        }
      } catch (error) {
        logger.error('查询或删除旧素材包时发生错误', {
          error: error.message,
          stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
          entityId: entity_id
        });
        // 继续上传新附件，不阻止流程
      }

      const attachment = await saveAttachment(
        { entity_type, entity_id },
        req.file,
        req.user.id
      );
      
      logger.info('素材包上传成功', {
        userId: req.user.id,
        attachmentId: attachment.id,
        filePath: attachment.file_path
      });
      
      return res.success(attachment);
    } catch (error) {
      logger.error('素材包上传失败', {
        error: error.message,
        stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
        userId: req.user?.id,
        file: req.file?.originalname
      });
      
      return res.error(error.message, error.statusCode || 500);
    }
  }
);

/**
 * 3. 更新附件接口
 * 路径: /pallet/attachments/:id
 * 方法: PUT
 * 功能: 更新附件的关联实体
 */
router.put('/:id',
  jwtAuth,
  [
    body('entity_type')
      .isIn(['PRODUCT', 'BRAND', 'USER'])
      .withMessage('无效的关联类型，必须是PRODUCT/BRAND/USER之一'),
    body('entity_id')
      .isInt({ min: 1 })
      .withMessage('关联ID必须是有效的整数')
  ],
  async (req, res) => {
    const client = await pool.connect();
    try {
      const attachmentId = parseInt(req.params.id);
      const { entity_type, entity_id } = req.body;
      
      logger.info('更新附件关联请求', {
        attachmentId,
        newEntityType: entity_type,
        newEntityId: entity_id,
        userId: req.user.id
      });
      
      // 验证附件是否存在
      const { rows: attachmentCheck } = await client.query(
        'SELECT id, entity_type, entity_id FROM attachments WHERE id = $1',
        [attachmentId]
      );
      
      if (attachmentCheck.length === 0) {
        return res.error('附件不存在', 404);
      }
      
      // 验证新的实体是否存在
      try {
        await checkEntityPermission(entity_type, entity_id, req.user.id);
      } catch (error) {
        return res.error(error.message, 404);
      }
      
      // 更新附件关联
      const { rows } = await client.query(
        `UPDATE attachments 
         SET entity_type = $1, entity_id = $2
         WHERE id = $3
         RETURNING id, file_path, file_type, file_size, entity_type, entity_id`,
        [entity_type, entity_id, attachmentId]
      );
      
      logger.info('附件关联更新成功', {
        attachmentId,
        newEntityType: entity_type,
        newEntityId: entity_id,
        userId: req.user.id
      });
      
      return res.success(rows[0]);
    } catch (error) {
      logger.error('更新附件关联失败', {
        error: error.message,
        stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
        attachmentId: req.params.id,
        userId: req.user?.id,
        entityType: req.body.entity_type,
        entityId: req.body.entity_id
      });
      
      return res.error('更新附件关联失败: ' + error.message, 500);
    } finally {
      client.release();
    }
  }
);

module.exports = router;
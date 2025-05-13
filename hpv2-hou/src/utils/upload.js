const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const mkdirp = require('mkdirp');
const { MAX_FILE_SIZE, MAX_ZIP_SIZE } = require('../config/env');

// 确保上传目录存在
const createUploadDirs = () => {
  const dirs = [
    path.join(__dirname, '../uploads/images'),
    path.join(__dirname, '../uploads/materials'),
    path.join(__dirname, '../uploads/qrcode')
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      mkdirp.sync(dir);
    }
  });
};

// 创建上传目录
createUploadDirs();

// 存储配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 根据文件类型选择不同的目录
    let uploadPath;
    
    const isImage = /\.(jpg|jpeg|png|gif)$/i.test(file.originalname);
    const isMaterial = /\.(zip|rar|7z)$/i.test(file.originalname);
    
    if (isImage) {
      uploadPath = path.join(__dirname, '../uploads/images');
    } else if (isMaterial) {
      uploadPath = path.join(__dirname, '../uploads/materials');
    } else {
      // 默认路径
      uploadPath = path.join(__dirname, '../uploads');
    }
    
    console.log('[UPLOAD] 设置上传目录', {
      originalName: file.originalname,
      isImage,
      isMaterial,
      uploadPath
    });
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // 生成一个唯一的文件名，避免文件名冲突
    const uniqueFileName = `${uuidv4()}${path.extname(file.originalname)}`;
    
    console.log('[UPLOAD] 生成文件名', {
      originalName: file.originalname,
      uniqueFileName
    });
    
    cb(null, uniqueFileName);
  }
});

// 文件过滤器
const fileFilter = (req, file, cb) => {
  // 根据上传接口类型验证文件类型
  const isImage = /\.(jpg|jpeg|png|gif)$/i.test(file.originalname);
  const isMaterial = /\.(zip|rar|7z)$/i.test(file.originalname);
  
  // 判断上传类型
  let uploadType = 'image'; // 默认图片上传
  
  // 如果是附件管理接口的路由
  if (req.originalUrl.includes('/api/pallet/attachments/')) {
    // 附件管理接口使用路径判断
    uploadType = req.path.includes('image') ? 'image' : 'material';
  } else {
    // 自定义路由(如头像、二维码、Logo)默认使用图片上传
    uploadType = 'image';
  }
  
  if (uploadType === 'image' && !isImage) {
    return cb(new Error('只支持上传jpg/jpeg/png/gif格式的图片文件'), false);
  }
  
  if (uploadType === 'material' && !isMaterial) {
    return cb(new Error('只支持上传zip/rar/7z格式的压缩文件'), false);
  }
  
  cb(null, true);
};

// 创建图片上传实例
const imageUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE * 1024 * 1024  // 默认20MB
  }
});

// 创建素材包上传实例
const materialUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_ZIP_SIZE * 1024 * 1024  // 默认500MB
  }
});

// 处理multer错误
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.error('文件大小超出限制', 413);
    }
    return res.error(`文件上传错误: ${err.message}`, 400);
  } else if (err) {
    return res.error(err.message, 400);
  }
  next();
};

module.exports = {
  imageUpload,
  materialUpload,
  handleMulterError
}; 
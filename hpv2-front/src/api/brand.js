import request from '../utils/request';

// 全局缓存版本号
let CACHE_VERSION = Date.now();

// 更新缓存版本号的函数
export const updateCacheVersion = () => {
  // 使用时间戳作为缓存版本
  CACHE_VERSION = Date.now();
  
  // 保存到本地存储，确保不同标签页同步
  try {
    localStorage.setItem('brand_cache_version', CACHE_VERSION.toString());
  } catch (e) {
    console.error('[API] 缓存版本更新失败', e);
  }
  
  return CACHE_VERSION;
};

// 获取当前缓存版本号
export const getCacheVersion = () => {
  // 尝试从本地存储获取最新版本
  try {
    const storedVersion = localStorage.getItem('brand_cache_version');
    if (storedVersion && storedVersion > CACHE_VERSION) {
      CACHE_VERSION = storedVersion;
    }
  } catch (e) {
    // 忽略存储错误
  }
  return CACHE_VERSION;
};

/**
 * 获取品牌列表
 * @param {Object} params - 查询参数
 * @param {number} params.page - 页码
 * @param {number} params.page_size - 每页条数
 * @param {string} params.status - 状态过滤
 * @param {string} params.sort_by - 排序字段
 * @param {string} params.sort_order - 排序方式
 * @returns {Promise<Object>} 品牌列表数据
 */
export const getBrands = (params) => {
  // 添加缓存版本号到参数中
  const paramsWithCache = {
    ...params,
    _cache: CACHE_VERSION
  };
  
  // 确保分页参数存在且有效
  if (!paramsWithCache.page) {
    paramsWithCache.page = 1;
  }
  
  if (!paramsWithCache.page_size) {
    paramsWithCache.page_size = 10;
  }
  
  // 确保排序参数存在且有效
  if (!paramsWithCache.sort_by) {
    paramsWithCache.sort_by = 'updated_at';
  }
  
  if (!paramsWithCache.sort_order) {
    paramsWithCache.sort_order = 'desc';
  }
  
  console.log('[API] 获取品牌列表，参数：', paramsWithCache);
  
  return request({
    url: '/api/pallet/brands',
    method: 'GET',
    params: paramsWithCache
  });
};

/**
 * 获取品牌详情
 * @param {string} id - 品牌ID
 * @returns {Promise<Object>} 品牌详情
 */
export const getBrandDetail = (id) => {
  // 添加缓存版本参数，确保请求最新数据
  const cacheBuster = {
    _cache: CACHE_VERSION, 
    _t: Date.now()
  };
  
  return request({
    url: `/api/pallet/brands/${id}`,
    method: 'GET',
    params: cacheBuster,
    headers: {
      'Cache-Control': 'no-cache'
    }
  });
};

/**
 * 创建品牌
 * @param {Object} data - 品牌数据
 * @param {string} data.name - 品牌名称
 * @param {string} data.description - 品牌描述
 * @param {string} data.status - 品牌状态
 * @returns {Promise<Object>} 创建结果
 */
export const createBrand = async (data) => {
  const result = await request({
    url: '/api/pallet/brands',
    method: 'POST',
    data
  });
  
  // 创建成功后更新缓存版本
  if (result && result.success) {
    updateCacheVersion();
  }
  
  return result;
};

/**
 * 更新品牌
 * @param {string} id - 品牌ID
 * @param {Object} data - 品牌数据
 * @param {string} data.name - 品牌名称
 * @param {string} data.description - 品牌描述
 * @param {string} data.status - 品牌状态
 * @returns {Promise<Object>} 更新结果
 */
export const updateBrand = async (id, data) => {
  const result = await request({
    url: `/api/pallet/brands/${id}`,
    method: 'PUT',
    data
  });
  
  // 更新成功后更新缓存版本
  if (result && result.success) {
    updateCacheVersion();
  }
  
  return result;
};

/**
 * 上传品牌Logo
 * @param {File} file - Logo文件
 * @param {string} entityId - 品牌ID
 * @returns {Promise<Object>} 上传结果
 */
export const uploadLogo = async (file, entityId) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('entity_type', 'BRAND');
  formData.append('entity_id', entityId);
  formData.append('replace_existing', 'true');
  
  const result = await request({
    url: '/api/pallet/attachments/image',
    method: 'POST',
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data',
      'Cache-Control': 'no-cache'
    }
  });
  
  // 上传成功后更新缓存版本
  if (result && result.success) {
    updateCacheVersion();
  }
  
  return result;
};

/**
 * 删除品牌
 * @param {string} id - 品牌ID
 * @returns {Promise<Object>} 删除结果
 */
export const deleteBrand = (id) => {
  return request({
    url: `/api/pallet/brands/${id}`,
    method: 'DELETE'
  });
};

/**
 * 切换品牌状态
 * @param {string} id - 品牌ID
 * @param {string} status - 目标状态 ('active'|'inactive')
 * @returns {Promise<Object>} 更新结果
 */
export const toggleBrandStatus = (id, status) => {
  return request({
    url: `/api/pallet/brands/${id}/status`,
    method: 'PATCH',
    data: { status }
  });
}; 
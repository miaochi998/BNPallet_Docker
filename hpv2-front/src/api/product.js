import request from '../utils/request';

/**
 * 获取产品列表
 * 
 * @param {Object} params - 查询参数
 * @param {number} params.page - 页码
 * @param {number} params.page_size - 每页条数
 * @param {string} params.keyword - 搜索关键词
 * @param {string} params.status - 状态过滤
 * @param {string} params.brand_id - 品牌ID过滤
 * @param {string} params.sort_field - 排序字段
 * @param {string} params.sort_order - 排序方式 (asc|desc)
 * @returns {Promise<Object>} 产品列表数据
 */
export const getProducts = (params) => {
  return request({
    url: '/pallet/products',
    method: 'GET',
    params
  });
};

/**
 * 获取产品详情
 * 
 * @param {string} id - 产品ID
 * @returns {Promise<Object>} 产品详情
 */
export const getProductDetail = (id) => {
  return request({
    url: `/pallet/products/${id}`,
    method: 'GET'
  });
};

/**
 * 创建产品
 * 
 * @param {Object} data - 产品数据
 * @returns {Promise<Object>} 创建结果
 */
export const createProduct = (data) => {
  return request({
    url: '/pallet/products',
    method: 'POST',
    data
  });
};

/**
 * 更新产品
 * 
 * @param {string} id - 产品ID
 * @param {Object} data - 产品数据
 * @returns {Promise<Object>} 更新结果
 */
export const updateProduct = (id, data) => {
  return request({
    url: `/pallet/products/${id}`,
    method: 'PUT',
    data
  });
};

/**
 * 删除产品
 * 
 * @param {string} id - 产品ID
 * @returns {Promise<Object>} 删除结果
 */
export const deleteProduct = (id) => {
  return request({
    url: `/pallet/products/${id}`,
    method: 'DELETE'
  });
};

/**
 * 更新产品状态
 * 
 * @param {string} id - 产品ID
 * @param {string} status - 状态值
 * @returns {Promise<Object>} 更新结果
 */
export const updateProductStatus = (id, status) => {
  return request({
    url: `/pallet/products/${id}/status`,
    method: 'PATCH',
    data: { status }
  });
};

export default {
  getProducts,
  getProductDetail,
  createProduct,
  updateProduct,
  deleteProduct,
  updateProductStatus
}; 
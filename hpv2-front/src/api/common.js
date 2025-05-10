import request from '../utils/request';

/**
 * 获取通用分页查询数据
 * 
 * @param {Object} params - 查询参数
 * @param {number} params.page - 页码
 * @param {number} params.page_size - 每页条数
 * @param {string} params.sort_field - 排序字段
 * @param {string} params.sort_order - 排序方式 (asc|desc)
 * @returns {Promise<Object>} 分页数据
 */
export const getPaginationData = (params) => {
  return request({
    url: '/common/pagination/query',
    method: 'GET',
    params
  });
};

/**
 * 更新用户分页设置
 * 
 * @param {Object} data - 分页设置
 * @param {number} data.page_size - 每页条数 (10|20|50|100)
 * @returns {Promise<Object>} 更新结果
 */
export const updatePaginationSettings = (data) => {
  return request({
    url: '/common/pagination/settings',
    method: 'POST',
    data
  });
};

/**
 * 通用搜索接口
 * @param {string} module - 搜索模块名称 
 * @param {string} keyword - 搜索关键字
 * @param {string} fields - 搜索字段，逗号分隔
 * @param {boolean} exact - 是否精确匹配
 * @param {object} additionalParams - 附加参数
 * @returns {Promise} - 返回搜索结果
 */
export const commonSearch = (module, keyword, fields, exact = false, additionalParams = {}) => {
  return request({
    url: '/api/common/search',
    method: 'get',
    params: {
      module,
      keyword,
      fields,
      exact,
      ...additionalParams
    }
  });
};

/**
 * 获取可搜索字段
 * @returns {Promise} - 返回各模块可搜索字段
 */
export const getSearchFields = () => {
  return request({
    url: '/api/common/search/fields',
    method: 'get'
  });
};

export default {
  getPaginationData,
  updatePaginationSettings,
  commonSearch,
  getSearchFields
}; 
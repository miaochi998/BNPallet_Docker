import request from '@/utils/request';

/**
 * 获取静态页面内容
 * @param {string} pageType - 页面类型: 'store-service', 'logistics', 'help-center'
 * @returns {Promise<Object>} 返回静态页面内容
 */
export const getStaticContent = (pageType) => {
  return request({
    url: `/api/content/${pageType}`,
    method: 'get',
  });
};

/**
 * 更新静态页面内容
 * @param {string} pageType - 页面类型: 'store-service', 'logistics', 'help-center'
 * @param {string} content - HTML格式的内容
 * @returns {Promise<Object>} 返回更新结果
 */
export const updateStaticContent = (pageType, content) => {
  return request({
    url: `/api/content/${pageType}`,
    method: 'post',
    data: { content },
  });
}; 
import request from '../utils/request';

/**
 * 获取仪表盘概览数据
 * @returns {Promise} 返回仪表盘概览数据
 */
export const getDashboardOverview = () => {
  return request({
    url: '/api/pallet/dashboard/overview',
    method: 'get'
  });
};

/**
 * 获取实时数据刷新数据
 * @returns {Promise} 返回最新的数据更新时间
 */
export const getDashboardRefresh = () => {
  return request({
    url: '/api/pallet/dashboard/refresh',
    method: 'get'
  });
};

/**
 * 获取用户个人信息
 * @returns {Promise} 返回用户个人信息
 */
export const getDashboardProfile = () => {
  return request({
    url: '/api/pallet/dashboard/profile',
    method: 'get'
  });
};

/**
 * 获取用户权限信息
 * @param {string} module 可选，指定模块权限
 * @returns {Promise} 返回用户权限信息
 */
export const getDashboardPermissions = (module) => {
  return request({
    url: '/api/pallet/dashboard/permissions',
    method: 'get',
    params: { module }
  });
}; 
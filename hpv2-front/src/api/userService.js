import request from '../utils/request';
import { commonSearch } from './common';

/**
 * 获取用户列表
 * @param {Object} params - 查询参数
 * @param {boolean} isAdmin - 是否查询管理员用户
 * @returns {Promise} - API响应
 */
export const getUsers = (params, isAdmin) => {
  console.log(`[API] 调用getUsers，参数:`, params, `isAdmin:`, isAdmin);
  
  // 如果有搜索关键词，使用通用搜索接口
  if (params.username || params.name || params.phone || params.email) {
    // 提取搜索关键词
    let keyword = '';
    if (params.username) keyword = params.username.trim();
    else if (params.name) keyword = params.name.trim();
    else if (params.phone) keyword = params.phone.trim();
    else if (params.email) keyword = params.email.trim();
    
    // 清理关键词，去掉可能的%符号
    keyword = keyword.replace(/%/g, '');
    
    console.log('[API] 使用通用搜索接口，关键词:', keyword);
    
    // 调用通用搜索接口，模块设为users表示用户搜索，附加is_admin过滤条件
    return commonSearch('users', keyword, 'username,name,phone,email', false, { is_admin: isAdmin })
      .then(response => {
        console.log('[API] commonSearch返回:', response);
        return response;
      });
  }
  
  // 没有搜索关键词，使用用户列表接口
  return request({
    url: '/api/auth/users',
    method: 'get',
    params: {
      ...params,
      is_admin: isAdmin
    }
  }).then(response => {
    console.log(`[API] getUsers原始响应:`, response);
    
    // 确保返回数据格式一致，即使后端返回的数据结构不完整
    if (!response.data) {
      console.log('[API] 没有data字段，返回空列表');
      return {
        ...response,
        data: {
          list: [],
          total: 0
        }
      };
    }
    
    // 如果后端返回的是users数组，将其格式化为前端需要的格式
    if (response.data.users && Array.isArray(response.data.users)) {
      console.log('[API] 处理users数组，长度:', response.data.users.length);
      return {
        ...response,
        data: {
          list: response.data.users,
          total: response.data.pagination?.total || response.data.users.length
        }
      };
    }
    
    // 返回原始响应
    console.log('[API] 返回原始响应');
    return response;
  });
};

/**
 * 创建用户
 * @param {Object} data - 用户数据
 * @param {boolean} isAdmin - 是否创建管理员用户
 * @returns {Promise} - API响应
 */
export const createUser = (data, isAdmin) => {
  return request({
    url: '/api/auth/users',
    method: 'post',
    data: {
      ...data,
      is_admin: isAdmin  // 根据isAdmin参数设置用户类型
    }
  });
};

/**
 * 获取用户详情
 * @param {number|string} id - 用户ID
 * @returns {Promise} - API响应
 */
export const getUserById = (id) => {
  return request({
    url: `/api/auth/users/${id}`,
    method: 'get'
  });
};

/**
 * 更新用户信息
 * @param {number|string} id - 用户ID
 * @param {Object} data - 更新的数据
 * @returns {Promise} - API响应
 */
export const updateUser = (id, data) => {
  return request({
    url: `/api/auth/users/${id}`,
    method: 'patch',
    data
  });
};

/**
 * 更新用户密码
 * @param {number|string} id - 用户ID
 * @param {string} password - 新密码
 * @returns {Promise} - API响应
 */
export const updateUserPassword = (id, password) => {
  return request({
    url: `/api/auth/users/${id}/password`,
    method: 'patch',
    data: {
      new_password: password
    }
  });
};

/**
 * 更新用户状态
 * @param {number|string} id - 用户ID
 * @param {string} status - 新状态
 * @returns {Promise} - API响应
 */
export const updateUserStatus = (id, status) => {
  return request({
    url: `/api/auth/users/${id}/status`,
    method: 'patch',
    data: {
      status
    }
  });
};

/**
 * 删除用户
 * @param {number|string} id - 用户ID
 * @returns {Promise} - API响应
 */
export const deleteUser = (id) => {
  return request({
    url: `/api/auth/users/${id}`,
    method: 'delete'
  });
};

/**
 * 批量重置用户密码
 * @param {Array} ids - 用户ID数组
 * @returns {Promise} - API响应
 */
export const batchResetUserPassword = (ids) => {
  return request({
    url: '/api/auth/users/batch/reset-password',
    method: 'post',
    data: {
      user_ids: ids
    }
  });
};

/**
 * 获取所有品牌列表，用于设置用户可管理品牌
 * @returns {Promise} - API响应
 */
export const getBrands = () => {
  return request({
    url: '/api/pallet/brands',
    method: 'get'
  }).then(response => {
    // 确保返回数据格式一致，即使后端返回的数据结构不完整
    if (!response.data) {
      return {
        ...response,
        data: []
      };
    }
    
    // 检查返回的数据结构
    if (Array.isArray(response.data)) {
      // 如果本身就是数组，直接返回
      return response;
    } else if (response.data.list && Array.isArray(response.data.list)) {
      // 后端返回带分页的数据结构，取list字段
      return {
        ...response,
        data: response.data.list
      };
    } else if (response.data.brands && Array.isArray(response.data.brands)) {
      // 如果data中有brands字段且为数组，返回这个数组
      return {
        ...response,
        data: response.data.brands
      };
    } else {
      // 其他情况返回空数组
      return {
        ...response,
        data: []
      };
    }
  });
};

/**
 * 设置用户可管理的品牌
 * @param {number|string} userId - 用户ID
 * @param {Array} brandIds - 品牌ID数组
 * @returns {Promise} - API响应
 */
export const setUserBrands = (userId, brandIds) => {
  return request({
    url: `/api/auth/users/${userId}/brands`,
    method: 'post',
    data: {
      brand_ids: brandIds
    }
  });
}; 
import request from '../utils/request';
import { getApiBaseUrl } from '../config/urls';
import axios from 'axios';

// 获取用户列表
export const getUsers = (params) => {
  return request({
    url: '/users',
    method: 'get',
    params
  });
};

// 获取用户详情
export const getUserById = (id) => {
  return request({
    url: `/users/${id}`,
    method: 'get'
  });
};

// 创建用户
export const createUser = (data) => {
  return request({
    url: '/users',
    method: 'post',
    data
  });
};

// 更新用户
export const updateUser = (id, data) => {
  return request({
    url: `/users/${id}`,
    method: 'put',
    data
  });
};

// 删除用户
export const deleteUser = (id) => {
  return request({
    url: `/users/${id}`,
    method: 'delete'
  });
};

// 获取个人资料
export const getProfile = () => {
  return request({
    url: '/api/auth/profile',
    method: 'get'
  });
};

// 更新个人资料
export const updateProfile = (data) => {
  return request({
    url: '/api/auth/profile',
    method: 'put',
    data
  });
};

// 更新密码
export const updatePassword = (data) => {
  return request({
    url: '/api/auth/profile/password',
    method: 'put',
    data
  });
};

// 获取店铺列表
export const getStores = () => {
  return request({
    url: '/api/auth/stores',
    method: 'get'
  });
};

// 添加店铺
export const addStore = (data) => {
  return request({
    url: '/api/auth/stores',
    method: 'post',
    data
  });
};

// 更新店铺
export const updateStore = (id, data) => {
  return request({
    url: `/api/auth/stores/${id}`,
    method: 'put',
    data
  });
};

// 删除店铺
export const deleteStore = (id) => {
  return request({
    url: `/api/auth/stores/${id}`,
    method: 'delete'
  });
};

// 上传图片通用函数（头像或二维码）
export const uploadImage = async (file, entityType = 'USER', entityId, uploadType) => {
  const formData = new FormData();
  
  if (file instanceof File) {
    formData.append('file', file);
  } else if (formData instanceof FormData) {
    // 如果已经是FormData对象，直接使用
    return request({
      url: '/api/pallet/attachments/image',
      method: 'post',
      data: file,
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  }
  
  formData.append('entity_type', entityType);
  formData.append('entity_id', entityId);
  
  if (uploadType) {
    formData.append('upload_type', uploadType);
  }
  
  return request({
    url: '/api/pallet/attachments/image',
    method: 'post',
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
}; 
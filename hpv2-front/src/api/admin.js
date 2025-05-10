import { 
  getUsers, createUser, getUserById, updateUser, 
  updateUserPassword, updateUserStatus, deleteUser, batchResetUserPassword 
} from './userService';

// 获取管理员用户列表
export const getAdminUsers = (params) => {
  return getUsers(params, true);
};

// 创建管理员用户
export const createAdminUser = (data) => {
  return createUser(data, true);
};

// 获取管理员用户详情
export const getAdminUserById = (id) => {
  return getUserById(id);
};

// 更新管理员用户
export const updateAdminUser = (id, data) => {
  return updateUser(id, data);
};

// 更新管理员用户密码
export const updateAdminUserPassword = (id, password) => {
  return updateUserPassword(id, password);
};

// 更新管理员用户状态
export const updateAdminUserStatus = (id, status) => {
  return updateUserStatus(id, status);
};

// 删除管理员用户
export const deleteAdminUser = (id) => {
  return deleteUser(id);
};

// 批量重置管理员密码
export const batchResetAdminPassword = (ids) => {
  return batchResetUserPassword(ids);
}; 
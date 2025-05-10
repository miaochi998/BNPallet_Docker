import { 
  getUsers, createUser, getUserById, updateUser, 
  updateUserPassword, updateUserStatus, deleteUser, 
  batchResetUserPassword, getBrands as fetchBrands, setUserBrands as assignUserBrands 
} from './userService';

// 获取普通用户列表
export const getRegularUsers = (params) => {
  return getUsers(params, false);
};

// 创建普通用户
export const createRegularUser = (data) => {
  return createUser(data, false);
};

// 获取普通用户详情
export const getRegularUserById = (id) => {
  return getUserById(id);
};

// 更新普通用户
export const updateRegularUser = (id, data) => {
  return updateUser(id, data);
};

// 更新普通用户密码
export const updateRegularUserPassword = (id, password) => {
  return updateUserPassword(id, password);
};

// 更新普通用户状态
export const updateRegularUserStatus = (id, status) => {
  return updateUserStatus(id, status);
};

// 删除普通用户
export const deleteRegularUser = (id) => {
  return deleteUser(id);
};

// 获取所有品牌列表，用于设置用户可管理品牌
export const getBrands = () => {
  return fetchBrands();
};

// 设置用户可管理的品牌
export const setUserBrands = (userId, brandIds) => {
  return assignUserBrands(userId, brandIds);
};

// 批量重置普通用户密码
export const batchResetRegularUserPassword = (ids) => {
  return batchResetUserPassword(ids);
}; 
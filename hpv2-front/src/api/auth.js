import request from '../utils/request';

// 开发环境模拟响应
const useMockResponse = import.meta.env.DEV && import.meta.env.VITE_DEBUG_MODE === 'true';
console.log('当前环境:', {
  isDev: import.meta.env.DEV,
  env: import.meta.env.VITE_ENV,
  debug: import.meta.env.VITE_DEBUG_MODE,
  useMockResponse
});

// 模拟数据
const mockData = {
  login: {
    code: 200,
    message: '登录成功',
    data: {
      token: 'mock_token_123456',
      user_info: {
        id: 1,
        username: 'admin',
        name: '管理员',
        is_admin: true,
        email: 'admin@example.com',
        avatar: null
      }
    }
  },
  profile: {
    code: 200,
    message: '获取用户信息成功',
    data: {
      id: 1,
      username: 'admin',
      name: '管理员',
      is_admin: true,
      email: 'admin@example.com',
      avatar: null
    }
  }
};

// 登录API
export const login = async (data) => {
  console.log('API调用: 登录', data);
  
  // 开发环境使用模拟数据
  if (useMockResponse && (data.username === 'admin' && data.password === '654321')) {
    console.log('使用模拟登录数据');
    return Promise.resolve(mockData.login);
  }
  
  // 临时调试模式 - 始终使用模拟数据登录成功
  if (localStorage.getItem('debug_auth') === 'true') {
    console.log('紧急调试模式: 使用模拟登录数据');
    return Promise.resolve(mockData.login);
  }
  
  try {
    const result = await request({
      url: '/api/auth/login',
      method: 'post',
      data
    });
    console.log('登录API响应:', result);
    return result;
  } catch (error) {
    console.error('登录API错误:', error);
    throw error;
  }
};

// 获取用户信息API
export const getUserProfile = async () => {
  console.log('API调用: 获取用户信息');
  
  // 开发环境使用模拟数据
  if (useMockResponse) {
    console.log('使用模拟用户信息数据');
    return Promise.resolve(mockData.profile);
  }
  
  // 临时调试模式
  if (localStorage.getItem('debug_auth') === 'true') {
    console.log('紧急调试模式: 使用模拟用户信息数据');
    return Promise.resolve(mockData.profile);
  }
  
  try {
    const result = await request({
      url: '/api/auth/profile',
      method: 'get'
    });
    console.log('获取用户信息API响应:', result);
    return result;
  } catch (error) {
    console.error('获取用户信息API错误:', error);
    throw error;
  }
};

// 登出API
export const logout = async () => {
  console.log('API调用: 登出');
  
  // 开发环境使用模拟数据
  if (useMockResponse || localStorage.getItem('debug_auth') === 'true') {
    console.log('使用模拟登出数据');
    return Promise.resolve({ code: 200, message: '登出成功' });
  }
  
  try {
    const result = await request({
      url: '/api/auth/logout',
      method: 'post'
    });
    console.log('登出API响应:', result);
    return result;
  } catch (error) {
    console.error('登出API错误:', error);
    throw error;
  }
};

// 更新用户信息API
export const updateUserProfile = (data) => {
  console.log('API调用: updateUserProfile', data);
  
  // 开发环境使用模拟数据
  if (useMockResponse || localStorage.getItem('debug_auth') === 'true') {
    console.log('使用模拟更新用户信息数据');
    return Promise.resolve({ 
      code: 200, 
      message: '更新用户信息成功',
      data: { ...mockData.profile.data, ...data }
    });
  }
  
  return request({
    url: '/api/auth/profile',
    method: 'put',
    data
  });
}; 
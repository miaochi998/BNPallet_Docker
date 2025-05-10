import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import request from '@/utils/request';
import { message } from 'antd';

// Token处理
const TOKEN_KEY = 'auth_token';

const getToken = () => {
  return localStorage.getItem(TOKEN_KEY);
};

const setToken = (token) => {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    return true;
  }
  return false;
};

const removeToken = () => {
  localStorage.removeItem(TOKEN_KEY);
};

// 从localStorage加载初始状态
const loadInitialState = () => {
  const token = getToken();
  return {
    isAuthenticated: !!token,
    token: token || null,
    user: null,
    error: null,
    loading: false
  };
};

// 登录异步action
export const loginAsync = createAsyncThunk(
  'auth/login',
  async (credentials, { rejectWithValue }) => {
    try {
      const response = await request.post('/api/auth/login', credentials);
      
      // 保存token到localStorage
      if (response.data?.token) {
        localStorage.setItem('auth_token', response.data.token);
      }
      
      return response.data;
    } catch (error) {
      console.error('登录失败:', error);
      
      let errorMessage = '登录失败，请稍后重试';
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      return rejectWithValue(errorMessage);
    }
  }
);

// 获取用户信息
export const getUserInfoAsync = createAsyncThunk(
  'auth/getUserInfo',
  async (_, { rejectWithValue }) => {
    try {
      const response = await request.get('/api/auth/profile');
      return response.data;
    } catch (error) {
      console.error('获取用户信息失败:', error);
      
      let errorMessage = '获取用户信息失败';
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      return rejectWithValue(errorMessage);
    }
  }
);

// 登出
export const logoutAsync = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      // 调用后端登出接口
      await request.post('/api/auth/logout');
      
      // 清除localStorage中的token
      localStorage.removeItem('auth_token');
      
      return true;
    } catch (error) {
      console.error('登出失败:', error);
      
      // 无论成功失败，都清除本地存储的token
      localStorage.removeItem('auth_token');
      
      return rejectWithValue('登出失败');
    }
  }
);

// 使用加载的状态作为初始状态
const initialState = loadInitialState();

// 创建auth slice
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      console.log('显式清除错误状态');
      state.error = null;
    },
    clearAuth: (state) => {
      state.isAuthenticated = false;
      state.user = null;
      state.error = null;
      localStorage.removeItem('auth_token');
    },
    debugLogin: (state, action) => {
      // 调试模式下直接设置认证状态
      state.isAuthenticated = true;
      state.user = action.payload.user_info;
      state.token = action.payload.token;
      state.error = null;
      state.loading = false;
      
      // 保存token到localStorage
      localStorage.setItem('auth_token', action.payload.token);
    }
  },
  extraReducers: (builder) => {
    // 登录处理
    builder
      .addCase(loginAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginAsync.fulfilled, (state, action) => {
        state.loading = false;
        state.isAuthenticated = true;
        // 不清除错误，只有在明确调用clearError才清除
      })
      .addCase(loginAsync.rejected, (state, action) => {
        state.loading = false;
        state.isAuthenticated = false;
        state.error = action.payload || '登录失败，请稍后重试';
        console.error('登录被拒绝，设置错误状态:', state.error);
      })
      
      // 获取用户信息处理
      .addCase(getUserInfoAsync.pending, (state) => {
        state.loading = true;
        // 不清除错误，保持现有错误状态
      })
      .addCase(getUserInfoAsync.fulfilled, (state, action) => {
        state.loading = false;
        state.isAuthenticated = true;
        state.user = action.payload;
        // 获取用户信息成功，清除可能的错误
        state.error = null;
      })
      .addCase(getUserInfoAsync.rejected, (state, action) => {
        state.loading = false;
        state.isAuthenticated = false;
        state.user = null;
        state.error = action.payload || '获取用户信息失败';
        console.error('获取用户信息被拒绝，设置错误状态:', state.error);
        // 清除token
        localStorage.removeItem('auth_token');
      })
      
      // 登出处理
      .addCase(logoutAsync.fulfilled, (state) => {
        state.isAuthenticated = false;
        state.user = null;
        state.error = null;
      });
  }
});

export const { clearError, clearAuth, debugLogin } = authSlice.actions;
export default authSlice.reducer; 
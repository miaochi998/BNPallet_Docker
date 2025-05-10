import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { 
  getBrands, 
  createBrand, 
  updateBrand, 
  deleteBrand, 
  toggleBrandStatus 
} from '@/api/brand';

// 初始状态
const initialState = {
  list: [],
  loading: false,
  error: null,
  currentBrand: null,
  pagination: {
    current: 1,
    pageSize: 10,
    total: 0
  },
  filter: {
    status: null
  }
};

// 异步Action: 获取品牌列表
export const fetchBrands = createAsyncThunk(
  'brands/fetchBrands',
  async (params, { rejectWithValue }) => {
    try {
      // 确保分页参数存在
      const queryParams = {
        page: params?.page || 1,
        page_size: params?.pageSize || 10,
        ...params
      };
      
      console.log('[BRANDS SLICE] 获取品牌列表，参数:', queryParams);
      
      const response = await getBrands(queryParams);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || '获取品牌列表失败');
    }
  }
);

// 异步Action: 创建品牌
export const addBrand = createAsyncThunk(
  'brands/addBrand',
  async (brandData, { rejectWithValue, dispatch }) => {
    try {
      const response = await createBrand(brandData);
      // 创建成功后刷新品牌列表
      dispatch(fetchBrands());
      return response;
    } catch (error) {
      return rejectWithValue(error.message || '创建品牌失败');
    }
  }
);

// 异步Action: 更新品牌
export const updateBrandById = createAsyncThunk(
  'brands/updateBrand',
  async ({ id, data }, { rejectWithValue, dispatch, getState }) => {
    try {
      console.log('[BRAND SLICE] 开始更新品牌', { brandId: id });
      const response = await updateBrand(id, data);
      console.log('[BRAND SLICE] 品牌更新成功，准备刷新列表', { response });
      
      // 获取当前的过滤和分页参数
      const state = getState();
      const { pagination, filter } = state.brands;
      
      // 构建刷新参数
      const refreshParams = {
        page: pagination.current,
        page_size: pagination.pageSize,
        ...filter,
        _t: new Date().getTime() // 添加时间戳参数防止缓存
      };
      
      // 延迟200ms再刷新列表，确保后端数据已更新
      setTimeout(() => {
        dispatch(fetchBrands(refreshParams));
      }, 200);
      
      return response;
    } catch (error) {
      console.error('[BRAND SLICE] 更新品牌失败', { 
        brandId: id, 
        error: error.message 
      });
      return rejectWithValue(error.message || '更新品牌失败');
    }
  }
);

// 异步Action: 删除品牌
export const removeBrand = createAsyncThunk(
  'brands/removeBrand',
  async (id, { rejectWithValue, dispatch, getState }) => {
    try {
      const response = await deleteBrand(id);
      
      // 获取当前的分页和过滤参数
      const state = getState();
      const { pagination, filter } = state.brands;
      
      // 删除成功后使用当前分页大小刷新品牌列表
      dispatch(fetchBrands({
        page: 1, // 删除后返回第一页
        page_size: pagination.pageSize, // 保持当前的每页数量
        ...filter,
        _t: Date.now() // 添加时间戳防止缓存
      }));
      
      return response;
    } catch (error) {
      // 检查错误信息中是否包含"无法删除：该品牌下存在产品"
      if (error.response && error.response.data && 
          (error.response.data.message.includes('存在产品') || 
           error.response.data.message.includes('无法删除'))) {
        return rejectWithValue({
          message: '该品牌下有关联产品，请先移除所有关联产品后再删除。',
          hasProducts: true
        });
      }
      return rejectWithValue(error.message || '删除品牌失败');
    }
  }
);

// 异步Action: 变更品牌状态
export const toggleBrandStatusAction = createAsyncThunk(
  'brands/toggleStatus',
  async ({ id, status }, { rejectWithValue, dispatch, getState }) => {
    try {
      const response = await toggleBrandStatus(id, status);
      
      // 获取当前的分页和过滤参数
      const state = getState();
      const { pagination, filter } = state.brands;
      
      // 状态变更成功后使用当前分页大小刷新品牌列表
      dispatch(fetchBrands({
        page: pagination.current,
        page_size: pagination.pageSize,
        ...filter,
        _t: Date.now() // 添加时间戳防止缓存
      }));
      
      return response;
    } catch (error) {
      return rejectWithValue(error.message || '变更品牌状态失败');
    }
  }
);

// 创建Slice
const brandsSlice = createSlice({
  name: 'brands',
  initialState,
  reducers: {
    setFilter: (state, action) => {
      state.filter = { ...state.filter, ...action.payload };
      // 重置分页到第一页
      state.pagination.current = 1;
    },
    setPagination: (state, action) => {
      state.pagination = { ...state.pagination, ...action.payload };
    },
    setCurrentBrand: (state, action) => {
      state.currentBrand = action.payload;
    },
    clearCurrentBrand: (state) => {
      state.currentBrand = null;
    }
  },
  extraReducers: (builder) => {
    // 处理fetchBrands
    builder
      .addCase(fetchBrands.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchBrands.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload.data.list || [];
        
        // 调试日志
        console.log('[BRANDS SLICE] API返回数据:', action.payload.data);
        
        // 更新分页信息，只更新总数，保留当前页和页大小
        const paginationData = action.payload.data.pagination || {};
        
        if (paginationData) {
          // 使用后端返回的分页信息，但保留前端设置的当前页和页大小
          state.pagination = {
            ...state.pagination, // 保留现有的分页设置
            total: paginationData.total || 0  // 只更新总数
          };
          
          console.log('[BRANDS SLICE] 更新分页信息:', state.pagination);
        }
      })
      .addCase(fetchBrands.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || '获取品牌列表失败';
      })
      
      // 处理addBrand
      .addCase(addBrand.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addBrand.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(addBrand.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || '创建品牌失败';
      })
      
      // 处理updateBrandById
      .addCase(updateBrandById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateBrandById.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(updateBrandById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || '更新品牌失败';
      })
      
      // 处理removeBrand
      .addCase(removeBrand.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(removeBrand.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(removeBrand.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || '删除品牌失败';
      })
      
      // 处理toggleBrandStatus
      .addCase(toggleBrandStatusAction.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(toggleBrandStatusAction.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(toggleBrandStatusAction.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || '变更品牌状态失败';
      });
  }
});

// 导出actions
export const { 
  setFilter, 
  setPagination, 
  setCurrentBrand,
  clearCurrentBrand 
} = brandsSlice.actions;

// 导出reducer
export default brandsSlice.reducer; 
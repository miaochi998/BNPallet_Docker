import { useState, useEffect, useCallback } from 'react';

/**
 * 通用分页Hook
 * 
 * @param {Object} options - 配置选项
 * @param {Function} options.fetchData - 获取数据的函数，接收分页参数
 * @param {Object} options.defaultParams - 默认查询参数
 * @param {number} options.defaultParams.page - 默认页码
 * @param {number} options.defaultParams.pageSize - 默认每页条数
 * @param {Function} options.onSuccess - 请求成功回调
 * @param {Function} options.onError - 请求失败回调
 * @param {boolean} options.immediate - 是否立即请求数据
 * @returns {Object} 分页状态和方法
 */
const usePagination = ({
  fetchData,
  defaultParams = {
    page: 1,
    page_size: 10
  },
  onSuccess,
  onError,
  immediate = true
}) => {
  // 分页状态
  const [pagination, setPagination] = useState({
    current: defaultParams.page || 1,
    pageSize: defaultParams.page_size || 10,
    total: 0
  });
  
  // 请求参数状态
  const [params, setParams] = useState({
    ...defaultParams
  });
  
  // 加载状态
  const [loading, setLoading] = useState(false);
  
  // 数据状态
  const [data, setData] = useState([]);
  
  // 错误状态
  const [error, setError] = useState(null);

  // 请求数据方法
  const fetchDataWithPagination = useCallback(async (newParams = {}) => {
    if (!fetchData) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // 合并参数
      const requestParams = {
        ...params,
        ...newParams,
        // 确保参数名称与后端接口一致
        page: newParams.page || params.page,
        page_size: newParams.pageSize || params.page_size,
      };
      
      // 发起请求
      console.log('[Hook] 请求分页数据', requestParams);
      const response = await fetchData(requestParams);
      
      // 处理响应
      if (response && response.data) {
        // 设置数据
        setData(response.data.items || response.data.list || []);
        
        // 更新分页信息
        const meta = response.data.pagination || response.data.meta || {};
        setPagination({
          current: parseInt(meta.current_page || requestParams.page || 1),
          pageSize: parseInt(meta.page_size || requestParams.page_size || 10),
          total: parseInt(meta.total || 0)
        });
        
        // 成功回调
        if (onSuccess) {
          onSuccess(response.data, requestParams);
        }
      }
    } catch (err) {
      console.error('[Hook] 分页数据请求失败:', err);
      setError(err);
      if (onError) {
        onError(err);
      }
    } finally {
      setLoading(false);
    }
  }, [fetchData, params, onSuccess, onError]);

  // 切换页码
  const changePage = useCallback((page, pageSize) => {
    const newParams = {
      ...params,
      page,
      page_size: pageSize
    };
    
    setParams(newParams);
    fetchDataWithPagination(newParams);
  }, [params, fetchDataWithPagination]);

  // 切换每页条数
  const changePageSize = useCallback((current, size) => {
    const newParams = {
      ...params,
      page: 1, // 切换每页条数时重置为第一页
      page_size: size
    };
    
    setParams(newParams);
    fetchDataWithPagination(newParams);
  }, [params, fetchDataWithPagination]);

  // 刷新数据
  const refresh = useCallback(() => {
    fetchDataWithPagination(params);
  }, [params, fetchDataWithPagination]);

  // 重置分页
  const reset = useCallback(() => {
    const newParams = {
      ...params,
      page: 1,
      page_size: defaultParams.page_size || 10
    };
    
    setParams(newParams);
    fetchDataWithPagination(newParams);
  }, [params, defaultParams.page_size, fetchDataWithPagination]);

  // 更新查询参数
  const updateParams = useCallback((newParams) => {
    const updatedParams = {
      ...params,
      ...newParams,
      page: newParams.page || 1 // 更新参数时默认回到第一页
    };
    
    setParams(updatedParams);
    fetchDataWithPagination(updatedParams);
  }, [params, fetchDataWithPagination]);

  // 处理表格变化（排序、筛选、分页）
  const handleTableChange = useCallback((pagination, filters, sorter) => {
    const newParams = {
      ...params,
      page: pagination.current,
      page_size: pagination.pageSize,
    };
    
    // 处理排序
    if (sorter && sorter.field) {
      newParams.sort_field = sorter.field;
      newParams.sort_order = sorter.order === 'ascend' ? 'asc' : 'desc';
    }
    
    // 处理筛选
    if (filters) {
      Object.keys(filters).forEach(key => {
        if (filters[key] && filters[key].length > 0) {
          newParams[key] = filters[key];
        } else {
          // 如果该筛选已存在于params中，则移除
          if (params.hasOwnProperty(key)) {
            delete newParams[key];
          }
        }
      });
    }
    
    setParams(newParams);
    fetchDataWithPagination(newParams);
  }, [params, fetchDataWithPagination]);

  // 首次加载时请求数据
  useEffect(() => {
    if (immediate) {
      fetchDataWithPagination(params);
    }
  }, [immediate]); // 依赖immedidate，确保只在初始加载时执行

  return {
    // 状态
    data,
    loading,
    error,
    pagination,
    params,
    
    // 方法
    changePage,
    changePageSize,
    refresh,
    reset,
    updateParams,
    handleTableChange,
    fetchData: fetchDataWithPagination
  };
};

export default usePagination; 
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button, Input, Select, Typography, App, Modal, Spin, Radio, Alert } from 'antd';
import { PlusOutlined, ShareAltOutlined, ReloadOutlined, SearchOutlined, BarsOutlined, AppstoreOutlined, FilterOutlined, DownloadOutlined, CopyOutlined, LinkOutlined, ExportOutlined } from '@ant-design/icons';
import { useSelector } from 'react-redux';
import request from '@/utils/request';
import ProductGrid from '@/components/business/ProductGrid';
import styles from './ProductManagement.module.css';
import { commonSearch } from '@/api/common';
import { getImageUrl, getApiBaseUrl } from '@/config/urls';
import ProductForm from '@/components/business/ProductForm';
import { createShareLink, generateQrCode } from '@/api/pallet';

const { Title } = Typography;
const { Option } = Select;

// 创建独立于组件的函数，避免循环引用
const createProductFetcher = (setLoading, setIsSearching, setProducts, setPagination, message, ownerType, processProductData) => {
  return async (page, pageSize, keyword, brandId, sortField, sortOrder) => {
    setLoading(true);
    
    // 使用updated_at降序排序作为默认值，保持接收参数的灵活性
    const actualSortField = sortField || 'updated_at';
    const actualSortOrder = sortOrder || 'desc';
    
    // 记录调试信息
    console.log('[排序] API请求参数:', {
      page, pageSize, keyword, brandId, 
      requestedSortField: sortField,
      requestedSortOrder: sortOrder,
      actualSortField,
      actualSortOrder
    });
    
    try {
      // 判断是否为搜索模式
      const isSearchMode = keyword && keyword.trim() !== '';
      setIsSearching(isSearchMode);

      // 构建通用的查询参数，使用指定的排序参数
      const commonParams = {
        sort_field: actualSortField,
        sort_order: actualSortOrder,
        with_price_tiers: true,
        with_attachments: true,
        owner_type: ownerType
      };

      // 添加品牌筛选参数（如果有）
      if (brandId !== null && brandId !== undefined && !isNaN(brandId)) {
        commonParams.brand_id = brandId;
      }

      let response;
      
      if (isSearchMode) {
        // 搜索模式
        const fields = 'p.name,b.name,p.product_code,p.specification,p.net_content';
        response = await commonSearch('products', keyword, fields, false, commonParams);
      } else {
        // 分页模式
        response = await request({
          url: '/api/common/pagination/query',
          method: 'GET',
          params: {
            page,
            page_size: pageSize,
            module: 'products',
            with_brand: true,
            ...commonParams
          }
        });
      }

      // 输出API响应，帮助调试
      console.log('[API响应]', {
        status: response?.code,
        itemCount: response?.data?.items?.length || 0,
        requestParams: commonParams
      });
      
      // 添加排序调试信息
      if (response?.data?.items?.length > 0) {
        const first3Items = response.data.items.slice(0, 3);
        console.log('[排序] 前3个产品数据:', first3Items.map(item => ({
          id: item.id,
          name: item.name, 
          created_at: item.created_at,
          updated_at: item.updated_at
        })));
      }
      
      // 统一处理响应
      if (response && response.code === 200 && response.data) {
        let productList = [];
        let total = 0;
        let totalPages = 1;
        
        if (isSearchMode) {
          // 处理搜索响应
          productList = response.data.list || [];
          total = productList.length;
          
          // 前端分页 - 计算当前页应该显示的数据
          const startIndex = (page - 1) * pageSize;
          const endIndex = Math.min(startIndex + pageSize, total);
          productList = productList.slice(startIndex, endIndex);
          totalPages = Math.ceil(total / pageSize);
        } else {
          // 处理分页响应
          productList = response.data.items || [];
          total = response.data.pagination?.total || 0;
          totalPages = response.data.pagination?.total_pages || 1;
        }
        
        try {
          // 处理产品数据，并处理可能的失败情况
          const enhancedProducts = await processProductData(productList);
          
          // 添加序号
          const startIndex = (page - 1) * pageSize;
          const productsWithIndex = enhancedProducts.map((item, index) => ({
            ...item,
            index: startIndex + index + 1
          }));
          
          // 更新状态
          setProducts(productsWithIndex);
        } catch (processError) {
          console.error('处理产品数据时出错:', processError);
          
          // 即使处理详情失败，仍然显示基本列表数据并添加序号
          const startIndex = (page - 1) * pageSize;
          const productsWithIndex = productList.map((item, index) => ({
            ...item,
            index: startIndex + index + 1,
            // 确保基本字段存在
            price_tiers: Array.isArray(item.price_tiers) ? item.price_tiers : [],
            attachments: Array.isArray(item.attachments) ? item.attachments : []
          }));
          
          setProducts(productsWithIndex);
        }
        
        // 无论产品详情处理成功与否，都更新分页信息
        setPagination({
          current: page,
          pageSize: pageSize,
          total: total,
          totalPages: totalPages
        });
      } else {
        // 错误处理
        setProducts([]);
        setPagination(prev => ({
          ...prev,
          current: 1,
          total: 0,
          totalPages: 0
        }));
        
        if (response?.message) {
          message.error(response.message);
        }
      }
    } catch (error) {
      // 统一错误处理
      console.error('获取产品列表失败:', error);
      setProducts([]);
      setPagination(prev => ({
        ...prev,
        current: 1,
        total: 0,
        totalPages: 0
      }));
      message.error('获取产品列表失败');
    } finally {
      setLoading(false);
    }
  };
};

const ProductManagement = () => {
  const { user, isAuthenticated } = useSelector(state => state.auth);
  const isAdmin = user?.is_admin;
  const { message, modal } = App.useApp();
  
  // 添加搜索防抖定时器的引用
  const searchTimerRef = useRef(null);
  // 用于保存fetchProducts函数的引用
  const fetchProductsRef = useRef(null);
  // 用于标记是否已经初始化数据
  const initializedRef = useRef(false);
  
  // 状态管理
  const [products, setProducts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false); // 是否处于搜索状态
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10, // 所有用户默认显示10条数据
    total: 0,
    totalPages: 0
  });
  // 添加视图模式状态
  const [viewMode, setViewMode] = useState('table'); // 'table' 或 'card'
  
  // 搜索参数 - 注意排序字段只能是backend支持的字段
  const [searchParams, setSearchParams] = useState({
    keyword: '',
    brand_id: null, // 添加品牌ID字段用于筛选
    sort_field: 'updated_at', // 后端只支持 name, product_code, created_at, updated_at, brand_id
    sort_order: 'desc'
  });
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(null);
  const [isEdit, setIsEdit] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [currentDeleteId, setCurrentDeleteId] = useState(null);
  
  // 根据用户角色确定固定的所有者类型 - 管理员查看公司总货盘，普通用户查看个人货盘
  const ownerType = isAdmin ? 'COMPANY' : 'SELLER';

  // 获取品牌列表 - 仅用于显示，不再用于筛选
  const fetchBrands = useCallback(async () => {
    try {
      const response = await request({
        url: '/api/pallet/brands',
        method: 'GET',
        params: {
          status: 'ACTIVE'
        }
      });
      
      if (response && response.data && response.data.list && Array.isArray(response.data.list)) {
        console.log('[产品] 成功获取品牌列表, 数量:', response.data.list.length);
        setBrands(response.data.list);
        return response.data.list; // 返回品牌数据，方便后续使用
      } else {
        console.error('[产品] 获取品牌列表格式错误或为空');
        message.error('获取品牌列表失败');
        return [];
      }
    } catch (error) {
      console.error('[产品] 获取品牌列表失败:', error);
      message.error('获取品牌列表失败');
      return [];
    }
  }, [message]);

  // 优化原生select元素的样式，提升用户体验
  const selectStyle = {
    width: '100%', 
    height: '32px',
    padding: '4px 11px',
    borderRadius: '6px',
    border: '1px solid #d9d9d9',
    fontSize: '14px',
    boxSizing: 'border-box',
    outline: 'none',
    backgroundColor: '#fff',
    color: 'rgba(0, 0, 0, 0.85)',
    cursor: 'pointer',
    appearance: 'auto',  // 确保下拉箭头在各浏览器中显示
    transition: 'all 0.3s'
  };

  // 优化processProductData函数，减少不必要的请求和数据处理
  const processProductData = useCallback(async (products) => {
    if (!products || products.length === 0) return [];
    
    // 创建产品ID到产品的映射，以便后续更新
    const productMap = {};
    products.forEach(product => {
      productMap[product.id] = { ...product };
      
      // 确保每个产品都有价格档位和附件数组
      productMap[product.id].price_tiers = Array.isArray(product.price_tiers) ? product.price_tiers : [];
      productMap[product.id].attachments = Array.isArray(product.attachments) ? product.attachments : [];
    });
    
    // 仅处理缺少详情数据的产品
    const productsNeedingDetails = products.filter(product => 
      (!product.price_tiers || !Array.isArray(product.price_tiers) || product.price_tiers.length === 0) ||
      (!product.attachments || !Array.isArray(product.attachments) || product.attachments.length === 0) ||
      !product.product_size || !product.shipping_method || !product.shipping_spec || !product.shipping_size
    );
    
    // 如果所有产品都已有完整数据，直接返回
    if (productsNeedingDetails.length === 0) {
      return Object.values(productMap);
    }
    
    // 获取需要补充详情的产品ID列表
    const productIds = productsNeedingDetails.map(p => p.id);
    
    try {
      // 并行请求所有产品详情
      const queryPromises = productIds.map(productId => 
        request({
          url: `/api/pallet/products/${productId}`,
          method: 'GET'
        }).catch(err => {
          console.warn(`获取产品详情失败 (ID: ${productId}):`, err);
          // 返回一个标准化的错误响应对象，而不是抛出异常
          return { 
            code: err.response?.status || 500, 
            data: null,
            error: true
          }; 
        })
      );
      
      // 等待所有请求完成
      const responses = await Promise.all(queryPromises);
      
      // 更新产品数据
      responses.forEach((response, index) => {
        const productId = productIds[index];
        if (response && response.code === 200 && response.data) {
          const productData = response.data;
          
          // 从产品详情中获取价格档位和附件信息以及其他产品详情字段
          if (productMap[productId]) {
            productMap[productId].price_tiers = productData.price_tiers || [];
            productMap[productId].attachments = productData.attachments || [];
            // 确保所有需要的字段都被复制过来
            productMap[productId].product_size = productData.product_size || '';
            productMap[productId].shipping_method = productData.shipping_method || '';
            productMap[productId].shipping_spec = productData.shipping_spec || '';
            productMap[productId].shipping_size = productData.shipping_size || '';
            productMap[productId].product_url = productData.product_url || '';
          }
        }
        // 即使获取详情失败，也保留产品的基本信息
      });
      
      // 返回更新后的产品列表
      return Object.values(productMap);
    } catch (error) {
      console.error('处理产品数据时出错:', error);
      // 出错时返回原始产品列表
      return products;
    }
  }, []);

  // 在useEffect中创建fetchProducts函数
  useEffect(() => {
    // 创建fetchProducts函数
    console.log('[产品] 创建fetchProducts函数');
    fetchProductsRef.current = createProductFetcher(
      setLoading, 
      setIsSearching, 
      setProducts, 
      setPagination, 
      message, 
      ownerType, 
      processProductData
    );
    
    // 组件卸载时清理
    return () => {
      fetchProductsRef.current = null;
    };
  }, [ownerType, message, processProductData]);

  // 包装函数，确保在fetchProductsRef.current已赋值后调用
  const fetchProducts = useCallback(function fetchProductsWrapper(
    page = pagination.current, 
    pageSize = pagination.pageSize, 
    keyword = searchParams.keyword, 
    brandId = searchParams.brand_id, 
    sortField = searchParams.sort_field, 
    sortOrder = searchParams.sort_order
  ) {
    console.log('[产品] 执行fetchProducts:', { page, pageSize, keyword, brandId, sortField, sortOrder });
    
    if (fetchProductsRef.current) {
      return fetchProductsRef.current(
        page, 
        pageSize, 
        keyword, 
        brandId, 
        sortField, 
        sortOrder
      );
    } else {
      console.error('fetchProductsRef.current 未初始化');
      return Promise.resolve();
    }
  }, [pagination.current, pagination.pageSize, searchParams]);

  // 初始化加载数据 - 确保先加载品牌再加载产品
  useEffect(() => {
    // 如果fetchProductsRef未初始化，直接返回
    if (!fetchProductsRef.current) {
      console.log('[产品] 等待fetchProductsRef初始化...');
      return;
    }
    
    // 仅在组件挂载时加载一次数据
    if (initializedRef.current) {
      return;
    }
    
    initializedRef.current = true;
    
    // 数据加载函数
    async function loadInitialData() {
      try {
        console.log('[产品] 开始加载初始数据');
        
        // 先获取品牌列表
        await fetchBrands();
        
        // 设置适当的分页大小
        const pageSize = 10;
        
        // 更新分页状态
        setPagination({
          current: 1,
          pageSize: pageSize,
          total: 0
        });
        
        // 使用updated_at降序排序
        const initialSortField = 'updated_at';
        const initialSortOrder = 'desc';
        
        // 重置搜索参数
        setSearchParams({
          keyword: '',
          brand_id: null,
          sort_field: initialSortField,
          sort_order: initialSortOrder
        });
        
        // 记录关键日志
        console.log('[产品] 初始化加载数据，即将调用 fetchProducts:', { 
          page: 1, 
          pageSize,
          sort_field: initialSortField,
          sort_order: initialSortOrder
        });
        
        // 获取产品列表，使用正确的排序参数
        await fetchProducts(1, pageSize, '', null, initialSortField, initialSortOrder);
      } catch (error) {
        console.error('[产品] 初始化加载数据失败:', error);
        message.error('数据加载失败，请刷新页面重试');
      }
    }
    
    loadInitialData();
  }, [fetchBrands, fetchProducts, message, setPagination, setSearchParams]);

  // 添加效果确保按updated_at排序
  useEffect(() => {
    // 确保产品已加载
    if (products.length > 0) {
      // 手动按updated_at降序排序，确保前端显示顺序正确
      const sortedProducts = [...products].sort((a, b) => {
        const dateA = new Date(a.updated_at || 0);
        const dateB = new Date(b.updated_at || 0);
        return dateB - dateA; // 降序
      });
      
      // 检查排序是否正确
      if (JSON.stringify(products) !== JSON.stringify(sortedProducts)) {
        console.log('[排序] 前端手动排序：发现顺序不匹配，强制更正');
        setProducts(sortedProducts);
      }
    }
  }, [products]);

  // 处理图片预览
  const handleImagePreview = (imageUrl, title = '产品图片') => {
    if (!imageUrl) return;
    
    // 设置加载状态
    setPreviewLoading(true);
    setPreviewImage(imageUrl);
    setPreviewTitle(title || '产品图片');
    setPreviewVisible(true);
    
    // 预加载图片
    const img = new Image();
    img.src = imageUrl;
    img.onload = () => setPreviewLoading(false);
    img.onerror = () => {
      setPreviewLoading(false);
      message.error('图片加载失败');
      console.error('图片加载失败:', imageUrl);
    };
  };
  
  const handlePreviewCancel = () => {
    setPreviewVisible(false);
    setPreviewImage('');
    setPreviewTitle('');
  };

  // 处理下载素材包
  const handleDownloadMaterial = async (product) => {
    if (!product || !product.attachments) {
      message.error('产品素材包不存在');
      return;
    }
    
    // 查找素材包附件
    const materialAttachment = product.attachments.find(
      attachment => attachment.file_type === 'MATERIAL'
    );
    
    if (!materialAttachment || !materialAttachment.file_path) {
      message.error('素材包不存在');
      return;
    }
    
    try {
      // 构建完整的文件URL
      const fileUrl = getImageUrl(materialAttachment.file_path);
      
      // 使用隐藏的a标签触发文件下载
      const link = document.createElement('a');
      link.href = fileUrl;
      
      // 设置下载文件名
      const fileName = materialAttachment.file_name || `素材包_${materialAttachment.id}`;
      link.setAttribute('download', fileName);
      
      // 触发下载
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      message.success('素材包下载已开始');
    } catch (error) {
      console.error('下载素材包失败', error);
      message.error('下载素材包失败：' + (error.message || '未知错误'));
    }
  };

  // 处理放入回收站
  const handleMoveToRecycleBin = async (productId) => {
    try {
      // 确保productId是有效的整数
      if (!productId || isNaN(Number(productId))) {
        message.error('无效的产品ID');
        return;
      }
      
      // 转换为数字类型
      const numericProductId = Number(productId);
      
      message.loading({ content: '正在移动到回收站...', key: 'recycle' });
      
      const response = await request({
        url: `/api/pallet/products/${numericProductId}/recycle`,
        method: 'POST',
        data: {
          confirm: true
        }
      });
      
      if (response.code === 200) {
        message.success({ content: '已成功放入回收站', key: 'recycle', duration: 2 });
        
        // 重置搜索参数，确保始终按创建时间降序排序
        setSearchParams(prev => ({
          ...prev,
          sort_field: 'updated_at',
          sort_order: 'desc'
        }));
        
        // 刷新产品列表
        fetchProducts(
          pagination.current, 
          pagination.pageSize, 
          searchParams.keyword, 
          searchParams.brand_id,
          'updated_at',
          'desc'
        );
      } else {
        message.error({ content: response.message || '操作失败', key: 'recycle', duration: 2 });
      }
    } catch (error) {
      console.error('移动到回收站失败:', error);
      message.error({ content: '移动到回收站失败: ' + error.message, key: 'recycle', duration: 2 });
    }
  };

  // 添加产品
  const handleAddProduct = () => {
    setIsFormVisible(true);
    setIsEdit(false);
    setCurrentProduct(null);
  };

  // 编辑产品
  const handleEdit = async (record) => {
    try {
      setLoading(true);
      // 获取产品详情，包括价格档位和附件信息
      const response = await request({
        url: `/api/pallet/products/${record.id}`,
        method: 'GET'
      });
      
      if (response && response.code === 200) {
        setCurrentProduct(response.data);
        setIsEdit(true);
        setIsFormVisible(true);
      }
    } catch (error) {
      console.error('获取产品详情失败:', error);
      message.error('获取产品详情失败');
    } finally {
      setLoading(false);
    }
  };

  // 处理产品表单完成
  const handleFormFinish = useCallback((productId, savedProduct) => {
    setIsFormVisible(false);
    
    // 重置搜索参数，确保始终按最后更新时间降序排序
    setSearchParams(prev => ({
      ...prev,
      sort_field: 'updated_at',
      sort_order: 'desc'
    }));
    
    // 确保使用正确的排序字段重新加载列表
    console.log('[表单完成] 刷新产品列表', { productId, savedProduct });
    if (fetchProductsRef.current) {
      // 始终重置到第一页，并使用正确的排序规则
      fetchProductsRef.current(
        1, 
        pagination.pageSize, 
        searchParams.keyword, 
        searchParams.brand_id,
        'updated_at',
        'desc'
      );
    }
  }, [pagination.pageSize, searchParams.keyword, searchParams.brand_id, setSearchParams]);

  // 取消表单
  const handleFormCancel = () => {
    setIsFormVisible(false);
  };

  // 处理产品删除
  const handleDelete = useCallback((id) => {
    // 确保id是有效的整数
    if (id && !isNaN(Number(id))) {
      setCurrentDeleteId(Number(id));
      setDeleteModalVisible(true);
    } else {
      message.error('无效的产品ID');
    }
  }, []);

  // 处理永久删除确认
  const confirmDelete = useCallback(async () => {
    if (!currentDeleteId) return;
    
    try {
      setLoading(true);
      
      const response = await request({
        url: `/api/pallet/products/${currentDeleteId}/permanent`,
        method: 'DELETE'
      });
      
      if (response && response.code === 200) {
        message.success('产品已删除');
        
        // 关闭对话框
        setDeleteModalVisible(false);
        
        // 重置搜索参数，确保始终按创建时间降序排序
        setSearchParams(prev => ({
          ...prev,
          sort_field: 'updated_at',
          sort_order: 'desc'
        }));
        
        // 刷新产品列表 - 强制使用正确的排序参数
        fetchProducts(
            pagination.current, 
            pagination.pageSize, 
            searchParams.keyword, 
            searchParams.brand_id,
            'updated_at',
            'desc'
          );
      } else {
        message.error(response?.message || '删除失败');
      }
    } catch (error) {
      console.error('删除产品失败:', error);
      message.error('删除产品失败: ' + (error.response?.data?.message || error.message || '未知错误'));
    } finally {
      setLoading(false);
      // 重置当前删除ID
      setCurrentDeleteId(null);
    }
  }, [currentDeleteId, message, pagination, searchParams, setLoading, fetchProducts]);

  // 处理取消删除
  const handleCancelDelete = useCallback(() => {
    setDeleteModalVisible(false);
    setCurrentDeleteId(null);
  }, []);

  // 处理分享货盘
  const handleSharePallet = useCallback(async () => {
    console.log('分享货盘按钮被点击');
    try {
      // 显示加载状态
      setLoading(true);
      message.loading({ content: '正在生成分享链接...', key: 'shareLoading' });
      
      console.log('调用 createShareLink API...');
      // 创建分享链接
      const shareResponse = await createShareLink();
      console.log('分享链接创建成功:', shareResponse);
      const { token, share_url } = shareResponse.data;
      
      console.log('调用 generateQrCode API，token:', token);
      // 生成二维码
      const qrcodeResponse = await generateQrCode(token);
      console.log('二维码生成成功:', qrcodeResponse);
      const { qrcode_url } = qrcodeResponse.data;
      
      console.log('准备显示成功对话框');
      // 显示分享模态框 
      modal.success({
        title: '分享货盘',
        icon: <ShareAltOutlined style={{ color: '#1890ff' }} />,
        content: (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
              {/* 分享链接区域 */}
              <div style={{ 
                flex: 1, 
                padding: '15px', 
                border: '1px solid #e8e8e8', 
                borderRadius: '5px',
                marginRight: '15px',
                height: '150px',
                display: 'flex',
                alignItems: 'center',
                overflow: 'hidden',
                cursor: 'pointer'
              }} onClick={() => {
                // 使用更兼容的方式复制链接
                const textarea = document.createElement('textarea');
                textarea.value = share_url;
                textarea.style.position = 'fixed';  // 防止滚动到页面底部
                document.body.appendChild(textarea);
                textarea.focus();
                textarea.select();
                try {
                  const successful = document.execCommand('copy');
                  if (successful) {
                    message.success('链接已复制到剪贴板');
                  } else {
                    message.error('复制失败，请手动复制');
                  }
                } catch (err) {
                  message.error('复制失败，请手动复制');
                }
                document.body.removeChild(textarea);
              }}>
                <div style={{ wordBreak: 'break-all' }}>{share_url}</div>
              </div>
              
              {/* 二维码区域 */}
              <div>
                <img 
                  src={qrcode_url} 
                  alt="二维码" 
                  style={{ width: 150, height: 150 }}
                />
              </div>
            </div>
            
            {/* 提示文字 */}
            <div style={{ marginBottom: 20 }}>
              <p style={{ color: '#666', fontSize: '14px' }}>点击链接地址或右键复制二维码图片，然后到微信粘贴给客户即可。</p>
            </div>
            
            {/* 底部按钮 */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center',
              marginTop: 10,
              gap: '20px'  // 设置按钮之间的间距为20px
            }}>
              <Button key="close" onClick={() => {
                // 找到并点击对话框中的确定按钮
                const okBtn = document.querySelector('.ant-modal-confirm-btns .ant-btn-primary');
                if (okBtn) {
                  okBtn.click();
                }
              }}>
                关闭
              </Button>
              
              <Button 
                key="copy" 
                icon={<CopyOutlined />}
                style={{ 
                  backgroundColor: '#85ce61',
                  color: 'white',
                  border: 'none'
                }}
                onClick={() => {
                  // 使用更兼容的方式复制链接
                  const textarea = document.createElement('textarea');
                  textarea.value = share_url;
                  textarea.style.position = 'fixed';  // 防止滚动到页面底部
                  document.body.appendChild(textarea);
                  textarea.focus();
                  textarea.select();
                  try {
                    const successful = document.execCommand('copy');
                    if (successful) {
                      message.success('链接已复制到剪贴板');
                    } else {
                      message.error('复制失败，请手动复制');
                    }
                  } catch (err) {
                    message.error('复制失败，请手动复制');
                  }
                  document.body.removeChild(textarea);
                }}
              >
                复制链接
              </Button>
              
              <Button 
                key="view" 
                type="primary" 
                icon={<ExportOutlined />}
                onClick={() => {
                  window.open(share_url, '_blank');
                }}
              >
                访问货盘
              </Button>
            </div>
          </div>
        ),
        width: 550,
        onOk: undefined, // 完全移除确认按钮
        okButtonProps: { style: { display: 'none' } }, // 隐藏确认按钮
        okText: '',
        closable: true, // 启用关闭按钮
        closeIcon: <span style={{ fontSize: '18px', fontWeight: 'bold' }}>×</span>, // 自定义关闭图标
      });
      
      // 隐藏加载消息
      message.destroy('shareLoading');
    } catch (error) {
      console.error('分享货盘失败:', error);
      message.error({ content: '分享货盘失败，请稍后重试', key: 'shareLoading' });
    } finally {
      setLoading(false);
    }
  }, [message, modal]);

  // 处理表格分页、排序和筛选变化
  const handleTableChange = useCallback((newPagination, filters, sorter) => {
    // 记录日志
    console.log('[排序] 表格变化事件', {
      newPagination,
      currentPagination: pagination,
      sorter
    });
    
    if (!fetchProductsRef.current) {
      console.error('fetchProductsRef未初始化');
      return;
    }
    
    // 获取页码和每页条数
    const { current, pageSize } = newPagination;

    // 检查是否是分页大小改变
    const isPageSizeChanged = pageSize !== pagination.pageSize;
    
    // 如果分页大小变化，重置为第一页
    const newPage = isPageSizeChanged ? 1 : current;
      
    // 强制使用updated_at降序排序
    const sortField = 'updated_at';
    const sortOrder = 'desc';
    
    // 更新排序参数
    setSearchParams(prev => ({
      ...prev,
      sort_field: sortField,
      sort_order: sortOrder
    }));
      
    // 更新分页状态
    setPagination({
      current: newPage,
      pageSize: pageSize,
      total: pagination.total
    });
    
    // 添加记录
    console.log('[排序] 发送API请求参数:', {
      page: newPage,
      pageSize,
      sort_field: searchParams.sort_field,
      sort_order: searchParams.sort_order
    });
    
    // 发起请求 - 使用搜索参数中的排序设置
    fetchProducts(
      newPage,
      pageSize,
      searchParams.keyword,
      searchParams.brand_id,
      searchParams.sort_field,
      searchParams.sort_order
    );
  }, [pagination, fetchProducts, searchParams]);

  // 简化handleSearchInputChange函数，保留核心功能
  const handleSearchInputChange = useCallback((e) => {
    const value = e.target.value;
    
    // 清除之前的定时器
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    
    // 更新搜索关键词状态
    setSearchParams(prev => ({
      ...prev,
      keyword: value
    }));
    
    // 空输入时立即执行查询，否则添加防抖
    if (!value || value.trim() === '') {
      fetchProducts(1, pagination.pageSize, '', searchParams.brand_id, 'updated_at', 'desc');
    } else {
      searchTimerRef.current = setTimeout(() => {
        fetchProducts(1, pagination.pageSize, value, searchParams.brand_id, 'updated_at', 'desc');
      }, 300);
    }
  }, [fetchProducts, pagination.pageSize, searchParams.brand_id]);

  // 处理品牌筛选变化
  const handleBrandChange = useCallback((event) => {
    // 使用event.target.value获取选中值
    const selectedValue = event.target.value;
    
    // 设置brand_id，如果是'all'则为null，否则转为数字
    let brandId = null;
    if (selectedValue !== 'all') {
      brandId = parseInt(selectedValue, 10);
    }
    
    // 更新搜索参数
    setSearchParams(prev => ({
      ...prev,
      brand_id: brandId
    }));
    
    // 获取筛选后的数据 - 确保始终使用正确的排序参数，按创建时间降序排序
    fetchProducts(1, pagination.pageSize, searchParams.keyword, brandId, 'updated_at', 'desc');
  }, [brands, fetchProducts, pagination.pageSize, searchParams.keyword]);

  // 常规刷新产品列表，使用useCallback优化
  const handleRefreshList = useCallback(() => {
    // 设置正确的排序参数 - 使用updated_at降序
    const sortField = 'updated_at';
    const sortOrder = 'desc';
    
    // 重置搜索参数为初始值
    setSearchParams({
      keyword: '',
      brand_id: null,
      sort_field: sortField,
      sort_order: sortOrder
    });
    
    // 重置分页设置，统一使用10条每页
    setPagination({
      current: 1,
      pageSize: 10,
      total: 0,
      totalPages: 0
    });
    
    // 重置搜索状态
    setIsSearching(false);
    
    // 手动刷新暂时不考虑防止多次加载的限制
    const refreshData = async () => {
      try {
        // 先获取品牌列表
        await fetchBrands();
        // 确保使用正确的排序参数
        await fetchProducts(1, 10, '', null, sortField, sortOrder);
        message.success('页面已刷新');
      } catch (error) {
        console.error('刷新数据失败:', error);
        message.error('刷新数据失败，请重试');
      }
    };
    
    refreshData();
  }, [fetchProducts, fetchBrands, message, setPagination, setSearchParams, setIsSearching]);

  // 内存清理函数 - 放在引用前定义，避免警告
  useEffect(() => {
    return () => {
      // 清理搜索定时器
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, []);

  // 在组件内部的最前面添加这段代码，用于禁用表格组件的内部排序
  useEffect(() => {
    // 禁用表格的默认排序功能，确保始终使用API返回的顺序
    const disableTableSorting = () => {
      // 等待表格DOM元素加载完成
      const timerId = setTimeout(() => {
        try {
          // 找到所有表头元素并移除排序相关的事件监听器
          const tableHeaders = document.querySelectorAll('.ant-table-column-sorter');
          if (tableHeaders && tableHeaders.length > 0) {
            console.log('[排序] 已找到表格排序元素，正在禁用内部排序机制');
            tableHeaders.forEach(header => {
              // 设置样式使其不可点击
              if (header.parentNode) {
                header.parentNode.style.pointerEvents = 'none';
              }
            });
          }
        } catch (error) {
          console.error('[排序] 禁用表格排序失败:', error);
        }
      }, 500);

      // 返回清理函数，清除计时器避免组件卸载后执行
      return () => clearTimeout(timerId);
    };

    // 在组件挂载和数据更新后执行
    const cleanup = disableTableSorting();
    
    // 返回嵌套的清理函数
    return cleanup;
  }, [products]);

  // 处理视图模式切换
  const handleViewModeChange = (e) => {
    setViewMode(e.target.value);
    // 视图切换时不主动请求数据，只更新视图模式
    console.log('[排序调试] 仅切换视图模式，不改变数据排序');
  };

  // 如果未认证，返回null（让路由系统处理重定向）
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <Title level={3}>{isAdmin ? '公司总货盘管理' : '我的货盘管理'}</Title>
        
        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft}>
            <Input
              placeholder="搜索产品名称、品牌、货号、规格、净含量" 
              style={{ 
                width: 400,
                marginRight: 16,
                borderRadius: '20px'
              }}
              value={searchParams.keyword}
              onChange={handleSearchInputChange}
              allowClear
              prefix={<SearchOutlined style={{ color: '#999' }} />}
            />
            
            <div style={{ display: 'inline-block', width: 200, marginRight: 8 }}>
              <select 
                style={selectStyle}
                value={searchParams.brand_id === null ? 'all' : String(searchParams.brand_id)}
                onChange={handleBrandChange}
              >
                <option value="all">全部品牌</option>
                {brands.map(brand => (
                  <option key={brand.id} value={String(brand.id)}>
                    {brand.name}
                  </option>
                ))}
              </select>
            </div>
            
            <Button
              icon={<ReloadOutlined />}
              onClick={handleRefreshList}
              style={{ marginRight: 16 }}
            >
              刷新
            </Button>
          </div>
          <div className={styles.toolbarRight}>
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              style={{ marginRight: 16 }}
              onClick={handleAddProduct}
              className={styles.addProductBtn}
            >
              添加产品
            </Button>
            <Button 
              icon={<ShareAltOutlined />} 
              className={styles.shareBtn}
              onClick={handleSharePallet}
              style={{ marginRight: 16 }}
            >
              分享货盘
            </Button>
            <Radio.Group 
              value={viewMode} 
              onChange={handleViewModeChange} 
              buttonStyle="solid"
            >
              <Radio.Button value="table"><BarsOutlined /> 表格视图</Radio.Button>
              <Radio.Button value="card"><AppstoreOutlined /> 卡片视图</Radio.Button>
            </Radio.Group>
          </div>
        </div>
      </div>
      
      <ProductGrid
        products={products}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50', '100'],
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条记录`
        }}
        viewMode={viewMode}
        onTableChange={handleTableChange}
        loading={loading}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onImagePreview={handleImagePreview}
        onDownloadMaterial={handleDownloadMaterial}
        onMoveToRecycleBin={handleMoveToRecycleBin}
      />
      
      <Modal
        title={previewTitle}
        footer={null}
        open={previewVisible}
        onCancel={handlePreviewCancel}
        centered
        width="auto"
        styles={{
          body: { padding: 0 }
        }}
        style={{ maxWidth: '90vw' }}
        wrapClassName="product-image-preview-modal"
      >
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          minHeight: '200px',
          minWidth: '300px',
          maxHeight: '80vh',
          overflow: 'auto'
        }}>
          {previewLoading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Spin size="large" tip="图片加载中..." />
            </div>
          ) : (
            <img 
              alt={previewTitle} 
              style={{ 
                maxWidth: '100%', 
                maxHeight: '80vh', 
                objectFit: 'contain' 
              }} 
              src={previewImage} 
            />
          )}
        </div>
      </Modal>
      
      {/* 添加编辑产品表单弹窗 */}
      <Modal
        open={isFormVisible}
        onCancel={handleFormCancel}
        footer={null}
        width={960}
        style={{ top: 20 }}
        destroyOnClose
        closeIcon={<div className={styles.closeModalIcon}>×</div>}
        styles={{
          body: { padding: 0 }
        }}
        maskClosable={false}
        className={styles.productFormModal}
      >
        <ProductForm
          isEdit={isEdit}
          initialValues={currentProduct}
          onFinish={handleFormFinish}
          onCancel={handleFormCancel}
        />
      </Modal>
      
      {/* 产品删除确认模态框 */}
      <Modal
        title="确定要删除本产品吗？"
        open={deleteModalVisible}
        onCancel={handleCancelDelete}
        footer={null}
        centered
      >
        <p>放入回收站可恢复，永久删除不可恢复！</p>
        <div style={{ marginTop: 24, textAlign: 'right' }}>
          <Button onClick={handleCancelDelete}>
            取消
          </Button>
          <Button 
            type="primary" 
            style={{ marginLeft: 8, backgroundColor: '#52c41a', borderColor: '#52c41a' }}
            onClick={() => {
              // 确保传递整数形式的产品ID
              if (currentDeleteId && !isNaN(Number(currentDeleteId))) {
                handleMoveToRecycleBin(Number(currentDeleteId));
                setDeleteModalVisible(false);
              } else {
                message.error('无效的产品ID');
              }
            }}
          >
            放入回收站
          </Button>
          <Button danger onClick={confirmDelete} style={{ marginLeft: 8 }}>
            永久删除
          </Button>
        </div>
      </Modal>
    </div>
  );
};

// 使用App组件包裹ProductManagement，提供全局消息和模态框上下文
const ProductManagementWithApp = () => (
  <App>
    <ProductManagement />
  </App>
);

export default ProductManagementWithApp; 
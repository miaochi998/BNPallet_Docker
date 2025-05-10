import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Button, Input, Select, Typography, App, Modal, Checkbox, 
  Image, Tag, Tooltip, Pagination, Empty, Spin
} from 'antd';
import { 
  SearchOutlined, UndoOutlined, DeleteOutlined, 
  EyeOutlined, DownloadOutlined, 
  FileOutlined, LinkOutlined, ReloadOutlined
} from '@ant-design/icons';
import { useSelector } from 'react-redux';
import request from '@/utils/request';
import styles from './RecycleBin.module.css';
import { 
  getRecycleBinItems, restoreProduct, deleteProduct,
  batchRestoreProducts, batchDeleteProducts 
} from '@/api/recycleBin';
import { commonSearch } from '@/api/common';
import { getImageUrl } from '@/config/urls';
import { formatDateTime } from '@/utils/formatDateTime';
import './RecycleBinStyles.css';

const { Title, Text } = Typography;
const { Option } = Select;

// 创建独立于组件的数据获取函数
const createRecycleBinFetcher = (setLoading, setIsSearching, setRecycleBinItems, setPagination, message) => {
  return async (page, pageSize, keyword, brandId, sortField, sortOrder) => {
    setLoading(true);
    
    // 使用deleted_at降序排序作为默认值
    const actualSortField = sortField || 'deleted_at';
    const actualSortOrder = sortOrder || 'desc';
    
    console.log('[回收站] API请求参数:', {
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

      // 构建通用的查询参数
      const commonParams = {
        sort_field: actualSortField,
        sort_order: actualSortOrder
      };

      // 添加品牌筛选（如果有）
      if (brandId !== undefined && brandId !== null && !isNaN(brandId)) {
        commonParams.brand_id = brandId;
      }

      let response;
      
      if (isSearchMode) {
        // 搜索模式 - 使用通用搜索API
        const fields = 'p.name,b.name,p.product_code,p.specification,p.net_content';
        response = await commonSearch('recycle', keyword, fields, false, commonParams);
      } else {
        // 分页模式 - 使用回收站分页API
        response = await getRecycleBinItems({
          page,
          page_size: pageSize,
          ...commonParams
        });
      }

      console.log('[回收站API响应]', {
        status: response?.code,
        data: response?.data,
        isSearchMode
      });
      
      // 统一处理响应
      if (response && response.code === 200 && response.data) {
        let itemsList = [];
        let total = 0;
        let totalPages = 1;
        let currentPage = page;
        
        if (isSearchMode) {
          // 处理搜索响应
          itemsList = response.data.list || [];
          total = itemsList.length;
          
          // 前端分页 - 计算当前页应该显示的数据
          const startIndex = (page - 1) * pageSize;
          const endIndex = Math.min(startIndex + pageSize, total);
          
          // 对全部结果进行分页
          if (startIndex < itemsList.length) {
            itemsList = itemsList.slice(startIndex, endIndex);
          } else {
            itemsList = [];
          }
          
          currentPage = page;
          totalPages = Math.ceil(total / pageSize);
        } else {
          // 处理分页响应
          itemsList = response.data.list || [];
          total = response.data.pagination?.total || 0;
          currentPage = response.data.pagination?.current_page || 1;
          totalPages = Math.ceil(total / (response.data.pagination?.per_page || pageSize));
        }
        
        // 添加序号
        const startIndex = (currentPage - 1) * pageSize;
        const itemsWithIndex = itemsList.map((item, index) => ({
          ...item,
          index: startIndex + index + 1,
          // 确保键的唯一性
          key: `item_${item.id}_${Date.now()}_${index}`
        }));
        
        // 更新状态
        setRecycleBinItems(itemsWithIndex);
        setPagination({
          current: currentPage,
          pageSize: pageSize,
          total: total,
          totalPages: totalPages
        });
      } else {
        // 错误处理
        setRecycleBinItems([]);
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
      console.error('获取回收站列表失败:', error);
      setRecycleBinItems([]);
      setPagination(prev => ({
        ...prev,
        current: 1,
        total: 0,
        totalPages: 0
      }));
      message.error('获取回收站列表失败');
    } finally {
      setLoading(false);
    }
  };
};

const RecycleBin = () => {
  const { user } = useSelector((state) => state.auth);
  const isAdmin = user?.is_admin;
  const { message, modal } = App.useApp();
  
  // 搜索防抖定时器引用
  const searchTimerRef = useRef(null);
  // 搜索框引用，用于重置值
  const searchInputRef = useRef(null);
  // 回收站数据获取函数引用
  const fetchRecycleBinRef = useRef(null);
  // 初始化状态追踪
  const initializedRef = useRef(false);
  
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
  
  // 状态管理
  const [recycleBinItems, setRecycleBinItems] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0
  });
  const [searchParams, setSearchParams] = useState({
    keyword: '',
    brand_id: null,
    sort_field: 'deleted_at',
    sort_order: 'desc'
  });
  const [selectedItems, setSelectedItems] = useState([]);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  
  // 添加滚动容器引用
  const scrollContainerRef = useRef(null);
  
  // 在useEffect中创建fetchRecycleBinData函数
  useEffect(() => {
    console.log('[回收站] 创建fetchRecycleBinData函数');
    fetchRecycleBinRef.current = createRecycleBinFetcher(
      setLoading,
      setIsSearching,
      setRecycleBinItems,
      setPagination,
      message
    );
    
    // 组件卸载时清理
    return () => {
      fetchRecycleBinRef.current = null;
    };
  }, [message]);
  
  // 包装函数，确保在fetchRecycleBinRef.current已赋值后调用
  const fetchRecycleBinData = useCallback((
    page = pagination.current,
    pageSize = pagination.pageSize,
    keyword = searchParams.keyword,
    brandId = searchParams.brand_id,
    sortField = searchParams.sort_field,
    sortOrder = searchParams.sort_order
  ) => {
    console.log('[回收站] 执行fetchRecycleBinData:', { page, pageSize, keyword, brandId, sortField, sortOrder });
    
    if (fetchRecycleBinRef.current) {
      return fetchRecycleBinRef.current(
        page,
        pageSize,
        keyword,
        brandId,
        sortField,
        sortOrder
      );
    } else {
      console.error('fetchRecycleBinRef.current 未初始化');
      return Promise.resolve();
    }
  }, [pagination.current, pagination.pageSize, searchParams]);
  
  // 获取品牌列表
  const fetchBrands = useCallback(async () => {
    try {
      const response = await request({
        url: '/api/pallet/brands',
        method: 'GET'
      });
      
      if (response && response.code === 200 && response.data?.list && Array.isArray(response.data.list)) {
        console.log('[回收站] 成功获取品牌列表, 数量:', response.data.list.length);
        setBrands(response.data.list);
      } else {
        console.error('[回收站] 获取品牌列表格式错误或为空');
      }
    } catch (error) {
      console.error('获取品牌列表失败:', error);
    }
  }, []);
  
  // 初始化加载数据
  useEffect(() => {
    // 如果fetchRecycleBinRef未初始化，直接返回
    if (!fetchRecycleBinRef.current) {
      console.log('[回收站] 等待fetchRecycleBinRef初始化...');
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
        console.log('[回收站] 开始加载初始数据');
        
        // 先获取品牌列表
        await fetchBrands();
        
        // 设置适当的分页大小
        const pageSize = 10;
        
        // 更新分页状态
        setPagination({
          current: 1,
          pageSize: pageSize,
          total: 0,
          totalPages: 0
        });
        
        // 使用deleted_at降序排序
        const initialSortField = 'deleted_at';
        const initialSortOrder = 'desc';
        
        // 重置搜索参数
        setSearchParams({
          keyword: '',
          brand_id: null,
          sort_field: initialSortField,
          sort_order: initialSortOrder
        });
        
        // 记录关键日志
        console.log('[回收站] 初始化加载数据，即将调用 fetchRecycleBinData:', {
          page: 1,
          pageSize,
          sort_field: initialSortField,
          sort_order: initialSortOrder
        });
        
        // 获取回收站列表，使用正确的排序参数
        await fetchRecycleBinData(1, pageSize, '', null, initialSortField, initialSortOrder);
      } catch (error) {
        console.error('[回收站] 初始化加载数据失败:', error);
        message.error('数据加载失败，请刷新页面重试');
      }
    }
    
    loadInitialData();
  }, [fetchBrands, fetchRecycleBinData, message, setPagination, setSearchParams]);
  
  // 处理搜索输入
  const handleSearchInput = (e) => {
    const value = e.target.value;
    
    // 清除之前的定时器
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    
    // 更新搜索关键词
    setSearchParams(prev => ({
      ...prev,
      keyword: value
    }));
    
    // 设置防抖定时器
    searchTimerRef.current = setTimeout(() => {
      // 重置到第一页进行搜索
      fetchRecycleBinData(1, pagination.pageSize, value, searchParams.brand_id);
    }, 500);
  };
  
  // 处理品牌筛选
  const handleBrandFilter = (event) => {
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
    
    // 获取筛选后的数据
    fetchRecycleBinData(1, pagination.pageSize, searchParams.keyword, brandId);
  };
  
  // 处理分页切换
  const handlePageChange = (page, pageSize) => {
    fetchRecycleBinData(page, pageSize, searchParams.keyword, searchParams.brand_id);
  };
  
  // 处理刷新数据
  const handleRefresh = useCallback(() => {
    // 重置搜索参数为初始值
    setSearchParams({
      keyword: '',
      brand_id: null,
      sort_field: 'deleted_at',
      sort_order: 'desc'
    });
    
    // 重置分页设置
    setPagination({
      current: 1,
      pageSize: 10,
      total: 0,
      totalPages: 0
    });
    
    // 重置搜索状态
    setIsSearching(false);
    
    // 重置选中项
    setSelectedItems([]);
    
    // 重置搜索框值
    if (searchInputRef.current) {
      searchInputRef.current.input.value = '';
    }
    
    // 执行刷新操作
    const refreshData = async () => {
      try {
        // 先获取品牌列表
        await fetchBrands();
        // 然后获取回收站数据
        await fetchRecycleBinData(1, 10, '', null, 'deleted_at', 'desc');
        message.success('回收站数据已刷新');
      } catch (error) {
        console.error('刷新回收站数据失败:', error);
        message.error('刷新回收站数据失败，请重试');
      }
    };
    
    refreshData();
  }, [fetchRecycleBinData, fetchBrands, message, setSearchParams, setPagination, setIsSearching]);
  
  // 处理图片预览
  const handleImagePreview = (imageUrl, title = '产品图片') => {
    if (!imageUrl) return;
    
    console.log('[回收站] 预览图片:', imageUrl);
    
    // 设置加载状态
    setPreviewLoading(true);
    setPreviewImage(imageUrl); // 直接使用传入的URL (已经由getImageUrl处理过)
    setPreviewTitle(title || '产品图片');
    setPreviewVisible(true);
    
    // 预加载图片 - 使用window.Image而不是Image，避免与antd的Image组件冲突
    const img = new window.Image();
    img.src = imageUrl;
    img.onload = () => {
      console.log('[回收站] 图片加载完成:', imageUrl);
      setPreviewLoading(false);
    };
    img.onerror = () => {
      console.error('[回收站] 图片加载失败:', imageUrl);
      setPreviewLoading(false);
      message.error('图片加载失败');
    };
  };
  
  // 关闭图片预览
  const handlePreviewCancel = () => {
    setPreviewVisible(false);
    setPreviewImage('');
    setPreviewTitle('');
  };
  
  // 下载素材包
  const handleDownloadMaterial = async (product) => {
    // 查找素材包附件
    const material = product.attachments?.find(item => item.file_type === 'MATERIAL');
    
    if (material && material.file_path) {
      try {
        // 构建完整的文件URL
        const fileUrl = getImageUrl(material.file_path);
        
        // 使用隐藏的a标签触发文件下载
        const link = document.createElement('a');
        link.href = fileUrl;
        
        // 设置下载文件名
        const fileName = material.file_name || `素材包_${material.id}`;
        link.setAttribute('download', fileName);
        
        // 触发下载
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        message.success('素材包下载已开始');
      } catch (error) {
        console.error('[回收站] 下载素材包失败:', error);
        message.error('下载素材包失败：' + (error.message || '未知错误'));
      }
    } else {
      message.warning('该产品没有素材包');
    }
  };
  
  // 处理产品选择
  const handleItemSelect = (itemId) => {
    setSelectedItems(prev => {
      if (prev.includes(itemId)) {
        // 如果已选中，则取消选中
        return prev.filter(id => id !== itemId);
      } else {
        // 如果未选中，则添加到选中列表
        return [...prev, itemId];
      }
    });
  };
  
  // 处理全选/取消全选
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      // 全选当前页的所有产品
      const allIds = recycleBinItems.map(item => item.id);
      setSelectedItems(allIds);
    } else {
      // 取消全选
      setSelectedItems([]);
    }
  };
  
  // 处理还原产品
  const handleRestore = (item) => {
    modal.confirm({
      title: '确定要还原此产品吗？',
      content: <div>
        <p>还原后，产品将重新出现在货盘列表中。</p>
        <p>产品名称: {item.product.name}</p>
        <p>产品货号: {item.product.product_code}</p>
      </div>,
      onOk: async () => {
        try {
          const response = await restoreProduct(item.id);
          
          if (response && response.code === 200) {
            message.success('产品还原成功');
            // 刷新回收站列表
            fetchRecycleBinData();
          } else {
            message.error(response?.message || '产品还原失败');
          }
        } catch (error) {
          console.error('[回收站] 产品还原失败:', error);
          message.error('产品还原失败');
        }
      }
    });
  };
  
  // 处理永久删除产品
  const handleDelete = (item) => {
    modal.confirm({
      title: '确定要永久删除此产品吗？',
      content: <div>
        <p style={{ color: '#ff4d4f', fontWeight: 'bold' }}>
          警告: 此操作无法撤销！产品将被永久删除，包括所有附件和价格信息。
        </p>
        <p>产品名称: {item.product.name}</p>
        <p>产品货号: {item.product.product_code}</p>
      </div>,
      okButtonProps: { danger: true, type: 'primary' },
      okText: '永久删除',
      cancelText: '取消',
      onOk: async () => {
        try {
          const response = await deleteProduct(item.id);
          
          if (response && response.code === 200) {
            message.success('产品已永久删除');
            // 刷新回收站列表
            fetchRecycleBinData();
          } else {
            message.error(response?.message || '永久删除失败');
          }
        } catch (error) {
          console.error('[回收站] 永久删除产品失败:', error);
          message.error('永久删除失败');
        }
      }
    });
  };
  
  // 处理批量还原
  const handleBatchRestore = () => {
    if (selectedItems.length === 0) {
      message.warning('请先选择要还原的产品');
      return;
    }
    
    modal.confirm({
      title: '批量还原产品',
      content: <div>
        <p>确定要还原选中的 {selectedItems.length} 个产品吗？</p>
        <p>还原后，这些产品将重新出现在货盘列表中。</p>
      </div>,
      onOk: async () => {
        try {
          const response = await batchRestoreProducts(selectedItems);
          
          if (response && response.code === 200) {
            message.success(`已成功还原 ${response.data.success} 个产品`);
            // 重置选中状态
            setSelectedItems([]);
            // 刷新回收站列表
            fetchRecycleBinData();
          } else {
            message.error(response?.message || '批量还原失败');
          }
        } catch (error) {
          console.error('[回收站] 批量还原产品失败:', error);
          message.error('批量还原失败');
        }
      }
    });
  };
  
  // 处理批量删除
  const handleBatchDelete = () => {
    if (selectedItems.length === 0) {
      message.warning('请先选择要删除的产品');
      return;
    }
    
    modal.confirm({
      title: '批量永久删除产品',
      content: <div>
        <p style={{ color: '#ff4d4f', fontWeight: 'bold' }}>
          警告: 此操作无法撤销！选中的 {selectedItems.length} 个产品将被永久删除，包括所有附件和价格信息。
        </p>
      </div>,
      okButtonProps: { danger: true, type: 'primary' },
      okText: '永久删除',
      cancelText: '取消',
      onOk: async () => {
        try {
          const response = await batchDeleteProducts(selectedItems);
          
          if (response && response.code === 200) {
            message.success(`已成功删除 ${response.data.success} 个产品`);
            // 重置选中状态
            setSelectedItems([]);
            // 刷新回收站列表
            fetchRecycleBinData();
          } else {
            message.error(response?.message || '批量删除失败');
          }
        } catch (error) {
          console.error('[回收站] 批量删除产品失败:', error);
          message.error('批量删除失败');
        }
      }
    });
  };
  
  // 渲染价格档位
  const renderPriceTiers = (priceTiers) => {
    if (!priceTiers || !Array.isArray(priceTiers) || priceTiers.length === 0) {
      return <div className="recyclebin-price-tier-empty">暂无价格档位</div>;
    }

    // 只有一行时，添加特殊的内联样式处理边框问题
    const isSingleRow = priceTiers.length === 1;
    
    return (
      <div className="recyclebin-price-tiers-container">
        <div className="recyclebin-price-tiers-header">
          <div className="recyclebin-tier-qty-header">订购数量</div>
          <div className="recyclebin-tier-price-header">单价</div>
        </div>
        {priceTiers.map((tier, index) => (
          <div 
            key={index} 
            className="recyclebin-price-tier-row"
            style={isSingleRow ? { height: '100%', flex: '1' } : {}}
          >
            <div 
              className="recyclebin-tier-qty"
              style={isSingleRow ? { 
                height: '100%',
                position: 'relative',
                borderRight: '1px solid #f0f0f0',
              } : {}}
            >{`≤${tier.quantity}`}</div>
            <div 
              className="recyclebin-tier-price"
              style={isSingleRow ? { height: '100%' } : {}}
            >{tier.price}</div>
          </div>
        ))}
      </div>
    );
  };
  
  // 获取产品主图
  const getProductMainImage = (product) => {
    if (!product.attachments || !Array.isArray(product.attachments)) return null;
    
    // 查找产品图片附件(类型为IMAGE)
    const imageAttachment = product.attachments.find(
      attachment => attachment.file_type === 'IMAGE'
    );
    
    // 有图片时返回图片URL
    if (imageAttachment && imageAttachment.file_path) {
      return imageAttachment.file_path;
    }
    
    return null;
  };
  
  // 渲染产品图片
  const renderProductImage = (product) => {
    const imagePath = getProductMainImage(product);
    
    if (!imagePath) {
      return <div className="recyclebin-product-image-placeholder">暂无图片</div>;
    }
    
    // 生成完整图片URL用于缩略图显示和预览
    const fullImageUrl = getImageUrl(imagePath);
    
    return (
      <div className="recyclebin-product-image-container" onClick={() => handleImagePreview(fullImageUrl, product.name)}>
        <Image
          src={fullImageUrl}
          alt={product.name}
          preview={false}
          className="recyclebin-product-image"
          fallback="/images/fallback-image.png"
        />
        <div className="recyclebin-image-overlay">
          <EyeOutlined />
        </div>
      </div>
    );
  };
  
  return (
    <div className={styles.recycleBinContainer}>
      {/* 页面标题 */}
      <div className={styles.pageHeader}>
        <Title level={4}>{isAdmin ? '公司货盘回收站' : `${user?.name || ''}的货盘回收站`}</Title>
      </div>
      
      {/* 搜索和筛选栏 */}
      <div className={styles.searchFilterBar}>
        <Input
          placeholder="搜索产品名称、品牌、货号、规格、净含量..."
          allowClear
          prefix={<SearchOutlined />}
          value={searchParams.keyword}
          onChange={handleSearchInput}
          className={styles.searchInput}
          ref={searchInputRef}
        />
        
        <div style={{ display: 'inline-block', width: 200, marginRight: 8 }}>
          <select 
            style={selectStyle}
            value={searchParams.brand_id === null ? 'all' : String(searchParams.brand_id)}
            onChange={handleBrandFilter}
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
          onClick={handleRefresh}
          style={{ marginLeft: 8 }}
        >
          刷新
        </Button>
      </div>
      
      {/* 批量操作栏 */}
      {recycleBinItems.length > 0 && (
        <div className={styles.batchActionBar}>
          <div className={styles.leftSection}>
            <span className={styles.selectionInfo}>
              {selectedItems.length > 0 ? (
                <>已选择 <span className={styles.selectedCount}>{selectedItems.length}</span> 个产品</>
              ) : (
                '可选择产品进行批量操作'
              )}
            </span>
            
            <Button
              type="primary"
              icon={<UndoOutlined />}
              onClick={handleBatchRestore}
              disabled={selectedItems.length === 0}
              style={{ marginLeft: 16 }}
            >
              批量还原
            </Button>
            
            <Button
              type="primary"
              danger
              icon={<DeleteOutlined />}
              onClick={handleBatchDelete}
              disabled={selectedItems.length === 0}
              style={{ 
                marginLeft: 12, 
                ...(selectedItems.length > 0 
                  ? { backgroundColor: '#ff7875', borderColor: '#ff7875' } 
                  : { backgroundColor: '#d9d9d9', borderColor: '#d9d9d9' })
              }}
            >
              批量删除
            </Button>
          </div>
          
          <Text type="secondary">
            共 {pagination.total} 个产品在回收站
          </Text>
        </div>
      )}
      
      {/* 产品表格 */}
      <div className="recyclebin-product-grid-container">
        <Spin spinning={loading}>
          {recycleBinItems.length > 0 ? (
            <div 
              className="recyclebin-product-grid-scroll-container"
              ref={scrollContainerRef}
            >
              {/* 添加内容容器 */}
              <div className="recyclebin-product-grid-content">
                {/* 表头 */}
                <div className="recyclebin-product-grid-header">
                  <div className="recyclebin-grid-col recyclebin-grid-col-select">
                    <Checkbox
                      checked={selectedItems.length > 0 && selectedItems.length === recycleBinItems.length}
                      indeterminate={selectedItems.length > 0 && selectedItems.length < recycleBinItems.length}
                      onChange={handleSelectAll}
                    />
                  </div>
                  <div className="recyclebin-grid-col recyclebin-grid-col-index">序号</div>
                  <div className="recyclebin-grid-col recyclebin-grid-col-image">图片</div>
                  <div className="recyclebin-grid-col recyclebin-grid-col-name">名称</div>
                  <div className="recyclebin-grid-col recyclebin-grid-col-brand">品牌</div>
                  <div className="recyclebin-grid-col recyclebin-grid-col-code">货号</div>
                  <div className="recyclebin-grid-col recyclebin-grid-col-spec">规格</div>
                  <div className="recyclebin-grid-col recyclebin-grid-col-content">净含量</div>
                  <div className="recyclebin-grid-col recyclebin-grid-col-size">产品尺寸</div>
                  <div className="recyclebin-grid-col recyclebin-grid-col-shipping">装箱方式</div>
                  <div className="recyclebin-grid-col recyclebin-grid-col-ship-spec">装箱规格</div>
                  <div className="recyclebin-grid-col recyclebin-grid-col-ship-size">装箱尺寸</div>
                  <div className="recyclebin-grid-col recyclebin-grid-col-price-tier">价格档位</div>
                  <div className="recyclebin-grid-col recyclebin-grid-col-material">素材包</div>
                  <div className="recyclebin-grid-col recyclebin-grid-col-url">产品链接</div>
                  <div className="recyclebin-grid-col recyclebin-grid-col-restore">还原</div>
                  <div className="recyclebin-grid-col recyclebin-grid-col-delete">删除</div>
                </div>

                {/* 数据行 */}
                <div className="recyclebin-product-grid-body">
                  {recycleBinItems.map((item) => {
                    // 确保product对象存在，如果不存在则提供空对象
                    const product = item.product || {};
                    // 确保attachments属性存在且是数组
                    if (!product.attachments) product.attachments = [];
                    if (!Array.isArray(product.attachments)) product.attachments = [];
                    // 确保price_tiers属性存在且是数组
                    if (!product.price_tiers) product.price_tiers = [];
                    if (!Array.isArray(product.price_tiers)) product.price_tiers = [];
                    
                    const hasMaterial = product.attachments?.some(att => att.file_type === 'MATERIAL');
                    
                    // 使用item上的key字段或生成唯一键
                    const rowKey = item.key || `item_${item.id}_${Date.now()}_${item.index}`;
                    
                    return (
                      <div key={rowKey} className="recyclebin-product-grid-row">
                        <div className="recyclebin-grid-col recyclebin-grid-col-select">
                          <Checkbox 
                            checked={selectedItems.includes(item.id)}
                            onChange={() => handleItemSelect(item.id)}
                          />
                        </div>
                        <div className="recyclebin-grid-col recyclebin-grid-col-index">
                          {item.index}
                        </div>
                        <div className="recyclebin-grid-col recyclebin-grid-col-image">
                          {renderProductImage(product)}
                        </div>
                        <div className="recyclebin-grid-col recyclebin-grid-col-name" title={product.name}>
                          {product.name}
                        </div>
                        <div className="recyclebin-grid-col recyclebin-grid-col-brand">
                          {product.brand_name || '-'}
                        </div>
                        <div className="recyclebin-grid-col recyclebin-grid-col-code">
                          {product.product_code || '-'}
                        </div>
                        <div className="recyclebin-grid-col recyclebin-grid-col-spec" title={product.specification}>
                          {product.specification || '-'}
                        </div>
                        <div className="recyclebin-grid-col recyclebin-grid-col-content">
                          {product.net_content || '-'}
                        </div>
                        <div className="recyclebin-grid-col recyclebin-grid-col-size">
                          {product.product_size || '-'}
                        </div>
                        <div className="recyclebin-grid-col recyclebin-grid-col-shipping">
                          {product.shipping_method || '-'}
                        </div>
                        <div className="recyclebin-grid-col recyclebin-grid-col-ship-spec">
                          {product.shipping_spec || '-'}
                        </div>
                        <div className="recyclebin-grid-col recyclebin-grid-col-ship-size">
                          {product.shipping_size || '-'}
                        </div>
                        <div className="recyclebin-grid-col recyclebin-grid-col-price-tier">
                          {renderPriceTiers(product.price_tiers)}
                        </div>
                        <div className="recyclebin-grid-col recyclebin-grid-col-material">
                          {hasMaterial ? (
                            <Button 
                              type="link" 
                              icon={<DownloadOutlined />} 
                              onClick={() => handleDownloadMaterial(product)}
                            />
                          ) : (
                            <span className="recyclebin-no-material">暂无</span>
                          )}
                        </div>
                        <div className="recyclebin-grid-col recyclebin-grid-col-url">
                          {product.product_url ? (
                            <Button 
                              type="link" 
                              icon={<EyeOutlined />} 
                              onClick={() => window.open(product.product_url, '_blank')}
                            />
                          ) : (
                            <span className="recyclebin-no-url">暂无</span>
                          )}
                        </div>
                        <div className="recyclebin-grid-col recyclebin-grid-col-restore">
                          <Button
                            type="link"
                            icon={<UndoOutlined />}
                            style={{ color: '#52c41a' }}
                            onClick={() => handleRestore(item)}
                          />
                        </div>
                        <div className="recyclebin-grid-col recyclebin-grid-col-delete">
                          <Button
                            type="link"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => handleDelete(item)}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="recyclebin-product-grid-empty">
              <Empty description={loading ? '加载中...' : '回收站中没有产品'} />
            </div>
          )}
        </Spin>
      </div>
      
      {/* 分页控件 */}
      {pagination.total > 0 && (
        <div className="recyclebin-product-grid-pagination">
          <Pagination
            current={pagination.current}
            pageSize={pagination.pageSize}
            total={pagination.total}
            onChange={handlePageChange}
            showSizeChanger
            showQuickJumper
            showTotal={(total) => `共 ${total} 条记录`}
          />
        </div>
      )}
      
      {/* 图片预览模态框 */}
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
    </div>
  );
};

// 使用App组件包装，提供消息通知和模态框功能
const RecycleBinWithApp = () => (
  <App>
    <RecycleBin />
  </App>
);

export default RecycleBinWithApp; 
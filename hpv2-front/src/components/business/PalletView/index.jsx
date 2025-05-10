import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button, Input, Select, Typography, App, Modal, Spin, Radio, Pagination, Empty, Result, Tooltip } from 'antd';
import { 
  PictureOutlined, 
  CopyOutlined, 
  DownloadOutlined, 
  LinkOutlined, 
  BarsOutlined, 
  AppstoreOutlined,
  SearchOutlined
} from '@ant-design/icons';
import { useSelector } from 'react-redux';
import request from '@/utils/request';
import { commonSearch } from '@/api/common';
import ProductCard from './ProductCard';
import styles from './styles.module.css';

const { Title } = Typography;
const { Option } = Select;

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

// 创建独立于组件的函数，避免循环引用
const createProductFetcher = (setLoading, setIsSearching, setProducts, setPagination, message) => {
  return async (page, pageSize, keyword, brandId, sortField, sortOrder, ownerType, ownerId) => {
    setLoading(true);
    
    // 使用updated_at降序排序作为默认值
    const actualSortField = sortField || 'updated_at';
    const actualSortOrder = sortOrder || 'desc';
    
    try {
      // 判断是否为搜索模式
      const isSearchMode = keyword && keyword.trim() !== '';
      setIsSearching(isSearchMode);

      // 构建通用的查询参数
      const commonParams = {
        sort_field: actualSortField,
        sort_order: actualSortOrder,
        with_price_tiers: true,
        with_attachments: true,
        owner_type: ownerType,
        owner_id: ownerId
      };

      // 添加品牌筛选参数（如果有）
      if (brandId !== null && brandId !== undefined && !isNaN(brandId)) {
        commonParams.brand_id = brandId;
      }

      let response;
      
      if (isSearchMode) {
        // 搜索模式 - 使用通用搜索API
        const fields = 'p.name,b.name,p.product_code,p.specification,p.net_content';
        console.log('【调试】发起搜索请求，参数:', {
          module: 'products',
          keyword,
          fields,
          exact: false,
          ownerType,
          ownerId,
          ...commonParams
        });
        response = await commonSearch('products', keyword, fields, false, commonParams);
        console.log('【调试】搜索请求响应:', response);
      } else {
        // 分页模式 - 使用通用分页查询API
        const queryParams = {
          page,
          page_size: pageSize,
          module: 'products',
          with_brand: true,
          ...commonParams
        };
        console.log('【调试】发送产品列表查询请求，参数:', queryParams);
        
        response = await request({
          url: '/api/common/pagination/query',
          method: 'GET',
          params: queryParams
        });
        
        // 打印完整响应以便调试
        console.log('【调试】产品列表查询响应:', {
          status: response?.code,
          pagination: response?.data?.pagination,
          itemsCount: response?.data?.items?.length || 0
        });
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
        
        // 确保产品数据包含所有必要字段
        // 打印原始产品数据以便调试
        console.log("原始产品数据:", productList[0]);
        
        // 直接使用原始数据，不再进行字段映射转换
        const enhancedProducts = productList.map(product => {
          // 创建增强后的产品对象，确保price_tiers和attachments是数组
          const enhancedProduct = {
            ...product,
            price_tiers: Array.isArray(product.price_tiers) ? product.price_tiers : [],
            attachments: Array.isArray(product.attachments) ? product.attachments : []
          };
          
          // 调试第一个产品的数据，确保shipping字段存在
          if (product.id === productList[0]?.id) {
            console.log("产品数据:", {
              id: product.id,
              shipping_method: product.shipping_method || "字段不存在",
              shipping_spec: product.shipping_spec || "字段不存在", 
              shipping_size: product.shipping_size || "字段不存在"
            });
          }
          
          return enhancedProduct;
        });
        
        // 添加序号
        const startIndex = (page - 1) * pageSize;
        const productsWithIndex = enhancedProducts.map((item, index) => ({
          ...item,
          index: startIndex + index + 1
        }));
        
        // 更新状态
        setProducts(productsWithIndex);
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

/**
 * 渲染产品图片
 * @param {Object} product - 产品数据
 * @param {Function} onPreview - 预览回调函数
 * @returns {JSX.Element}
 */
const renderProductImage = (product, onPreview) => {
  // 查找类型为IMAGE的第一个附件
  const imageAttachment = product.attachments?.find(
    att => att.file_type === 'IMAGE'
  );
  
  if (imageAttachment) {
    const imageUrl = imageAttachment.file_path;
    return (
      <div className="product-image">
        <img
          src={imageUrl}
          alt={product.name || '产品图片'}
          onClick={() => onPreview(imageUrl, product.name)}
          className="product-thumbnail"
        />
      </div>
    );
  }
  
  // 无图片时显示占位图
  return (
    <div className="product-image no-image">
      <PictureOutlined style={{ fontSize: 36, color: '#d9d9d9' }} />
    </div>
  );
};

/**
 * 渲染价格档位
 * @param {Array} priceTiers - 价格档位数组
 * @returns {JSX.Element}
 */
const renderPriceTiers = (priceTiers) => {
  if (!priceTiers || priceTiers.length === 0) {
    return <div className={styles.priceTierEmpty}>暂无</div>;
  }
  
  // 按数量排序
  const sortedTiers = [...priceTiers].sort((a, b) => {
    const numA = parseInt(a.quantity, 10);
    const numB = parseInt(b.quantity, 10);
    return numA - numB;
  });
  
  // 只有一行时，添加特殊的内联样式处理边框问题
  const isSingleRow = sortedTiers.length === 1;

  // 通用样式，确保在非CSS模块环境下也能正确显示
  const containerStyle = {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column'
  };

  const headerStyle = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    backgroundColor: '#f0f0f0',
    fontWeight: 500,
    borderBottom: '1px solid #e8e8e8',
    minHeight: '32px'
  };

  const headerCellStyle = {
    padding: '4px',
    textAlign: 'center',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%'
  };

  const rowStyle = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    borderBottom: '1px solid #f0f0f0',
    minHeight: '32px',
    ...isSingleRow && { height: '100%', flex: '1' }
  };

  const cellStyle = {
    padding: '4px',
    textAlign: 'center',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '32px',
    height: '100%',
    wordBreak: 'break-word',
    whiteSpace: 'normal',
    overflow: 'hidden'
  };
  
  return (
    <div className={styles.priceTiersContainer} style={containerStyle}>
      <div className={styles.priceTiersHeader} style={headerStyle}>
        <div className={styles.tierQtyHeader} style={{...headerCellStyle, borderRight: '1px solid #e8e8e8'}}>订购数量</div>
        <div className={styles.tierPriceHeader} style={headerCellStyle}>单价</div>
      </div>
      {sortedTiers.map((tier, index) => (
        <div 
          key={tier.id || index} 
          className={styles.priceTierRow}
          style={rowStyle}
        >
          <div 
            className={styles.tierQty}
            style={{
              ...cellStyle,
              borderRight: '1px solid #f0f0f0',
              position: 'relative',
              ...isSingleRow && { height: '100%' }
            }}
          >{`≤${tier.quantity}`}</div>
          <div 
            className={styles.tierPrice}
            style={{...cellStyle, ...isSingleRow && { height: '100%' }}}
          >{tier.price}</div>
        </div>
      ))}
    </div>
  );
};

/**
 * 复制产品到目标货盘
 * @param {number} sourceId - 源产品ID
 * @param {string} targetOwnerType - 目标拥有者类型 (COMPANY|SELLER)
 * @param {number|null} targetOwnerId - 目标拥有者ID
 * @returns {Promise<Object>} - 复制结果
 */
const copyProduct = async (sourceId, targetOwnerType, targetOwnerId = null) => {
  return request({
    url: `/api/pallet/products/${sourceId}/copy`,
    method: 'POST',
    data: {
      source_id: sourceId,
      target_owner_type: targetOwnerType,
      target_owner_id: targetOwnerId
    }
  });
};

/**
 * 下载产品素材
 * @param {number} productId - 产品ID
 * @returns {Promise<Object>} - 下载结果
 */
const downloadProductMaterials = async (productId) => {
  return request({
    url: `/api/pallet/products/${productId}/attachments/download`,
    method: 'GET',
    responseType: 'blob'
  });
};

/**
 * 获取品牌列表
 * @returns {Promise<Object>} - 品牌列表
 */
const getBrands = async () => {
  try {
    console.log('【调试】开始请求品牌列表');
    const response = await request({
      url: '/api/pallet/brands',
      method: 'GET',
      params: { status: 'ACTIVE' }
    });
    console.log('【调试】品牌列表请求成功:', response);
    return response;
  } catch (error) {
    console.error('【调试】品牌列表请求失败:', error);
    // 返回一个标准格式的错误响应，避免因为异常导致后续代码执行中断
    return {
      code: 500,
      message: '获取品牌列表失败',
      data: { list: [] }
    };
  }
};

const PalletView = ({
  ownerType,
  ownerId,
  role,
  copyTargetType,
  copyTargetId,
  onCopySuccess,
  emptyText = '暂无产品数据',
  actionText = '复制产品'
}) => {
  const { message, modal } = App.useApp();
  const fetchProductsRef = useRef(null);
  const initializedRef = useRef(false);
  const searchTimerRef = useRef(null);
  
  // UI状态
  const [viewMode, setViewMode] = useState('table'); // 'table' 或 'card'
  const [loading, setLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false); // 是否处于搜索模式
  
  // 数据状态
  const [products, setProducts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10, 
    total: 0,
    totalPages: 0
  });
  
  // 搜索与筛选状态
  const [searchParams, setSearchParams] = useState({
    keyword: '',
    brandId: null,
    sortField: 'updated_at',
    sortOrder: 'desc'
  });
  
  // 弹窗相关状态
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [copyModalVisible, setCopyModalVisible] = useState(false);
  const [copySuccessVisible, setCopySuccessVisible] = useState(false);
  const [copyLoading, setCopyLoading] = useState(false);
  
  // 初始化产品获取函数
  useEffect(() => {
    fetchProductsRef.current = createProductFetcher(
      setLoading,
      setIsSearching,
      setProducts,
      setPagination,
      message
    );
    
    return () => {
      fetchProductsRef.current = null;
    };
  }, [message]);
  
  // 清理定时器
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
        searchTimerRef.current = null;
      }
    };
  }, []);
  
  // 获取产品数据
  const fetchProducts = useCallback((...args) => {
    if (fetchProductsRef.current) {
      return fetchProductsRef.current(...args, ownerType, ownerId);
    }
  }, [ownerType, ownerId]);
  
  // 监听ownerId变化，重新加载数据
  useEffect(() => {
    // 当ownerId变化时，重置初始化标记并重新加载数据
    if (initializedRef.current) {
      console.log(`【调试】ownerId发生变化，从 ${initializedRef.current} 变为 ${ownerId}，重新加载数据`, {
        ownerType,
        ownerId,
        role
      });
      
      // 重置搜索和分页状态
      setSearchParams({
        keyword: '',
        brandId: null,
        sortField: 'updated_at',
        sortOrder: 'desc'
      });
      
      setPagination(prev => ({
        ...prev,
        current: 1
      }));
      
      // 立即加载新数据
      fetchProducts(
        1,
        pagination.pageSize,
        '',
        null,
        'updated_at',
        'desc'
      );
    }
    
    // 存储当前ownerId作为已初始化的标记
    initializedRef.current = ownerId;
  }, [ownerId, fetchProducts, pagination.pageSize]);
  
  // 初始化数据加载
  useEffect(() => {
    async function loadInitialData() {
      // 移除初始化检查，让专门的ownerId监听器来处理数据加载
      try {
        console.log('【调试】初始化数据加载', {
          ownerType,
          ownerId,
          role,
          fetchProducts: !!fetchProducts
        });
        
        // 获取品牌列表
        const brandsResponse = await getBrands();
        console.log('【调试】获取品牌列表响应:', brandsResponse);
        if (brandsResponse?.code === 200 && Array.isArray(brandsResponse.data?.list)) {
          console.log('【调试】设置品牌列表:', brandsResponse.data.list);
          setBrands(brandsResponse.data.list);
        } else {
          console.error('【调试】品牌列表获取失败或格式错误:', brandsResponse);
        }
        
        // 主动触发产品数据加载
        if (fetchProducts) {
          console.log('【调试】初始化时主动加载产品数据', {
            ownerType,
            ownerId
          });
          
          fetchProducts(
            1,
            pagination.pageSize,
            '',
            null,
            'updated_at',
            'desc',
            ownerType,
            ownerId
          );
        }
      } catch (error) {
        console.error('获取品牌列表失败:', error);
        message.error('获取品牌列表失败');
      }
    }
    
    loadInitialData();
  }, [message, ownerType, ownerId, fetchProducts, pagination.pageSize]);
  
  // 搜索处理（带防抖）
  const handleSearch = (e) => {
    const value = e.target.value;
    
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    
    // 更新搜索参数
    setSearchParams(prev => ({ ...prev, keyword: value }));
    setPagination(prev => ({ ...prev, current: 1 }));
    
    // 空输入时立即执行查询，否则添加防抖
    if (!value || value.trim() === '') {
      fetchProducts(
        1,
        pagination.pageSize,
        '',
        searchParams.brandId,
        'updated_at',
        'desc',
        ownerType,
        ownerId
      );
    } else {
      searchTimerRef.current = setTimeout(() => {
        fetchProducts(
          1,
          pagination.pageSize,
          value,
          searchParams.brandId,
          'updated_at',
          'desc',
          ownerType,
          ownerId
        );
      }, 300); // 300ms防抖
    }
  };
  
  // 品牌筛选
  const handleBrandFilter = (value) => {
    // 更新搜索参数
    setSearchParams(prev => ({ ...prev, brandId: value }));
    setPagination(prev => ({ ...prev, current: 1 }));
    
    // 获取筛选后的数据 - 确保始终使用正确的排序参数，按更新时间降序排序
    fetchProducts(
      1,
      pagination.pageSize,
      searchParams.keyword,
      value,
      'updated_at',
      'desc',
      ownerType,
      ownerId
    );
  };
  
  // 视图模式切换
  const handleViewModeChange = (e) => {
    setViewMode(e.target.value);
  };
  
  // 分页处理
  const handlePageChange = (page, pageSize) => {
    setPagination(prev => ({
      ...prev,
      current: page,
      pageSize: pageSize
    }));
    
    fetchProducts(
      page,
      pageSize,
      searchParams.keyword,
      searchParams.brandId,
      searchParams.sortField,
      searchParams.sortOrder,
      ownerType,
      ownerId
    );
  };
  
  // 图片预览
  const handleImagePreview = (imageUrl, title) => {
    setPreviewImage(imageUrl);
    setPreviewTitle(title);
    setPreviewVisible(true);
  };
  
  // 产品复制
  const handleCopyProduct = (product) => {
    setSelectedProduct(product);
    setCopyModalVisible(true);
  };
  
  // 确认复制
  const handleConfirmCopy = async () => {
    if (!selectedProduct) return;
    
    setCopyLoading(true);
    
    try {
      const response = await copyProduct(
        selectedProduct.id,
        copyTargetType,
        copyTargetId
      );
      
      if (response?.code === 200) {
        setCopyModalVisible(false);
        setCopySuccessVisible(true);
        
        if (onCopySuccess && typeof onCopySuccess === 'function') {
          onCopySuccess(selectedProduct);
        }
      } else {
        message.error(response?.message || '复制失败');
      }
    } catch (error) {
      console.error('复制产品失败:', error);
      message.error('复制产品失败');
    } finally {
      setCopyLoading(false);
    }
  };
  
  // 下载素材
  const handleDownloadMaterials = async (product) => {
    try {
      message.loading('正在准备下载...', 0);
      const response = await downloadProductMaterials(product.id);
      
      // 创建下载链接
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${product.name}-素材包.zip`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      
      message.destroy();
      message.success('素材下载成功');
    } catch (error) {
      message.destroy();
      message.error('素材下载失败');
      console.error('下载失败:', error);
    }
  };
  
  return (
    <div className={styles.container}>
      {/* 工具栏：搜索、筛选和视图切换 */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <Input 
            placeholder="搜索产品名称、品牌、货号、规格、净含量"
            onChange={handleSearch}
            allowClear
            value={searchParams.keyword}
            prefix={<SearchOutlined style={{ color: '#999' }} />}
          />
          <div>
            <select 
              style={selectStyle}
              value={searchParams.brandId === null ? 'all' : String(searchParams.brandId)}
              onChange={(e) => {
                const selectedValue = e.target.value;
                let brandId = null;
                if (selectedValue !== 'all') {
                  brandId = parseInt(selectedValue, 10);
                }
                handleBrandFilter(brandId);
              }}
            >
              <option value="all">全部品牌</option>
              {brands.map(brand => (
                <option key={brand.id} value={String(brand.id)}>
                  {brand.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className={styles.toolbarRight}>
          <Radio.Group 
            value={viewMode} 
            onChange={handleViewModeChange}
            buttonStyle="solid"
          >
            <Radio.Button value="table"><BarsOutlined /> 表格</Radio.Button>
            <Radio.Button value="card"><AppstoreOutlined /> 卡片</Radio.Button>
          </Radio.Group>
        </div>
      </div>

      {/* 产品列表 - 表格视图 */}
      {viewMode === 'table' && (
        <div className={styles.productGridContainer}>
          <div className={styles.productGridScrollContainer}>
            <div className={styles.productGridContent}>
              {/* 表头 */}
              <div className={styles.productGridHeader}>
                <div className={`${styles.gridCol} ${styles.gridColIndex}`}>序号</div>
                <div className={`${styles.gridCol} ${styles.gridColImage}`}>图片</div>
                <div className={`${styles.gridCol} ${styles.gridColName}`}>名称</div>
                <div className={`${styles.gridCol} ${styles.gridColBrand}`}>品牌</div>
                <div className={`${styles.gridCol} ${styles.gridColCode}`}>货号</div>
                <div className={`${styles.gridCol} ${styles.gridColSpec}`}>规格</div>
                <div className={`${styles.gridCol} ${styles.gridColContent}`}>净含量</div>
                <div className={`${styles.gridCol} ${styles.gridColSize}`}>产品尺寸</div>
                <div className={`${styles.gridCol} ${styles.gridColShipping}`}>装箱方式</div>
                <div className={`${styles.gridCol} ${styles.gridColShipSpec}`}>装箱规格</div>
                <div className={`${styles.gridCol} ${styles.gridColShipSize}`}>装箱尺寸</div>
                <div className={`${styles.gridCol} ${styles.gridColPriceTier}`}>价格档位</div>
                <div className={`${styles.gridCol} ${styles.gridColMaterial}`}>素材包</div>
                <div className={`${styles.gridCol} ${styles.gridColUrl}`}>产品链接</div>
                <div className={`${styles.gridCol} ${styles.gridColAction}`}>操作</div>
              </div>
              
              {/* 表格主体 */}
              <div className={styles.productGridBody}>
                {products.length > 0 ? (
                  products.map(product => (
                    <div key={product.id} className={styles.productGridRow}>
                      {/* 序号 */}
                      <div className={`${styles.gridCol} ${styles.gridColIndex}`}>
                        {product.index}
                      </div>
                      
                      {/* 图片 */}
                      <div className={`${styles.gridCol} ${styles.gridColImage}`}>
                        {renderProductImage(product, handleImagePreview)}
                      </div>
                      
                      {/* 其他字段... */}
                      <div className={`${styles.gridCol} ${styles.gridColName}`} title={product.name}>
                        {product.name}
                      </div>
                      
                      <div className={`${styles.gridCol} ${styles.gridColBrand}`}>
                        {product.brand_name || '-'}
                      </div>
                      
                      <div className={`${styles.gridCol} ${styles.gridColCode}`}>
                        {product.product_code || '-'}
                      </div>
                      
                      <div className={`${styles.gridCol} ${styles.gridColSpec}`} title={product.specification}>
                        {product.specification || '-'}
                      </div>
                      
                      <div className={`${styles.gridCol} ${styles.gridColContent}`}>
                        {product.net_content || '-'}
                      </div>
                      
                      <div className={`${styles.gridCol} ${styles.gridColSize}`}>
                        {product.product_size || '-'}
                      </div>
                      
                      <div className={`${styles.gridCol} ${styles.gridColShipping}`}>
                        {product.shipping_method || '-'}
                      </div>
                      
                      <div className={`${styles.gridCol} ${styles.gridColShipSpec}`}>
                        {product.shipping_spec || '-'}
                      </div>
                      
                      <div className={`${styles.gridCol} ${styles.gridColShipSize}`}>
                        {product.shipping_size || '-'}
                      </div>
                      
                      <div className={`${styles.gridCol} ${styles.gridColPriceTier}`}>
                        {renderPriceTiers(product.price_tiers)}
                      </div>
                      
                      <div className={`${styles.gridCol} ${styles.gridColMaterial}`}>
                        {product.attachments?.some(att => att.file_type === 'MATERIAL') ? (
                          <Button 
                            type="link" 
                            icon={<DownloadOutlined />} 
                            onClick={() => handleDownloadMaterials(product)}
                          />
                        ) : (
                          <span className={styles.noMaterial}>暂无</span>
                        )}
                      </div>
                      
                      <div className={`${styles.gridCol} ${styles.gridColUrl}`}>
                        {product.product_url ? (
                          <a 
                            href={product.product_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                          >
                            <LinkOutlined />
                          </a>
                        ) : (
                          <span className={styles.noMaterial}>暂无</span>
                        )}
                      </div>
                      
                      <div className={`${styles.gridCol} ${styles.gridColAction}`}>
                        <Button
                          type="link"
                          onClick={() => handleCopyProduct(product)}
                          icon={<CopyOutlined />}
                          title={actionText}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className={styles.productGridEmpty}>
                    <Empty description={loading ? "加载中..." : emptyText} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* 产品列表 - 卡片视图 */}
      {viewMode === 'card' && (
        <div className={styles.productCardGrid}>
          {products.length > 0 ? (
            products.map(product => (
              <ProductCard 
                key={product.id}
                product={product}
                onDownload={handleDownloadMaterials}
                onCopy={handleCopyProduct}
                onPreview={handleImagePreview}
                actionText={actionText}
              />
            ))
          ) : (
            <div className={styles.emptyContainer}>
              <Empty description={loading ? "加载中..." : emptyText} />
            </div>
          )}
        </div>
      )}
      
      {/* 分页控件 */}
      {products.length > 0 && (
        <div className={styles.pagination}>
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
      
      {/* 弹窗组件 */}
      <Modal
        open={previewVisible}
        title={previewTitle}
        footer={null}
        onCancel={() => setPreviewVisible(false)}
      >
        <img
          alt="产品图片"
          style={{ width: '100%' }}
          src={previewImage}
        />
      </Modal>
      
      <Modal
        title="确认复制产品"
        open={copyModalVisible}
        onCancel={() => setCopyModalVisible(false)}
        confirmLoading={copyLoading}
        onOk={handleConfirmCopy}
        okText="确认复制"
        cancelText="取消"
      >
        <p>确定要将产品"{selectedProduct?.name}"复制到{copyTargetType === 'COMPANY' ? '公司总货盘' : '个人货盘'}吗？</p>
      </Modal>
      
      <Modal
        title="复制成功"
        open={copySuccessVisible}
        onCancel={() => setCopySuccessVisible(false)}
        footer={[
          <Button key="ok" type="primary" onClick={() => setCopySuccessVisible(false)}>
            确定
          </Button>
        ]}
      >
        <Result
          status="success"
          title="产品复制成功"
          subTitle={`产品"${selectedProduct?.name}"已成功复制到${copyTargetType === 'COMPANY' ? '公司总货盘' : '个人货盘'}`}
        />
      </Modal>
    </div>
  );
};

export default PalletView; 
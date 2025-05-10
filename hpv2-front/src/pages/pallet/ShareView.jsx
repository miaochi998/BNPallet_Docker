import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Card, Row, Col, Typography, Avatar, Tag, Input, Select, 
  Button, Pagination, Tabs, Table, Empty, Spin, Image, Tooltip, 
  Divider, message, Space, Badge, Modal
} from 'antd';
import { 
  SearchOutlined, ReloadOutlined, ShopOutlined, PhoneOutlined, 
  MailOutlined, AppstoreOutlined, UnorderedListOutlined, 
  DownloadOutlined, UserOutlined, BarsOutlined, EyeOutlined,
  FilterOutlined, SortAscendingOutlined, SortDescendingOutlined,
  HomeOutlined, ShoppingOutlined, FileTextOutlined, 
  QuestionCircleOutlined, HeartOutlined, LeftOutlined, RightOutlined,
  StarOutlined, LinkOutlined
} from '@ant-design/icons';
import { getPalletShareData, getProductImageUrl } from '@/api/pallet';
import { commonSearch } from '@/api/common';
import { getStaticContent } from '@/api/staticContent';
import styles from './ShareView.module.css';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;
const { Option } = Select;

// 图片占位符
const PLACEHOLDER_IMAGE = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2YwZjBmMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBhbGlnbm1lbnQtYmFzZWxpbmU9Im1pZGRsZSIgZm9udC1mYW1pbHk9IkFyaWFsLHNhbnMtc2VyaWYiIGZpbGw9IiNjY2NjY2MiPuaaguaXoOWbvueJhzwvdGV4dD48L3N2Zz4=';

// 更新占位符，将"暂无"改为"暂无图片"
const PLACEHOLDER_IMAGE_UPDATED = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2YwZjBmMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBhbGlnbm1lbnQtYmFzZWxpbmU9Im1pZGRsZSIgZm9udC1mYW1pbHk9IkFyaWFsLHNhbnMtc2VyaWYiIGZpbGw9IiNjY2NjY2MiPuaaguaXoOWbvueJhzwvdGV4dD48L3N2Zz4=';

/**
 * 货盘分享浏览页面
 */
const ShareView = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  
  // 添加搜索防抖定时器的引用
  const searchTimerRef = useRef(null);
  
  // 窗口大小状态
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  
  // 状态管理
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [seller, setSeller] = useState(null);
  const [products, setProducts] = useState([]);
  const [brands, setBrands] = useState([]); // 存储所有品牌
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0
  });
  
  // 筛选状态
  const [search, setSearch] = useState('');
  const [brandId, setBrandId] = useState(null);
  const [viewMode, setViewMode] = useState('table'); // 'table' 或 'card'
  
  // 图片预览状态
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');
  
  // 侧边栏状态
  const [collapsed, setCollapsed] = useState(false);
  
  // 模态框状态
  const [storeModalVisible, setStoreModalVisible] = useState(false);
  const [helpModalVisible, setHelpModalVisible] = useState(false);
  const [logisticsModalVisible, setLogisticsModalVisible] = useState(false);
  
  // 静态内容状态
  const [staticContents, setStaticContents] = useState({
    'store-service': '',
    'logistics': '',
    'help-center': ''
  });
  const [staticContentLoading, setStaticContentLoading] = useState({
    'store-service': false,
    'logistics': false,
    'help-center': false
  });
  
  // 从本地存储获取上次的视图模式
  useEffect(() => {
    const savedViewMode = localStorage.getItem('pallet_share_view_mode');
    if (savedViewMode) {
      setViewMode(savedViewMode);
    }
  }, []);
  
  // 保存视图模式到本地存储
  useEffect(() => {
    localStorage.setItem('pallet_share_view_mode', viewMode);
  }, [viewMode]);
  
  // 内存清理函数
  useEffect(() => {
    return () => {
      // 清理搜索定时器
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, []);
  
  // 监听窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    
    // 清理函数
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
  // 获取所有品牌数据
  const fetchBrands = useCallback(async () => {
    try {
      // 通过通用搜索接口获取该分享链接下的所有产品（只获取必要的字段）
      const allProductsResponse = await commonSearch('products', '', 'p.name', false, { 
        token, 
        page_size: 1000 // 设置足够大的数量以获取所有产品
      });
      
      if (allProductsResponse?.code === 200 && allProductsResponse?.data?.list) {
        // 从所有产品中提取不重复的品牌
        const productList = allProductsResponse.data.list || [];
        const uniqueBrands = {};
        
        productList.forEach(product => {
          if (product.brand_id && product.brand_name) {
            uniqueBrands[product.brand_id] = {
              id: product.brand_id,
              name: product.brand_name
            };
          }
        });
        
        // 转换为数组并按品牌名称排序
        const brandList = Object.values(uniqueBrands).sort((a, b) => 
          a.name.localeCompare(b.name, 'zh-CN')
        );
        
        console.log('获取到的品牌列表:', brandList);
        setBrands(brandList);
      }
    } catch (err) {
      console.error('获取品牌列表失败:', err);
    }
  }, [token]);
  
  // 获取静态内容
  const fetchStaticContent = useCallback(async (contentType) => {
    try {
      setStaticContentLoading(prev => ({ ...prev, [contentType]: true }));
      const response = await getStaticContent(contentType);
      if (response && response.data) {
        setStaticContents(prev => ({ 
          ...prev, 
          [contentType]: response.data.content || '' 
        }));
      }
    } catch (err) {
      console.error(`获取${contentType}内容失败:`, err);
    } finally {
      setStaticContentLoading(prev => ({ ...prev, [contentType]: false }));
    }
  }, []);
  
  // 获取数据
  const fetchData = useCallback(async (page = 1, pageSize = 10, searchText = '', brand = null) => {
    setLoading(true);
    try {
      // 先获取卖家信息（仍然使用原始API获取）
      const sellerResponse = await getPalletShareData(token, {
        page: 1,
        pageSize: 1,
        search: '',
        brandId: null
      });
      
      // 提取卖家信息
      const { seller } = sellerResponse.data;
      setSeller(seller);
      
      // 判断是否为搜索模式
      const isSearchMode = searchText && searchText.trim() !== '';
      
      let productList = [];
      let total = 0;
      let totalPages = 1;
      
      if (isSearchMode) {
        // 搜索模式 - 使用通用搜索API
        const fields = 'p.name,b.name,p.product_code,p.specification,p.net_content,p.product_url';
        const additionalParams = {
          token // 传递token作为额外参数
        };
        
        // 添加品牌筛选参数（如果有）
        if (brand !== null && brand !== undefined && !isNaN(brand)) {
          additionalParams.brand_id = brand;
        }
        
        const searchResponse = await commonSearch('products', searchText, fields, false, additionalParams);
        
        if (searchResponse && searchResponse.code === 200 && searchResponse.data) {
          productList = searchResponse.data.list || [];
          total = productList.length;
          
          // 前端分页 - 计算当前页应该显示的数据
          const startIndex = (page - 1) * pageSize;
          const endIndex = Math.min(startIndex + pageSize, total);
          productList = productList.slice(startIndex, endIndex);
          totalPages = Math.ceil(total / pageSize);
        }
      } else {
        // 非搜索模式 - 使用原始API
        const response = await getPalletShareData(token, {
          page,
          pageSize,
          search: '',
          brandId: brand,
          sortField: 'updated_at', // 修改为按最后更新时间排序
          sortOrder: 'desc'
        });
        
        // 提取产品数据
        productList = response.data.products.items || [];
        total = response.data.products.meta.total_count || 0;
        totalPages = response.data.products.meta.total_pages || 0;
      }
      
      // 更新产品列表和分页信息
      setProducts(productList);
      setPagination({
        current: page,
        pageSize,
        total,
        totalPages
      });
      
      setError(null);
    } catch (err) {
      console.error('获取分享数据失败:', err);
      setError('获取分享数据失败，请检查链接是否有效');
      message.error('获取分享数据失败，请检查链接是否有效');
    } finally {
      setLoading(false);
    }
  }, [token]);
  
  // 初始加载
  useEffect(() => {
    if (token) {
      // 先获取所有品牌列表
      fetchBrands();
      // 然后获取产品数据
      fetchData(pagination.current, pagination.pageSize, search, brandId);
      // 获取静态内容
      fetchStaticContent('store-service');
      fetchStaticContent('logistics');
      fetchStaticContent('help-center');
    }
  }, [token, fetchBrands, fetchData, fetchStaticContent]);
  
  // 处理页码变化
  const handlePageChange = (page, pageSize) => {
    setPagination({
      ...pagination,
      current: page,
      pageSize
    });
    fetchData(page, pageSize, search, brandId);
  };
  
  // 处理搜索 - 改为防抖即时搜索
  const handleSearchInputChange = (e) => {
    const value = e.target.value;
    
    // 清除之前的定时器
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    
    // 更新搜索关键词状态
    setSearch(value);
    
    // 空输入时立即执行查询，否则添加防抖
    if (!value || value.trim() === '') {
      fetchData(1, pagination.pageSize, '', brandId);
    } else {
      searchTimerRef.current = setTimeout(() => {
        fetchData(1, pagination.pageSize, value, brandId);
      }, 300);
    }
  };
  
  // 处理品牌筛选
  const handleBrandChange = (value) => {
    // 直接设置品牌ID（value已经在onChange处理函数中处理为正确的格式）
    setBrandId(value);
    setPagination({
      ...pagination,
      current: 1
    });
    fetchData(1, pagination.pageSize, search, value);
  };
  
  // 重置筛选
  const handleResetFilters = () => {
    setSearch('');
    setBrandId(null);
    setPagination({
      ...pagination,
      current: 1
    });
    fetchData(1, pagination.pageSize, '', null);
  };
  
  // 处理视图切换
  const handleViewModeChange = (mode) => {
    setViewMode(mode);
  };
  
  // 处理图片预览
  const handlePreview = (image, title) => {
    setPreviewImage(image);
    setPreviewTitle(title);
    setPreviewVisible(true);
  };
  
  // 处理图片预览关闭
  const handlePreviewClose = () => {
    setPreviewVisible(false);
  };
  
  // 切换侧边栏折叠状态
  const toggleCollapsed = () => {
    setCollapsed(!collapsed);
  };
  
  // 打开店铺管理模态框
  const showStoreModal = () => {
    setStoreModalVisible(true);
  };
  
  // 关闭店铺管理模态框
  const closeStoreModal = () => {
    setStoreModalVisible(false);
  };
  
  // 打开帮助中心模态框
  const showHelpModal = () => {
    setHelpModalVisible(true);
  };
  
  // 关闭帮助中心模态框
  const closeHelpModal = () => {
    setHelpModalVisible(false);
  };
  
  // 打开物流模态框
  const showLogisticsModal = () => {
    setLogisticsModalVisible(true);
  };
  
  // 关闭物流模态框
  const closeLogisticsModal = () => {
    setLogisticsModalVisible(false);
  };
  
  // 添加到收藏夹
  const addToFavorites = () => {
    // 现代浏览器使用标准方法
    if (window.navigator && window.navigator.addToFavorites) {
      window.navigator.addToFavorites(window.location.href, document.title);
    } else if (document.all) { // IE
      try {
        window.external.addFavorite(window.location.href, document.title);
      } catch (e) {
        alert('您的浏览器不支持自动添加收藏夹，请按 Ctrl+D 手动添加');
      }
    } else if (window.sidebar && window.sidebar.addPanel) { // Firefox
      window.sidebar.addPanel(document.title, window.location.href, '');
    } else { // 现代浏览器一般不支持自动添加收藏夹
      // 通知用户使用快捷键添加收藏
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const shortcutKey = isMac ? '⌘+D' : 'Ctrl+D';
      alert(`请按 ${shortcutKey} 将本页添加到收藏夹`);
    }
  };
  
  // 表格列定义
  const columns = [
    {
      title: '序号',
      dataIndex: 'index',
      key: 'index',
      width: 60,
      render: (_, __, index) => (pagination.current - 1) * pagination.pageSize + index + 1
    },
    {
      title: '产品图片',
      dataIndex: 'attachments',
      key: 'image',
      width: 120,
      render: (attachments) => {
        const imageAttachment = attachments?.find(att => att.file_type === 'IMAGE');
        const imagePath = imageAttachment ? getProductImageUrl(imageAttachment.file_path) : null;
        
        return (
          <div className={styles.productImageCell}>
            <Image 
              src={imagePath || PLACEHOLDER_IMAGE_UPDATED} 
              alt="产品图片"
              fallback={PLACEHOLDER_IMAGE_UPDATED}
              preview={false}
              onClick={() => imagePath && handlePreview(imagePath, '产品图片')}
              style={{ cursor: imagePath ? 'pointer' : 'default', maxWidth: '80px', maxHeight: '80px' }}
            />
          </div>
        );
      }
    },
    {
      title: '产品名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      ellipsis: true
    },
    {
      title: '品牌',
      dataIndex: 'brand_name',
      key: 'brand',
      width: 120
    },
    {
      title: '产品货号',
      dataIndex: 'product_code',
      key: 'code',
      width: 120
    },
    {
      title: '规格',
      dataIndex: 'specification',
      key: 'specification',
      width: 150,
      ellipsis: true
    },
    {
      title: '净含量',
      dataIndex: 'net_content',
      key: 'content',
      width: 120
    },
    {
      title: '产品尺寸',
      dataIndex: 'product_size',
      key: 'size',
      width: 150
    },
    {
      title: '装箱方式',
      dataIndex: 'shipping_method',
      key: 'method',
      width: 120
    },
    {
      title: '装箱规格',
      dataIndex: 'shipping_spec',
      key: 'ship_spec',
      width: 150
    },
    {
      title: '装箱尺寸',
      dataIndex: 'shipping_size',
      key: 'ship_size',
      width: 150
    },
    {
      title: '价格档位',
      dataIndex: 'price_tiers',
      key: 'price',
      width: 200,
      render: (tiers) => {
        if (!tiers || tiers.length === 0) {
          return <Text type="secondary">暂无价格</Text>;
        }
        
        // 只有一行时，添加特殊的内联样式处理边框问题
        const isSingleRow = tiers.length === 1;
        
        return (
          <div className={styles.priceTiers}>
            <div className={styles.priceTiersHeader}>
              <div className={styles.tierQtyHeader}>订购数量</div>
              <div className={styles.tierPriceHeader}>单价</div>
            </div>
            {tiers.map((tier, index) => (
              <div 
                key={index} 
                className={styles.priceTier}
                style={isSingleRow ? { height: '100%', flex: '1' } : {}}
              >
                <div 
                  className={styles.tierQty}
                  style={isSingleRow ? { 
                    height: '100%',
                    position: 'relative',
                    borderRight: '1px solid #f0f0f0',
                  } : {}}
                >{`≤${tier.quantity}`}</div>
                <div 
                  className={styles.tierPrice}
                  style={isSingleRow ? { height: '100%' } : {}}
                >{tier.price}</div>
              </div>
            ))}
          </div>
        );
      }
    },
    {
      title: '产品链接',
      dataIndex: 'product_url',
      key: 'product_url',
      width: 100,
      render: (product_url) => {
        if (!product_url) {
          return <Text type="secondary">无</Text>;
        }
        
        return (
          <Tooltip title="在新窗口打开产品链接">
            <Button 
              type="link" 
              icon={<LinkOutlined />}
              size="small"
              href={product_url} 
              target="_blank" 
              rel="noopener noreferrer"
            />
          </Tooltip>
        );
      }
    },
    {
      title: '素材包',
      dataIndex: 'attachments',
      key: 'materials',
      width: 70,
      render: (attachments) => {
        const materialAttachment = attachments?.find(att => att.file_type === 'MATERIAL');
        
        if (!materialAttachment) {
          return <Text type="secondary">无</Text>;
        }
        
        return (
          <Button 
            type="link" 
            icon={<DownloadOutlined />}
            size="small"
            href={getProductImageUrl(materialAttachment.file_path)} 
            target="_blank" 
            rel="noopener noreferrer"
          />
        );
      }
    }
  ];
  
  // 渲染卖家信息
  const renderSellerInfo = () => {
    if (!seller) return null;

    return (
      <div className={styles.userInfoSection}>
        {/* 头像部分 */}
        <Avatar
          src={seller.avatar ? getProductImageUrl(seller.avatar) : PLACEHOLDER_IMAGE}
          className={styles.userAvatar}
          icon={<UserOutlined />}
        />

        {/* 用户信息部分 */}
        <div className={styles.userInfoContent}>
          <div className={styles.userName}>
            产品专家：{seller.name || '未设置姓名'}
          </div>
          <div className={styles.userPhone}>
            {seller.phone || '未设置手机号'}
          </div>
          <div className={styles.wechatHint}>
            右侧二维码是我的微信哦！
          </div>
        </div>

        {/* 二维码部分 */}
        <div className={styles.qrCodeSection}>
          <Image
            src={seller.wechat_qrcode ? getProductImageUrl(seller.wechat_qrcode) : PLACEHOLDER_IMAGE}
            alt="微信二维码"
            preview={false}
          />
        </div>

        {/* 店铺信息部分 */}
        <div className={styles.storeInfoSection}>
          {seller.stores && seller.stores.map((store, index) => (
            <a
              key={index}
              href={store.url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.storeItem}
            >
              <span className={styles.platformTag}>
                {store.platform}
              </span>
              <span className={styles.storeNameTag}>
                {store.name}
              </span>
              <span className={styles.storeLinkIcon}>
                <LinkOutlined />
              </span>
            </a>
          ))}
        </div>
      </div>
    );
  };
  
  // 渲染筛选区域
  const renderFilters = () => {
    return (
      <div className={styles.filtersSection}>
        {/* 搜索输入框 */}
        <div className={styles.searchInputContainer}>
          <Input
            placeholder="搜索产品名称、品牌、货号、规格、净含量"
            value={search}
            onChange={handleSearchInputChange}
            allowClear
            prefix={<SearchOutlined style={{ color: '#999' }} />}
          />
        </div>
        
        {/* 品牌下拉框 */}
        {brands.length > 0 && (
          <div className={styles.brandSelectContainer}>
            <select 
              className={styles.selectInput}
              value={brandId === null ? 'all' : String(brandId)}
              onChange={(event) => {
                const selectedValue = event.target.value;
                let brandIdValue = null;
                if (selectedValue !== 'all') {
                  brandIdValue = parseInt(selectedValue, 10);
                }
                handleBrandChange(brandIdValue);
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
        )}
        
        {/* 重置按钮 */}
        <div className={styles.filterButtonContainer}>
          <Button 
            onClick={handleResetFilters} 
            icon={<ReloadOutlined />}
          >
            重置筛选
          </Button>
        </div>
        
        {/* 视图切换按钮 */}
        <div className={styles.viewButtonsContainer}>
          <Space className={styles.viewToggle}>
            <Tooltip title="表格视图">
              <Button 
                type={viewMode === 'table' ? 'primary' : 'default'}
                icon={<BarsOutlined />}
                onClick={() => handleViewModeChange('table')}
              />
            </Tooltip>
            <Tooltip title="卡片视图">
              <Button 
                type={viewMode === 'card' ? 'primary' : 'default'}
                icon={<AppstoreOutlined />}
                onClick={() => handleViewModeChange('card')}
              />
            </Tooltip>
          </Space>
        </div>

        {/* 清除浮动 */}
        <div style={{ clear: 'both' }}></div>
      </div>
    );
  };
  
  // 渲染卡片视图
  const renderCardView = () => {
    if (products.length === 0) {
      return <Empty description="暂无产品" />;
    }
    
    // 根据窗口宽度动态计算每行显示的卡片数量
    let cardsPerRow = 5; // 默认值
    
    if (windowWidth >= 1800) {
      cardsPerRow = 5; // 超大屏幕显示5个
    } else if (windowWidth >= 1450 && windowWidth < 1800) {
      cardsPerRow = 4; // 大屏幕显示4个
    } else if (windowWidth >= 1100 && windowWidth < 1450) {
      cardsPerRow = 3; // 中等屏幕显示3个
    } else if (windowWidth >= 750 && windowWidth < 1100) {
      cardsPerRow = 2; // 小屏幕显示2个
    } else {
      cardsPerRow = 1; // 移动设备显示1个
    }
    
    // 计算每个卡片的宽度百分比
    const cardWidthPercent = Math.floor(100 / cardsPerRow);
    
    return (
      <div className={styles.cardContainer}>
        <Row 
          gutter={[24, 32]} // 增加行列间距
          style={{ margin: 0, width: '100%' }}
          wrap
          justify="start"
          align="stretch"
        >
          {products.map(product => {
            const imageAttachment = product.attachments?.find(att => att.file_type === 'IMAGE');
            const imagePath = imageAttachment ? getProductImageUrl(imageAttachment.file_path) : null;
            const materialAttachment = product.attachments?.find(att => att.file_type === 'MATERIAL');
            
            return (
              <Col 
                key={product.id}
                className={styles.productColWrapper}
                xs={24} // 移动设备占满宽度
                sm={24} // 小屏幕占满宽度
                md={cardsPerRow <= 1 ? 24 : 12} // 中等屏幕至少2列
                lg={cardsPerRow <= 2 ? 12 : 8} // 大屏幕至少3列
                xl={cardsPerRow <= 3 ? 8 : 6} // 超大屏幕至少4列
                xxl={cardsPerRow <= 4 ? 6 : 4.8} // 超超大屏幕5列
                style={{
                  minWidth: '350px', // 保证最小宽度为350px
                  flex: `0 0 calc(${100/cardsPerRow}% - 24px)`, // 确保每行显示正确数量的卡片
                  marginBottom: '32px'
                }}
              >
                <Card
                  hoverable
                  className={styles.productCard}
                  cover={
                    <div className={styles.productCardImage} style={{
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      padding: '20px',
                      minHeight: '240px'
                    }}>
                      <Image
                        src={imagePath || PLACEHOLDER_IMAGE_UPDATED}
                        alt={product.name}
                        fallback={PLACEHOLDER_IMAGE_UPDATED}
                        preview={false}
                        onClick={() => imagePath && handlePreview(imagePath, product.name)}
                        style={{ 
                          cursor: imagePath ? 'pointer' : 'default',
                          width: '200px',
                          height: 'auto',
                          maxWidth: '100%'
                        }}
                      />
                    </div>
                  }
                >
                  <Card.Meta
                    title={
                      <Tooltip title={product.name}>
                        <div className={styles.productCardTitle}>{product.name}</div>
                      </Tooltip>
                    }
                    description={
                      <div style={{ padding: '12px 0' }}>
                        <div className={styles.productCardInfo}>
                          <div className={styles.infoItem}>
                            <span className={styles.infoLabel}>品牌:</span>
                            <span className={styles.infoValue}>{product.brand_name || '-'}</span>
                          </div>
                          <div className={styles.infoItem}>
                            <span className={styles.infoLabel}>货号:</span>
                            <span className={styles.infoValue}>{product.product_code || '-'}</span>
                          </div>
                          <div className={styles.infoItem}>
                            <span className={styles.infoLabel}>规格:</span>
                            <span className={styles.infoValue}>{product.specification || '-'}</span>
                          </div>
                          <div className={styles.infoItem}>
                            <span className={styles.infoLabel}>净含量:</span>
                            <span className={styles.infoValue}>{product.net_content || '-'}</span>
                          </div>
                          <div className={styles.infoItem}>
                            <span className={styles.infoLabel}>产品尺寸:</span>
                            <span className={styles.infoValue}>{product.product_size || '-'}</span>
                          </div>
                          <div className={styles.infoItem}>
                            <span className={styles.infoLabel}>装箱方式:</span>
                            <span className={styles.infoValue}>{product.shipping_method || '-'}</span>
                          </div>
                          <div className={styles.infoItem}>
                            <span className={styles.infoLabel}>装箱规格:</span>
                            <span className={styles.infoValue}>{product.shipping_spec || '-'}</span>
                          </div>
                          <div className={styles.infoItem}>
                            <span className={styles.infoLabel}>装箱尺寸:</span>
                            <span className={styles.infoValue}>{product.shipping_size || '-'}</span>
                          </div>
                        </div>
                        
                        {product.price_tiers && product.price_tiers.length > 0 && (
                          <div className={styles.cardPriceTiers}>
                            <Divider orientation="left" plain>
                              <span className={styles.priceTierTitle}>价格档位</span>
                            </Divider>
                            <div className={styles.cardPriceTiersContainer}>
                              <div className={styles.cardPriceTierHeader}>
                                <div className={styles.cardTierQtyHeader}>订购数量</div>
                                <div className={styles.cardTierPriceHeader}>单价</div>
                              </div>
                              {product.price_tiers.map((tier, index) => (
                                <div key={index} className={styles.cardPriceTierRow}>
                                  <div className={styles.cardTierQty}>{`≤${tier.quantity}`}</div>
                                  <div className={styles.cardTierPrice}>{tier.price}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <div className={styles.cardActions}>
                          {product.product_url && (
                            <Button 
                              type="primary" 
                              style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                              icon={<LinkOutlined />} 
                              size="middle"
                              href={product.product_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                            >
                              查看产品链接
                            </Button>
                          )}
                          {materialAttachment && (
                            <Button 
                              type="primary" 
                              icon={<DownloadOutlined />} 
                              size="middle"
                              href={getProductImageUrl(materialAttachment.file_path)} 
                              target="_blank" 
                              rel="noopener noreferrer"
                            >
                              下载产品素材包
                            </Button>
                          )}
                        </div>
                      </div>
                    }
                  />
                </Card>
              </Col>
            );
          })}
        </Row>
      </div>
    );
  };
  
  // 渲染表格视图
  const renderTableView = () => {
    // 加载中状态
    if (loading) {
      return (
        <div className={styles.tableContainer}>
          <div className={styles.loadingContainer}>
            <Spin size="large" tip="加载中..." />
          </div>
        </div>
      );
    }
    
    // 无数据状态
    if (products.length === 0) {
      return (
        <div className={styles.tableContainer}>
          <div className={styles.emptyContainer}>
            <Empty description="暂无产品数据" />
          </div>
        </div>
      );
    }
    
    return (
      <div className={styles.tableContainer}>
        <div className={styles.tableScrollContainer}>
          <div className={styles.tableContent}>
            {/* 表头 */}
            <div className={styles.tableHeader}>
              <div className={styles.gridCol + ' ' + styles.gridColIndex}>序号</div>
              <div className={styles.gridCol + ' ' + styles.gridColImage}>图片</div>
              <div className={styles.gridCol + ' ' + styles.gridColName}>名称</div>
              <div className={styles.gridCol + ' ' + styles.gridColBrand}>品牌</div>
              <div className={styles.gridCol + ' ' + styles.gridColCode}>货号</div>
              <div className={styles.gridCol + ' ' + styles.gridColSpec}>规格</div>
              <div className={styles.gridCol + ' ' + styles.gridColContent}>净含量</div>
              <div className={styles.gridCol + ' ' + styles.gridColSize}>产品尺寸</div>
              <div className={styles.gridCol + ' ' + styles.gridColShipping}>装箱方式</div>
              <div className={styles.gridCol + ' ' + styles.gridColShipSpec}>装箱规格</div>
              <div className={styles.gridCol + ' ' + styles.gridColShipSize}>装箱尺寸</div>
              <div className={styles.gridCol + ' ' + styles.gridColPriceTier}>价格档位</div>
              <div className={styles.gridCol + ' ' + styles.gridColLink}>链接</div>
              <div className={styles.gridCol + ' ' + styles.gridColMaterial}>素材包</div>
            </div>

            {/* 数据行 */}
            <div className={styles.tableBody}>
              {products.map((product, index) => (
                <div key={product.id} className={styles.tableRow}>
                  <div className={styles.gridCol + ' ' + styles.gridColIndex}>
                    {(pagination.current - 1) * pagination.pageSize + index + 1}
                  </div>
                  <div className={styles.gridCol + ' ' + styles.gridColImage}>
                    <div className={styles.productImageCell}>
                      {product.attachments && product.attachments.length > 0 ? (
                        (() => {
                          const imageAttachment = product.attachments.find(att => att.file_type === 'IMAGE');
                          const imagePath = imageAttachment ? getProductImageUrl(imageAttachment.file_path) : null;
                          
                          return (
                            <div className={styles.productImageContainer} onClick={() => imagePath && handlePreview(imagePath, product.name)}>
                              <Image 
                                src={imagePath || PLACEHOLDER_IMAGE_UPDATED} 
                                alt={product.name}
                                fallback={PLACEHOLDER_IMAGE_UPDATED}
                                preview={false}
                                style={{ cursor: imagePath ? 'pointer' : 'default', maxWidth: '80px', maxHeight: '80px' }}
                              />
                              {imagePath && (
                                <div className={styles.imageOverlay}>
                                  <EyeOutlined />
                                </div>
                              )}
                            </div>
                          );
                        })()
                      ) : (
                        <div className={styles.productImagePlaceholder}>暂无图片</div>
                      )}
                    </div>
                  </div>
                  <div className={styles.gridCol + ' ' + styles.gridColName} title={product.name}>
                    {product.name}
                  </div>
                  <div className={styles.gridCol + ' ' + styles.gridColBrand}>
                    {product.brand_name || '-'}
                  </div>
                  <div className={styles.gridCol + ' ' + styles.gridColCode}>
                    {product.product_code || '-'}
                  </div>
                  <div className={styles.gridCol + ' ' + styles.gridColSpec} title={product.specification}>
                    {product.specification || '-'}
                  </div>
                  <div className={styles.gridCol + ' ' + styles.gridColContent}>
                    {product.net_content || '-'}
                  </div>
                  <div className={styles.gridCol + ' ' + styles.gridColSize}>
                    {product.product_size || '-'}
                  </div>
                  <div className={styles.gridCol + ' ' + styles.gridColShipping}>
                    {product.shipping_method || '-'}
                  </div>
                  <div className={styles.gridCol + ' ' + styles.gridColShipSpec}>
                    {product.shipping_spec || '-'}
                  </div>
                  <div className={styles.gridCol + ' ' + styles.gridColShipSize}>
                    {product.shipping_size || '-'}
                  </div>
                  <div className={styles.gridCol + ' ' + styles.gridColPriceTier}>
                    {(() => {
                      const tiers = product.price_tiers;
                      if (!tiers || tiers.length === 0) {
                        return <div className={styles.priceTierEmpty}>暂无价格</div>;
                      }
                      
                      const isSingleRow = tiers.length === 1;
                      
                      return (
                        <div className={styles.priceTiers}>
                          <div className={styles.priceTiersHeader}>
                            <div className={styles.tierQtyHeader}>订购数量</div>
                            <div className={styles.tierPriceHeader}>单价</div>
                          </div>
                          {tiers.map((tier, idx) => (
                            <div 
                              key={idx} 
                              className={styles.priceTier}
                              style={isSingleRow ? { height: '100%', flex: '1' } : {}}
                            >
                              <div 
                                className={styles.tierQty}
                                style={isSingleRow ? { 
                                  height: '100%',
                                  position: 'relative',
                                  borderRight: '1px solid #f0f0f0',
                                } : {}}
                              >{`≤${tier.quantity}`}</div>
                              <div 
                                className={styles.tierPrice}
                                style={isSingleRow ? { height: '100%' } : {}}
                              >{tier.price}</div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                  <div className={styles.gridCol + ' ' + styles.gridColLink}>
                    {product.product_url ? (
                      <Button 
                        type="link" 
                        icon={<LinkOutlined />}
                        size="small"
                        href={product.product_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                      />
                    ) : (
                      <span className={styles.noLink}>无</span>
                    )}
                  </div>
                  <div className={styles.gridCol + ' ' + styles.gridColMaterial}>
                    {(() => {
                      const materialAttachment = product.attachments?.find(att => att.file_type === 'MATERIAL');
                      
                      if (!materialAttachment) {
                        return <span className={styles.noMaterial}>无</span>;
                      }
                      
                      return (
                        <Button 
                          type="link" 
                          icon={<DownloadOutlined />}
                          size="small"
                          href={getProductImageUrl(materialAttachment.file_path)} 
                          target="_blank" 
                          rel="noopener noreferrer"
                        />
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  // 设置页面标题
  useEffect(() => {
    document.title = '帮你品牌货盘';
    
    // 清理函数 - 组件卸载时恢复原标题
    return () => {
      document.title = '帮你品牌货盘管理系统';
    };
  }, []);
  
  // 主渲染
  return (
    <div className={styles.appLayout}>
      {/* 左侧导航栏 */}
      <aside className={`${styles.sider} ${collapsed ? styles.siderNarrow : styles.siderWide}`}>
        <div className={styles.logo}>
          {!collapsed && <span className={styles.logoText}>帮你品牌</span>}
        </div>
        
        <div className={styles.menu}>
          <div className={`${styles.menuItem} ${collapsed ? styles.menuItemNarrow : styles.menuItemWide}`}>
            <span className={styles.menuItemIcon}><HomeOutlined /></span>
            {!collapsed && <span className={styles.menuItemText}>查看货盘</span>}
          </div>
          
          <div className={`${styles.menuItem} ${collapsed ? styles.menuItemNarrow : styles.menuItemWide}`} onClick={showStoreModal}>
            <span className={styles.menuItemIcon}><ShoppingOutlined /></span>
            {!collapsed && <span className={styles.menuItemText}>对接店管家</span>}
          </div>
          
          <div className={`${styles.menuItem} ${collapsed ? styles.menuItemNarrow : styles.menuItemWide}`} onClick={showLogisticsModal}>
            <span className={styles.menuItemIcon}><FileTextOutlined /></span>
            {!collapsed && <span className={styles.menuItemText}>快递物流</span>}
          </div>
          
          {/* 底部菜单项 */}
          <div className={styles.bottomMenuContainer}>
            <div className={`${styles.menuItem} ${collapsed ? styles.menuItemNarrow : styles.menuItemWide}`} onClick={addToFavorites}>
              <span className={styles.menuItemIcon}><StarOutlined /></span>
              {!collapsed && <span className={styles.menuItemText}>加入收藏夹</span>}
            </div>
            
            <div className={`${styles.menuItem} ${collapsed ? styles.menuItemNarrow : styles.menuItemWide}`} onClick={showHelpModal}>
              <span className={styles.menuItemIcon}><QuestionCircleOutlined /></span>
              {!collapsed && <span className={styles.menuItemText}>帮助中心</span>}
            </div>
          </div>
        </div>
      </aside>
      
      {/* 折叠开关按钮 - 移到侧边栏外部作为独立元素 */}
      <button className={styles.collapseButton} onClick={toggleCollapsed}>
        {collapsed ? <RightOutlined /> : <LeftOutlined />}
      </button>
      
      {/* 右侧内容区域 */}
      <main className={`${styles.content} ${collapsed ? styles.contentWhenNarrow : ''}`}>
        <div className={styles.shareViewContainer}>
          <div className={styles.pageHeader}>
            <div className={styles.pageTitle}>
              <img 
                src="/bnlogo.svg" 
                alt="帮你品牌" 
                className={styles.headerLogo} 
                style={{ filter: 'invert(18%) sepia(97%) saturate(2775%) hue-rotate(210deg) brightness(95%) contrast(106%)' }}
              />
            </div>
            
            <div className={styles.headerRightContent}>
              <div className={styles.servicePromise}>
                严苛产品品控 · 极速发货确保时效 · 保证无忧售后 · 为您提供全方位的优质代发服务！
              </div>
              <div className={styles.serviceIcons}>
                <div className={styles.serviceIconItem}>
                  <img src="/gongchang.svg" alt="厂家直供" />
                  <span>厂家直供</span>
                </div>
                <div className={styles.serviceIconItem}>
                  <img src="/pinzhi.svg" alt="质量严控" />
                  <span>质量严控</span>
                </div>
                <div className={styles.serviceIconItem}>
                  <img src="/pinpai.svg" alt="品牌正品" />
                  <span>品牌正品</span>
                </div>
                <div className={styles.serviceIconItem}>
                  <img src="/shouhou.svg" alt="售后保证" />
                  <span>售后保证</span>
                </div>
                <div className={styles.serviceIconItem}>
                  <img src="/jisu.svg" alt="极速发货" />
                  <span>极速发货</span>
                </div>
                <div className={styles.serviceIconItem}>
                  <img src="/daifa.svg" alt="一件代发" />
                  <span>一件代发</span>
                </div>
                <div className={styles.serviceIconItem}>
                  <img src="/dianguanjia.svg" alt="可接管家" />
                  <span>可接管家</span>
                </div>
              </div>
            </div>
          </div>
          
          {loading && !seller ? (
            <div className={styles.loadingContainer}>
              <Spin size="large" tip="加载中..." />
            </div>
          ) : error ? (
            <div className={styles.errorContainer}>
              <Empty
                description={
                  <Space direction="vertical" align="center">
                    <Text type="danger">{error}</Text>
                    <Button type="primary" onClick={() => navigate('/')}>
                      返回首页
                    </Button>
                  </Space>
                }
              />
            </div>
          ) : (
            <>
              {renderSellerInfo()}
              
              <Card className={styles.productsCard}>
                {renderFilters()}
                
                <div className={`${styles.productListContainer} ${viewMode === 'table' ? styles.enableScroll : ''}`}>
                  {viewMode === 'table' ? renderTableView() : renderCardView()}
                </div>
                
                {pagination.total > 0 && (
                  <div className={styles.paginationContainer}>
                    <Pagination
                      current={pagination.current}
                      pageSize={pagination.pageSize}
                      total={pagination.total}
                      onChange={handlePageChange}
                      showSizeChanger
                      showQuickJumper
                      showTotal={total => `共 ${total} 条记录`}
                    />
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      </main>
      
      {/* 隐藏的图片预览容器 */}
      <Image
        style={{ display: 'none' }}
        preview={{
          visible: previewVisible,
          src: previewImage,
          title: previewTitle,
          onVisibleChange: visible => setPreviewVisible(visible)
        }}
      />
      
      {/* 店铺管理模态框 */}
      <Modal
        title="帮你产品一件代发对接店管家流程"
        open={storeModalVisible}
        footer={[
          <Button key="close" onClick={closeStoreModal}>
            关闭
          </Button>
        ]}
        onCancel={closeStoreModal}
        width="auto"
        style={{ maxWidth: '60%', top: '12.5%' }}
        bodyStyle={{ 
          maxHeight: 'calc(75vh - 110px)', 
          overflow: 'auto', 
          padding: '24px',
          overflowX: 'hidden'
        }}
      >
        {staticContentLoading['store-service'] ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <Spin size="large" tip="加载中..." />
          </div>
        ) : (
          <div 
            className={styles.modalContent}
            dangerouslySetInnerHTML={{ 
              __html: staticContents['store-service'] || '暂无内容'
            }}
          />
        )}
      </Modal>
      
      {/* 物流服务模态框 */}
      <Modal
        title="快递物流服务"
        open={logisticsModalVisible}
        footer={[
          <Button key="close" onClick={closeLogisticsModal}>
            关闭
          </Button>
        ]}
        onCancel={closeLogisticsModal}
        width="auto"
        style={{ maxWidth: '60%', top: '12.5%' }}
        bodyStyle={{ 
          maxHeight: 'calc(75vh - 110px)', 
          overflow: 'auto', 
          padding: '24px',
          overflowX: 'hidden'
        }}
      >
        {staticContentLoading['logistics'] ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <Spin size="large" tip="加载中..." />
          </div>
        ) : (
          <div 
            className={styles.modalContent}
            dangerouslySetInnerHTML={{ 
              __html: staticContents['logistics'] || '暂无内容'
            }}
          />
        )}
      </Modal>
      
      {/* 帮助中心模态框 */}
      <Modal
        title="帮助中心"
        open={helpModalVisible}
        footer={[
          <Button key="close" onClick={closeHelpModal}>
            关闭
          </Button>
        ]}
        onCancel={closeHelpModal}
        width="auto"
        style={{ maxWidth: '60%', top: '12.5%' }}
        bodyStyle={{ 
          maxHeight: 'calc(75vh - 110px)', 
          overflow: 'auto', 
          padding: '24px',
          overflowX: 'hidden'
        }}
      >
        {staticContentLoading['help-center'] ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <Spin size="large" tip="加载中..." />
          </div>
        ) : (
          <div 
            className={styles.modalContent}
            dangerouslySetInnerHTML={{ 
              __html: staticContents['help-center'] || '暂无内容'
            }}
          />
        )}
      </Modal>
    </div>
  );
};

export default ShareView; 
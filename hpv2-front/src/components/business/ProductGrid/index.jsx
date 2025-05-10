import React from 'react';
import { Pagination, Spin, Empty, Image, Tooltip, Button, App, Radio } from 'antd';
import { EyeOutlined, EditOutlined, DeleteOutlined, DownloadOutlined, AppstoreOutlined, BarsOutlined } from '@ant-design/icons';
import ProductCard from './ProductCard';
import { getImageUrl } from '@/config/urls';
import './styles.css';

/**
 * 产品网格列表组件 - 使用CSS Grid布局
 * 
 * @param {Object} props
 * @param {Array} props.products - 产品数据源
 * @param {Object} props.pagination - 分页配置
 * @param {Function} props.onTableChange - 分页、排序、筛选变化时的回调
 * @param {boolean} props.loading - 加载状态
 * @param {Function} props.onEdit - 编辑回调
 * @param {Function} props.onDelete - 删除回调
 * @param {Function} props.onImagePreview - 图片预览回调
 * @param {Function} props.onDownloadMaterial - 下载素材包回调
 * @param {Function} props.onMoveToRecycleBin - 移动到回收站回调
 * @param {string} props.viewMode - 视图模式，'table' 或 'card'
 */
const ProductGrid = ({
  products = [],
  pagination = {},
  onTableChange,
  loading = false,
  onEdit,
  onDelete,
  onImagePreview,
  onDownloadMaterial,
  onMoveToRecycleBin,
  viewMode = 'table'
}) => {
  const { message } = App.useApp();
  
  // 默认分页配置
  const defaultPagination = {
    current: 1,
    pageSize: 10,
    total: 0,
    showSizeChanger: true,
    pageSizeOptions: ['10', '20', '50', '100'],
    showQuickJumper: true,
    showTotal: (total) => `共 ${total} 条记录`,
  };

  // 合并分页配置
  const paginationConfig = {
    ...defaultPagination,
    ...pagination,
  };

  // 处理分页变化
  const handlePaginationChange = (page, pageSize) => {
    if (onTableChange) {
      // 这里直接调用父组件传入的onTableChange函数，传递完整的分页参数
      onTableChange(
        { 
          current: page, 
          pageSize: pageSize 
        }, 
        {}, // filters参数，这里不需要
        {} // sorter参数，这里不需要
      );
    }
  };

  // 格式化价格
  const formatPrice = (price) => {
    if (price === undefined || price === null) return '-';
    return `¥${parseFloat(price).toFixed(2)}`;
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
      return getImageUrl(imageAttachment.file_path);
    }
    
    return null;
  };

  // 渲染价格档位
  const renderPriceTiers = (priceTiers) => {
    if (!priceTiers || !Array.isArray(priceTiers) || priceTiers.length === 0) {
      return <div className="price-tier-empty">暂无价格档位</div>;
    }

    // 只有一行时，添加特殊的内联样式处理边框问题
    const isSingleRow = priceTiers.length === 1;
    
    return (
      <div className="price-tiers-container">
        <div className="price-tiers-header">
          <div className="tier-qty-header">订购数量</div>
          <div className="tier-price-header">单价</div>
        </div>
        {priceTiers.map((tier, index) => (
          <div 
            key={tier.id || index} 
            className="price-tier-row"
            style={isSingleRow ? { height: '100%', flex: '1' } : {}}
          >
            <div 
              className="tier-qty"
              style={isSingleRow ? { 
                height: '100%',
                position: 'relative',
                borderRight: '1px solid #f0f0f0',
              } : {}}
            >{`≤${tier.quantity}`}</div>
            <div 
              className="tier-price"
              style={isSingleRow ? { height: '100%' } : {}}
            >{tier.price}</div>
          </div>
        ))}
      </div>
    );
  };

  // 渲染产品图片
  const renderProductImage = (product) => {
    const imageUrl = getProductMainImage(product);
    
    if (!imageUrl) {
      return <div className="product-image-placeholder">暂无图片</div>;
    }
    
    return (
      <div className="product-image-container" onClick={() => onImagePreview(imageUrl, product.name)}>
        <Image
          src={imageUrl}
          alt={product.name}
          preview={false}
          className="product-image"
        />
        <div className="image-overlay">
          <EyeOutlined />
        </div>
      </div>
    );
  };

  // 渲染表格视图
  const renderTableView = () => {
    return (
      <>
        <div className="product-grid-scroll-container">
          {/* 添加内容容器，确保它与内容一样宽 */}
          <div className="product-grid-content">
            {/* 表头 */}
            <div className="product-grid-header">
              <div className="grid-col grid-col-index">序号</div>
              <div className="grid-col grid-col-image">图片</div>
              <div className="grid-col grid-col-name">名称</div>
              <div className="grid-col grid-col-brand">品牌</div>
              <div className="grid-col grid-col-code">货号</div>
              <div className="grid-col grid-col-spec">规格</div>
              <div className="grid-col grid-col-content">净含量</div>
              <div className="grid-col grid-col-size">产品尺寸</div>
              <div className="grid-col grid-col-shipping">装箱方式</div>
              <div className="grid-col grid-col-ship-spec">装箱规格</div>
              <div className="grid-col grid-col-ship-size">装箱尺寸</div>
              <div className="grid-col grid-col-price-tier">价格档位</div>
              <div className="grid-col grid-col-material">素材包</div>
              <div className="grid-col grid-col-url">产品链接</div>
              <div className="grid-col grid-col-edit">编辑</div>
              <div className="grid-col grid-col-recycle">放入回收站</div>
              <div className="grid-col grid-col-delete">删除</div>
            </div>

            {/* 数据行 */}
            <div className="product-grid-body">
              {products.map((product) => (
                <div key={product.id} className="product-grid-row">
                  <div className="grid-col grid-col-index">{product.index}</div>
                  <div className="grid-col grid-col-image">
                    {renderProductImage(product)}
                  </div>
                  <div className="grid-col grid-col-name" title={product.name}>
                    {product.name}
                  </div>
                  <div className="grid-col grid-col-brand">
                    {product.brand_name || '-'}
                  </div>
                  <div className="grid-col grid-col-code">
                    {product.product_code || '-'}
                  </div>
                  <div className="grid-col grid-col-spec" title={product.specification}>
                    {product.specification || '-'}
                  </div>
                  <div className="grid-col grid-col-content">
                    {product.net_content || '-'}
                  </div>
                  <div className="grid-col grid-col-size">
                    {product.product_size || '-'}
                  </div>
                  <div className="grid-col grid-col-shipping">
                    {product.shipping_method || '-'}
                  </div>
                  <div className="grid-col grid-col-ship-spec">
                    {product.shipping_spec || '-'}
                  </div>
                  <div className="grid-col grid-col-ship-size">
                    {product.shipping_size || '-'}
                  </div>
                  <div className="grid-col grid-col-price-tier">
                    {renderPriceTiers(product.price_tiers)}
                  </div>
                  <div className="grid-col grid-col-material">
                    {product.attachments?.some(att => att.file_type === 'MATERIAL') ? (
                      <Button 
                        type="link" 
                        icon={<DownloadOutlined />} 
                        onClick={() => onDownloadMaterial(product)}
                      />
                    ) : (
                      <span className="no-material">暂无</span>
                    )}
                  </div>
                  <div className="grid-col grid-col-url">
                    {product.product_url ? (
                      <Button 
                        type="link" 
                        icon={<EyeOutlined />} 
                        onClick={() => window.open(product.product_url, '_blank')}
                      />
                    ) : (
                      <span className="no-material">暂无</span>
                    )}
                  </div>
                  <div className="grid-col grid-col-edit">
                    <Button 
                      type="link" 
                      icon={<EditOutlined />} 
                      onClick={() => onEdit(product)}
                    />
                  </div>
                  <div className="grid-col grid-col-recycle">
                    <Button 
                      type="link" 
                      danger
                      onClick={() => onMoveToRecycleBin(product.id)}
                    >放入回收站</Button>
                  </div>
                  <div className="grid-col grid-col-delete">
                    <Button 
                      type="link" 
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => onDelete(product.id)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </>
    );
  };

  // 渲染卡片视图
  const renderCardView = () => {
    return (
      <div className="product-card-grid">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onEdit={onEdit}
            onDelete={onDelete}
            onImagePreview={onImagePreview}
            onDownloadMaterial={onDownloadMaterial}
            onMoveToRecycleBin={onMoveToRecycleBin}
          />
        ))}
      </div>
    );
  };

  // 渲染空状态
  if (products.length === 0 && !loading) {
    return (
      <div className="product-grid-empty">
        <Empty description="暂无产品数据" />
      </div>
    );
  }

  return (
    <div className="product-grid-container">
      <Spin spinning={loading} tip="正在加载...">
        {viewMode === 'table' ? renderTableView() : renderCardView()}
      </Spin>

      {/* 分页器 */}
      <div className="product-grid-pagination">
        <Pagination
          current={pagination.current}
          pageSize={pagination.pageSize}
          total={pagination.total}
          pageSizeOptions={['10', '20', '50', '100']}
          showSizeChanger
          showQuickJumper
          showTotal={(total) => `共 ${total} 条记录`}
          onChange={(page, pageSize) => {
            // 明确传递page和pageSize，同时保持created_at降序排序
            console.log('[排序调试] 分页变化，保持created_at降序排序');
            if (onTableChange) {
              onTableChange(
                {
                  current: page,
                  pageSize: pageSize
                }, 
                {}, 
                {
                  field: 'created_at', 
                  order: 'descend'
                }
              );
            }
          }}
          onShowSizeChange={(current, size) => {
            // 确保每页大小变化时，强制使用created_at降序排序并回到第一页
            console.log('[排序调试] 每页条数变化，保持created_at降序排序并回到第一页');
            if (onTableChange) {
              onTableChange(
                {
                  current: 1, // 始终回到第一页
                  pageSize: size
                },
                {},
                {
                  field: 'created_at',
                  order: 'descend'
                }
              );
            }
          }}
        />
      </div>

      {/* 添加调试信息 */}
      {process.env.NODE_ENV === 'development' && products.length > 0 && (
        <div style={{ marginTop: '20px', padding: '10px', background: '#f5f5f5', fontSize: '12px', display: 'none' }}>
          <div><strong>排序调试信息</strong> (按创建时间降序)</div>
          {products.slice(0, 5).map((product, index) => (
            <div key={product.id} style={{ margin: '5px 0' }}>
              {index+1}. ID: {product.id}, 名称: {product.name}, 创建时间: {new Date(product.created_at).toLocaleString()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductGrid; 
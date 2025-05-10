import React from 'react';
import { Card, Tooltip } from 'antd';
import { 
  DownloadOutlined, 
  CopyOutlined, 
  LinkOutlined, 
  PictureOutlined 
} from '@ant-design/icons';
import styles from './styles.module.css';

/**
 * 产品卡片组件
 * @param {Object} props 组件属性
 * @param {Object} props.product 产品数据
 * @param {Function} props.onDownload 下载回调
 * @param {Function} props.onCopy 复制回调
 * @param {Function} props.onPreview 预览回调
 * @param {string} props.actionText 操作按钮文本
 * @returns {JSX.Element}
 */
const ProductCard = ({ product, onDownload, onCopy, onPreview, actionText = '复制产品' }) => {
  // 查找产品图片
  const imageAttachment = product.attachments?.find(
    att => att.file_type === 'IMAGE'
  );
  const imageUrl = imageAttachment?.file_path;
  
  // 检查是否有素材包
  const hasMaterials = product.attachments?.some(att => att.file_type === 'MATERIAL');
  
  // 渲染价格档位
  const renderPriceTiers = () => {
    if (!product.price_tiers || !Array.isArray(product.price_tiers) || product.price_tiers.length === 0) {
      return <div className={styles.priceTierEmpty}>暂无价格档位</div>;
    }

    // 限制价格档位最多显示4个，超过的不显示
    const displayTiers = product.price_tiers.slice(0, 4);

    return (
      <div className={styles.priceTiersContainer}>
        <div className={styles.priceTierTitle}>产品订购价格</div>
        <div className={styles.priceTiersHeader}>
          <span className={styles.tierQtyHeader}>订购数量</span>
          <span className={styles.tierPriceHeader}>单价</span>
        </div>
        {displayTiers.map((tier, index) => (
          <div key={tier.id || index} className={styles.priceTierRow}>
            <span className={styles.tierQty}>{`≤${tier.quantity}`}</span>
            <span className={styles.tierPrice}>{tier.price}</span>
          </div>
        ))}
      </div>
    );
  };

  // 图片容器样式
  const imageContainerStyle = {
    height: '200px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
    width: '100%',
    padding: '10px',
    boxSizing: 'border-box'
  };

  // 图片样式
  const imageStyle = {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
    cursor: 'pointer',
    display: 'block',
    margin: '0 auto'
  };
  
  return (
    <Card
      hoverable
      cover={
        imageUrl ? (
          <div style={imageContainerStyle}>
            <img
              alt={product.name}
              src={imageUrl}
              style={imageStyle}
              onClick={() => onPreview && onPreview(imageUrl, product.name)}
            />
          </div>
        ) : (
          <div className={styles.noImagePlaceholder}>
            <PictureOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
          </div>
        )
      }
      className={styles.productCard}
      bodyStyle={{ padding: '12px', flex: 1, display: 'flex', flexDirection: 'column' }}
      actions={[
        hasMaterials && (
          <Tooltip title="下载素材包" key="download">
            <DownloadOutlined onClick={() => onDownload(product)} />
          </Tooltip>
        ),
        product.product_url && (
          <Tooltip title="访问产品链接" key="link">
            <a
              href={product.product_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
            >
              <LinkOutlined />
            </a>
          </Tooltip>
        ),
        <Tooltip title={actionText} key="copy">
          <CopyOutlined onClick={() => onCopy(product)} />
        </Tooltip>
      ].filter(Boolean)}
    >
      <Card.Meta
        title={product.name}
        className={styles.cardMeta}
        description={
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
            <div className={styles.cardPriceTiers}>
              {renderPriceTiers()}
            </div>
          </div>
        }
      />
    </Card>
  );
};

export default ProductCard; 
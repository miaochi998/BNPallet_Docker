import React, { useState, useRef, useEffect } from 'react';
import { Card, Tag, Space, Button, Switch, Tooltip } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { getCacheVersion } from '../../api/brand';
import { getImageUrl } from '../../config/urls';
import styles from './BrandCard.module.css';

const BrandCard = ({ brand, onEdit, onDelete, onStatusChange }) => {
  const [imageError, setImageError] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(0);
  
  // 监听brand变化，重新渲染图片
  useEffect(() => {
    setForceUpdate(Date.now());
    setImageError(false);
  }, [brand.logo_url, brand.updated_at]);
  
  // 生成图片URL的函数
  const getBrandImageUrl = () => {
    if (!brand?.logo_url) {
      return null;
    }
    
    // 添加缓存破坏参数
    const cacheVer = getCacheVersion();
    const timestamp = forceUpdate;
    const params = `?_v=${cacheVer}&_t=${timestamp}`;
    
    // 使用集中配置的URL生成函数
    return getImageUrl(brand.logo_url, params);
  };

  // 判断品牌是否激活
  const isActive = brand?.status === 'ACTIVE';
  
  // 手动强制刷新图片
  const forceReloadImage = (e) => {
    if (e) e.stopPropagation();
    setForceUpdate(Date.now());
    setImageError(false);
  };

  // 编辑品牌
  const handleEdit = () => {
    onEdit(brand);
  };

  // 删除品牌
  const handleDelete = () => {
    onDelete(brand);
  };

  // 处理状态切换
  const handleStatusChange = () => {
    const newStatus = isActive ? 'INACTIVE' : 'ACTIVE';
    onStatusChange(brand, newStatus);
  };

  // 渲染品牌logo
  const renderLogo = () => {
    // 获取图片URL，如果为空则显示错误占位符
    const imageUrl = getBrandImageUrl();
    
    if (!imageUrl || imageError) {
      return (
        <div className={styles.placeholderLogo}>
          <div className={styles.errorIcon}>
            <ReloadOutlined 
              onClick={forceReloadImage} 
              style={{ fontSize: '24px', color: '#999' }}
            />
          </div>
          <div className={styles.errorText}>加载失败</div>
        </div>
      );
    }

    return (
      <div className={styles.imageWrapper}>
        <img
          src={imageUrl}
          alt={brand.name}
          className={styles.brandLogo}
          onError={() => setImageError(true)}
        />
      </div>
    );
  };

  if (!brand) return null;

  return (
    <Card className={styles.brandCard}>
      <div className={styles.logoContainer}>{renderLogo()}</div>
      <div className={styles.brandName}>{brand.name}</div>
      
      <div className={styles.statusContainer}>
        <Tag color={isActive ? "success" : "error"} icon={isActive ? <CheckCircleOutlined /> : <CloseCircleOutlined />}>
          {isActive ? '已启用' : '已禁用'}
        </Tag>
        <Switch
          checked={isActive}
          onChange={handleStatusChange}
          size="small"
        />
      </div>
      
      <div className={styles.actions}>
        <Space size={4}>
          <Tooltip title="编辑">
            <Button 
              type="text" 
              icon={<EditOutlined />} 
              onClick={handleEdit}
              size="small"
            />
          </Tooltip>
          <Tooltip title="删除">
            <Button 
              type="text" 
              danger
              icon={<DeleteOutlined />} 
              onClick={handleDelete}
              size="small"
            />
          </Tooltip>
        </Space>
      </div>
    </Card>
  );
};

export default BrandCard;
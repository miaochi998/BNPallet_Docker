import React from 'react';
import { Card, Avatar, Button } from 'antd';
import { 
  UserOutlined, 
  InboxOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { getImageUrl } from '@/config/urls';
import styles from './styles.module.css';

/**
 * 销售员卡片组件
 * @param {Object} props
 * @param {Object} props.salesperson - 销售员数据
 * @param {Function} props.onSelect - 选择回调
 * @param {boolean} props.selected - 是否选中
 * @returns {JSX.Element}
 */
const SalesPersonCard = ({ salesperson, onSelect, selected }) => {
  // 获取头像完整URL
  const avatarUrl = salesperson.avatar ? getImageUrl(salesperson.avatar) : null;
  
  return (
    <Card
      hoverable
      className={`${styles.salesCard} ${selected ? styles.selected : ''}`}
      onClick={() => onSelect(salesperson)}
    >
      <div className={styles.cardHeader}>
        <Avatar 
          size={48} 
          src={avatarUrl}
          icon={!avatarUrl && <UserOutlined />}
          crossOrigin="anonymous"
        />
        <div className={styles.userInfo}>
          <div className={styles.name}>{salesperson.name}</div>
          <div className={styles.username}>{salesperson.username}</div>
        </div>
      </div>
      
      <div className={styles.cardBody}>
        <div className={styles.company}>
          {salesperson.company || '未设置公司'}
        </div>
        <div className={styles.stats}>
          <span><InboxOutlined /> {typeof salesperson.product_count !== 'undefined' ? salesperson.product_count : '加载中...'} 个产品</span>
        </div>
      </div>
      
      <Button 
        type="primary" 
        className={styles.viewButton}
      >
        查看{salesperson.name}的货盘
      </Button>
    </Card>
  );
};

export default SalesPersonCard; 
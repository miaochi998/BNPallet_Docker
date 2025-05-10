import React from 'react';
import { Typography, App, Card, Empty } from 'antd';
import { useSelector } from 'react-redux';
import PalletView from '@/components/business/PalletView';
import styles from './ViewCompanyPallets.module.css';

const { Title } = Typography;

const ViewCompanyPallets = () => {
  const { message } = App.useApp();
  const { user, isAuthenticated } = useSelector(state => state.auth);
  
  // 确保普通用户可以访问
  if (!isAuthenticated) {
    return (
      <Card>
        <Empty 
          description="请登录后访问此页面" 
          image={Empty.PRESENTED_IMAGE_SIMPLE} 
        />
      </Card>
    );
  }
  
  // 管理员不应该在这个视图操作，应该引导他们去管理货盘
  if (user.is_admin) {
    return (
      <Card>
        <Empty 
          description="管理员请使用货盘管理功能" 
          image={Empty.PRESENTED_IMAGE_SIMPLE} 
        />
      </Card>
    );
  }
  
  // 处理产品复制成功
  const handleCopySuccess = () => {
    message.success('产品已成功复制到个人货盘');
  };
  
  return (
    <div className={styles.container}>
      <Title level={2}>查看公司货盘</Title>
      
      <div className={styles.palletContainer}>
        <PalletView 
          ownerType="COMPANY"
          ownerId={null}
          role="seller"
          copyTargetType="SELLER"
          copyTargetId={user.id}
          onCopySuccess={handleCopySuccess}
          emptyText="公司货盘中暂无产品"
          actionText="复制到个人货盘"
        />
      </div>
    </div>
  );
};

export default ViewCompanyPallets; 
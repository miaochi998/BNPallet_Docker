import React, { useState, useEffect, useCallback } from 'react';
import { Typography, App, Card, Empty } from 'antd';
import { useSelector } from 'react-redux';
import SalesPersonList from '@/components/business/SalesPersonList';
import PalletView from '@/components/business/PalletView';
import request from '@/utils/request';
import styles from './ViewSalesPallets.module.css';

const { Title } = Typography;

/**
 * 获取销售员列表
 * @param {Object} params - 查询参数
 * @returns {Promise<Object>} - 销售员列表
 */
const getSalespeople = async (params = {}) => {
  return request({
    url: '/api/auth/users',
    method: 'GET',
    params: { 
      is_admin: false,
      status: 'ACTIVE',
      ...params 
    }
  });
};

const ViewSalesPallets = () => {
  const { message } = App.useApp();
  const { user, isAuthenticated } = useSelector(state => state.auth);
  
  // 确保只有管理员可以访问
  if (!isAuthenticated || !user.is_admin) {
    return (
      <Card>
        <Empty 
          description="您没有权限访问此页面" 
          image={Empty.PRESENTED_IMAGE_SIMPLE} 
        />
      </Card>
    );
  }

  // 销售员相关状态
  const [salesList, setSalesList] = useState([]);
  const [salesLoading, setSalesLoading] = useState(false);
  const [currentSalesperson, setCurrentSalesperson] = useState(null);
  
  // 获取销售员列表
  const fetchSalespeople = useCallback(async () => {
    setSalesLoading(true);
    try {
      const response = await getSalespeople({ page: 1, page_size: 50 });
      if (response?.code === 200 && Array.isArray(response.data?.users)) {
        console.log("获取到销售员列表:", response.data.users);
        
        // 初始加载时显示销售员，但不包含产品数量
        const usersList = response.data.users.map(person => ({
          ...person,
          // 明确设置为undefined，让卡片显示"加载中..."
          product_count: undefined
        }));
        setSalesList(usersList);
        
        // 优化：使用Promise.all同时获取所有销售员的产品数量
        try {
          // 创建所有销售员产品数量查询的Promise数组
          const countPromises = usersList.map(async (person) => {
            try {
              const requestParams = {
                module: 'products',
                owner_type: 'SELLER',
                owner_id: person.id,
                page: 1,
                page_size: 10  // 符合后端API要求（必须在10到100之间）
              };
              console.log(`发送查询请求，用户ID:${person.id}，参数:`, requestParams);
              
              const countResponse = await request({
                url: '/api/common/pagination/query',
                method: 'GET',
                params: requestParams
              });
              
              const productCount = countResponse?.data?.pagination?.total || 0;
              console.log(`用户 [${person.id}] ${person.name || person.username} 产品数量: ${productCount}`);
              
              // 返回用户ID和产品数量
              return { id: person.id, count: productCount };
            } catch (error) {
              console.error(`获取销售员 ${person.id} 的产品数量失败:`, error);
              // 失败时返回0
              return { id: person.id, count: 0 };
            }
          });
          
          // 等待所有产品数量查询完成
          const countResults = await Promise.all(countPromises);
          
          // 一次性更新所有销售员的产品数量
          setSalesList(currentList => {
            return currentList.map(item => {
              // 查找对应的产品数量结果
              const result = countResults.find(r => r.id === item.id);
              if (result) {
                return { ...item, product_count: result.count };
              }
              return item;
            });
          });
        } catch (error) {
          console.error('获取销售员产品数量失败:', error);
          message.error('获取销售员产品数量失败');
        }
      } else {
        console.error('API响应异常:', response);
        message.error('获取销售员列表失败');
      }
    } catch (error) {
      console.error('获取销售员列表失败:', error);
      message.error('获取销售员列表失败');
    } finally {
      setSalesLoading(false);
    }
  }, [message]);
  
  // 初始化加载
  useEffect(() => {
    fetchSalespeople();
  }, [fetchSalespeople]);
  
  // 处理销售员选择
  const handleSelectSalesperson = (salesperson) => {
    setCurrentSalesperson(salesperson);
  };
  
  // 处理产品复制成功
  const handleCopySuccess = () => {
    message.success('产品已成功复制到公司总货盘');
  };
  
  return (
    <div className={styles.container}>
      <Title level={2}>查看销售货盘</Title>
      
      {/* 销售员列表 */}
      <SalesPersonList 
        salesList={salesList}
        loading={salesLoading}
        onSelectSalesperson={handleSelectSalesperson}
        currentSalesperson={currentSalesperson}
      />
      
      {/* 产品列表 */}
      {currentSalesperson ? (
        <div className={styles.productListContainer}>
          <Title level={4} style={{ marginTop: 0, marginBottom: 16 }}>
            {currentSalesperson.name}的货盘
          </Title>
          <PalletView 
            ownerType="SELLER"
            ownerId={currentSalesperson.id}
            role="admin"
            copyTargetType="COMPANY"
            copyTargetId={null}
            onCopySuccess={handleCopySuccess}
            emptyText={`${currentSalesperson.name}的货盘中暂无产品`}
            actionText="复制到公司总货盘"
          />
        </div>
      ) : (
        <div className={styles.emptySelection}>
          <Empty description="请选择一个销售员查看货盘" />
        </div>
      )}
    </div>
  );
};

export default ViewSalesPallets; 
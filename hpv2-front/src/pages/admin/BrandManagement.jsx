import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Typography, Button, Space, Radio, Modal, App } from 'antd';
import { PlusOutlined, ReloadOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import BrandGrid from '@/components/brand/BrandGrid';
import AddBrandModal from '@/components/brand/AddBrandModal';
import EditBrandModal from '@/components/brand/EditBrandModal';
import DeleteBrandModal from '@/components/brand/DeleteBrandModal';
import DataTable from '@/components/common/DataTable';
import { 
  fetchBrands, 
  removeBrand, 
  toggleBrandStatusAction,
  setFilter,
  setPagination,
  setCurrentBrand,
  clearCurrentBrand
} from '@/store/slices/brandsSlice';
import { updateCacheVersion } from '@/api/brand';
import styles from './BrandManagement.module.css';

const { Title, Text } = Typography;

/**
 * 品牌管理页面
 */
const BrandManagement = () => {
  const dispatch = useDispatch();
  const { modal, message } = App.useApp(); // 使用App.useApp获取模态框和消息实例
  
  // 从Redux获取状态
  const { 
    list,
    loading,
    pagination,
    filter,
    currentBrand 
  } = useSelector(state => state.brands);
  
  // 本地状态管理弹窗显示
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  
  // 初始加载品牌列表
  useEffect(() => {
    console.log('[BRAND MANAGEMENT] 开始加载品牌列表', { 
      pagination: {
        current: pagination.current,
        pageSize: pagination.pageSize
      }, 
      filter 
    });
    
    const params = {
      page: pagination.current,
      page_size: pagination.pageSize,
      ...filter,
      // 确保无论是否有筛选都按修改时间降序排列
      sort_by: 'updated_at',
      sort_order: 'desc'
    };
    
    dispatch(fetchBrands(params))
      .unwrap()
      .then(response => {
        console.log('[BRAND MANAGEMENT] 品牌列表加载成功', { 
          count: response.data.list?.length || 0,
          total: response.data.pagination?.total || 0,
          brands: response.data.list?.map(brand => ({
            id: brand.id,
            name: brand.name,
            status: brand.status,
            logo_url: brand.logo_url
          }))
        });
      })
      .catch(error => {
        console.error('[BRAND MANAGEMENT] 品牌列表加载失败', { error });
        message.error('加载品牌列表失败');
      });
  }, [dispatch, filter, pagination.current, pagination.pageSize]);
  
  // 处理状态筛选变化
  const handleStatusFilterChange = (e) => {
    dispatch(setFilter({ status: e.target.value }));
  };
  
  // 处理分页变化
  const handleTableChange = (newPagination, filters, sorter) => {
    console.log('[BRAND MANAGEMENT] 表格变化', { 
      newPagination, 
      currentPagination: pagination 
    });
    
    // 检查是否是分页大小改变
    const isPageSizeChanged = newPagination.pageSize !== pagination.pageSize;
    
    // 如果分页大小发生变化，总是将当前页设为1
    const newCurrentPage = isPageSizeChanged ? 1 : newPagination.current;
    
    // 更新Redux中的分页信息
    dispatch(setPagination({ 
      current: newCurrentPage, 
      pageSize: newPagination.pageSize 
    }));
    
    // 构建查询参数
    const params = {
      page: newCurrentPage,
      page_size: newPagination.pageSize,
      ...filter
    };
    
    // 添加排序参数
    if (sorter && sorter.field) {
      params.sort_by = sorter.field;
      params.sort_order = sorter.order === 'ascend' ? 'asc' : 'desc';
      
      console.log('[BRAND MANAGEMENT] 排序变化', {
        field: sorter.field,
        order: sorter.order
      });
    } else {
      // 默认排序
      params.sort_by = 'updated_at';
      params.sort_order = 'desc';
    }
    
    console.log('[BRAND MANAGEMENT] 获取数据参数:', params);
    
    // 获取数据
    dispatch(fetchBrands(params));
  };
  
  // 处理添加品牌
  const handleAddBrand = () => {
    setAddModalVisible(true);
  };
  
  // 处理编辑品牌
  const handleEditBrand = (brand) => {
    dispatch(setCurrentBrand(brand));
    setEditModalVisible(true);
  };
  
  // 处理删除品牌
  const handleDeleteBrand = (brand) => {
    dispatch(setCurrentBrand(brand));
    setDeleteModalVisible(true);
  };
  
  // 处理删除确认
  const handleDeleteConfirm = (id) => {
    dispatch(removeBrand(id))
      .unwrap()
      .then(() => {
        message.success('品牌删除成功');
        setDeleteModalVisible(false);
        dispatch(clearCurrentBrand());
      })
      .catch((error) => {
        console.error('[BrandManagement] 删除品牌失败:', error);
        // 如果是由于有关联产品导致的删除失败，显示特定的提示信息
        if (error && error.hasProducts) {
          modal.warning({
            title: '无法删除品牌',
            content: error.message || '该品牌下有关联产品，请先移除所有关联产品后再删除。',
            icon: <ExclamationCircleOutlined />,
            okText: '我知道了'
          });
        } else {
          message.error('删除品牌失败');
        }
        setDeleteModalVisible(false);
        dispatch(clearCurrentBrand());
      });
  };
  
  // 处理品牌状态变更 - 已更新为适配字符串类型的状态值
  const handleStatusChange = (brand, newStatus) => {
    dispatch(toggleBrandStatusAction({ id: brand.id, status: newStatus }))
      .unwrap()
      .then(() => {
        message.success('品牌状态更新成功');
      })
      .catch(() => {
        message.error('变更品牌状态失败');
      });
  };
  
  // 关闭弹窗时清理当前品牌
  const handleCloseModals = () => {
    setAddModalVisible(false);
    setEditModalVisible(false);
    setDeleteModalVisible(false);
    dispatch(clearCurrentBrand());
  };
  
  // 强制刷新品牌列表
  const handleRefreshList = () => {
    console.log('[BRAND MANAGEMENT] 强制刷新品牌列表');
    
    // 更新缓存版本号
    updateCacheVersion();
    
    // 添加随机时间戳作为缓存破坏参数
    const refreshParams = {
      page: pagination.current,
      page_size: pagination.pageSize,
      ...filter,
      // 添加排序参数，按最后修改时间降序排列
      sort_by: 'updated_at',
      sort_order: 'desc',
      _t: Date.now()
    };
    
    // 重新获取品牌列表数据
    dispatch(fetchBrands(refreshParams));
  };
  
  // 编辑、添加、删除品牌后的成功回调
  const handleOperationSuccess = (result) => {
    console.log('[BRAND MANAGEMENT] 操作成功，刷新数据', result);
    
    // 更新缓存版本
    const newCacheVersion = updateCacheVersion();
    
    // 如果是更新了Logo，进行特殊处理
    if (result && result.logoUpdated) {
      console.log('[BRAND MANAGEMENT] 检测到Logo已更新，强制刷新显示', {
        brandId: result.brandId,
        cacheVersion: newCacheVersion || result.cacheVersion,
        timestamp: Date.now()
      });
      
      // 添加最强缓存破坏参数，确保获取最新数据
      const refreshParams = {
        page: pagination.current,
        page_size: pagination.pageSize,
        ...filter,
        sort_by: 'updated_at',
        sort_order: 'desc',
        _t: Date.now(),
        _v: newCacheVersion,
        _force: true,
        _r: Math.random().toString(36).substring(2, 10)
      };
      
      // 先清除Redux缓存，然后重新获取品牌列表数据
      dispatch(clearCurrentBrand());
      
      // 立即刷新列表
      dispatch(fetchBrands(refreshParams))
        .unwrap()
        .then(() => {
          console.log('[BRAND MANAGEMENT] 品牌列表刷新成功');
          // 关闭所有弹窗
          handleCloseModals();
        })
        .catch(error => {
          console.error('[BRAND MANAGEMENT] 品牌列表刷新失败', error);
          message.error('刷新品牌列表失败');
          // 关闭所有弹窗
          handleCloseModals();
        });
    } else {
      // 普通刷新列表
      const refreshParams = {
        page: pagination.current,
        page_size: pagination.pageSize,
        ...filter,
        sort_by: 'updated_at',
        sort_order: 'desc',
        _t: Date.now()
      };
      
      console.log('[BRAND MANAGEMENT] 使用当前分页参数刷新列表', refreshParams);
      
      // 使用明确的参数调用刷新
      dispatch(fetchBrands(refreshParams))
        .unwrap()
        .then(() => {
          // 关闭所有弹窗
          handleCloseModals();
        })
        .catch(error => {
          console.error('[BRAND MANAGEMENT] 刷新失败', error);
          // 关闭所有弹窗
          handleCloseModals();
        });
    }
  };
  
  return (
    <div className={styles.brandManagement}>
      {/* 页面标题与操作区 */}
      <div className={styles.pageHeader}>
        <div>
          <Title level={2}>品牌管理</Title>
          <Text type="secondary">管理系统中的所有品牌</Text>
        </div>
        
        <div className={styles.actions}>
          <Radio.Group 
            value={filter.status} 
            onChange={handleStatusFilterChange}
            buttonStyle="solid"
            className={styles.filterGroup}
          >
            <Radio.Button value={null}>全部</Radio.Button>
            <Radio.Button value="ACTIVE">已启用</Radio.Button>
            <Radio.Button value="INACTIVE">已禁用</Radio.Button>
          </Radio.Group>
          
          <Button
            icon={<ReloadOutlined />}
            onClick={handleRefreshList}
            className={styles.refreshButton}
          >
            刷新
          </Button>
          
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={handleAddBrand}
            className={styles.addButton}
          >
            添加品牌
          </Button>
        </div>
      </div>
      
      {/* 主内容区 */}
      <div className={styles.content}>
        <BrandGrid 
          brands={list}
          loading={loading}
          onAddBrand={handleAddBrand}
          onEditBrand={handleEditBrand}
          onDeleteBrand={handleDeleteBrand}
          onStatusChange={handleStatusChange}
        />
        
        {/* 分页控制 - 只显示分页，不显示表格 */}
        <div style={{ 
          marginTop: '24px', 
          minHeight: '70px', 
          position: 'relative',
          overflow: 'visible'
        }}>
          <DataTable
            showPagination={true}
            showTable={false} // 不显示表格部分
            dataSource={list}
            columns={[]}
            loading={loading}
            pagination={{
              current: pagination?.current || 1,
              pageSize: pagination?.pageSize || 10,
              total: pagination?.total || 0, // 使用后端返回的总数
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50', '100'], // 设置页大小选项
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 条记录`,
              style: { overflow: 'visible' }
            }}
            onChange={handleTableChange}
          />
        </div>
      </div>
      
      {/* 添加品牌弹窗 */}
      <AddBrandModal
        visible={addModalVisible}
        onCancel={handleCloseModals}
        onSuccess={handleOperationSuccess}
      />
      
      {/* 编辑品牌弹窗 */}
      <EditBrandModal
        visible={editModalVisible}
        brandId={currentBrand?.id}
        onCancel={handleCloseModals}
        onSuccess={handleOperationSuccess}
      />
      
      {/* 删除品牌弹窗 */}
      <DeleteBrandModal
        visible={deleteModalVisible}
        brand={currentBrand}
        onCancel={handleCloseModals}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
};

// 使用App组件包裹BrandManagement，提供全局消息和模态框上下文
const BrandManagementWithApp = () => (
  <App>
    <BrandManagement />
  </App>
);

export default BrandManagementWithApp; 
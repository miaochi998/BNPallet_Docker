import React, { useState, useEffect } from 'react';
import { 
  Table, Button, Space, Input, Select, Modal, 
  Form, Row, Col, Checkbox, message, Card, Switch, Tag, App
} from 'antd';
import { 
  PlusOutlined, SearchOutlined, EditOutlined, 
  DeleteOutlined, ReloadOutlined, ExclamationCircleOutlined, KeyOutlined
} from '@ant-design/icons';
import {
  getAdminUsers,
  createAdminUser,
  updateAdminUser,
  updateAdminUserPassword,
  updateAdminUserStatus,
  deleteAdminUser,
  batchResetAdminPassword
} from '@/api/admin';
import request from '@/utils/request';
import styles from './AdminManagement.module.css';

const { Option } = Select;

const AdminManagement = () => {
  // 使用App组件的message和modal方法
  const { message: messageApi, modal } = App.useApp();
  
  // 状态变量
  const [loading, setLoading] = useState(false);
  const [admins, setAdmins] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [currentAdmin, setCurrentAdmin] = useState(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [addForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [currentUserInfo, setCurrentUserInfo] = useState(null);

  // 获取当前登录用户信息
  useEffect(() => {
    const userInfoStr = localStorage.getItem('userInfo');
    if (userInfoStr) {
      try {
        const userInfo = JSON.parse(userInfoStr);
        setCurrentUserInfo(userInfo);
      } catch (e) {
        console.error('解析用户信息失败', e);
      }
    }
  }, []);

  // 获取管理员列表数据
  const fetchAdmins = async (page = pagination.current, pageSize = pagination.pageSize) => {
    setLoading(true);
    try {
      // 创建查询参数对象
      const params = {
        page,
        pageSize,
        is_admin: true // 固定查询管理员用户
      };
      
      // 添加状态筛选参数 - 确保大写
      if (statusFilter) {
        params.status = statusFilter.toUpperCase(); // 确保使用大写
        console.log('[fetchAdmins] 使用状态筛选:', params.status);
      }
      
      // 如果有搜索关键词，添加到查询参数
      if (search && search.trim()) {
        const searchTerm = search.trim();
        console.log('添加搜索关键词:', searchTerm);
        
        // 将搜索词添加到各个可搜索字段
        // 不再使用前端判断，直接传递给API，由API负责格式化
        params.username = searchTerm;
        params.name = searchTerm;
        params.phone = searchTerm;
        params.email = searchTerm;
      }
      
      console.log('最终请求参数:', params);
      
      // 调用API
      const response = await getAdminUsers(params);
      console.log('后端响应:', response);
      
      // 处理返回数据
      if (response && response.data) {
        // 提取管理员列表
        let adminList = [];
        
        // 兼容处理不同的返回数据格式
        if (Array.isArray(response.data.list)) {
          adminList = response.data.list;
        } else if (Array.isArray(response.data.users)) {
          adminList = response.data.users;
        } else if (Array.isArray(response.data)) {
          adminList = response.data;
        }
        
        // 调试：打印状态分布
        const statusCounts = adminList.reduce((acc, admin) => {
          acc[admin.status] = (acc[admin.status] || 0) + 1;
          return acc;
        }, {});
        console.log('管理员状态分布:', statusCounts);
        
        setAdmins(adminList);
        
        // 设置分页信息
        let total = 0;
        if (response.data.total !== undefined) {
          total = response.data.total;
        } else if (response.data.pagination && response.data.pagination.total !== undefined) {
          total = response.data.pagination.total;
        } else {
          total = adminList.length;
        }
        
        setPagination({
          ...pagination,
          current: page,
          pageSize,
          total
        });
      } else {
        setAdmins([]);
      }
    } catch (error) {
      console.error('获取管理员列表失败:', error);
      messageApi.error('获取管理员列表失败，请重试');
      setAdmins([]);
    } finally {
      setLoading(false);
    }
  };

  // 组件挂载时获取数据
  useEffect(() => {
    fetchAdmins(1, pagination.pageSize);
    
    // 创建管理员管理页面特有样式
    const styleId = 'admin-management-styles';
    if (!document.getElementById(styleId)) {
      const styleEl = document.createElement('style');
      styleEl.id = styleId;
      styleEl.innerHTML = `
        /* 确保管理员管理页面表格样式正常 */
        .ant-table-cell {
          padding: 16px !important;
        }
        .ant-table-thead > tr > th {
          background-color: #fafafa !important;
        }
        .ant-table-tbody > tr > td {
          padding: 16px !important;
        }
      `;
      document.head.appendChild(styleEl);
    }
    
    // 组件卸载时清理样式
    return () => {
      const styleEl = document.getElementById(styleId);
      if (styleEl) {
        document.head.removeChild(styleEl);
      }
    };
  }, []);

  // 搜索条件变化时重新加载数据
  useEffect(() => {
    fetchAdmins(1, pagination.pageSize);
  }, [search, statusFilter]);

  // 表格分页、排序、筛选变化时触发
  const handleTableChange = (newPagination) => {
    fetchAdmins(newPagination.current, newPagination.pageSize);
  };

  // 打开添加管理员弹窗
  const showAddModal = () => {
    addForm.resetFields();
    // 设置默认密码
    addForm.setFieldsValue({
      password: '123456',
      confirm_password: '123456'
    });
    setIsAddModalVisible(true);
  };

  // 提交添加管理员表单
  const handleAddAdmin = async (values) => {
    if (values.password !== values.confirm_password) {
      messageApi.error('两次输入密码不一致');
      return;
    }

    try {
      const userData = {
        username: values.username,
        password: values.password
      };

      await createAdminUser(userData);
      messageApi.success('添加管理员成功');
      setIsAddModalVisible(false);
      addForm.resetFields();
      fetchAdmins();
    } catch (error) {
      console.error('添加管理员失败:', error);
      messageApi.error('添加管理员失败，请重试');
    }
  };

  // 打开编辑管理员弹窗
  const showEditModal = (admin) => {
    setCurrentAdmin(admin);
    
    editForm.setFieldsValue({
      username: admin.username,
      password: '123456',
      confirm_password: '123456'
    });
    
    setIsEditModalVisible(true);
  };

  // 提交编辑管理员表单
  const handleEditAdmin = async (values) => {
    if (!currentAdmin) return;

    try {
      // 不再更新用户名，仅更新密码
      if (values.password && values.password.trim() !== '') {
        await updateAdminUserPassword(currentAdmin.id, values.password);
        messageApi.success('成功更新管理员密码');
      } else {
        messageApi.success('管理员信息未变更');
      }

      setIsEditModalVisible(false);
      fetchAdmins();
    } catch (error) {
      console.error('编辑管理员失败:', error);
      messageApi.error('编辑管理员失败，请重试');
    }
  };

  // 删除管理员确认
  const showDeleteConfirm = (admin) => {
    modal.confirm({
      title: '确定删除该管理员吗？',
      icon: <ExclamationCircleOutlined />,
      content: '删除后，该管理员将无法登录系统，已关联的数据将保留。',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteAdminUser(admin.id);
          messageApi.success('删除管理员成功');
          fetchAdmins(pagination.current, pagination.pageSize);
        } catch (error) {
          console.error('删除管理员失败:', error);
          messageApi.error('删除管理员失败，请重试');
        }
      }
    });
  };

  // 更改管理员状态
  const handleStatusChange = async (admin, checked) => {
    try {
      const newStatus = checked ? 'ACTIVE' : 'INACTIVE';
      await updateAdminUserStatus(admin.id, newStatus);
      messageApi.success(`管理员已${checked ? '启用' : '禁用'}`);
      fetchAdmins(pagination.current, pagination.pageSize);
    } catch (error) {
      console.error('更新管理员状态失败:', error);
      messageApi.error('更新管理员状态失败，请重试');
    }
  };

  // 搜索管理员功能
  const handleSearch = (value) => {
    setSearch(value);
    setPagination({
      ...pagination,
      current: 1 // 搜索时重置页码
    });
    
    // 搜索请求不需要手动调用，因为search状态变化会触发useEffect
  };

  // 状态筛选
  const handleStatusFilterChange = (value) => {
    console.log("[AdminManagement] 状态筛选值:", value);
    
    // 重要：根据数据库定义设置正确的状态值
    let newStatusFilter;
    if (value === '') {
      // 全部状态
      newStatusFilter = undefined;
    } else if (value === 'ACTIVE' || value === 'INACTIVE') {
      // 已经是正确格式的状态值
      newStatusFilter = value;
    } else {
      // 转换为正确格式
      newStatusFilter = value.toUpperCase();
    }
    
    console.log("[AdminManagement] 设置状态筛选为:", newStatusFilter);
    
    // 更新状态值
    setStatusFilter(newStatusFilter);
    
    // 更新分页信息并重置到第一页
    setPagination({
      ...pagination,
      current: 1
    });
    
    // 关闭下拉菜单
    setStatusDropdownOpen(false);
    
    // 通过useEffect触发重新加载
  };

  // 切换下拉菜单状态
  const toggleStatusDropdown = () => {
    setStatusDropdownOpen(!statusDropdownOpen);
  };

  // 批量重置密码
  const batchResetPassword = () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning('请先选择要重置密码的管理员');
      return;
    }

    modal.confirm({
      title: '批量重置密码',
      icon: <ExclamationCircleOutlined />,
      content: `确定要将所选的 ${selectedRowKeys.length} 个管理员的密码重置为 123456 吗？`,
      okText: '确定重置',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await batchResetAdminPassword(selectedRowKeys);
          messageApi.success('批量重置密码成功');
          setSelectedRowKeys([]);
        } catch (error) {
          console.error('批量重置密码失败:', error);
          messageApi.error('批量重置密码失败，请重试');
        }
      }
    });
  };

  // 表格行选择配置
  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys) => {
      setSelectedRowKeys(newSelectedRowKeys);
    },
    getCheckboxProps: (record) => ({
      disabled: isCurrentUser(record.id) // 当前登录用户不能被选中
    })
  };

  // 判断是否是当前登录的用户（不能删除或禁用自己）
  const isCurrentUser = (adminId) => {
    return currentUserInfo && adminId === currentUserInfo.id;
  };

  // 表格列配置
  const columns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      width: 120
    },
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      width: 120
    },
    {
      title: '手机号码',
      dataIndex: 'phone',
      key: 'phone',
      width: 140
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      width: 160
    },
    {
      title: '店铺',
      dataIndex: 'stores',
      key: 'stores',
      width: 180,
      render: (stores) => {
        if (!stores || !Array.isArray(stores) || stores.length === 0) {
          return '-';
        }
        
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {stores.map(store => (
              <Tag 
                color="blue" 
                key={store.id}
                style={{ cursor: 'pointer', padding: '4px 8px' }}
                onClick={() => {
                  if (store.url) {
                    window.open(store.url, '_blank');
                  }
                }}
              >
                {store.platform}:{store.name}
              </Tag>
            ))}
          </div>
        );
      }
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (text) => text && new Date(text).toLocaleString()
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status, record) => (
        <Switch 
          checked={status === 'ACTIVE'} 
          onChange={(checked) => handleStatusChange(record, checked)}
          checkedChildren="启用" 
          unCheckedChildren="禁用"
          disabled={isCurrentUser(record.id)} // 禁止切换当前登录用户状态
        />
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space>
          <Button 
            type="link" 
            size="small" 
            onClick={() => showEditModal(record)}
            style={{ color: '#1890ff' }}
          >
            编辑
          </Button>
          <Button 
            type="link" 
            size="small" 
            danger 
            onClick={() => showDeleteConfirm(record)}
            disabled={isCurrentUser(record.id)} // 禁止删除当前登录用户
          >
            删除
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div className={styles.container}>
      <Card title="管理员用户管理" bordered={false}>
        {/* 搜索和过滤区 */}
        <div className={styles.toolBar}>
          <Space>
            <Input
              placeholder="搜索用户名、姓名或手机号"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              style={{ width: 250 }}
              prefix={<SearchOutlined />}
              allowClear
              onPressEnter={() => fetchAdmins(1, pagination.pageSize)}
            />
            <div style={{ position: 'relative', display: 'inline-block', marginRight: '8px' }}>
              <Button
                style={{ width: 120 }}
                onClick={toggleStatusDropdown}
              >
                {statusFilter === 'ACTIVE' ? '启用状态' : 
                 statusFilter === 'INACTIVE' ? '禁用状态' : '全部状态'}
              </Button>
              {statusDropdownOpen && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  width: 120,
                  backgroundColor: '#fff',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                  zIndex: 1000,
                  borderRadius: '2px'
                }}>
                  <div 
                    style={{ padding: '8px 12px', cursor: 'pointer', hoverBackgroundColor: '#f5f5f5' }}
                    onClick={() => handleStatusFilterChange('')}
                  >
                    全部状态
                  </div>
                  <div 
                    style={{ padding: '8px 12px', cursor: 'pointer', hoverBackgroundColor: '#f5f5f5' }}
                    onClick={() => handleStatusFilterChange('ACTIVE')}
                  >
                    启用状态
                  </div>
                  <div 
                    style={{ padding: '8px 12px', cursor: 'pointer', hoverBackgroundColor: '#f5f5f5' }}
                    onClick={() => handleStatusFilterChange('INACTIVE')}
                  >
                    禁用状态
                  </div>
                </div>
              )}
            </div>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => fetchAdmins(1, pagination.pageSize)}
            >
              刷新
            </Button>
          </Space>
          <Space>
            <Button
              type="primary"
              ghost
              icon={<KeyOutlined />}
              onClick={batchResetPassword}
              disabled={selectedRowKeys.length === 0}
            >
              批量重置密码
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={showAddModal}
            >
              添加管理员
            </Button>
          </Space>
        </div>

        {/* 管理员表格 */}
        <div className={styles.tableContainer}>
          <Table
            columns={columns}
            dataSource={admins}
            rowKey="id"
            rowSelection={rowSelection}
            pagination={{
              ...pagination,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 条记录`
            }}
            loading={loading}
            onChange={handleTableChange}
            scroll={{ x: 1200 }}
          />
        </div>

        {/* 添加管理员弹窗 */}
        <Modal
          title="添加管理员"
          open={isAddModalVisible}
          onCancel={() => setIsAddModalVisible(false)}
          footer={null}
          width={500}
          destroyOnClose
        >
          <Form
            form={addForm}
            layout="vertical"
            onFinish={handleAddAdmin}
          >
            <Form.Item
              name="username"
              label="用户名"
              rules={[
                { required: true, message: '请输入用户名' },
                { min: 4, message: '用户名至少4个字符' }
              ]}
            >
              <Input placeholder="请输入用户名" />
            </Form.Item>
            <Form.Item
              name="password"
              label="登录密码"
              initialValue="123456"
              rules={[
                { required: true, message: '请设置登录密码' },
                { min: 6, message: '密码至少6个字符' }
              ]}
            >
              <Input.Password placeholder="请设置登录密码，默认123456" />
            </Form.Item>
            <Form.Item
              name="confirm_password"
              label="确认密码"
              initialValue="123456"
              rules={[
                { required: true, message: '请再次输入登录密码' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('两次输入的密码不一致'));
                  },
                }),
              ]}
            >
              <Input.Password placeholder="请再次输入登录密码，默认123456" />
            </Form.Item>

            <Form.Item style={{ marginTop: 24, textAlign: 'right' }}>
              <Space>
                <Button onClick={() => setIsAddModalVisible(false)}>取消</Button>
                <Button type="primary" htmlType="submit">提交</Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>

        {/* 编辑管理员弹窗 */}
        <Modal
          title="编辑管理员"
          open={isEditModalVisible}
          onCancel={() => setIsEditModalVisible(false)}
          footer={null}
          width={500}
          destroyOnClose
        >
          <Form
            form={editForm}
            layout="vertical"
            onFinish={handleEditAdmin}
          >
            <Form.Item
              name="username"
              label="用户名"
              rules={[
                { required: true, message: '请输入用户名' },
                { min: 4, message: '用户名至少4个字符' }
              ]}
            >
              <Input placeholder="请输入用户名" disabled />
            </Form.Item>
            <Form.Item
              name="password"
              label="登录密码"
              initialValue="123456"
              rules={[
                { min: 6, message: '密码至少6个字符' }
              ]}
            >
              <Input.Password placeholder="请设置登录密码，默认123456" />
            </Form.Item>
            <Form.Item
              name="confirm_password"
              label="确认密码"
              initialValue="123456"
              rules={[
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('两次输入的密码不一致'));
                  },
                }),
              ]}
            >
              <Input.Password placeholder="请再次输入登录密码，默认123456" />
            </Form.Item>
            
            <Form.Item style={{ marginTop: 24, textAlign: 'right' }}>
              <Space>
                <Button onClick={() => setIsEditModalVisible(false)}>取消</Button>
                <Button type="primary" htmlType="submit">提交</Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>
      </Card>
    </div>
  );
};

export default AdminManagement; 
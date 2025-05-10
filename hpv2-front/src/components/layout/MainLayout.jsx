import { useEffect, useState } from 'react';
import { Layout, Avatar, Typography, Dropdown, Menu, Spin } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { UserOutlined, LogoutOutlined, DownOutlined } from '@ant-design/icons';
import { getUserInfoAsync, logoutAsync } from '@/store/slices/authSlice';
import { getImageUrl } from '@/config/urls';
import PrivateRoute from '@/components/auth/PrivateRoute';
import Sidebar from './Sidebar';
import styles from './MainLayout.module.css';

const { Header, Content } = Layout;
const { Title } = Typography;

const MainLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { user, loading } = useSelector((state) => state.auth);
  
  // 获取左侧导航状态
  const savedCollapsed = localStorage.getItem('sidebar_collapsed') === 'true';
  const [sidebarCollapsed, setSidebarCollapsed] = useState(savedCollapsed);

  // 监听导航栏折叠状态变化
  useEffect(() => {
    const handleSidebarChange = () => {
      const isCollapsed = localStorage.getItem('sidebar_collapsed') === 'true';
      setSidebarCollapsed(isCollapsed);
    };

    // 添加事件监听器
    window.addEventListener('storage', handleSidebarChange);
    
    // 定时检查状态变化
    const interval = setInterval(() => {
      const isCollapsed = localStorage.getItem('sidebar_collapsed') === 'true';
      if (isCollapsed !== sidebarCollapsed) {
        setSidebarCollapsed(isCollapsed);
      }
    }, 200); // 每200毫秒检查一次

    return () => {
      window.removeEventListener('storage', handleSidebarChange);
      clearInterval(interval);
    };
  }, [sidebarCollapsed]);

  // 获取用户信息
  useEffect(() => {
    if (!user) {
      console.log('[MainLayout] 用户信息未加载，尝试获取');
      dispatch(getUserInfoAsync())
        .unwrap()
        .then(userData => {
          console.log('[MainLayout] 成功获取到用户信息:', {
            id: userData.id,
            name: userData.name,
            is_admin: userData.is_admin
          });
        })
        .catch(error => {
          console.error('[MainLayout] 获取用户信息失败:', error);
        });
    } else {
      console.log('[MainLayout] 用户信息已加载', {
        id: user.id,
        name: user.name,
        is_admin: user.is_admin
      });
    }
  }, [dispatch, user]);

  // 处理登出
  const handleLogout = () => {
    dispatch(logoutAsync()).then(() => {
      navigate('/login');
    });
  };

  // 处理个人资料跳转
  const handleProfileClick = () => {
    if (!user) return;
    
    // 使用通用路径，不区分角色
    const profilePath = `/protected/profile`;
    
    navigate(profilePath);
    console.log(`[MainLayout] 导航到个人资料页面: ${profilePath}`);
  };

  // 获取用户头像URL
  const getAvatarUrl = () => {
    if (!user || !user.avatar) return null;
    
    try {
      // 避免头像缓存，添加时间戳
      return getImageUrl(user.avatar, `?t=${Date.now()}`);
    } catch (error) {
      console.error('[MainLayout] 获取头像URL失败:', error);
      return null;
    }
  };

  // 创建Dropdown菜单项
  const items = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人资料',
      onClick: handleProfileClick
    },
    {
      type: 'divider'
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout
    }
  ];

  // 如果正在加载，显示加载中
  if (loading && !user) {
    console.log('MainLayout: 显示加载中状态');
    return (
      <div className={styles.loadingContainer}>
        <Spin>
          <div style={{ padding: '50px', textAlign: 'center' }}>加载中...</div>
        </Spin>
      </div>
    );
  }

  console.log('MainLayout: 正在渲染主布局', { currentPath: location.pathname });

  return (
    <Layout className={styles.mainLayout}>
      {/* 使用新的Sidebar组件 */}
      <Sidebar />
      
      <Layout className={`${styles.rightLayout} ${sidebarCollapsed ? styles.rightLayoutExpanded : ''}`}>
        {/* 头部 */}
        <Header className={styles.header}>
          <div className={styles.headerTitle}>
            <Title level={4} className={styles.pageTitle}>
              帮你品牌货盘管理系统
            </Title>
          </div>
          <div className={styles.headerRight}>
            <Dropdown menu={{ items }} placement="bottomRight" trigger={['click']}>
              <a onClick={(e) => e.preventDefault()} className={styles.userInfo}>
                <Avatar 
                  src={getAvatarUrl()} 
                  icon={!user?.avatar ? <UserOutlined /> : null} 
                  className={styles.avatar} 
                />
                <span className={styles.username}>{user?.name || '用户'}</span>
              </a>
            </Dropdown>
          </div>
        </Header>
        
        {/* 内容区 */}
        <Content className={styles.content}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout; 
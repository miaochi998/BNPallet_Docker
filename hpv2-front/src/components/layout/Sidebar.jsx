import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { Layout, Menu, Avatar, Typography, Tooltip, Button } from 'antd';
import { 
  DashboardOutlined, 
  AppstoreOutlined, 
  UserOutlined, 
  TagOutlined, 
  LogoutOutlined,
  WindowsOutlined,
  DeleteOutlined,
  SettingOutlined,
  LeftOutlined,
  RightOutlined,
  ShareAltOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import { logoutAsync } from '../../store/slices/authSlice';
import { getImageUrl } from '../../config/urls';
import styles from './Sidebar.module.css';

const { Sider } = Layout;
const { Title, Text } = Typography;

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { user } = useSelector(state => state.auth);
  
  // 获取本地存储的导航状态
  const savedCollapsed = localStorage.getItem('sidebar_collapsed') === 'true';
  const [collapsed, setCollapsed] = useState(savedCollapsed);
  
  // 判断当前用户角色
  const isAdmin = user?.is_admin;
  
  // 切换导航展开/收起
  const toggleCollapsed = () => {
    const newCollapsed = !collapsed;
    setCollapsed(newCollapsed);
    localStorage.setItem('sidebar_collapsed', String(newCollapsed));
  };
  
  // 处理登出
  const handleLogout = () => {
    dispatch(logoutAsync()).then(() => {
      navigate('/login');
    });
  };
  
  // 处理个人资料编辑
  const handleProfileEdit = () => {
    navigate('/protected/profile');
  };
  
  // 获取用户头像URL
  const getAvatarUrl = () => {
    if (!user || !user.avatar) return null;
    
    try {
      // 避免头像缓存，添加时间戳
      return getImageUrl(user.avatar, `?t=${Date.now()}`);
    } catch (error) {
      console.error('[Sidebar] 获取头像URL失败:', error);
      return null;
    }
  };
  
  // 菜单点击处理
  const handleMenuClick = ({ key }) => {
    if (key === 'logout') {
      handleLogout();
    } else {
      navigate(key);
    }
  };

  // 构建菜单项
  const getMenuItems = () => {
    // 基础菜单(所有用户都有)
    const baseMenuItems = [
      {
        key: '/protected/dashboard',
        icon: <DashboardOutlined />,
        label: '仪表盘'
      }
    ];
    
    // 管理员菜单
    const adminMenuItems = isAdmin ? [
      {
        key: '/protected/products',
        icon: <AppstoreOutlined />,
        label: '总货盘管理'
      },
      {
        key: '/protected/recyclebin',
        icon: <DeleteOutlined />,
        label: '货盘回收站'
      },
      {
        key: '/protected/admin/sales-pallets',
        icon: <WindowsOutlined />,
        label: '查看销售货盘'
      },
      {
        key: '/protected/admin/brands',
        icon: <TagOutlined />,
        label: '品牌管理'
      },
      {
        key: '/protected/admin/users',
        icon: <UserOutlined />,
        label: '用户管理'
      },
      {
        key: '/protected/admin/admins',
        icon: <SettingOutlined />,
        label: '管理员管理'
      },
      {
        key: '/protected/admin/static-content',
        icon: <FileTextOutlined />,
        label: '静态内容管理'
      },
      {
        key: '/protected/share-history',
        icon: <ShareAltOutlined />,
        label: '分享历史'
      }
    ] : [];
    
    // 销售员菜单
    const sellerMenuItems = !isAdmin ? [
      {
        key: '/protected/products',
        icon: <AppstoreOutlined />,
        label: '货盘管理'
      },
      {
        key: '/protected/recyclebin',
        icon: <DeleteOutlined />,
        label: '货盘回收站'
      },
      {
        key: '/protected/seller/company-pallets',
        icon: <WindowsOutlined />,
        label: '查看公司货盘'
      },
      {
        key: '/protected/share-history',
        icon: <ShareAltOutlined />,
        label: '分享历史'
      }
    ] : [];
    
    // 返回菜单项 - 不再需要单独的公共菜单，已经合并到各自的菜单中
    return [...baseMenuItems, ...adminMenuItems, ...sellerMenuItems];
  };
  
  return (
    <Sider
      width={200}
      collapsible
      collapsed={collapsed}
      trigger={null}
      className={styles.sidebar}
      theme="dark"
    >
      {/* 导航顶部 */}
      <div className={styles.sidebarHeader}>
        <div className={styles.logo}>
          {collapsed ? (
            <span className={styles.collapsedLogo}>帮</span>
          ) : (
            <Title level={4} className={styles.logoTitle}>
              帮你品牌货盘
            </Title>
          )}
        </div>
      </div>
      
      {/* 折叠按钮 */}
      <div className={styles.collapseButton} onClick={toggleCollapsed}>
        {collapsed ? <RightOutlined /> : <LeftOutlined />}
      </div>
      
      {/* 导航菜单 */}
      <div className={styles.sidebarMenu}>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={getMenuItems()}
          onClick={handleMenuClick}
        />
      </div>
      
      {/* 导航底部 */}
      <div className={styles.sidebarFooter}>
        {collapsed ? (
          // 窄导航模式：显示头像和退出按钮
          <div className={styles.footerCollapsed}>
            <Tooltip title="个人资料" placement="right">
              <Avatar 
                src={getAvatarUrl()} 
                icon={!user?.avatar ? <UserOutlined /> : null} 
                size={50} 
                className={styles.avatar}
                onClick={handleProfileEdit}
              />
            </Tooltip>
            <Tooltip title="退出登录" placement="right">
              <Button 
                type="text" 
                icon={<LogoutOutlined style={{ color: 'inherit' }} />} 
                className={styles.logoutBtn}
                onClick={handleLogout}
                style={{ 
                  color: 'rgba(255, 255, 255, 0.65)', 
                  background: 'transparent'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#fff';
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.textDecoration = 'underline';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'rgba(255, 255, 255, 0.65)';
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.textDecoration = 'none';
                }}
              >
                退出登录
              </Button>
            </Tooltip>
          </div>
        ) : (
          // 宽导航模式：显示头像、用户名和退出登录
          <div className={styles.footerExpanded}>
            <div className={styles.userInfoVertical} onClick={handleProfileEdit}>
              <Avatar 
                src={getAvatarUrl()} 
                icon={!user?.avatar ? <UserOutlined /> : null}
                size={50} 
                className={styles.avatarLarge} 
              />
              <Text className={styles.userName}>{user?.name || '用户'}</Text>
            </div>
            <Button 
              type="text" 
              icon={<LogoutOutlined style={{ color: 'inherit' }} />} 
              className={styles.logoutBtn}
              onClick={handleLogout}
              style={{ 
                color: 'rgba(255, 255, 255, 0.65)', 
                background: 'transparent'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#fff';
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.textDecoration = 'underline';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.65)';
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.textDecoration = 'none';
              }}
            >
              退出登录
            </Button>
          </div>
        )}
      </div>
    </Sider>
  );
};

export default Sidebar; 
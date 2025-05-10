import { useEffect, useState } from 'react';
import { Card, Typography, Row, Col, Spin, Button, Avatar, message } from 'antd';
import { useSelector } from 'react-redux';
import { 
  ShoppingOutlined, 
  UserOutlined, 
  AppstoreOutlined, 
  TagOutlined,
  FileTextOutlined,
  ShoppingCartOutlined,
  ProfileOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import styles from './Dashboard.module.css';
import { getDashboardOverview, getDashboardProfile } from '../../api/dashboard';
import { useNavigate } from 'react-router-dom';
import { getApiBaseUrl } from '../../config/urls';

const { Title, Text } = Typography;

// 组装完整的头像URL
const getAvatarUrl = (avatarPath) => {
  if (!avatarPath) return null;
  // 如果已经是完整URL则直接返回
  if (avatarPath.startsWith('http')) return avatarPath;
  // 否则拼接基础URL
  return `${getApiBaseUrl()}${avatarPath}`;
};

// 管理员仪表盘组件
const AdminDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);
  
  // 加载仪表盘数据
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const [overviewRes, profileRes] = await Promise.all([
          getDashboardOverview(),
          getDashboardProfile()
        ]);
        
        setOverview(overviewRes.data);
        setProfile(profileRes.data);
        
        // 调试输出，检查头像信息
        console.log('获取到的个人信息:', profileRes.data);
      } catch (error) {
        console.error('加载仪表盘数据失败', error);
        setError('数据加载失败，请刷新页面重试');
        message.error('仪表盘数据加载失败');
      } finally {
      setLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <Spin>
          <div style={{ padding: '50px', textAlign: 'center' }}>加载中...</div>
        </Spin>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className={styles.errorContainer}>
        <Text type="danger">{error}</Text>
        <Button type="primary" onClick={() => window.location.reload()}>
          刷新页面
        </Button>
      </div>
    );
  }
  
  // 格式化日期
  const formatDate = (dateString) => {
    if (!dateString) return '无数据';
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN');
  };

  // 获取头像完整URL
  const avatarUrl = getAvatarUrl(profile?.avatar);
  console.log('头像URL:', avatarUrl);
  
  return (
    <div className={styles.dashboard}>
      <Row gutter={[24, 24]}>
        {/* 个人信息卡片 */}
        <Col xs={24} lg={12}>
          <Card className={styles.infoCard}>
            <Title level={3}>个人信息</Title>
            <div className={styles.profileContainer}>
              <Avatar 
                size={100} 
                icon={<UserOutlined />} 
                className={styles.avatar} 
                src={avatarUrl}
                crossOrigin="anonymous"
              />
              <div className={styles.userInfo}>
                <div className={styles.infoItem}>
                  <Text strong>管理员：</Text>
                  <Text>{profile?.username || '未获取到用户名'}</Text>
                </div>
                <div className={styles.infoItem}>
                  <Text strong>姓名：</Text>
                  <Text>{profile?.name || '未获取到姓名'}</Text>
                </div>
                <div className={styles.infoItem}>
                  <Text strong>手机：</Text>
                  <Text>{profile?.phone || '未获取到手机号'}</Text>
                </div>
              </div>
            </div>
          </Card>
        </Col>
        
        {/* 货盘信息卡片 */}
        <Col xs={24} lg={12}>
          <Card className={styles.infoCard}>
            <Title level={3}>货盘信息</Title>
            <div className={styles.palletStats}>
              <div className={styles.statsItem}>
                <Text strong>产品总数：</Text>
                <Text>{overview?.product_stats?.total || 0}条</Text>
              </div>
              <div className={styles.statsItem}>
                <Text strong>回收站产品总数：</Text>
                <Text>{overview?.product_stats?.recycled || 0}条</Text>
              </div>
              <div className={styles.statsItem}>
                <Text strong>最后更新时间：</Text>
                <Text>{formatDate(overview?.product_stats?.last_updated)}</Text>
              </div>
            </div>
            <div className={styles.actionButtons}>
              <Button type="primary" icon={<AppstoreOutlined />} onClick={() => navigate('/protected/products')}>
                管理货盘
              </Button>
              <Button type="primary" icon={<ReloadOutlined />} className={styles.secondButton} onClick={() => navigate('/protected/recyclebin')}>
                查看回收站
              </Button>
            </div>
          </Card>
        </Col>
        
        {/* 管理员信息卡片 */}
        <Col xs={24} lg={12}>
          <Card className={styles.infoCard}>
            <Title level={3}>管理员信息</Title>
            <div className={styles.adminStats}>
              <div className={styles.statsItem}>
                <Text strong>管理员总数：</Text>
                <Text>{overview?.admin_stats?.total || 0}条</Text>
              </div>
              <div className={styles.statsItem}>
                <Text strong>启用管理员：</Text>
                <Text>{overview?.admin_stats?.active || 0}条</Text>
              </div>
              <div className={styles.statsItem}>
                <Text strong>停用管理员：</Text>
                <Text>{overview?.admin_stats?.inactive || 0}条</Text>
              </div>
              <div className={styles.statsItem}>
                <Text strong>最后更新时间：</Text>
                <Text>{formatDate(overview?.brand_stats?.last_updated)}</Text>
              </div>
            </div>
            <div className={styles.actionButtons}>
              <Button type="primary" icon={<UserOutlined />} onClick={() => navigate('/protected/admin/admins')}>
                管理管理员
              </Button>
            </div>
          </Card>
        </Col>
      
        {/* 用户信息卡片 */}
        <Col xs={24} lg={12}>
          <Card className={styles.infoCard}>
            <Title level={3}>用户信息</Title>
            <div className={styles.userStats}>
              <div className={styles.statsItem}>
                <Text strong>用户总数：</Text>
                <Text>{overview?.user_stats?.total || 0}条</Text>
              </div>
              <div className={styles.statsItem}>
                <Text strong>启用用户：</Text>
                <Text>{overview?.user_stats?.active || 0}条</Text>
              </div>
              <div className={styles.statsItem}>
                <Text strong>停用用户：</Text>
                <Text>{overview?.user_stats?.inactive || 0}条</Text>
              </div>
              <div className={styles.statsItem}>
                <Text strong>最后更新时间：</Text>
                <Text>{formatDate(overview?.user_stats?.last_updated)}</Text>
              </div>
            </div>
            <div className={styles.actionButtons}>
              <Button type="primary" icon={<UserOutlined />} onClick={() => navigate('/protected/admin/users')}>
                管理用户
              </Button>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

// 销售员仪表盘组件
const SellerDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);
  
  // 加载仪表盘数据
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const [overviewRes, profileRes] = await Promise.all([
          getDashboardOverview(),
          getDashboardProfile()
        ]);
        
        setOverview(overviewRes.data);
        setProfile(profileRes.data);
        
        // 调试输出，检查头像信息
        console.log('获取到的个人信息:', profileRes.data);
      } catch (error) {
        console.error('加载仪表盘数据失败', error);
        setError('数据加载失败，请刷新页面重试');
        message.error('仪表盘数据加载失败');
      } finally {
      setLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <Spin>
          <div style={{ padding: '50px', textAlign: 'center' }}>加载中...</div>
        </Spin>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className={styles.errorContainer}>
        <Text type="danger">{error}</Text>
        <Button type="primary" onClick={() => window.location.reload()}>
          刷新页面
        </Button>
      </div>
    );
  }
  
  // 格式化日期
  const formatDate = (dateString) => {
    if (!dateString) return '无数据';
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN');
  };

  // 获取头像完整URL
  const avatarUrl = getAvatarUrl(profile?.avatar);
  console.log('头像URL:', avatarUrl);
  
  return (
    <div className={styles.dashboard}>
      <Row gutter={[24, 24]}>
        {/* 个人信息卡片 */}
        <Col xs={24} lg={12}>
          <Card className={styles.infoCard}>
            <Title level={3}>个人信息</Title>
            <div className={styles.profileContainer}>
              <Avatar 
                size={100} 
                icon={<UserOutlined />} 
                className={styles.avatar} 
                src={avatarUrl}
                crossOrigin="anonymous"
              />
              <div className={styles.userInfo}>
                <div className={styles.infoItem}>
                  <Text strong>销售员：</Text>
                  <Text>{profile?.username || '未获取到用户名'}</Text>
                </div>
                <div className={styles.infoItem}>
                  <Text strong>姓名：</Text>
                  <Text>{profile?.name || '未获取到姓名'}</Text>
                </div>
                <div className={styles.infoItem}>
                  <Text strong>手机：</Text>
                  <Text>{profile?.phone || '未获取到手机号'}</Text>
                </div>
              </div>
            </div>
          </Card>
        </Col>
        
        {/* 货盘信息卡片 */}
        <Col xs={24} lg={12}>
          <Card className={styles.infoCard}>
            <Title level={3}>货盘信息</Title>
            <div className={styles.palletStats}>
              <div className={styles.statsItem}>
                <Text strong>产品总数：</Text>
                <Text>{overview?.product_stats?.total || 0}条</Text>
              </div>
              <div className={styles.statsItem}>
                <Text strong>回收站产品总数：</Text>
                <Text>{overview?.product_stats?.recycled || 0}条</Text>
              </div>
              <div className={styles.statsItem}>
                <Text strong>最后更新时间：</Text>
                <Text>{formatDate(overview?.product_stats?.last_updated)}</Text>
              </div>
            </div>
            <div className={styles.actionButtons}>
              <Button type="primary" icon={<AppstoreOutlined />} onClick={() => navigate('/protected/products')}>
                管理货盘
              </Button>
              <Button type="primary" icon={<ReloadOutlined />} className={styles.secondButton} onClick={() => navigate('/protected/recyclebin')}>
                查看回收站
              </Button>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

// 主仪表盘组件 - 根据用户角色渲染不同仪表盘
const Dashboard = () => {
  const { user } = useSelector(state => state.auth);
  const [loading, setLoading] = useState(!user);
  
  useEffect(() => {
    // 如果用户数据加载完成，设置loading为false
    if (user) {
      setLoading(false);
    }
  }, [user]);

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <Spin>
          <div style={{ padding: '50px', textAlign: 'center' }}>加载用户信息...</div>
        </Spin>
      </div>
    );
  }
  
  // 根据用户角色决定显示哪个仪表盘
  const isAdmin = user?.is_admin;
  return isAdmin ? <AdminDashboard /> : <SellerDashboard />;
};

export default Dashboard; 
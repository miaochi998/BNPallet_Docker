import React from 'react';
import { Button, Card, Space, Typography, Divider, message } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { debugLogin, logoutAsync } from '@/store/slices/authSlice';

const { Title, Text, Paragraph } = Typography;

const styles = {
  container: {
    padding: '20px',
    maxWidth: '800px',
    margin: '0 auto',
    marginTop: '50px'
  },
  card: {
    marginBottom: '20px'
  },
  buttonGroup: {
    display: 'flex',
    gap: '10px',
    marginTop: '20px'
  },
  infoText: {
    whiteSpace: 'pre-wrap',
    marginTop: '10px'
  }
};

const DebugLogin = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const authState = useSelector(state => state.auth);
  
  const handleDebugLogin = () => {
    dispatch(debugLogin({
      token: 'debug_token_' + Date.now(),
      user_info: {
        id: 9999,
        username: 'debug_user',
        name: '调试用户',
        is_admin: true
      }
    }));
    message.success('调试登录成功');
  };
  
  const handleLogout = () => {
    dispatch(logoutAsync());
    message.success('登出成功');
  };
  
  const goToLoginPage = () => {
    navigate('/login');
  };
  
  const goToDashboard = () => {
    navigate('/dashboard');
  };
  
  return (
    <div style={styles.container}>
      <Card title="登录调试工具" style={styles.card}>
        <Title level={4}>当前登录状态</Title>
        <Paragraph>
          <Text strong>已登录:</Text> {String(authState.isAuthenticated)}
        </Paragraph>
        <Paragraph>
          <Text strong>Token:</Text> {authState.token || '无'}
        </Paragraph>
        <Paragraph>
          <Text strong>用户信息:</Text> 
          <Text style={styles.infoText}>
            {authState.user ? JSON.stringify(authState.user, null, 2) : '无'}
          </Text>
        </Paragraph>
        
        <Divider />
        
        <Title level={4}>操作</Title>
        <Space style={styles.buttonGroup}>
          <Button type="primary" onClick={handleDebugLogin}>调试登录</Button>
          <Button danger onClick={handleLogout}>登出</Button>
          <Button onClick={goToLoginPage}>前往登录页</Button>
          <Button onClick={goToDashboard}>前往仪表盘</Button>
        </Space>
      </Card>
    </div>
  );
};

export default DebugLogin; 
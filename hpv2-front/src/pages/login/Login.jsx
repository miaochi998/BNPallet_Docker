import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, Typography, Spin, Checkbox, Alert, App } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useDispatch } from 'react-redux';
import { clearAuth, debugLogin } from '@/store/slices/authSlice';

const { Title } = Typography;

// 样式定义
const styles = {
  container: {
    width: '100vw',
    height: '100vh',
    background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '20px',
    boxSizing: 'border-box',
    position: 'fixed',
    top: 0,
    left: 0
  },
  cardWrapper: {
    width: '100%',
    maxWidth: '400px'
  },
  card: {
    borderRadius: '8px',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)',
    padding: '24px',
    background: 'white',
    width: '100%'
  },
  header: {
    textAlign: 'center',
    marginBottom: '24px'
  },
  form: {
    width: '100%'
  },
  formItem: {
    marginBottom: '16px'
  },
  button: {
    height: '45px',
    fontSize: '16px',
    width: '100%',
    marginTop: '8px'
  },
  input: {
    height: '45px'
  },
  alert: {
    marginBottom: '16px'
  }
};

// 本地存储键名常量
const REMEMBER_USERNAME_KEY = 'login_remember_username';
const SAVED_USERNAME_KEY = 'login_saved_username';
const TOKEN_KEY = 'auth_token';

// 创建API客户端
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  timeout: 15000,
});

const Login = () => {
  // 获取App上下文
  const { message } = App.useApp();
  
  // 状态定义
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [rememberUsername, setRememberUsername] = useState(
    localStorage.getItem(REMEMBER_USERNAME_KEY) === 'true'
  );
  
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const [form] = Form.useForm();
  
  // 组件挂载时清除登录状态
  useEffect(() => {
    // 清除之前的认证状态
    dispatch(clearAuth());
    
    // 填充记住的用户名
    if (localStorage.getItem(REMEMBER_USERNAME_KEY) === 'true') {
      const savedUsername = localStorage.getItem(SAVED_USERNAME_KEY);
      if (savedUsername) {
        form.setFieldsValue({ username: savedUsername });
      }
    }
  }, [dispatch, form]);

  // 处理记住用户名选项变化
  const handleRememberChange = (e) => {
    const checked = e.target.checked;
    setRememberUsername(checked);
    localStorage.setItem(REMEMBER_USERNAME_KEY, checked);
    
    // 如果取消记住用户名，则清除已保存的用户名
    if (!checked) {
      localStorage.removeItem(SAVED_USERNAME_KEY);
    }
  };

  // 处理登录提交
  const handleSubmit = async (values) => {
    try {
      setLoading(true);
      setErrorMessage(null);
      
      // 如果选择了记住用户名，则保存用户名
      if (rememberUsername && values.username) {
        localStorage.setItem(SAVED_USERNAME_KEY, values.username);
      }
      
      // 清除localStorage中可能存在的旧token
      localStorage.removeItem(TOKEN_KEY);
      
      // 调用登录API
      const loginResponse = await apiClient.post('/api/auth/login', values);
      
      // 检查登录响应
      if (loginResponse.data?.data?.token) {
        // 保存token
        const token = loginResponse.data.data.token;
        localStorage.setItem(TOKEN_KEY, token);
        
        try {
          // 获取用户信息
          const userResponse = await apiClient.get('/api/auth/profile', {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          // 更新Redux状态
          const userData = userResponse.data.data || userResponse.data;
          dispatch(debugLogin({
            token: token,
            user_info: userData
          }));
          
          // 登录成功
          message.success('登录成功');
          
          // 检查是否有保存的重定向路径
          const redirectPath = sessionStorage.getItem('redirect_after_login');
          
          // 延迟跳转以确保用户看到成功消息
          setTimeout(() => {
            // 如果有重定向路径，使用它并清除存储
            if (redirectPath) {
              console.log('[Login] 登录成功，重定向到保存的路径:', redirectPath);
              sessionStorage.removeItem('redirect_after_login');
              navigate(redirectPath);
            } else {
              // 否则使用location.state中的from或默认到dashboard
              const from = location.state?.from || '/protected/dashboard';
              console.log('[Login] 登录成功，重定向到:', from);
              navigate(from);
            }
          }, 500);
        } catch (userInfoError) {
          setErrorMessage('获取用户信息失败，请稍后重试');
          message.error('获取用户信息失败，请稍后重试');
        }
      } else {
        setErrorMessage('登录失败: 服务器响应错误');
        message.error('登录失败: 服务器响应错误');
      }
    } catch (error) {
      console.error('登录请求失败:', error);
      // 详细记录错误响应
      console.log('错误响应详情:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.response?.data?.message,
        errorCode: error.response?.data?.code,
        fullResponse: error.response?.data
      });
      
      // 获取后端返回的错误信息
      let errorMsg = '用户名或密码错误'; // 默认错误信息
      
      // 针对不同状态码处理不同的错误消息
      if (error.response) {
        console.log('原始错误消息:', error.response.data?.message);
        console.log('完整错误响应:', error.response.data);
        
        // 直接检查错误消息中是否包含"停用"
        if (error.response.data?.message && 
            (error.response.data.message.includes('停用') || 
             error.response.data.message.includes('禁用'))) {
          errorMsg = '用户已停用';
          console.log('根据错误消息内容判断为: 用户已停用');
        }
        // 针对状态码403 - 用户已停用
        else if (error.response.status === 403) {
          errorMsg = '用户已停用';
          console.log('收到403错误，设置错误信息为: 用户已停用');
        } 
        // 针对其他错误状态码
        else {
          console.log(`收到${error.response.status}错误，设置默认错误信息: 用户名或密码错误`);
        }
      } else {
        console.log('没有响应状态码，使用默认错误信息: 用户名或密码错误');
      }
      
      setErrorMessage(errorMsg);
      message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.cardWrapper}>
        <div style={styles.card}>
          <div style={styles.header}>
            <Title level={2}>系统登录</Title>
            <Title level={5} type="secondary">欢迎回来，请登录您的账号</Title>
          </div>
          
          {errorMessage && (
            <Alert
              message="登录失败"
              description={errorMessage}
              type="error"
              showIcon
              closable
              style={styles.alert}
              onClose={() => setErrorMessage(null)}
            />
          )}
          
          <Spin spinning={loading} tip="登录中...">
            <Form
              form={form}
              name="login"
              layout="vertical"
              initialValues={{ remember: rememberUsername }}
              onFinish={handleSubmit}
              size="large"
              style={styles.form}
            >
              <Form.Item
                name="username"
                rules={[
                  { required: true, message: '请输入用户名' },
                  { min: 3, message: '用户名长度不能少于3个字符' }
                ]}
                style={styles.formItem}
              >
                <Input 
                  prefix={<UserOutlined />} 
                  placeholder="请输入用户名" 
                  autoComplete="username"
                  style={styles.input}
                />
              </Form.Item>

              <Form.Item
                name="password"
                rules={[
                  { required: true, message: '请输入密码' },
                  { min: 6, message: '密码长度不能少于6个字符' }
                ]}
                style={styles.formItem}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="请输入密码"
                  autoComplete="current-password"
                  style={styles.input}
                />
              </Form.Item>
              
              <Form.Item style={styles.formItem}>
                <Checkbox 
                  checked={rememberUsername} 
                  onChange={handleRememberChange}
                >
                  记住用户名
                </Checkbox>
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  style={styles.button}
                  loading={loading}
                >
                  登录
                </Button>
              </Form.Item>
            </Form>
          </Spin>
        </div>
      </div>
    </div>
  );
};

export default Login; 
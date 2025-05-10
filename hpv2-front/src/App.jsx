import { useEffect, useState } from 'react';
import { RouterProvider } from 'react-router-dom';
import { ConfigProvider, Spin, App as AntdApp } from 'antd';
import zhCN from 'antd/lib/locale/zh_CN';
import { useDispatch, useSelector } from 'react-redux';
import { getUserInfoAsync, clearAuth } from './store/slices/authSlice';
import router from './router';
import './App.css';
import { getToken, resetTokenExpiredTip } from './utils/request';

// 根组件
const App = () => {
  const dispatch = useDispatch();
  const { isAuthenticated, user, loading } = useSelector(state => state.auth);
  const [initializing, setInitializing] = useState(true);
  
  // 应用启动时，初始化认证状态
  useEffect(() => {
    const token = getToken();
    
    // 重置token过期提示标记
    resetTokenExpiredTip();
    
    // 如果有token但没有用户信息，尝试获取用户信息
    if (token && !user) {
      console.log('应用启动: 检测到token，自动获取用户信息');
      dispatch(getUserInfoAsync())
        .unwrap()
        .then(() => {
          console.log('用户信息获取成功');
          setInitializing(false);
        })
        .catch(error => {
          console.error('用户信息获取失败:', error);
          // 获取失败则清除认证状态
          dispatch(clearAuth());
          setInitializing(false);
        });
    } else {
      // 没有token或已有用户信息，不需要初始化
      setInitializing(false);
    }
  }, [dispatch, user]);

  // 在初始化过程中显示加载状态
  if (initializing) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        backgroundColor: '#f0f2f5'
      }}>
        <Spin size="large" tip="正在加载用户信息..." />
      </div>
    );
  }

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#1890ff',
        },
      }}
    >
      <AntdApp>
        <RouterProvider router={router} />
      </AntdApp>
    </ConfigProvider>
  );
};

export default App;

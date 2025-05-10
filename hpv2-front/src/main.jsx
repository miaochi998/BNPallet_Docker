import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './assets/styles/pagination-fix.css';
import App from './App.jsx';
import { Provider } from 'react-redux';
import store from './store';

// 禁用antd兼容性警告
window.REACT_APP_DISABLE_ANTD_WARNINGS = true;

// 开发环境下的错误捕获
if (import.meta.env.DEV) {
  const originalConsoleError = console.error;
  console.error = (...args) => {
    if (args[0]?.includes?.('React does not recognize the') || 
        args[0]?.includes?.('Invalid prop')) {
      return;
    }
    originalConsoleError.apply(console, args);
  };
  
  // 添加全局日志记录函数
  window.logToServer = (message, data) => {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      message,
      data
    };
    console.log(`[DEBUG LOG] ${timestamp}:`, message, data);
    
    // 将日志写入localStorage以便查看
    const logs = JSON.parse(localStorage.getItem('debug_logs') || '[]');
    logs.push(logEntry);
    localStorage.setItem('debug_logs', JSON.stringify(logs.slice(-50))); // 只保留最近50条日志
  };
  
  // 添加全局视图日志的函数
  window.viewLogs = () => {
    const logs = JSON.parse(localStorage.getItem('debug_logs') || '[]');
    console.table(logs);
    return logs;
  };
  
  // 添加清除日志的函数
  window.clearLogs = () => {
    localStorage.removeItem('debug_logs');
    console.log('日志已清除');
  };
}

// 渲染应用
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>,
);

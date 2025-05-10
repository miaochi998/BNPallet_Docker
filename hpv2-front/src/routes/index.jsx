import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { App } from 'antd';
import { useSelector } from 'react-redux';
import Login from '@/pages/Login';
import NotFound from '@/pages/NotFound';
import Layout from '@/components/layout/Layout';
import Dashboard from '@/pages/Dashboard';
import UserManagement from '@/pages/admin/UserManagement';
import AdminManagement from '@/pages/admin/AdminManagement';
import ProductManagement from '../pages/pallet/ProductManagement';
import BrandManagement from '@/pages/pallet/BrandManagement';
import CategoryManagement from '@/pages/pallet/CategoryManagement';
import SalesPalletView from '@/pages/sales/SalesPalletView';
import Profile from '@/pages/user/Profile';
import Unauthorized from '@/pages/Unauthorized';
import AuthGuard from '@/components/auth/AuthGuard';
import RecycleBin from '@/pages/pallet/RecycleBin';
import StaticContentManagement from '@/pages/admin/StaticContentManagement';

const AppRoutes = () => {
  const { isAuthenticated, user } = useSelector(state => state.auth);
  const isAdmin = user?.is_admin === true;

  return (
    <App>
      <Router>
        <Routes>
          <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/dashboard" />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          
          <Route element={<AuthGuard />}>
            <Route path="/" element={<Layout />}>
              <Route index element={<Navigate to="/dashboard" />} />
              <Route path="dashboard" element={<Dashboard />} />
              
              {/* 管理员路由 */}
              <Route path="protected/admin">
                <Route 
                  path="users" 
                  element={isAdmin ? <UserManagement /> : <Navigate to="/unauthorized" />} 
                />
                <Route 
                  path="admins" 
                  element={isAdmin ? <AdminManagement /> : <Navigate to="/unauthorized" />} 
                />
                <Route 
                  path="static-content" 
                  element={isAdmin ? <StaticContentManagement /> : <Navigate to="/unauthorized" />} 
                />
              </Route>
              
              {/* 货盘管理路由 */}
              <Route path="protected/pallet">
                <Route path="products" element={<ProductManagement />} />
                <Route 
                  path="brands" 
                  element={isAdmin ? <BrandManagement /> : <Navigate to="/unauthorized" />} 
                />
                <Route 
                  path="categories" 
                  element={isAdmin ? <CategoryManagement /> : <Navigate to="/unauthorized" />} 
                />
              </Route>
              
              {/* 回收站路由 */}
              <Route path="protected/recyclebin" element={<RecycleBin />} />
              
              {/* 销售部分 */}
              <Route path="protected/sales">
                <Route path="pallet/:salesId?" element={<SalesPalletView />} />
              </Route>
              
              {/* 用户中心 */}
              <Route path="profile" element={<Profile />} />
            </Route>
          </Route>
          
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </App>
  );
};

export default AppRoutes; 
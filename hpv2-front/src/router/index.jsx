import { createBrowserRouter, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Spin } from 'antd';
import PrivateRoute from '@/components/auth/PrivateRoute';

// 懒加载包装器
const lazyLoad = (Component) => (
  <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><Spin size="large" /></div>}>
    <Component />
  </Suspense>
);

// 懒加载组件
const LoginPage = lazy(() => import('@/pages/login/Login'));
const DebugLogin = lazy(() => import('@/pages/login/DebugLogin'));
const MainLayout = lazy(() => import('@/components/layout/MainLayout'));
const Dashboard = lazy(() => import('@/pages/dashboard/Dashboard'));
const Unauthorized = lazy(() => import('@/pages/Unauthorized'));
const ProductManagement = lazy(() => import('@/pages/pallet/ProductManagement'));
const RecycleBin = lazy(() => import('@/pages/pallet/RecycleBin'));
const ShareView = lazy(() => import('@/pages/pallet/ShareView'));
const ShareHistory = lazy(() => import('@/pages/pallet/ShareHistory'));

// 管理员页面
const BrandManagement = lazy(() => import('@/pages/admin/BrandManagement'));
const UserManagement = lazy(() => import('@/pages/admin/UserManagement'));
const AdminManagement = lazy(() => import('@/pages/admin/AdminManagement'));
const ViewSalesPallets = lazy(() => import('@/pages/admin/ViewSalesPallets'));
const StaticContentManagement = lazy(() => import('@/pages/admin/StaticContentManagement'));

// 销售员页面
const ProfileManagement = lazy(() => import('@/pages/ProfileManagement'));
const ViewCompanyPallets = lazy(() => import('@/pages/seller/ViewCompanyPallets'));

// 创建路由
const router = createBrowserRouter([
  {
    path: '/share/:token',
    element: lazyLoad(ShareView),
  },
  {
    path: '/login',
    element: lazyLoad(LoginPage),
  },
  {
    path: '/debug',
    element: lazyLoad(DebugLogin),
  },
  {
    path: '/unauthorized',
    element: lazyLoad(Unauthorized),
  },
  {
    path: '/protected',
    element: lazyLoad(MainLayout),
    children: [
      { 
        index: true, 
        element: <Navigate to="/protected/dashboard" replace /> 
      },
      { 
        path: 'dashboard', 
        element: <PrivateRoute 
          element={lazyLoad(Dashboard)} 
          requiredRoles={[]} 
        />
      },
      // 通用路由 - 对所有登录用户有效
      {
        path: 'profile',
        element: <PrivateRoute 
          element={lazyLoad(ProfileManagement)}
          requiredRoles={[]} // 空数组表示所有角色都可访问
        />
      },
      {
        path: 'products',
        element: <PrivateRoute 
          element={lazyLoad(ProductManagement)}
          requiredRoles={[]} // 空数组表示所有角色都可访问
        />
      },
      {
        path: 'share-history',
        element: <PrivateRoute 
          element={lazyLoad(ShareHistory)}
          requiredRoles={[]} // 空数组表示所有角色都可访问
        />
      },
      {
        path: 'recyclebin',
        element: <PrivateRoute 
          element={lazyLoad(RecycleBin)}
          requiredRoles={[]} // 空数组表示所有角色都可访问
        />
      },
      // 管理员路由
      {
        path: 'admin',
        children: [
          { 
            path: 'brands', 
            element: <PrivateRoute 
              element={lazyLoad(BrandManagement)} 
              requiredRoles={['admin']} 
            />
          },
          { 
            path: 'users', 
            element: <PrivateRoute 
              element={lazyLoad(UserManagement)} 
              requiredRoles={['admin']} 
            />
          },
          { 
            path: 'admins', 
            element: <PrivateRoute 
              element={lazyLoad(AdminManagement)} 
              requiredRoles={['admin']} 
            />
          },
          { 
            path: 'sales-pallets', 
            element: <PrivateRoute 
              element={lazyLoad(ViewSalesPallets)} 
              requiredRoles={['admin']} 
            />
          },
          { 
            path: 'static-content', 
            element: <PrivateRoute 
              element={lazyLoad(StaticContentManagement)} 
              requiredRoles={['admin']} 
            />
          },
        ],
      },
      // 销售员路由
      {
        path: 'seller',
        children: [
          { 
            path: 'company-pallets', 
            element: <PrivateRoute 
              element={lazyLoad(ViewCompanyPallets)} 
              requiredRoles={['seller']} 
            />
          },
        ],
      },
    ],
  },
  // 根路径直接跳转到登录页
  {
    path: '/',
    element: <Navigate to="/login" replace />
  },
  // 兼容旧路径
  {
    path: '/basic-login',
    element: <Navigate to="/login" replace />
  },
  // 兼容旧链接，将dashboard重定向
  {
    path: '/dashboard', 
    element: <Navigate to="/protected/dashboard" replace />
  },
  // 兼容旧链接，将admin重定向
  {
    path: '/admin/*',
    element: <Navigate to="/protected/admin/*" replace />
  },
  // 兼容旧链接，将seller重定向
  {
    path: '/seller/*',
    element: <Navigate to="/protected/seller/*" replace />
  },
  // 默认重定向
  {
    path: '*',
    element: <Navigate to="/login" replace />
  },
]);

export default router; 
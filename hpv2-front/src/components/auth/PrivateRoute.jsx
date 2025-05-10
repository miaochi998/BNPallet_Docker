import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';

// 权限验证组件 - 增强版本
const PrivateRoute = ({ element, requiredRoles = [] }) => {
  const { isAuthenticated, user, token } = useSelector((state) => state.auth);
  const location = useLocation();

  // 添加详细日志
  console.log('[PrivateRoute] 开始检查授权:', { 
    isAuthenticated, 
    token: token ? `${token.substring(0, 10)}...` : null,
    hasUser: !!user,
    userRole: user?.is_admin ? 'admin' : 'seller',
    requiredRoles, 
    currentPath: location.pathname 
  });

  // 未登录时，直接跳转到登录页
  if (!isAuthenticated || !token) {
    console.log('[PrivateRoute] 未登录或token无效，重定向到登录页面', {
      from: location.pathname
    });
    
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // 没有用户信息时，也认为是未授权
  if (!user) {
    console.log('[PrivateRoute] 无法获取用户信息，重定向到登录页面');
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // 需要特定角色验证
  if (requiredRoles.length > 0) {
    const userRole = user.is_admin ? 'admin' : 'seller';
    
    console.log('[PrivateRoute] 检查用户角色权限:', {
      userRole,
      requiredRoles,
      hasPermission: requiredRoles.includes(userRole)
    });
    
    if (!requiredRoles.includes(userRole)) {
      console.log('[PrivateRoute] 无权限访问，重定向到无权限页面');
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // 验证通过，渲染组件
  console.log('[PrivateRoute] 权限验证通过，渲染组件');
  return element;
};

export default PrivateRoute; 
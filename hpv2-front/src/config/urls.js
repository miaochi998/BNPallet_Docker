/**
 * URL配置管理模块
 * 集中管理所有API和资源URL配置，方便未来域名变更
 */

// 获取API基础URL
export const getApiBaseUrl = () => {
  // 1. 首先检查环境变量中是否已定义VITE_API_URL
  const apiUrlFromEnv = import.meta.env.VITE_API_URL;
  if (apiUrlFromEnv) {
    return apiUrlFromEnv;
  }
  
  // 2. 检查是否有定义VITE_API_BASE_URL (兼容两种配置)
  const apiBaseUrlFromEnv = import.meta.env.VITE_API_BASE_URL;
  if (apiBaseUrlFromEnv) {
    return apiBaseUrlFromEnv;
  }
  
  // 3. 如果环境变量都未定义或为空，则使用当前域名(相对路径)
  // 这适合前后端部署在同一服务器的情况
  const { protocol, host } = window.location;
  
  // 开发环境下使用固定端口，生产环境下使用相对路径
  if (import.meta.env.DEV) {
    const developmentPort = import.meta.env.VITE_BACKEND_PORT || '6016';
    const hostname = window.location.hostname;
    return `${protocol}//${hostname}:${developmentPort}`;
  } else {
    // 生产环境下，推荐使用相对路径，这样前后端可以部署在同一域名下
    return '';
  }
};

// 获取图片URL的函数
export const getImageUrl = (imagePath, params = '') => {
  if (!imagePath) {
    return null;
  }
  
  // 如果已经是完整的URL（包含http或https），直接返回
  if (imagePath.startsWith('http')) {
    return imagePath + params;
  }
  
  // 确保路径以'/'开头
  if (!imagePath.startsWith('/')) {
    imagePath = `/${imagePath}`;
  }
  
  // 优先使用环境变量中的图片基础URL
  let baseUrl = '';
  if (import.meta.env.VITE_IMAGE_BASE_URL) {
    baseUrl = import.meta.env.VITE_IMAGE_BASE_URL;
  } else {
    // 否则使用API基础URL
    baseUrl = getApiBaseUrl();
  }
  
  // 返回完整URL
  return `${baseUrl}${imagePath}${params}`;
};

// 导出配置对象，方便引用
export default {
  apiBaseUrl: getApiBaseUrl(),
  getImageUrl
}; 
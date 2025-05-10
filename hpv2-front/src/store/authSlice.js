// 这是一个桥接文件，用于解决旧的导入路径问题
// 从实际的authSlice中导出所有内容
export * from './slices/authSlice';

// 还需要默认导出
import authReducer from './slices/authSlice';
export default authReducer; 
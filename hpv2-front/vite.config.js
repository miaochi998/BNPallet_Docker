import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// 基于环境决定基础路径
const base = process.env.NODE_ENV === 'production' ? '/' : '/';

// 通用代理配置
const proxyConfig = {
  '/api': {
    target: 'http://localhost:6016',
    changeOrigin: true,
    secure: false
  },
  '/uploads': {
    target: 'http://localhost:6016',
    changeOrigin: true,
    secure: false
  }
};

export default defineConfig({
  plugins: [react()],
  base, // 设置基础路径，确保资源能够正确加载
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // 确保生产环境中资源能够正确访问
    assetsInlineLimit: 4096,
    // 添加hash到文件名以避免缓存问题
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  },
  server: {
    port: 6017,
    host: "0.0.0.0",
    cors: true,
    proxy: proxyConfig
  },
  preview: {
    port: 6015,
    host: "0.0.0.0",
    cors: true,
    proxy: proxyConfig
  }
});

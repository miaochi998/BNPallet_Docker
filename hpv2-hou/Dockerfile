# 使用Node.js 20版本的Alpine镜像
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 设置最基本的默认环境变量（其他变量从docker-compose传入）
ENV NODE_ENV=production \
    PORT=6016

# 安装构建依赖
RUN apk add --no-cache python3 make g++ gcc

# 复制package.json和package-lock.json文件
COPY package*.json ./

# 安装生产环境依赖
RUN npm ci --only=production

# 复制源代码
COPY . .

# 创建必要的目录并设置权限
RUN mkdir -p uploads logs temp && \
    chmod -R 755 uploads logs temp

# 设置端口
EXPOSE ${PORT}

# 健康检查（检查API是否响应）
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:${PORT}/health || exit 1

# 启动应用
CMD ["node", "src/app.js"] 
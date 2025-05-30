# 使用Node.js 20版本的Alpine镜像
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 设置最基本的默认环境变量（其他变量从docker-compose传入）
ENV NODE_ENV=production \
    PORT=6016

# 安装构建依赖
RUN apk add --no-cache python3 make g++ gcc curl

# 复制package.json和package-lock.json文件
COPY package*.json ./

# 安装生产环境依赖
RUN npm ci --only=production

# 复制源代码
COPY . .

# 创建必要的目录并设置权限
RUN mkdir -p uploads/images uploads/materials uploads/qrcode logs temp && \
    chmod -R 777 uploads logs temp

# 创建启动脚本
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo '# 确保上传目录存在并有正确权限' >> /app/start.sh && \
    echo 'mkdir -p /app/uploads/images /app/uploads/materials /app/uploads/qrcode' >> /app/start.sh && \
    echo 'chmod -R 777 /app/uploads' >> /app/start.sh && \
    echo '' >> /app/start.sh && \
    echo '# 确保软链接创建正确' >> /app/start.sh && \
    echo 'if [ -d /app/src/uploads ] && [ ! -L /app/src/uploads ]; then' >> /app/start.sh && \
    echo '  rm -rf /app/src/uploads' >> /app/start.sh && \
    echo '  ln -sf /app/uploads /app/src/uploads' >> /app/start.sh && \
    echo 'fi' >> /app/start.sh && \
    echo '' >> /app/start.sh && \
    echo '# 启动应用' >> /app/start.sh && \
    echo 'exec node src/app.js' >> /app/start.sh && \
    chmod +x /app/start.sh

# 设置端口
EXPOSE ${PORT}

# 健康检查（检查API是否响应）
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://127.0.0.1:${PORT}/health || exit 1

# 启动应用
CMD ["/app/start.sh"] 
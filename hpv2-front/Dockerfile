# 构建阶段
FROM node:20-alpine AS build

WORKDIR /app

# 复制并安装依赖
COPY package*.json ./
RUN npm ci

# 复制源代码并构建
COPY . .
RUN npm run build

# 生产阶段
FROM nginx:stable-alpine

# 复制构建产物
COPY --from=build /app/dist /usr/share/nginx/html

# 复制Nginx配置模板
COPY nginx.conf /etc/nginx/templates/default.conf.template

# 默认端口配置
ENV NGINX_PORT=6017
ENV BACKEND_PORT=6016

EXPOSE 6017

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s CMD wget --quiet --tries=1 --spider http://localhost:${NGINX_PORT} || exit 1

CMD ["nginx", "-g", "daemon off;"] 
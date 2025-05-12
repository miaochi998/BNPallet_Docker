# 帮你品牌货盘管理系统 - Docker 部署方案

## 一、项目概述

帮你品牌货盘管理系统（BNPallet）是一个用于管理货盘信息的Web应用，包括前端和后端两部分：
- 前端：使用React + Vite构建的单页面应用
- 后端：使用Node.js + Express构建的API服务
- 数据库：PostgreSQL

本文档详细说明如何将该系统通过 Docker 方式打包、发布和部署，实现"一键部署"的用户体验。

## 二、目标与需求

### 2.1 目标

1. 简化部署流程，实现"一键部署"
2. 支持各种服务器环境，不依赖于宝塔面板等特定工具
3. 发布到GitHub开源，便于用户使用和贡献
4. 保持数据持久化，确保系统数据安全
5. 提供基本监控和故障排查工具
6. 支持离线部署，解决网络限制问题
7. 支持多种访问模式，适应不同的网络环境

### 2.2 用户需求

用户在拥有Docker环境的情况下，只需执行一行命令即可部署整个系统：
```bash
curl -fsSL https://raw.githubusercontent.com/miaochi998/BNPallet_Docker/master/deploy.sh | bash
```

### 2.3 系统需求

- Docker 20.10.0+
- Docker Compose v2.0.0+
- 开放端口: 6016, 6017
- 基本系统内存：建议2GB+
- 存储空间：至少1GB可用空间

## 三、实施方案

### 3.1 架构设计

系统使用三容器架构：
1. **PostgreSQL 容器**：数据库服务
2. **Node.js 容器**：后端API服务
3. **Nginx 容器**：前端静态文件服务和API代理

容器间关系:
- 前端容器通过Nginx代理将API请求转发到后端容器
- 后端容器连接PostgreSQL容器进行数据存储和查询
- 三个容器共享一个Docker网络
- 容器间使用健康检查确保按正确顺序启动

### 3.2 工作计划

整个工作分为以下几个阶段：

#### 阶段一：准备工作 [已完成]

1. **创建Docker Hub账户** [已完成]
   - 注册Docker Hub账户 [已完成]
   - 创建项目镜像仓库 [已完成]

2. **项目代码准备** [已完成]
   - 确认前端和后端代码的完整性 [已完成]
   - 确认数据库初始化脚本的正确性 [已完成]

#### 阶段二：构建镜像文件 [已完成]

1. **编写Dockerfile** [已完成]
   - 前端Dockerfile (构建并通过Nginx提供服务) [已完成]
   - 后端Dockerfile (Node.js运行环境) [已完成]
   - 添加健康检查配置 [已完成]

2. **编写Nginx配置** [已完成]
   - 配置前端静态文件服务 [已完成]
   - 配置API代理 [已完成]
   - 配置单页面应用路由支持 [已完成]
   - 添加环境变量模板支持 [已完成]

3. **编写docker-compose.yml** [已完成]
   - 配置三个容器的关系 [已完成]
   - 设置环境变量和端口映射 [已完成]
   - 配置数据卷持久化 [已完成]
   - 添加健康检查和容器依赖关系 [已完成]
   - 添加pull_policy策略优化 [已完成]

#### 阶段三：自动化部署脚本 [已完成]

1. **创建deploy.sh一键部署脚本** [已完成]
   - 检测Docker环境 [已完成]
   - 交互式配置选项 [已完成]
   - 下载必要文件 [已完成]
   - 启动服务并展示访问信息 [已完成]
   - 自动验证服务状态 [已完成]
   - 配置Docker镜像加速选项 [已完成]
   - 添加多种访问模式支持 [已完成]

2. **创建管理和监控脚本** [已完成]
   - 服务启停功能 [已完成]
   - 日志查看功能 [已完成]
   - 健康检查功能 [已完成]
   - 资源监控功能 [已完成]

3. **创建离线部署支持** [已完成]
   - 镜像保存功能 [已完成]
   - 镜像加载功能 [已完成]

#### 阶段四：测试与优化 [进行中]

1. **本地测试** [待完成]
   - 验证服务启动 
   - 测试功能正常性 
   - 测试数据持久化 
   - 测试多种访问模式 
   - 测试离线部署支持 

2. **优化配置** [部分完成]
   - 优化容器资源配置 [已完成]
   - 优化启动顺序和依赖关系 [已完成]
   - 完善错误处理 [已完成]
   - 优化拉取策略减少限流问题 [已完成]
   - 支持多种访问方式（域名、不同IP场景）[已完成]

#### 阶段五：发布与文档 [待完成]

1. **构建并推送镜像** [已完成]
   - 构建前端和后端镜像[已完成]
   - 推送到Docker Hub[已完成]

2. **完善README.md** [待完成]
   - 简明的部署说明
   - 系统架构说明
   - 常见问题解答

3. **设置GitHub Actions** [待完成]
   - 自动构建和推送镜像
   - 版本标签自动化

## 四、详细实施方案

### 4.1 前端Docker配置

#### 4.1.1 Dockerfile
```dockerfile
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
```

#### 4.1.2 Nginx配置
```nginx
server {
    listen ${NGINX_PORT};
    server_name ${FRONTEND_DOMAIN:-localhost} ${ACCESS_IP:-localhost};

    # 静态资源目录
    root /usr/share/nginx/html;
    index index.html;

    # 启用Gzip压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript application/xml;
    gzip_min_length 1000;

    # 解决SPA刷新404问题
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源缓存
    location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
        expires 7d;
        add_header Cache-Control "public, max-age=604800";
    }

    # API代理
    location /api {
        rewrite ^/api/(.*)$ /$1 break;
        proxy_pass http://backend:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # 上传文件目录代理
    location /uploads {
        proxy_pass http://backend:${BACKEND_PORT}/uploads;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 4.2 后端Docker配置

#### 4.2.1 Dockerfile
```dockerfile
# 使用Node.js 20版本的Alpine镜像
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 设置最基本的默认环境变量（其他变量从docker-compose传入）
ENV NODE_ENV=production \
    PORT=6016

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
```

### 4.3 docker-compose.yml

```yaml
version: '3.8'

services:
  # PostgreSQL 数据库服务
  postgres:
    image: postgres:16-alpine
    container_name: bnpallet-postgres
    restart: always
    pull_policy: if-not-present
    environment:
      # 数据库配置 - 可通过.env文件自定义
      POSTGRES_USER: ${DB_USER:-bnpallet}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-bnpallet123456}
      POSTGRES_DB: ${DB_NAME:-bnpallet}
    volumes:
      # 数据持久化
      - postgres_data:/var/lib/postgresql/data
      # 初始化数据库结构
      - ./setup-db.sql:/docker-entrypoint-initdb.d/setup-db.sql
    ports:
      - "${DB_PORT_EXPOSED:-5432}:5432"
    healthcheck:
      # 数据库健康检查
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-bnpallet}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
    networks:
      - bnpallet-network
    logging:
      driver: "json-file"
      options:
        max-size: "${LOG_MAX_SIZE:-10m}"
        max-file: "${LOG_MAX_FILE:-3}"

  # 后端API服务
  backend:
    build:
      context: ./hpv2-hou
      dockerfile: Dockerfile
    image: ${DOCKER_HUB_USERNAME:-miaochi}/bnpallet-backend:${TAG:-latest}
    container_name: bnpallet-backend
    restart: always
    pull_policy: if-not-present
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      # 应用基本配置
      - NODE_ENV=${NODE_ENV:-production}
      - PORT=${BACKEND_PORT:-6016}
      
      # 数据库连接配置
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_NAME=${DB_NAME:-bnpallet}
      - DB_USER=${DB_USER:-bnpallet}
      - DB_PASSWORD=${DB_PASSWORD:-bnpallet123456}
      
      # 安全配置
      - JWT_SECRET=${JWT_SECRET:-WxsLC5j1NT3+sDkWLS6fE/SCAjo5MJOHeH4kSNxtebc=}
      - JWT_EXPIRES_IN=${JWT_EXPIRES_IN:-30d}
      
      # 文件上传配置
      - MAX_FILE_SIZE=${MAX_FILE_SIZE:-20}
      - MAX_ZIP_SIZE=${MAX_ZIP_SIZE:-500}
      
      # CORS配置
      - ALLOWED_ORIGINS=${ALLOWED_ORIGINS:-http://localhost:6017,http://127.0.0.1:6017}
    volumes:
      # 持久化上传文件和日志
      - backend_uploads:/app/uploads
      - backend_logs:/app/logs
    ports:
      - "${BACKEND_PORT_EXPOSED:-6016}:${BACKEND_PORT:-6016}"
    networks:
      - bnpallet-network
    logging:
      driver: "json-file"
      options:
        max-size: "${LOG_MAX_SIZE:-10m}"
        max-file: "${LOG_MAX_FILE:-3}"

  # 前端Web服务
  frontend:
    build:
      context: ./hpv2-front
      dockerfile: Dockerfile
    image: ${DOCKER_HUB_USERNAME:-miaochi}/bnpallet-frontend:${TAG:-latest}
    container_name: bnpallet-frontend
    restart: always
    pull_policy: if-not-present
    depends_on:
      # 确保后端服务已成功启动并可用
      backend:
        condition: service_healthy
    environment:
      # 前端服务端口配置
      - NGINX_PORT=${FRONTEND_PORT:-6017}
      # 后端API服务端口配置
      - BACKEND_PORT=${BACKEND_PORT:-6016}
      # 访问配置
      - FRONTEND_DOMAIN=${FRONTEND_DOMAIN:-localhost}
      - ACCESS_TYPE=${ACCESS_TYPE:-ip}
      - ACCESS_IP=${ACCESS_IP:-localhost}
    ports:
      - "${FRONTEND_PORT_EXPOSED:-6017}:${FRONTEND_PORT:-6017}"
    networks:
      - bnpallet-network
    logging:
      driver: "json-file"
      options:
        max-size: "${LOG_MAX_SIZE:-10m}"
        max-file: "${LOG_MAX_FILE:-3}"

networks:
  bnpallet-network:
    driver: bridge
    name: bnpallet-network

volumes:
  postgres_data:
    name: ${VOLUME_PREFIX:-bnpallet}-postgres-data
  backend_uploads:
    name: ${VOLUME_PREFIX:-bnpallet}-uploads
  backend_logs:
    name: ${VOLUME_PREFIX:-bnpallet}-logs
```

### 4.4 一键部署脚本 (deploy.sh)

deploy.sh脚本提供了完整的交互式部署体验，主要功能包括：

1. **环境检查**：验证Docker和Docker Compose安装
2. **Docker镜像加速配置**：可选配置镜像加速器
3. **交互式配置**：用户可自定义端口、数据库信息等
4. **多种访问方式配置**：支持域名访问和不同类型的IP访问
5. **自动下载配置文件**：从GitHub仓库获取必要文件
6. **服务部署与验证**：启动服务并验证可用性
7. **监控工具创建**：生成monitor.sh系统监控脚本
8. **离线部署支持**：生成offline-install.sh支持离线部署

详细实现请参考GitHub仓库中的deploy.sh文件。

### 4.5 监控脚本 (monitor.sh)

自动生成的monitor.sh脚本提供以下功能：

```
• status     查看所有容器状态
• stats      监控容器资源使用情况
• logs       查看所有容器日志
• db-logs    查看数据库容器日志
• api-logs   查看后端API容器日志
• web-logs   查看前端Web容器日志
• restart    重启所有服务
• health     检查服务健康状态
```

### 4.6 离线部署支持 (offline-install.sh)

自动生成的offline-install.sh脚本支持离线部署场景：

```
• save       保存当前镜像到压缩文件
• load       从压缩文件加载镜像
```

离线部署流程：
1. 在有网络连接的环境中部署系统
2. 使用offline-install.sh保存镜像
3. 将镜像文件复制到目标服务器
4. 在目标服务器上运行部署脚本
5. 使用offline-install.sh加载镜像
6. 启动服务

### 4.7 环境变量配置 (.env.example)

系统提供了.env.example示例文件，用户可以基于此文件创建自己的.env配置：

```
# 项目基本配置
TAG=latest
DOCKER_HUB_USERNAME=miaochi
VOLUME_PREFIX=bnpallet
LOG_MAX_SIZE=10m
LOG_MAX_FILE=3

# 数据库配置
DB_NAME=bnpallet
DB_USER=bnpallet
DB_PASSWORD=bnpallet123456
DB_PORT_EXPOSED=5432

# 后端配置
NODE_ENV=production
BACKEND_PORT=6016
BACKEND_PORT_EXPOSED=6016
JWT_SECRET=WxsLC5j1NT3+sDkWLS6fE/SCAjo5MJOHeH4kSNxtebc=
JWT_EXPIRES_IN=30d
MAX_FILE_SIZE=20
MAX_ZIP_SIZE=500
ALLOWED_ORIGINS=http://localhost:6017,http://127.0.0.1:6017

# 前端配置
FRONTEND_PORT=6017
FRONTEND_PORT_EXPOSED=6017

# 访问配置
ACCESS_TYPE=ip
FRONTEND_DOMAIN=
ACCESS_IP=localhost
```

### 4.8 多种访问模式支持

系统支持多种访问方式，以适应不同的网络环境：

#### 4.8.1 域名访问方式

用户可以使用自己的域名访问系统，仅需在部署时填写域名即可。系统会自动配置nginx服务器接受该域名的请求。

#### 4.8.2 IP访问方式

系统支持以下几种IP访问模式：

1. **本地访问模式**：仅在部署服务器上访问系统，使用localhost作为访问地址。

2. **局域网访问模式**：在同一局域网的其他设备上访问系统，使用服务器的局域网IP作为访问地址。

3. **固定公网IP访问模式**：适用于服务器拥有固定公网IP的情况，用户只需确保防火墙开放相应的端口。

4. **动态公网IP访问模式**：适用于服务器公网IP会变化的情况，系统提供两种解决方案：
   - 通过DDNS服务映射动态IP到固定域名（推荐）
   - 在IP变化后手动更新访问地址

#### 4.8.3 前后端通信优化

无论用户选择何种外部访问方式，前端与后端容器间的通信始终使用Docker内部网络，通过容器名称直接访问。这种设计有以下优势：

1. **更高性能**：内部网络通信比通过外部网络地址通信更快
2. **更高可靠性**：即使外部网络配置变化，内部通信不受影响
3. **更高安全性**：减少了外部网络攻击面

## 五、接下来的工作计划

1. **完成测试工作** (预计1周)
   - 全面测试功能正常性
   - 测试不同网络环境下的访问配置
   - 测试离线部署功能

2. **优化与改进** (预计1周)
   - 对镜像进行大小优化
   - 改进错误处理和容错性
   - 解决测试中发现的问题

3. **发布准备** (预计1周)
   - 构建并推送最终镜像到Docker Hub
   - 编写详细的README.md
   - 完善使用文档和常见问题解答

4. **持续集成设置** (预计3天)
   - 设置GitHub Actions自动构建流程
   - 配置版本标签自动化
   - 测试CI/CD流程

5. **正式发布** (预计2天)
   - 发布v1.0.0版本
   - 更新项目主页
   - 发布公告

## 六、注意事项与风险

### 6.1 注意事项

1. **密码与敏感信息**
   - 避免在公开代码中硬编码敏感信息
   - 提供修改默认密码的说明
   - 部署脚本自动生成随机JWT密钥

2. **数据备份**
   - 使用`docker-compose exec postgres pg_dump -U {用户名} {数据库名} > backup.sql`备份数据
   - 定期备份持久化数据卷
   - 提供管理监控脚本便于维护

3. **安全性**
   - 建议用户在生产环境中修改默认密码
   - 建议配置防火墙规则
   - 参考https-setup.md配置HTTPS增强安全性

4. **网络配置**
   - 使用动态公网IP时，建议配置DDNS服务
   - 确保服务器防火墙已开放相应端口
   - 如在路由器后，需要配置端口映射

### 6.2 潜在风险与解决方案

1. **Docker Hub限制**
   - 风险：免费账户有下载次数限制
   - 解决方案：
     * 添加了pull_policy: if-not-present减少不必要的拉取
     * 提供了镜像加速器配置选项
     * 实现了离线部署支持避开DockerHub依赖

2. **兼容性问题**
   - 风险：不同Docker版本可能存在兼容问题
   - 解决方案：
     * 脚本检查Docker和Docker Compose最低版本
     * 提供详细的系统要求说明
     * 在多种环境中测试部署流程

3. **网络问题**
   - 风险：用户可能无法访问GitHub或Docker Hub
   - 解决方案：
     * 提供完整的离线部署方案
     * 支持镜像保存和加载功能
     * 支持配置镜像加速器

4. **动态IP访问问题**
   - 风险：动态公网IP变化导致无法访问
   - 解决方案：
     * 推荐使用DDNS服务
     * 在deploy.sh中提供DDNS配置指导
     * 提供详细的端口映射设置说明

## 七、后续优化方向

1. **多架构支持**
   - 支持ARM架构(如树莓派)
   - 兼容更多操作系统

2. **多版本支持**
   - 提供稳定版和最新版镜像
   - 支持版本选择和回滚

3. **高级监控**
   - 集成Prometheus监控解决方案
   - 提供Grafana可视化监控
   - 实现自动告警功能

4. **集群部署**
   - 支持Docker Swarm或Kubernetes集群部署
   - 提供高可用配置选项
   - 支持水平扩展

5. **HTTPS自动配置**
   - 集成Let's Encrypt自动证书申请
   - 简化HTTPS配置流程
   - 提供TLS设置优化选项

---

本文档将根据实施过程中的新发现和需求不断更新完善。 
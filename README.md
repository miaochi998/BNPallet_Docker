# 帮你品牌货盘管理系统 - Docker部署版

本项目是帮你品牌货盘管理系统的Docker容器化部署版本，包含前端、后端和数据库三个容器。

## 系统架构

- 前端：基于React开发的Web应用（运行在Nginx容器中）
- 后端：基于Node.js和Express开发的API服务
- 数据库：PostgreSQL数据库

## 快速部署

1. 克隆项目仓库
   ```bash
   git clone https://github.com/miaochi998/BNPallet_Docker.git
   cd BNPallet_Docker
   ```

2. 运行一键部署脚本
   ```bash
   bash deploy.sh
   ```
   
3. 按照提示完成部署配置

部署完成后，可以通过配置的IP地址和端口访问系统：
- 默认前端访问地址：http://服务器IP:6017
- 默认后端API地址：http://服务器IP:6016
- 默认管理员账号：admin
- 默认管理员密码：123456

## 容器结构说明

系统由三个容器组成：
- **postgres**：PostgreSQL数据库容器
- **backend**：Node.js后端API服务容器
- **frontend**：Nginx前端Web服务容器

## 数据持久化

系统使用Docker卷进行数据持久化：
- **postgres-data**：数据库文件
- **uploads**：上传的文件（图片、资料等）
- **logs**：系统日志

## 重要配置说明

### 上传文件访问配置

系统中上传的文件（如头像、产品图片等）需要在前后端容器间共享，涉及如下配置：

1. **数据卷配置**：在docker-compose.yml中，后端和前端容器共享同一个`backend_uploads`数据卷
   ```yaml
   # 后端配置
   backend:
     volumes:
       - backend_uploads:/app/uploads
       - backend_logs:/app/logs
   
   # 前端配置  
   frontend:
     volumes:
       - backend_uploads:/app/dist/uploads
   ```

2. **Nginx配置**：前端容器的Nginx服务器配置了本地路径提供上传文件服务
   ```nginx
   location /uploads {
     alias /app/dist/uploads;
     add_header Cache-Control "public, max-age=604800";
     expires 7d;
   }
   ```

3. **目录结构**：确保上传目录中存在必要的子目录
   ```
   /app/uploads/
   ├── images/    # 存放图片文件
   ├── materials/ # 存放资料文件
   └── qrcode/    # 存放二维码图片
   ```

## 常见问题及解决方案

### 1. 用户头像和二维码无法显示问题

**问题描述**：上传头像或二维码后，图片无法在前端显示，控制台报404错误。

**原因**：后端文件上传到 `/app/src/uploads` 目录，但静态文件服务提供的是 `/app/uploads` 目录，导致前端无法访问到实际的上传文件。

**解决方案**：

1. 确保前后端容器的上传目录正确共享:
   ```yaml
   volumes:
     - backend_uploads:/app/uploads  # 后端容器
     - backend_uploads:/usr/share/nginx/html/uploads  # 前端容器
   ```

2. 创建软链接，让后端上传目录指向共享卷目录:
   ```
   docker exec -it bnpallet-backend sh -c "if [ -d /app/src/uploads ] && [ ! -L /app/src/uploads ]; then rm -rf /app/src/uploads; ln -s /app/uploads /app/src/uploads; fi"
   ```

3. 确保uploads目录有正确的子目录结构:
   ```
   docker exec -it bnpallet-backend mkdir -p /app/uploads/images
   docker exec -it bnpallet-backend mkdir -p /app/uploads/materials
   docker exec -it bnpallet-backend mkdir -p /app/uploads/qrcode
   ```

4. 设置适当的目录权限:
   ```
   docker exec -it bnpallet-backend chmod -R 777 /app/uploads
   ```

执行完上述步骤后重启容器:
```
docker-compose restart
```

### 2. 管理员用户无法登录问题

**问题描述**：系统初始化后无法使用默认管理员账户(admin/123456)登录。

**解决方案**：

1. 确保在 `.env` 文件中设置 `FIRST_RUN_MODE=false`

2. 检查 `setup-db.sql` 文件中是否包含了默认管理员用户的创建语句:
   ```sql
   -- 创建默认管理员用户 (用户名: admin, 密码: 123456)
   INSERT INTO users (username, password, email, is_admin, status, created_at, updated_at)
   VALUES ('admin', '$2b$10$rSGSYGC2TnNBG1Z4yvK1puE66L/CZ3V1BzHNT9.xKOaVeuGZhP9hy', 'admin@example.com', true, 'ACTIVE', NOW(), NOW())
   ON CONFLICT (username) DO NOTHING;
   ```

## 手动修复脚本

如果遇到文件上传问题，可执行以下脚本进行修复：

```bash
#!/bin/bash

echo "============= 开始修复文件上传问题 ============="

# 检查后端uploads目录
echo "1. 检查容器中的uploads目录"
docker exec -it bnpallet-backend ls -la /app/src/uploads || echo "源目录不存在"
docker exec -it bnpallet-backend ls -la /app/uploads || echo "目标目录不存在"

# 创建必要的目录结构
echo "2. 创建必要的目录结构"
docker exec -it bnpallet-backend mkdir -p /app/uploads/images
docker exec -it bnpallet-backend mkdir -p /app/uploads/materials
docker exec -it bnpallet-backend mkdir -p /app/uploads/qrcode

# 复制已上传的文件
echo "3. 复制已上传的文件"
docker exec -it bnpallet-backend find /app/src/uploads/images -type f -exec cp {} /app/uploads/images/ \; 2>/dev/null || echo "无需复制图片文件"
docker exec -it bnpallet-backend find /app/src/uploads/materials -type f -exec cp {} /app/uploads/materials/ \; 2>/dev/null || echo "无需复制材料文件"
docker exec -it bnpallet-backend find /app/src/uploads/qrcode -type f -exec cp {} /app/uploads/qrcode/ \; 2>/dev/null || echo "无需复制二维码文件"

# 设置正确的权限
echo "4. 设置目录权限"
docker exec -it bnpallet-backend chmod -R 777 /app/uploads

# 创建软链接确保后端上传到正确位置
echo "5. 为后端上传目录创建软链接"
docker exec -it bnpallet-backend sh -c "if [ -d /app/src/uploads ] && [ ! -L /app/src/uploads ]; then rm -rf /app/src/uploads; ln -s /app/uploads /app/src/uploads; fi"

echo "============= 修复完成 ============="
```

## 注意事项

1. 文件上传路径配置必须与目录挂载保持一致
2. 对于产生新上传文件的场景，一定要测试文件上传和访问功能
3. 确保上传目录有适当的权限设置

## 许可证

本项目使用MIT许可证。 
# 帮你品牌货盘管理系统 - HTTPS配置指南

本文档提供了在帮你品牌货盘管理系统部署完成后配置HTTPS的方法。

## 配置HTTPS的方式

### 方式一：使用域名+Let's Encrypt证书（推荐）

这是生产环境的推荐配置方式，需要您拥有一个域名并将其解析到服务器IP。

1. **安装certbot**

```bash
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx
```

2. **获取SSL证书**

```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

3. **修改nginx配置**

编辑您的`docker-compose.yml`文件，添加证书挂载：

```yaml
frontend:
  # ... 其他配置 ...
  volumes:
    - /etc/letsencrypt/live/your-domain.com/fullchain.pem:/etc/nginx/ssl/cert.pem
    - /etc/letsencrypt/live/your-domain.com/privkey.pem:/etc/nginx/ssl/key.pem
    - ./frontend-ssl.conf:/etc/nginx/templates/default.conf.template
```

4. **创建SSL配置文件**

创建`frontend-ssl.conf`文件：

```nginx
server {
    listen ${NGINX_PORT};
    listen 443 ssl;
    server_name your-domain.com www.your-domain.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    
    # ... 其余配置与原nginx.conf相同 ...
}
```

5. **重启服务**

```bash
cd your-install-dir
docker-compose down
docker-compose up -d
```

### 方式二：使用自签名证书（测试环境）

如果您暂时无法使用域名，可以使用自签名证书进行HTTPS配置。注意：这种方式会导致浏览器显示不安全警告。

1. **生成自签名证书**

```bash
mkdir -p ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout ssl/private.key -out ssl/certificate.crt
```

2. **创建SSL配置文件**

创建`frontend-ssl.conf`文件：

```nginx
server {
    listen ${NGINX_PORT};
    listen 443 ssl;
    server_name localhost;

    ssl_certificate /etc/nginx/ssl/certificate.crt;
    ssl_certificate_key /etc/nginx/ssl/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    
    # ... 其余配置与原nginx.conf相同 ...
}
```

3. **修改docker-compose.yml**

```yaml
frontend:
  # ... 其他配置 ...
  volumes:
    - ./ssl/certificate.crt:/etc/nginx/ssl/certificate.crt
    - ./ssl/private.key:/etc/nginx/ssl/private.key
    - ./frontend-ssl.conf:/etc/nginx/templates/default.conf.template
  ports:
    - "${FRONTEND_PORT_EXPOSED:-6017}:${FRONTEND_PORT:-6017}"
    - "443:443"
```

4. **重启服务**

```bash
cd your-install-dir
docker-compose down
docker-compose up -d
```

## 使用IP地址的HTTPS注意事项

当使用IP地址而非域名配置HTTPS时：

1. 只能使用自签名证书，因为公共CA不会为IP地址颁发证书
2. 浏览器会显示不安全警告，用户需要手动添加例外
3. 某些浏览器功能可能受限

因此，在生产环境中，强烈建议使用域名配置HTTPS。

## 证书更新

使用Let's Encrypt证书需要每90天更新一次，可以设置定时任务：

```bash
sudo crontab -e
```

添加以下内容：

```
0 0 * * * certbot renew --quiet && cd your-install-dir && docker-compose restart frontend
```

## 安全增强配置

对于需要更高安全性的部署，可以添加以下配置：

```nginx
# 启用HTTP严格传输安全
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

# 防止点击劫持
add_header X-Frame-Options "SAMEORIGIN";

# 启用XSS保护
add_header X-XSS-Protection "1; mode=block";

# 禁止内容类型嗅探
add_header X-Content-Type-Options "nosniff";
```

## 故障排查

1. **证书不生效**：检查文件权限和路径
2. **无法访问HTTPS**：检查防火墙是否开放443端口
3. **证书错误**：确认证书未过期，且配置文件路径正确 
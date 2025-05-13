# 帮你品牌货盘管理系统 - Docker部署方案

[![Docker Image](https://img.shields.io/docker/pulls/miaochi/bnpallet-backend.svg)](https://hub.docker.com/r/miaochi/bnpallet-backend)
[![Docker Image](https://img.shields.io/docker/pulls/miaochi/bnpallet-frontend.svg)](https://hub.docker.com/r/miaochi/bnpallet-frontend)

## 项目介绍

帮你品牌货盘管理系统是一个基于Web的全功能货盘管理解决方案，旨在帮助企业高效管理货物、品牌和库存信息。

### 主要功能

- 品牌管理：创建和管理多个品牌及其相关信息
- 货盘管理：轻松创建、编辑和跟踪货盘信息
- 用户权限管理：基于角色的访问控制系统
- 文件上传：支持图片和材料文件的上传和管理
- 数据分析：提供基本的数据统计和分析功能
- 响应式设计：适配桌面和移动设备

## 技术栈

- 前端：React + Ant Design
- 后端：Node.js + Express
- 数据库：PostgreSQL
- 容器化：Docker + Docker Compose

## 快速部署

系统提供一键部署脚本，只需几个简单步骤即可完成部署：

```bash
# 克隆仓库
git clone https://github.com/miaochi998/BNPallet_Docker.git
cd BNPallet_Docker

# 执行部署脚本
bash deploy.sh
```

部署脚本会引导您完成以下步骤：
1. 环境检查
2. 系统配置（数据库、端口、访问方式等）
3. 下载必要文件
4. 构建并启动服务
5. 验证服务状态

### 系统要求

- Docker 20.10.0+
- Docker Compose 2.0.0+
- Linux系统（推荐Ubuntu 20.04+或CentOS 8+）
- 至少2GB内存
- 10GB可用磁盘空间

### 默认账户

- 用户名：admin
- 密码：123456

*注意：首次登录后请立即修改默认密码*

## 自定义配置

### 环境变量

部署脚本会生成一个.env文件，您可以根据需要修改以下配置：

- 数据库设置（DB_NAME, DB_USER, DB_PASSWORD）
- 服务端口（BACKEND_PORT, FRONTEND_PORT）
- JWT密钥（JWT_SECRET）
- 上传文件大小限制（MAX_FILE_SIZE, MAX_ZIP_SIZE）

### 数据持久化

系统使用Docker卷进行数据持久化：

- `bnpallet-postgres-data`：数据库文件
- `bnpallet-uploads`：上传文件
- `bnpallet-logs`：系统日志

## 系统管理

部署完成后，系统会生成以下管理脚本：

- `monitor.sh`：用于监控和管理容器
- `offline-install.sh`：用于镜像的保存和加载

常用命令：

```bash
# 查看系统状态
cd ./bnpallet && ./monitor.sh status

# 查看日志
cd ./bnpallet && ./monitor.sh logs

# 重启系统
cd ./bnpallet && docker-compose restart
```

## 贡献指南

我们欢迎任何形式的贡献，包括但不限于：

- 报告Bug
- 提交功能请求
- 提交代码改进
- 完善文档

## 许可证

本项目采用MIT许可证 - 详情请参阅LICENSE文件 
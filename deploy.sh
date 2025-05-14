#!/bin/bash

#============================================================
# 帮你品牌货盘管理系统 - 一键部署脚本
# 此脚本用于快速部署帮你品牌货盘管理系统
# 支持交互式配置、环境检查和服务部署
#============================================================

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# 版本信息
VERSION="1.0.1"
REPO_URL="https://raw.githubusercontent.com/miaochi998/BNPallet_Docker/master"

# 默认配置
DEFAULT_DB_NAME="bnpallet"
DEFAULT_DB_USER="bnpallet"
DEFAULT_DB_PASSWORD="bnpallet123456"
DEFAULT_DB_PORT="5432"
DEFAULT_BACKEND_PORT="6016"
DEFAULT_FRONTEND_PORT="6017"
DEFAULT_VOLUME_PREFIX="bnpallet"
DEFAULT_DOCKER_HUB_USERNAME="miaochi"
DEFAULT_ADMIN_USERNAME="admin"
DEFAULT_ADMIN_PASSWORD="123456"
DEFAULT_FIRST_RUN_MODE="false"  # 是否启用首次运行向导

# 管理员账户配置
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="123456"
FIRST_RUN_MODE="false"  # 禁用首次运行向导

# 显示欢迎信息
show_banner() {
    echo -e "${YELLOW}"
    echo "============================================================"
    echo "           帮你品牌货盘管理系统 - 一键部署脚本 v${VERSION}          "
    echo "============================================================"
    echo -e "${NC}"
    echo -e "本脚本将引导您完成帮你品牌货盘管理系统的部署过程。"
    echo -e "您将需要回答一些简单的问题，或直接按回车使用默认值。"
    echo -e "${NC}"
}

# 显示完成消息
show_completion() {
    echo -e "${GREEN}"
    echo "============================================================"
    echo "             帮你品牌货盘管理系统部署成功!                "
    echo "============================================================"
    echo -e "${NC}"
    
    # 显示访问地址
    echo -e "${WHITE}系统访问信息:${NC}"
    if [ "$ACCESS_TYPE" = "domain" ] && [ -n "$FRONTEND_DOMAIN" ]; then
        echo -e "前端访问地址: ${CYAN}http://${FRONTEND_DOMAIN}:${FRONTEND_PORT_EXPOSED}${NC}"
    else
        # 确保ACCESS_IP不为空
        if [ -z "$ACCESS_IP" ]; then
            ACCESS_IP=$(hostname -I | awk '{print $1}')
            if [ -z "$ACCESS_IP" ]; then
                ACCESS_IP="localhost"
            fi
        fi
        echo -e "前端访问地址: ${CYAN}http://${ACCESS_IP}:${FRONTEND_PORT_EXPOSED}${NC}"
    fi
    echo -e "后端API地址: ${CYAN}http://${ACCESS_IP}:${BACKEND_PORT_EXPOSED}${NC}"
    echo -e ""
    
    echo -e "${WHITE}系统管理员账号:${NC}"
    if [ "$FIRST_RUN_MODE" = "true" ]; then
        echo -e "${YELLOW}您已启用首次运行向导模式${NC}"
        echo -e "系统启动后，首次访问时将引导您创建管理员账户。"
    else
        echo -e "账号: ${CYAN}${ADMIN_USERNAME}${NC}"
        echo -e "密码: ${CYAN}${ADMIN_PASSWORD}${NC} (建议首次登录后立即修改)"
    fi
    echo -e ""
    
    echo -e "${WHITE}数据库信息:${NC}"
    echo -e "数据库: ${CYAN}${DB_NAME}${NC}"
    echo -e "用户名: ${CYAN}${DB_USER}${NC}"
    echo -e "密码: ${CYAN}${DB_PASSWORD}${NC}"
    echo -e ""
    
    echo -e "${WHITE}系统管理命令:${NC}"
    echo -e "• 启动系统: ${CYAN}cd ${INSTALL_DIR} && docker-compose up -d${NC}"
    echo -e "• 停止系统: ${CYAN}cd ${INSTALL_DIR} && docker-compose down${NC}"
    echo -e "• 重启系统: ${CYAN}cd ${INSTALL_DIR} && docker-compose restart${NC}"
    echo -e "• 查看日志: ${CYAN}cd ${INSTALL_DIR} && docker-compose logs -f${NC}"
    echo -e "• 查看状态: ${CYAN}cd ${INSTALL_DIR} && docker-compose ps${NC}"
    echo -e ""
    
    echo -e "${WHITE}生成的管理脚本:${NC}"
    echo -e "• 监控脚本: ${CYAN}${INSTALL_DIR}/monitor.sh${NC} - 用于监控和管理容器"
    echo -e "• 离线安装: ${CYAN}${INSTALL_DIR}/offline-install.sh${NC} - 用于镜像的保存和加载"
    echo -e "• 使用方法: ${CYAN}cd ${INSTALL_DIR} && ./monitor.sh help${NC} 查看监控命令"
    echo -e ""
    
    # 生成配置记录文件
    gen_config_record
    
    echo -e "${YELLOW}配置信息已保存到 ${CYAN}${INSTALL_DIR}/bnpallet-config-info.txt${NC} 文件中${NC}"
    echo -e "${YELLOW}强烈建议保存上述信息以备后用!${NC}"
    echo -e "${GREEN}感谢您使用帮你品牌货盘管理系统!${NC}"
    echo -e ""
}

# 下载文件
download_files() {
    echo -e "${YELLOW}正在下载必要文件...${NC}"
    
    # 下载docker-compose.yml
    echo -e "下载 docker-compose.yml..."
    
    # 检查数据库是否已初始化
    # 如果数据卷已存在，表示数据库可能已经初始化，使用无初始化脚本的版本
    DB_VOLUME_NAME="${VOLUME_PREFIX:-bnpallet}-postgres-data"
    
    if docker volume inspect $DB_VOLUME_NAME &>/dev/null; then
        echo -e "${YELLOW}检测到数据库卷 ${DB_VOLUME_NAME} 已存在，将使用无初始化脚本的配置${NC}"
        
        # 使用不包含初始化脚本挂载的docker-compose模板
        if [ -f "$REPO_URL/docker-compose-no-init.yml" ]; then
            echo -e "下载不包含初始化脚本的docker-compose模板..."
            curl -s -o $INSTALL_DIR/docker-compose.yml $REPO_URL/docker-compose-no-init.yml
        else
            # 如果模板不存在，则下载标准模板并删除初始化脚本挂载行
            echo -e "下载标准docker-compose模板并删除初始化脚本挂载..."
            curl -s -o $INSTALL_DIR/docker-compose.yml $REPO_URL/docker-compose.yml
            
            # 删除初始化脚本挂载行
            sed -i '/setup-db.sql/d' $INSTALL_DIR/docker-compose.yml
        fi
    else
        echo -e "首次部署，将使用包含初始化脚本的配置..."
        curl -s -o $INSTALL_DIR/docker-compose.yml $REPO_URL/docker-compose.yml
        
        # 下载数据库初始化脚本
        echo -e "下载 setup-db.sql..."
        curl -s -o $INSTALL_DIR/setup-db.sql $REPO_URL/setup-db.sql
    fi
    
    echo -e "${GREEN}必要文件下载完成 ✓${NC}"
}

# 其余部分保持不变
# ... 
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
VERSION="1.0.0"
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
ADMIN_USERNAME=""
ADMIN_PASSWORD=""
FIRST_RUN_MODE=""  # 是否启用首次运行向导

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

# 生成配置记录文件
gen_config_record() {
    CONFIG_FILE="${INSTALL_DIR}/bnpallet-config-info.txt"
    
    # 确定访问地址
    local FRONTEND_ACCESS_URL
    if [ "$ACCESS_TYPE" = "domain" ] && [ -n "$FRONTEND_DOMAIN" ]; then
        FRONTEND_ACCESS_URL="http://${FRONTEND_DOMAIN}:${FRONTEND_PORT_EXPOSED}"
    else
        # 确保ACCESS_IP不为空
        if [ -z "$ACCESS_IP" ]; then
            ACCESS_IP=$(hostname -I | awk '{print $1}')
            if [ -z "$ACCESS_IP" ]; then
                ACCESS_IP="localhost"
            fi
        fi
        FRONTEND_ACCESS_URL="http://${ACCESS_IP}:${FRONTEND_PORT_EXPOSED}"
    fi
    # 确保后端API地址也使用有效的IP
    local BACKEND_ACCESS_URL="http://${ACCESS_IP}:${BACKEND_PORT_EXPOSED}"
    
    # 根据配置模式设置管理员账户信息
    local ADMIN_ACCOUNT_INFO
    if [ "$FIRST_RUN_MODE" = "true" ]; then
        ADMIN_ACCOUNT_INFO="首次运行向导模式已启用\n系统启动后，首次访问时将引导您创建管理员账户。"
    else
        ADMIN_ACCOUNT_INFO="账号: ${ADMIN_USERNAME}\n密码: ${ADMIN_PASSWORD} (建议首次登录后立即修改)"
    fi
    
    cat > $CONFIG_FILE << EOF
==========================================
帮你品牌货盘管理系统 - 部署配置记录
==========================================
部署时间: $(date)
部署目录: ${INSTALL_DIR}

------------------------------------------
系统访问信息:
------------------------------------------
前端访问地址: ${FRONTEND_ACCESS_URL}
后端API地址: ${BACKEND_ACCESS_URL}

------------------------------------------
系统管理员账号:
------------------------------------------
${ADMIN_ACCOUNT_INFO}

------------------------------------------
数据库信息:
------------------------------------------
数据库名称: ${DB_NAME}
数据库用户名: ${DB_USER}
数据库密码: ${DB_PASSWORD}
数据库端口: ${DB_PORT_EXPOSED}

------------------------------------------
系统配置信息:
------------------------------------------
Docker Hub账号: ${DOCKER_HUB_USERNAME}
数据卷前缀: ${VOLUME_PREFIX}
后端端口: ${BACKEND_PORT}
前端端口: ${FRONTEND_PORT}
日志配置: 
  - 单文件最大: LOG_MAX_SIZE=10m
  - 文件数量: LOG_MAX_FILE=3

------------------------------------------
系统管理命令:
------------------------------------------
• 启动系统: cd ${INSTALL_DIR} && docker-compose up -d
• 停止系统: cd ${INSTALL_DIR} && docker-compose down
• 重启系统: cd ${INSTALL_DIR} && docker-compose restart
• 查看日志: cd ${INSTALL_DIR} && docker-compose logs -f
• 查看状态: cd ${INSTALL_DIR} && docker-compose ps
• 备份数据库: cd ${INSTALL_DIR} && docker-compose exec postgres pg_dump -U ${DB_USER} ${DB_NAME} > backup.sql
• 监控容器: cd ${INSTALL_DIR} && docker stats

------------------------------------------
生成的管理脚本:
------------------------------------------
1. 监控脚本: ${INSTALL_DIR}/monitor.sh
   使用方法: cd ${INSTALL_DIR} && ./monitor.sh help

2. 离线安装脚本: ${INSTALL_DIR}/offline-install.sh
   使用方法: cd ${INSTALL_DIR} && ./offline-install.sh help

------------------------------------------
备注:
------------------------------------------
1. 重要文件位置:
   - 环境配置文件: ${INSTALL_DIR}/.env
   - Docker Compose文件: ${INSTALL_DIR}/docker-compose.yml
   - 数据库初始化脚本: ${INSTALL_DIR}/setup-db.sql

2. 数据持久化位置:
   - 数据库文件: ${VOLUME_PREFIX}-postgres-data (Docker Volume)
   - 上传文件: ${VOLUME_PREFIX}-uploads (Docker Volume)
   - 日志文件: ${VOLUME_PREFIX}-logs (Docker Volume)

3. 默认端口说明:
   - 前端服务: ${FRONTEND_PORT_EXPOSED}
   - 后端API: ${BACKEND_PORT_EXPOSED}
   - 数据库: ${DB_PORT_EXPOSED}

4. 安全提示:
   - 请尽快修改默认管理员密码
   - 定期备份数据库内容
EOF

    # 设置权限，确保只有部署用户可以读取
    chmod 600 $CONFIG_FILE
    
    echo -e "${GREEN}配置记录已保存到: ${CONFIG_FILE}${NC}"
}

# 检查命令是否存在
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo -e "${RED}错误: 未找到 $1 命令${NC}"
        return 1
    fi
    return 0
}

# 检查环境
check_environment() {
    echo -e "${YELLOW}正在检查系统环境...${NC}"
    
    # 检查Linux系统
    if [[ "$(uname)" != "Linux" ]]; then
        echo -e "${RED}错误: 此脚本需要在Linux系统上运行${NC}"
        exit 1
    fi
    
    # 检查Docker
    if ! check_command docker; then
        echo -e "${RED}请先安装Docker: ${CYAN}https://docs.docker.com/get-docker/${NC}"
        exit 1
    fi
    
    # 检查Docker版本
    DOCKER_VERSION=$(docker --version | cut -d ' ' -f3 | cut -d ',' -f1)
    if [[ "$(echo -e "20.10.0\n$DOCKER_VERSION" | sort -V | head -n1)" != "20.10.0" ]]; then
        echo -e "${YELLOW}警告: 建议使用Docker 20.10.0+版本, 当前版本: ${DOCKER_VERSION}${NC}"
    else
        echo -e "${GREEN}Docker版本: ${DOCKER_VERSION} ✓${NC}"
    fi
    
    # 检查Docker Compose
    if check_command docker-compose; then
        COMPOSE_CMD="docker-compose"
        DOCKER_COMPOSE_VERSION=$(docker-compose --version | cut -d ' ' -f3 | cut -d ',' -f1)
        echo -e "${GREEN}Docker Compose版本: ${DOCKER_COMPOSE_VERSION} ✓${NC}"
    elif docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
        DOCKER_COMPOSE_VERSION=$(docker compose version --short)
        echo -e "${GREEN}Docker Compose版本: ${DOCKER_COMPOSE_VERSION} ✓${NC}"
    else
        echo -e "${RED}错误: 未找到Docker Compose${NC}"
        echo -e "${RED}请安装Docker Compose: ${CYAN}https://docs.docker.com/compose/install/${NC}"
        exit 1
    fi
    
    # 检查curl
    if ! check_command curl; then
        echo -e "${RED}错误: 未找到curl命令${NC}"
        echo -e "${RED}请安装curl命令: sudo apt-get install curl (Ubuntu/Debian) 或 sudo yum install curl (CentOS)${NC}"
        exit 1
    fi
    
    # 检查Docker是否运行
    if ! docker info &> /dev/null; then
        echo -e "${RED}错误: Docker服务未运行${NC}"
        echo -e "${RED}请启动Docker服务: sudo systemctl start docker${NC}"
        exit 1
    fi
    
    # 检查当前用户是否有Docker权限
    if ! docker ps &> /dev/null; then
        echo -e "${RED}错误: 当前用户没有执行Docker命令的权限${NC}"
        echo -e "${RED}请将当前用户添加到docker组中: sudo usermod -aG docker $(whoami)${NC}"
        echo -e "${RED}添加后需要重新登录或执行: newgrp docker${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}系统环境检查完毕 ✓${NC}"
    echo
}

# 配置Docker镜像加速器
setup_docker_mirror() {
    echo -e "${YELLOW}Docker镜像加速配置${NC}"
    echo -e "由于网络原因，从Docker Hub拉取镜像可能较慢。您可以配置镜像加速器来提高下载速度。"
    echo -e "可用的公共镜像加速器会经常变化，以下是一些可能可用的选项："
    echo -e "• ${CYAN}docker.1ms.run${NC}"
    echo -e "• ${CYAN}docker.mybacc.com${NC}"
    echo -e "• ${CYAN}https://dytt.online${NC}"
    echo -e "• ${CYAN}https://lispy.org${NC}" 
    echo -e "• ${CYAN}docker.xiaogenban1993.com${NC}"
    echo -e "• ${CYAN}docker.yomansunter.com${NC}"
    echo -e "• ${CYAN}aicarbon.xyz${NC}"
    echo -e "• ${CYAN}666860.xyz${NC}"
    echo -e "• ${CYAN}https://docker.zhai.cm${NC}"
    echo -e "• ${CYAN}https://a.ussh.net${NC}"
    echo -e ""
    echo -e "更多可用加速器请参考：${CYAN}https://github.com/dongyubin/DockerHub${NC}"
    echo -e "如果您已经配置了加速器或不需要加速，可以直接按回车跳过。"
    echo -e "${BLUE}------------------------------------------------------------${NC}"
    
    read -p "是否配置Docker镜像加速? [y/N]: " setup_mirror
    setup_mirror=${setup_mirror:-N}
    
    if [[ $setup_mirror =~ ^[Yy]$ ]]; then
        # 检查daemon.json是否存在
        DAEMON_JSON="/etc/docker/daemon.json"
        if [ -f $DAEMON_JSON ]; then
            echo -e "${YELLOW}发现已有的Docker配置文件: ${DAEMON_JSON}${NC}"
            echo -e "现有内容:"
            cat $DAEMON_JSON
            echo
            read -p "是否覆盖已有配置? [y/N]: " override_config
            override_config=${override_config:-N}
            
            if [[ ! $override_config =~ ^[Yy]$ ]]; then
                echo -e "${YELLOW}保留现有配置，跳过镜像加速器设置${NC}"
                return
            fi
        fi
        
        read -p "请输入镜像加速器地址: " mirror_url
        
        if [ -z "$mirror_url" ]; then
            echo -e "${YELLOW}未提供加速器地址，跳过配置${NC}"
            return
        fi
        
        # 测试镜像加速器连通性
        echo -e "${YELLOW}正在测试镜像加速器连通性...${NC}"
        if ! curl -s --connect-timeout 5 $mirror_url > /dev/null; then
            echo -e "${RED}警告: 无法连接到镜像加速器地址${NC}"
            read -p "是否继续使用此地址? [y/N]: " continue_with_mirror
            continue_with_mirror=${continue_with_mirror:-N}
            
            if [[ ! $continue_with_mirror =~ ^[Yy]$ ]]; then
                echo -e "${YELLOW}跳过镜像加速器配置${NC}"
                return
            fi
        fi
        
        # 配置Docker镜像加速器
        echo -e "${YELLOW}正在配置Docker镜像加速器...${NC}"
        sudo mkdir -p /etc/docker
        sudo tee $DAEMON_JSON > /dev/null << EOF
{
  "registry-mirrors": ["$mirror_url"]
}
EOF
        
        # 重启Docker服务
        echo -e "${YELLOW}正在重启Docker服务...${NC}"
        if systemctl is-active docker &>/dev/null; then
            sudo systemctl restart docker
            echo -e "${GREEN}Docker服务已重启，镜像加速器配置生效 ✓${NC}"
            echo -e "${YELLOW}提示: 如果加速器无效，您可以稍后手动编辑 ${DAEMON_JSON} 文件更换其他加速器${NC}"
        else
            echo -e "${YELLOW}Docker服务未通过systemctl管理，请手动重启Docker服务使配置生效${NC}"
        fi
    else
        echo -e "${YELLOW}跳过镜像加速器配置${NC}"
    fi
    
    echo
}

# 用户交互配置
interactive_config() {
    echo -e "${YELLOW}系统配置${NC}"
    echo -e "请回答以下问题进行系统配置，或直接按回车使用默认值。"
    echo -e "${BLUE}------------------------------------------------------------${NC}"
    
    # 安装目录
    read -p "安装目录 [./bnpallet]: " INSTALL_DIR
    INSTALL_DIR=${INSTALL_DIR:-"./bnpallet"}
    
    echo -e "${BLUE}------------------------------------------------------------${NC}"
    echo -e "${YELLOW}数据库配置${NC}"
    
    # 数据库配置
    read -p "数据库名称 [${DEFAULT_DB_NAME}]: " DB_NAME
    DB_NAME=${DB_NAME:-$DEFAULT_DB_NAME}
    
    read -p "数据库用户名 [${DEFAULT_DB_USER}]: " DB_USER
    DB_USER=${DB_USER:-$DEFAULT_DB_USER}
    
    read -p "数据库密码 [${DEFAULT_DB_PASSWORD}]: " DB_PASSWORD
    DB_PASSWORD=${DB_PASSWORD:-$DEFAULT_DB_PASSWORD}
    
    # 数据库端口
    read -p "数据库端口 [${DEFAULT_DB_PORT}]: " DB_PORT_EXPOSED
    DB_PORT_EXPOSED=${DB_PORT_EXPOSED:-$DEFAULT_DB_PORT}
    
    echo -e "${BLUE}------------------------------------------------------------${NC}"
    echo -e "${YELLOW}端口配置${NC}"
    
    # 检查端口是否已被占用
    check_port() {
        if nc -z localhost $1 2>/dev/null; then
            echo -e "${RED}警告: 端口 $1 已被占用，请指定其他端口${NC}"
            return 1
        fi
        return 0
    }
    
    # 后端端口
    while true; do
        read -p "后端服务端口 [${DEFAULT_BACKEND_PORT}]: " BACKEND_PORT
        BACKEND_PORT=${BACKEND_PORT:-$DEFAULT_BACKEND_PORT}
        BACKEND_PORT_EXPOSED=$BACKEND_PORT
        if check_port $BACKEND_PORT_EXPOSED; then
            break
        fi
    done
    
    # 前端端口
    while true; do
        read -p "前端服务端口 [${DEFAULT_FRONTEND_PORT}]: " FRONTEND_PORT
        FRONTEND_PORT=${FRONTEND_PORT:-$DEFAULT_FRONTEND_PORT}
        FRONTEND_PORT_EXPOSED=$FRONTEND_PORT
        if check_port $FRONTEND_PORT_EXPOSED; then
            break
        fi
    done
    
    echo -e "${BLUE}------------------------------------------------------------${NC}"
    echo -e "${YELLOW}访问配置${NC}"
    
    # 访问方式配置
    echo -e "系统可以通过域名或IP地址访问，请选择合适的访问方式:"
    
    # 域名配置
    read -p "前端访问域名 [留空使用IP方式访问]: " FRONTEND_DOMAIN
    
    if [ -n "$FRONTEND_DOMAIN" ]; then
        # 用户填写了域名
        echo -e "将使用域名访问: ${CYAN}http://${FRONTEND_DOMAIN}:${FRONTEND_PORT_EXPOSED}${NC}"
        # 询问域名是否已完成解析
        echo -e "${YELLOW}请确保您已经完成以下工作:${NC}"
        echo -e "1. 将域名 ${CYAN}${FRONTEND_DOMAIN}${NC} 解析到当前服务器IP"
        echo -e "2. 如果是使用动态公网IP的服务器，请确保已配置动态域名解析服务"
        echo -e "3. 如果需要通过公网访问，请确保已开放端口 ${CYAN}${FRONTEND_PORT_EXPOSED}${NC} 的访问权限"
        
        read -p "您已完成上述域名配置工作吗? [Y/n]: " domain_confirmed
        domain_confirmed=${domain_confirmed:-Y}
        
        if [[ ! $domain_confirmed =~ ^[Yy]$ ]]; then
            echo -e "${YELLOW}请完成域名配置后再继续...${NC}"
            read -p "是否要继续使用域名访问? [Y/n]: " continue_with_domain
            continue_with_domain=${continue_with_domain:-Y}
            
            if [[ ! $continue_with_domain =~ ^[Yy]$ ]]; then
                # 用户希望更改为IP访问
                FRONTEND_DOMAIN=""
                echo -e "${YELLOW}已切换到IP访问模式${NC}"
            else
                echo -e "${YELLOW}将继续使用域名访问，请确保正确配置域名解析${NC}"
            fi
        fi
        
        ACCESS_TYPE="domain"
    fi
    
    # 如果用户未填写域名或者取消了域名访问，提供IP访问选项
    if [ -z "$FRONTEND_DOMAIN" ]; then
        echo -e "${YELLOW}请选择IP访问模式:${NC}"
        echo -e "1) ${CYAN}本地访问${NC} (localhost - 仅限本机访问)"
        echo -e "2) ${CYAN}局域网访问${NC} (本机IP - 可在同一网络内的其他设备访问)"
        echo -e "3) ${CYAN}公网IP访问${NC} (固定公网IP - 服务器有固定公网IP)"
        echo -e "4) ${CYAN}公网动态IP访问${NC} (动态公网IP - 服务器公网IP会变化)"
        
        read -p "请选择访问模式 [1-4，默认2]: " IP_MODE
        IP_MODE=${IP_MODE:-2}
        
        case $IP_MODE in
            1)
                ACCESS_IP="localhost"
                echo -e "将使用本地访问: ${CYAN}http://localhost:${FRONTEND_PORT_EXPOSED}${NC}"
                ;;
            2)
                LOCAL_IP=$(hostname -I | awk '{print $1}')
                ACCESS_IP=$LOCAL_IP
                echo -e "将使用局域网访问: ${CYAN}http://${ACCESS_IP}:${FRONTEND_PORT_EXPOSED}${NC}"
                echo -e "${YELLOW}注意: 请确保服务器防火墙已开放 ${FRONTEND_PORT_EXPOSED} 端口${NC}"
                ;;
            3)
                echo -e "${YELLOW}您选择了固定公网IP访问模式${NC}"
                read -p "请输入服务器公网IP: " PUBLIC_IP
                if [ -z "$PUBLIC_IP" ]; then
                    PUBLIC_IP=$(hostname -I | awk '{print $1}')
                    echo -e "${YELLOW}未提供公网IP，将使用本机IP: ${PUBLIC_IP}${NC}"
                fi
                ACCESS_IP=$PUBLIC_IP
                echo -e "将使用公网IP访问: ${CYAN}http://${ACCESS_IP}:${FRONTEND_PORT_EXPOSED}${NC}"
                echo -e "${YELLOW}注意事项:${NC}"
                echo -e "1. 请确保服务器防火墙和安全组已开放 ${FRONTEND_PORT_EXPOSED} 端口"
                echo -e "2. 如有云服务商提供的外部防火墙或安全组，也需要开放该端口"
                ;;
            4)
                echo -e "${YELLOW}您选择了公网动态IP访问模式${NC}"
                echo -e "${YELLOW}重要提示:${NC}"
                echo -e "由于公网IP会变化，建议配置动态域名解析(DDNS)服务，将一个固定域名解析到您的动态IP"
                echo -e "常用的DDNS服务提供商包括: 花生壳、No-IP、DynDNS等"
                
                read -p "您是否已配置DDNS服务？[y/N]: " has_ddns
                has_ddns=${has_ddns:-N}
                
                if [[ $has_ddns =~ ^[Yy]$ ]]; then
                    read -p "请输入您的DDNS域名: " DDNS_DOMAIN
                    if [ -n "$DDNS_DOMAIN" ]; then
                        FRONTEND_DOMAIN=$DDNS_DOMAIN
                        ACCESS_TYPE="domain"
                        echo -e "将使用DDNS域名访问: ${CYAN}http://${FRONTEND_DOMAIN}:${FRONTEND_PORT_EXPOSED}${NC}"
                        echo -e "${YELLOW}请确保:${NC}"
                        echo -e "1. DDNS客户端已正确配置并运行"
                        echo -e "2. 端口映射已正确配置(将外部端口 ${FRONTEND_PORT_EXPOSED} 映射到内部端口 ${FRONTEND_PORT})"
                    else
                        echo -e "${YELLOW}未提供DDNS域名，将使用当前IP，但请注意IP变化后将无法访问${NC}"
                        read -p "请输入当前公网IP: " CURRENT_IP
                        ACCESS_IP=${CURRENT_IP:-$(hostname -I | awk '{print $1}')}
                        ACCESS_TYPE="ip"
                    fi
                else
                    echo -e "${YELLOW}警告: 没有配置DDNS服务，IP变化后将无法通过公网访问系统${NC}"
                    echo -e "${YELLOW}建议参考以下资源配置DDNS:${NC}"
                    echo -e "- 花生壳DDNS: https://hsk.oray.com/"
                    echo -e "- NO-IP: https://www.noip.com/"
                    echo -e "- 路由器内置的DDNS功能"
                    
                    read -p "请输入当前公网IP: " CURRENT_IP
                    ACCESS_IP=${CURRENT_IP:-$(hostname -I | awk '{print $1}')}
                    ACCESS_TYPE="ip"
                fi
                
                echo -e "${YELLOW}端口映射提示:${NC}"
                echo -e "如果服务器在路由器后面，您需要在路由器上配置端口映射:"
                echo -e "1. 前端服务: 外部端口 ${FRONTEND_PORT_EXPOSED} -> 内部IP $(hostname -I | awk '{print $1}'):${FRONTEND_PORT}"
                echo -e "2. 后端服务: 外部端口 ${BACKEND_PORT_EXPOSED} -> 内部IP $(hostname -I | awk '{print $1}'):${BACKEND_PORT}"
                ;;
        esac
        
        if [ "$IP_MODE" != "4" ] || [ -z "$FRONTEND_DOMAIN" ]; then
            ACCESS_TYPE="ip"
        fi
    fi
    
    echo -e "${BLUE}------------------------------------------------------------${NC}"
    echo -e "${YELLOW}高级配置 (可选)${NC}"
    
    # 高级配置
    read -p "数据卷名称前缀 [${DEFAULT_VOLUME_PREFIX}]: " VOLUME_PREFIX
    VOLUME_PREFIX=${VOLUME_PREFIX:-$DEFAULT_VOLUME_PREFIX}
    
    read -p "Docker Hub用户名 [${DEFAULT_DOCKER_HUB_USERNAME}]: " DOCKER_HUB_USERNAME
    DOCKER_HUB_USERNAME=${DOCKER_HUB_USERNAME:-$DEFAULT_DOCKER_HUB_USERNAME}
    
    echo -e "${BLUE}------------------------------------------------------------${NC}"
    
    # 确认配置
    echo -e "${YELLOW}请确认以下配置:${NC}"
    echo -e "• 安装目录: ${CYAN}${INSTALL_DIR}${NC}"
    echo -e "• 数据库名称: ${CYAN}${DB_NAME}${NC}"
    echo -e "• 数据库用户名: ${CYAN}${DB_USER}${NC}"
    echo -e "• 数据库密码: ${CYAN}${DB_PASSWORD}${NC}"
    echo -e "• 数据库端口: ${CYAN}${DB_PORT_EXPOSED}${NC}"
    echo -e "• 后端服务端口: ${CYAN}${BACKEND_PORT_EXPOSED}${NC}"
    echo -e "• 前端服务端口: ${CYAN}${FRONTEND_PORT_EXPOSED}${NC}"
    
    if [ "$ACCESS_TYPE" = "domain" ]; then
        echo -e "• 访问方式: ${CYAN}域名 (${FRONTEND_DOMAIN})${NC}"
    else
        echo -e "• 访问方式: ${CYAN}IP地址 (${ACCESS_IP})${NC}"
    fi
    
    echo -e "• 数据卷名称前缀: ${CYAN}${VOLUME_PREFIX}${NC}"
    echo -e "• Docker Hub用户名: ${CYAN}${DOCKER_HUB_USERNAME}${NC}"
    
    echo
    read -p "配置信息正确吗? [Y/n]: " confirm
    confirm=${confirm:-Y}
    
    if [[ ! $confirm =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}重新配置...${NC}"
        interactive_config
    fi
}

# 生成.env文件
generate_env_file() {
    echo -e "${YELLOW}正在生成环境配置文件...${NC}"
    
    # 创建安装目录
    mkdir -p $INSTALL_DIR
    
    # 确定ALLOWED_ORIGINS
    if [ "$ACCESS_TYPE" = "domain" ] && [ -n "$FRONTEND_DOMAIN" ]; then
        CORS_ORIGINS="http://localhost:$FRONTEND_PORT_EXPOSED,http://127.0.0.1:$FRONTEND_PORT_EXPOSED,http://$FRONTEND_DOMAIN:$FRONTEND_PORT_EXPOSED"
    else
        CORS_ORIGINS="http://localhost:$FRONTEND_PORT_EXPOSED,http://127.0.0.1:$FRONTEND_PORT_EXPOSED,http://$ACCESS_IP:$FRONTEND_PORT_EXPOSED"
    fi
    
    # 生成.env文件
    cat > $INSTALL_DIR/.env << EOF
# 帮你品牌货盘管理系统 - 环境配置
# 由deploy.sh脚本自动生成于$(date)

#==================================================
# 项目基本配置
#==================================================
# Docker镜像标签
TAG=latest

# Docker Hub用户名（用于拉取镜像）
DOCKER_HUB_USERNAME=$DOCKER_HUB_USERNAME

# 数据卷名称前缀，用于区分多个部署实例
VOLUME_PREFIX=$VOLUME_PREFIX

# 日志配置
LOG_MAX_SIZE=10m
LOG_MAX_FILE=3

#==================================================
# 数据库配置
#==================================================
# 数据库名称
DB_NAME=$DB_NAME

# 数据库用户名
DB_USER=$DB_USER

# 数据库密码 
DB_PASSWORD=$DB_PASSWORD

# 数据库外部端口（主机映射端口）
DB_PORT_EXPOSED=$DB_PORT_EXPOSED

#==================================================
# 后端配置
#==================================================
# 运行环境
NODE_ENV=production

# 后端服务端口
BACKEND_PORT=$BACKEND_PORT

# 后端服务外部端口（主机映射端口）
BACKEND_PORT_EXPOSED=$BACKEND_PORT_EXPOSED

# JWT密钥（自动生成的安全值）
JWT_SECRET=$(openssl rand -base64 32)

# JWT令牌过期时间
JWT_EXPIRES_IN=30d

# 单文件上传大小限制（MB）
MAX_FILE_SIZE=20

# 压缩包上传大小限制（MB）
MAX_ZIP_SIZE=500

# 允许的CORS来源（逗号分隔的URL列表）
ALLOWED_ORIGINS=$CORS_ORIGINS

#==================================================
# 前端配置
#==================================================
# 前端服务端口
FRONTEND_PORT=$FRONTEND_PORT

# 前端服务外部端口（主机映射端口）
FRONTEND_PORT_EXPOSED=$FRONTEND_PORT_EXPOSED

#==================================================
# 访问配置
#==================================================
# 访问方式 (domain或ip)
ACCESS_TYPE=$ACCESS_TYPE

# 前端访问域名 (如果使用域名访问)
FRONTEND_DOMAIN=$FRONTEND_DOMAIN

# 前端访问IP (如果使用IP访问)
ACCESS_IP=$ACCESS_IP

# 系统配置
FIRST_RUN_MODE=${FIRST_RUN_MODE:-false}
EOF
    
    echo -e "${GREEN}环境配置文件已生成: ${INSTALL_DIR}/.env ✓${NC}"
}

# 下载必要文件
download_files() {
    echo -e "${YELLOW}正在下载必要文件...${NC}"
    
    # 下载docker-compose.yml
    echo -e "下载 docker-compose.yml..."
    curl -s -o $INSTALL_DIR/docker-compose.yml $REPO_URL/docker-compose.yml
    
    # 下载数据库初始化脚本
    echo -e "下载 setup-db.sql..."
    curl -s -o $INSTALL_DIR/setup-db.sql $REPO_URL/setup-db.sql
    
    echo -e "${GREEN}必要文件下载完成 ✓${NC}"
}

# 部署服务
deploy_services() {
    echo -e "${YELLOW}正在部署服务...${NC}"
    
    # 进入安装目录
    cd $INSTALL_DIR
    
    # 拉取镜像
    echo -e "拉取镜像中，这可能需要几分钟时间..."
    if ! $COMPOSE_CMD pull; then
        echo -e "${RED}拉取镜像失败，请检查网络连接和Docker Hub凭据${NC}"
        exit 1
    fi
    
    # 启动服务
    echo -e "启动服务中..."
    if ! $COMPOSE_CMD up -d; then
        echo -e "${RED}启动服务失败，正在尝试停止并重新启动...${NC}"
        $COMPOSE_CMD down
        if ! $COMPOSE_CMD up -d; then
            echo -e "${RED}服务启动失败，请检查日志: ${CYAN}cd ${INSTALL_DIR} && docker-compose logs${NC}"
            exit 1
        fi
    fi
    
    echo -e "${GREEN}服务部署完成 ✓${NC}"
}

# 验证服务状态
verify_services() {
    echo -e "${YELLOW}正在验证服务状态...${NC}"
    
    # 进入安装目录
    cd $INSTALL_DIR
    
    # 等待服务启动
    echo -e "等待服务启动完成..."
    sleep 10
    
    # 检查容器状态
    if ! $COMPOSE_CMD ps | grep -q "Up"; then
        echo -e "${RED}服务未正常运行，请检查日志: ${CYAN}cd ${INSTALL_DIR} && docker-compose logs${NC}"
        exit 1
    fi
    
    # 检查前端可访问性
    echo -e "检查前端服务..."
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:$FRONTEND_PORT_EXPOSED | grep -q "200\|301\|302"; then
        echo -e "${GREEN}前端服务运行正常 ✓${NC}"
    else
        echo -e "${YELLOW}警告: 无法验证前端服务，但容器已启动${NC}"
    fi
    
    # 检查后端可访问性
    echo -e "检查后端服务..."
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:$BACKEND_PORT_EXPOSED/health | grep -q "200"; then
        echo -e "${GREEN}后端服务运行正常 ✓${NC}"
    else
        echo -e "${YELLOW}警告: 无法验证后端服务，但容器已启动${NC}"
    fi
    
    echo -e "${GREEN}服务验证完成 ✓${NC}"
}

# 创建监控脚本
create_monitoring_script() {
    echo -e "${YELLOW}正在创建基本监控脚本...${NC}"
    
    # 监控脚本路径
    MONITOR_SCRIPT="${INSTALL_DIR}/monitor.sh"
    
    # 检查目录是否存在并可写
    if [ ! -d "$INSTALL_DIR" ]; then
        echo -e "${RED}错误: 目录 $INSTALL_DIR 不存在${NC}"
        mkdir -p "$INSTALL_DIR" || { echo -e "${RED}无法创建目录 $INSTALL_DIR${NC}"; return 1; }
    fi
    
    if [ ! -w "$INSTALL_DIR" ]; then
        echo -e "${RED}错误: 目录 $INSTALL_DIR 不可写${NC}"
        return 1
    fi
    
    # 创建监控脚本
    cat > $MONITOR_SCRIPT << 'EOF'
#!/bin/bash

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 获取正确的 Docker Compose 命令
if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
else
    COMPOSE_CMD="docker compose"
fi

# 显示帮助信息
show_help() {
    echo -e "${BLUE}帮你品牌货盘管理系统 - 监控工具${NC}"
    echo -e "用法: $0 [选项]"
    echo -e ""
    echo -e "选项:"
    echo -e "  ${CYAN}status${NC}     查看所有容器状态"
    echo -e "  ${CYAN}stats${NC}      监控容器资源使用情况"
    echo -e "  ${CYAN}logs${NC}       查看所有容器日志"
    echo -e "  ${CYAN}db-logs${NC}    查看数据库容器日志"
    echo -e "  ${CYAN}api-logs${NC}   查看后端API容器日志" 
    echo -e "  ${CYAN}web-logs${NC}   查看前端Web容器日志"
    echo -e "  ${CYAN}restart${NC}    重启所有服务"
    echo -e "  ${CYAN}health${NC}     检查服务健康状态"
    echo -e "  ${CYAN}help${NC}       显示此帮助信息"
    echo -e ""
    echo -e "例子:"
    echo -e "  $0 status    # 查看所有容器状态"
    echo -e "  $0 stats     # 监控资源使用情况"
}

# 检查服务健康状态
check_health() {
    echo -e "${YELLOW}检查服务健康状态...${NC}"
    
    # 检查容器状态
    if ! $COMPOSE_CMD ps | grep -q "Up"; then
        echo -e "${RED}警告: 部分或全部服务未运行${NC}"
        $COMPOSE_CMD ps
        return 1
    fi
    
    # 获取端口信息
    FRONTEND_PORT=$(grep FRONTEND_PORT_EXPOSED .env | cut -d= -f2)
    BACKEND_PORT=$(grep BACKEND_PORT_EXPOSED .env | cut -d= -f2)
    
    # 使用默认值
    FRONTEND_PORT=${FRONTEND_PORT:-6017}
    BACKEND_PORT=${BACKEND_PORT:-6016}
    
    # 检查前端可访问性
    echo -e "检查前端服务(端口:${FRONTEND_PORT})..."
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:${FRONTEND_PORT} | grep -q "200\|301\|302"; then
        echo -e "${GREEN}前端服务运行正常 ✓${NC}"
    else
        echo -e "${RED}警告: 前端服务无法访问${NC}"
    fi
    
    # 检查后端可访问性
    echo -e "检查后端服务(端口:${BACKEND_PORT})..."
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:${BACKEND_PORT}/health | grep -q "200"; then
        echo -e "${GREEN}后端服务运行正常 ✓${NC}"
    else
        echo -e "${RED}警告: 后端服务无法访问${NC}"
    fi
    
    # 检查容器健康状态
    echo -e "检查容器健康状态..."
    for container in bnpallet-postgres bnpallet-backend bnpallet-frontend; do
        status=$(docker inspect --format='{{.State.Health.Status}}' $container 2>/dev/null)
        if [ "$status" = "healthy" ]; then
            echo -e "${GREEN}$container: 健康 ✓${NC}"
        elif [ "$status" = "unhealthy" ]; then
            echo -e "${RED}$container: 不健康 ✗${NC}"
        elif [ "$status" = "starting" ]; then
            echo -e "${YELLOW}$container: 启动中...${NC}"
        else
            echo -e "${YELLOW}$container: 状态未知 (可能没有健康检查配置)${NC}"
        fi
    done
    
    # 显示系统资源使用情况
    echo -e "\n${YELLOW}系统资源使用情况:${NC}"
    docker stats --no-stream
}

# 主函数
main() {
    # 切换到安装目录，确保docker-compose.yml和.env存在
    cd $(dirname "$0")
    
    # 没有参数或help参数，显示帮助
    if [ $# -eq 0 ] || [ "$1" = "help" ]; then
        show_help
        exit 0
    fi
    
    # 根据参数执行不同操作
    case "$1" in
        status)
            echo -e "${YELLOW}容器状态:${NC}"
            $COMPOSE_CMD ps
            ;;
        stats)
            echo -e "${YELLOW}监控容器资源使用情况:${NC}"
            docker stats
            ;;
        logs)
            echo -e "${YELLOW}查看所有容器日志:${NC}"
            $COMPOSE_CMD logs ${@:2}
            ;;
        db-logs)
            echo -e "${YELLOW}查看数据库容器日志:${NC}"
            $COMPOSE_CMD logs postgres ${@:2}
            ;;
        api-logs)
            echo -e "${YELLOW}查看后端API容器日志:${NC}"
            $COMPOSE_CMD logs backend ${@:2}
            ;;
        web-logs)
            echo -e "${YELLOW}查看前端Web容器日志:${NC}"
            $COMPOSE_CMD logs frontend ${@:2}
            ;;
        restart)
            echo -e "${YELLOW}重启所有服务...${NC}"
            $COMPOSE_CMD restart
            echo -e "${GREEN}服务已重启 ✓${NC}"
            ;;
        health)
            check_health
            ;;
        *)
            echo -e "${RED}错误: 未知参数 '$1'${NC}"
            show_help
            exit 1
            ;;
    esac
}

# 执行主函数
main "$@"
EOF
    
    # 检查脚本是否成功创建
    if [ ! -f "$MONITOR_SCRIPT" ]; then
        echo -e "${RED}错误: 无法创建监控脚本 ${MONITOR_SCRIPT}${NC}"
        return 1
    fi
    
    # 设置可执行权限
    chmod +x $MONITOR_SCRIPT || { echo -e "${RED}无法设置脚本执行权限${NC}"; return 1; }
    
    # 确认监控脚本已成功创建
    if [ -x "$MONITOR_SCRIPT" ]; then
        echo -e "${GREEN}监控脚本已创建: ${MONITOR_SCRIPT} ✓${NC}"
        echo -e "使用方法: ${CYAN}${MONITOR_SCRIPT} help${NC} 查看可用命令"
    else
        echo -e "${RED}警告: 监控脚本创建成功，但可能没有正确设置执行权限${NC}"
    fi
}

# 创建本地镜像缓存脚本
create_offline_install_script() {
    echo -e "${YELLOW}正在创建本地镜像缓存脚本...${NC}"
    
    # 离线安装脚本路径
    OFFLINE_SCRIPT="${INSTALL_DIR}/offline-install.sh"
    
    # 检查目录是否存在并可写
    if [ ! -d "$INSTALL_DIR" ]; then
        echo -e "${RED}错误: 目录 $INSTALL_DIR 不存在${NC}"
        mkdir -p "$INSTALL_DIR" || { echo -e "${RED}无法创建目录 $INSTALL_DIR${NC}"; return 1; }
    fi
    
    if [ ! -w "$INSTALL_DIR" ]; then
        echo -e "${RED}错误: 目录 $INSTALL_DIR 不可写${NC}"
        return 1
    fi
    
    # 创建离线安装脚本
    cat > $OFFLINE_SCRIPT << 'EOF'
#!/bin/bash

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 获取正确的 Docker Compose 命令
if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
else
    COMPOSE_CMD="docker compose"
fi

echo -e "${YELLOW}帮你品牌货盘管理系统 - 本地镜像保存工具${NC}"
echo -e "此脚本用于保存和加载Docker镜像，适用于无法直接从DockerHub拉取镜像的环境"
echo -e ""

# 显示帮助信息
show_help() {
    echo -e "用法: $0 [命令]"
    echo -e ""
    echo -e "命令:"
    echo -e "  ${CYAN}save${NC}       保存当前镜像到压缩文件"
    echo -e "  ${CYAN}load${NC}       从压缩文件加载镜像"
    echo -e "  ${CYAN}help${NC}       显示此帮助信息"
    echo -e ""
    echo -e "例子:"
    echo -e "  $0 save     # 保存镜像到bnpallet-images.tar.gz"
    echo -e "  $0 load     # 从bnpallet-images.tar.gz加载镜像"
}

# 保存镜像
save_images() {
    echo -e "${YELLOW}正在保存Docker镜像...${NC}"
    
    # 检查环境文件
    if [ ! -f .env ]; then
        echo -e "${RED}错误: 未找到.env文件${NC}"
        exit 1
    fi
    
    # 加载环境变量
    source .env
    
    # 设置默认值
    DOCKER_HUB_USERNAME=${DOCKER_HUB_USERNAME:-miaochi}
    TAG=${TAG:-latest}
    
    # 构建镜像名称
    BACKEND_IMAGE="${DOCKER_HUB_USERNAME}/bnpallet-backend:${TAG}"
    FRONTEND_IMAGE="${DOCKER_HUB_USERNAME}/bnpallet-frontend:${TAG}"
    DB_IMAGE="postgres:16-alpine"
    
    echo -e "将保存以下镜像:"
    echo -e "• ${CYAN}${BACKEND_IMAGE}${NC}"
    echo -e "• ${CYAN}${FRONTEND_IMAGE}${NC}"
    echo -e "• ${CYAN}${DB_IMAGE}${NC}"
    
    echo -e "${YELLOW}保存中，这可能需要几分钟...${NC}"
    
    # 保存镜像到压缩文件
    docker save ${BACKEND_IMAGE} ${FRONTEND_IMAGE} ${DB_IMAGE} | gzip > bnpallet-images.tar.gz
    
    # 检查是否成功
    if [ $? -eq 0 ]; then
        IMAGE_SIZE=$(du -h bnpallet-images.tar.gz | cut -f1)
        echo -e "${GREEN}镜像已保存到文件: bnpallet-images.tar.gz (${IMAGE_SIZE}) ✓${NC}"
    else
        echo -e "${RED}保存镜像失败${NC}"
        exit 1
    fi
}

# 加载镜像
load_images() {
    IMAGE_FILE="bnpallet-images.tar.gz"
    
    # 检查镜像文件是否存在
    if [ ! -f "${IMAGE_FILE}" ]; then
        echo -e "${RED}错误: 未找到镜像文件 ${IMAGE_FILE}${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}正在加载Docker镜像...${NC}"
    echo -e "加载中，这可能需要几分钟..."
    
    # 加载镜像
    gunzip -c ${IMAGE_FILE} | docker load
    
    # 检查是否成功
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}镜像加载成功 ✓${NC}"
        echo -e "加载的镜像列表:"
        docker images | grep "bnpallet\|postgres"
    else
        echo -e "${RED}加载镜像失败${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}提示: 现在您可以运行 ${CYAN}./${COMPOSE_CMD} up -d${NC} 启动服务${NC}"
}

# 主函数
main() {
    # 没有参数或help参数，显示帮助
    if [ $# -eq 0 ] || [ "$1" = "help" ]; then
        show_help
        exit 0
    fi
    
    # 根据参数执行不同操作
    case "$1" in
        save)
            save_images
            ;;
        load)
            load_images
            ;;
        *)
            echo -e "${RED}错误: 未知参数 '$1'${NC}"
            show_help
            exit 1
            ;;
    esac
}

# 执行主函数
main "$@"
EOF
    
    # 检查脚本是否成功创建
    if [ ! -f "$OFFLINE_SCRIPT" ]; then
        echo -e "${RED}错误: 无法创建离线安装脚本 ${OFFLINE_SCRIPT}${NC}"
        return 1
    fi
    
    # 设置可执行权限
    chmod +x $OFFLINE_SCRIPT || { echo -e "${RED}无法设置脚本执行权限${NC}"; return 1; }
    
    # 确认离线安装脚本已成功创建
    if [ -x "$OFFLINE_SCRIPT" ]; then
        echo -e "${GREEN}本地镜像缓存脚本已创建: ${OFFLINE_SCRIPT} ✓${NC}"
        echo -e "使用方法: ${CYAN}${OFFLINE_SCRIPT} help${NC} 查看可用命令"
    else
        echo -e "${RED}警告: 离线安装脚本创建成功，但可能没有正确设置执行权限${NC}"
    fi
}

# 配置管理员账户
configure_admin_account() {
    echo -e "${YELLOW}配置管理员账户${NC}"
    echo "您可以设置初始管理员账户信息，或使用默认值。"
    
    # 提供首次运行引导选项
    echo -e "${WHITE}请选择管理员账户设置方式:${NC}"
    echo -e "1) 现在设置管理员账户"
    echo -e "2) 启用首次运行向导（系统启动后将提示创建管理员账户）"
    read -p "> " admin_mode_choice
    
    if [ "$admin_mode_choice" = "2" ]; then
        FIRST_RUN_MODE="true"
        echo -e "${GREEN}已启用首次运行向导，系统启动后将引导您创建管理员账户。${NC}"
        echo ""
        return
    fi
    
    # 管理员用户名
    echo -e "请输入管理员用户名 ${CYAN}[默认: $DEFAULT_ADMIN_USERNAME]${NC}:"
    read -p "> " input_admin_username
    ADMIN_USERNAME=${input_admin_username:-$DEFAULT_ADMIN_USERNAME}
    
    # 管理员密码
    echo -e "请输入管理员密码 ${CYAN}[默认: $DEFAULT_ADMIN_PASSWORD]${NC}:"
    read -p "> " input_admin_password
    ADMIN_PASSWORD=${input_admin_password:-$DEFAULT_ADMIN_PASSWORD}
    
    # 验证密码
    if [ "$input_admin_password" != "" ]; then
        echo -e "请再次输入管理员密码进行确认:"
        read -p "> " confirm_admin_password
        
        if [ "$ADMIN_PASSWORD" != "$confirm_admin_password" ]; then
            echo -e "${RED}密码不匹配，请重新设置。${NC}"
            configure_admin_account
            return
        fi
    fi
    
    echo -e "${GREEN}管理员账户设置完成!${NC}"
    echo ""
}

# 主函数
main() {
    show_banner
    check_environment
    setup_docker_mirror
    interactive_config
    
    # 配置管理员账户
    configure_admin_account
    
    # 根据配置模式处理管理员账户
    if [ "$FIRST_RUN_MODE" = "true" ]; then
        echo -e "${YELLOW}已启用首次运行向导模式，将在系统首次启动时创建管理员账户。${NC}"
        # 使用默认值，但标记为首次运行模式，不会实际创建管理员账户
        ADMIN_USERNAME=$DEFAULT_ADMIN_USERNAME
        ADMIN_PASSWORD=$DEFAULT_ADMIN_PASSWORD
        
        # 修改setup-db.sql，去掉初始管理员账户创建
        sed -i '/-- 初始管理员账户/,/ON CONFLICT (username) DO NOTHING;/d' "${INSTALL_DIR}/setup-db.sql"
    else
        # 生成管理员密码哈希
        echo -e "${YELLOW}生成管理员账户...${NC}"
        ADMIN_PASSWORD_HASH=$(docker run --rm miaochi/bnpallet-backend:latest node -e "const bcrypt = require('bcrypt'); console.log(bcrypt.hashSync('$ADMIN_PASSWORD', 10))")
        if [ -z "$ADMIN_PASSWORD_HASH" ]; then
            echo -e "${RED}生成密码哈希失败，将使用默认密码哈希。${NC}"
            # 默认的密码哈希值对应 "123456"
            ADMIN_PASSWORD_HASH='$2b$10$oeFSfeVH9UYl1sOQBF5XSef9nQCf/B41kKO3LYh8xFSPegBfm2Ja.'
        fi
        
        # 修改setup-db.sql中的管理员信息
        sed -i "s/INSERT INTO public\.users (username, password, name, status, is_admin, company) VALUES ('admin', '.*', '系统管理员', 'ACTIVE', true, '帮你品牌')/INSERT INTO public.users (username, password, name, status, is_admin, company) VALUES ('$ADMIN_USERNAME', '$ADMIN_PASSWORD_HASH', '系统管理员', 'ACTIVE', true, '帮你品牌')/" "${INSTALL_DIR}/setup-db.sql"
    fi
    
    generate_env_file
    download_files
    
    deploy_services
    verify_services
    create_monitoring_script
    create_offline_install_script
    show_completion
}

# 执行主函数
main 
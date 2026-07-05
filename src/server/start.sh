#!/bin/bash
# =============================================
# TimeBlock 服务器一键启动脚本 - Linux/Mac 版
# =============================================

# 颜色定义
RED='\033[31m'
GREEN='\033[32m'
YELLOW='\033[33m'
BLUE='\033[34m'
CYAN='\033[36m'
RESET='\033[0m'

# 切换到脚本所在目录
cd "$(dirname "$0")"

echo ""
echo "${CYAN}╔══════════════════════════════════════════════╗${RESET}"
echo "${CYAN}║     TimeBlock 服务器一键启动 (Linux/Mac)    ║${RESET}"
echo "${CYAN}╚══════════════════════════════════════════════╝${RESET}"
echo ""

# 检查 Node.js 是否安装
if ! command -v node &> /dev/null; then
    echo "${RED}[错误] Node.js 未安装${RESET}"
    echo "${YELLOW}[提示] 请从 https://nodejs.org/ 下载安装 Node.js${RESET}"
    echo "${YELLOW}       或使用包管理器安装:${RESET}"
    echo "       - Ubuntu/Debian: sudo apt install nodejs npm"
    echo "       - CentOS/RHEL:   sudo yum install nodejs npm"
    echo "       - macOS:         brew install node"
    exit 1
fi

# 显示 Node.js 版本
NODE_VERSION=$(node -v)
echo "${GREEN}[信息] Node.js 版本: $NODE_VERSION${RESET}"

# 检查脚本执行权限
if [ ! -x "$0" ]; then
    echo "${YELLOW}[警告] 脚本缺少执行权限，正在添加...${RESET}"
    chmod +x "$0"
fi

# 执行启动脚本
node start.js

# 处理退出状态
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
    echo ""
    echo "${RED}[错误] 服务器异常退出 (code: $EXIT_CODE)${RESET}"
fi

exit $EXIT_CODE
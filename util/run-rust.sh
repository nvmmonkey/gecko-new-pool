#!/bin/bash

# 获取脚本所在目录的绝对路径
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

# 颜色定义
readonly COLOR_GREEN='\033[0;32m'
readonly COLOR_YELLOW='\033[1;33m'
readonly COLOR_RESET='\033[0m'

# 日志函数
log_info() {
    echo -e "${COLOR_GREEN}[INFO]${COLOR_RESET} $1" >&2
}

log_warning() {
    echo -e "${COLOR_YELLOW}[WARNING]${COLOR_RESET} $1" >&2
}

# 获取重启间隔时间（分钟）
get_restart_interval() {
    local interval
    interval=$(yq -r '.auto_restart // 0' config.yaml)
    if ! [[ "$interval" =~ ^[0-9]+$ ]]; then
        interval=0
    fi
    log_info "从配置文件读取重启间隔: ${interval}分钟"
    echo "$interval"
}

# 清理函数 (用于 Ctrl+C)
cleanup_and_exit() {
    echo ""
    local current_time=$(date '+%Y-%m-%d %H:%M:%S')
    log_warning "[$current_time] 收到终止信号，正在停止所有进程..."
    
    if pgrep -f "rust-mev-bot" >/dev/null; then
        local pid=$(pgrep -f "rust-mev-bot")
        log_info "找到 rust-mev-bot 进程 PID: $pid"
        pkill -f "rust-mev-bot"
        sleep 1
        if pgrep -f "rust-mev-bot" >/dev/null; then
            log_warning "进程未正常终止，使用强制终止..."
            pkill -9 -f "rust-mev-bot" || true
        fi
        log_info "进程终止完成"
    fi
    
    log_info "清理完成"
    exit 0
}

# 清理函数 (用于正常重启)
cleanup_for_restart() {
    local current_time=$(date '+%Y-%m-%d %H:%M:%S')
    log_warning "[$current_time] 正在终止 rust-mev-bot 进程..."
    
    if pgrep -f "rust-mev-bot" >/dev/null; then
        local pid=$(pgrep -f "rust-mev-bot")
        log_info "找到 rust-mev-bot 进程 PID: $pid"
        pkill -f "rust-mev-bot"
        sleep 1
        if pgrep -f "rust-mev-bot" >/dev/null; then
            log_warning "进程未正常终止，使用强制终止..."
            pkill -9 -f "rust-mev-bot" || true
        fi
        log_info "进程终止完成"
    else
        log_warning "未找到运行中的 rust-mev-bot 进程"
    fi
    
    sleep 5
    return 0
}

# 启动服务
start_service() {
    local current_time=$(date '+%Y-%m-%d %H:%M:%S')
    log_info "[$current_time] 正在启动 rust-mev-bot..."
    
    ./rust-mev-bot &
    local pid=$!
    log_info "rust-mev-bot 已启动，PID: $pid"
    
    return 0
}

# 设置信号处理
trap cleanup_and_exit SIGINT SIGTERM INT

# 主循环
run_main_loop() {
    local start_time=$(date '+%Y-%m-%d %H:%M:%S')
    log_info "脚本启动时间: $start_time"
    
    while true; do
        start_service
        
        local interval
        interval=$(get_restart_interval)
        
        if [ "$interval" -eq 0 ]; then
            log_info "自动重启已禁用，将持续运行..."
            wait
            break
        fi
        
        log_info "等待 ${interval} 分钟后重启..."
        sleep "${interval}m"
        cleanup_for_restart
    done
}

# 执行主循环
run_main_loop
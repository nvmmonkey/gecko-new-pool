#!/bin/bash

# 获取脚本所在目录的绝对路径
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

# 生成唯一实例ID - 使用脚本路径和当前时间戳的哈希值
INSTANCE_ID=$(echo "${SCRIPT_DIR}-$$-$(date +%s)" | md5sum | cut -d' ' -f1)
INSTANCE_PID_FILE="${SCRIPT_DIR}/.instance_${INSTANCE_ID}.pid"
INSTANCE_RUST_PID_FILE="${SCRIPT_DIR}/.rust_mev_bot_${INSTANCE_ID}.pid"
INSTANCE_JUPITER_PID_FILE="${SCRIPT_DIR}/.jupiter_${INSTANCE_ID}.pid"

# 颜色定义
readonly COLOR_RED='\033[0;31m'
readonly COLOR_GREEN='\033[0;32m'
readonly COLOR_YELLOW='\033[1;33m'
readonly COLOR_BLUE='\033[0;34m'
readonly COLOR_RESET='\033[0m'

# 日志函数
log_info() {
    echo -e "${COLOR_GREEN}[INFO]${COLOR_RESET} $1" >&2
}

log_error() {
    echo -e "${COLOR_RED}[ERROR]${COLOR_RESET} $1" >&2
}

log_warning() {
    echo -e "${COLOR_YELLOW}[WARNING]${COLOR_RESET} $1" >&2
}

log_debug() {
    if [[ "${DEBUG:-false}" == "true" ]]; then
        echo -e "${COLOR_BLUE}[DEBUG]${COLOR_RESET} $1" >&2
    fi
}

# 显示帮助信息
show_help() {
    log_info "用法: $0 [选项]"
    log_info "选项:"
    log_info "  --debug    启用调试模式，显示所有日志输出"
    log_info "  --help     显示此帮助信息"
}

# 安装 yq 函数
install_yq() {
    if ! command -v yq &> /dev/null; then
        log_info "正在安装 yq..."
        if wget -qO /usr/local/bin/yq https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64; then
            chmod +x /usr/local/bin/yq
            log_info "yq 安装成功"
        else
            log_error "yq 下载失败"
            return 1
        fi
    fi
    return 0
}

# 检查依赖工具是否安装
check_dependencies() {
    # 首先安装 yq
    install_yq || {
        log_error "yq 安装失败"
        exit 1
    }
    
    # 检查其他依赖
    local dependencies=("jq")
    for dep in "${dependencies[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            log_info "正在安装 $dep..."
            apt update && apt install -y "$dep"
        fi
    done
}

# 检查必要文件
check_required_files() {
    if [ ! -f "config.yaml" ]; then
        log_error "config.yaml 文件不存在！"
        exit 1
    fi

    if [ ! -f "jupiter-swap-api" ]; then
        log_error "jupiter-swap-api 文件不存在！"
        exit 1
    else
        log_info "设置 jupiter-swap-api 权限..."
        chmod +x jupiter-swap-api
    fi
}

# 设置文件权限
setup_file_permissions() {
    log_info "设置文件权限..."
    chmod +x rust-mev-bot upgrade.sh jupiter-swap-api run-jup.sh kill-jup.sh mints-query.sh 2>/dev/null || true
}

# 获取重启间隔时间（分钟）
get_restart_interval() {
    local interval
    interval=$(yq -r '.auto_restart // 0' config.yaml)
    if ! [[ "$interval" =~ ^[0-9]+$ ]]; then
        interval=0
    fi
    echo "$interval"
}

# 生成代币列表
generate_token_list() {
    if [[ "${DEBUG:-false}" == "true" ]]; then
        DEBUG=true ./mints-query.sh
    else
        ./mints-query.sh
    fi
    
    if [ $? -ne 0 ] || [ ! -f "$SCRIPT_DIR/token-cache.json" ]; then
        log_error "token-cache.json 生成失败"
        exit 1
    fi
}

# 检查是否需要启动本地 Jupiter
check_local_jupiter_enabled() {
    local disable_local_jupiter
    disable_local_jupiter=$(yq -r '.jupiter_disable_local // false' config.yaml)
    
    if [[ "$disable_local_jupiter" == "true" ]]; then
        log_info "配置文件设置为不启动本地 Jupiter，跳过启动步骤"
        return 1
    fi
    return 0
}

# 初始化环境
init_environment() {
    check_dependencies
    setup_file_permissions
    check_required_files
    generate_token_list
}

# 存储子进程的PID
CHILD_PIDS=()

# 清理函数 (用于正常重启)
cleanup_for_restart() {
    log_info "准备重启..."
    
    # 删除运行标记文件
    rm -f .jupiter_running 2>/dev/null
    
    # 只终止这个实例管理的进程
    for pid in "${CHILD_PIDS[@]}"; do
        if kill -0 $pid 2>/dev/null; then
            # 首先尝试发送 SIGTERM 以允许进程优雅退出
            kill -15 $pid 2>/dev/null || true
            # 等待一小段时间让进程退出
            sleep 1
            # 如果进程仍然存在，使用 SIGKILL
            if kill -0 $pid 2>/dev/null; then
                kill -9 $pid 2>/dev/null || true
            fi
        fi
    done
    
    # 清理这个实例的PID文件中记录的进程
    if [ -f "$INSTANCE_RUST_PID_FILE" ]; then
        local rust_pid=$(cat "$INSTANCE_RUST_PID_FILE")
        if kill -0 $rust_pid 2>/dev/null; then
            # 首先尝试发送 SIGTERM
            kill -15 $rust_pid 2>/dev/null || true
            sleep 1
            # 如果进程仍然存在，使用 SIGKILL
            if kill -0 $rust_pid 2>/dev/null; then
                kill -9 $rust_pid 2>/dev/null || true
            fi
        fi
        rm -f "$INSTANCE_RUST_PID_FILE"
    fi
    
    if [ -f "$INSTANCE_JUPITER_PID_FILE" ]; then
        local jupiter_pid=$(cat "$INSTANCE_JUPITER_PID_FILE")
        if kill -0 $jupiter_pid 2>/dev/null; then
            # 首先尝试发送 SIGTERM
            kill -15 $jupiter_pid 2>/dev/null || true
            sleep 1
            # 如果进程仍然存在，使用 SIGKILL
            if kill -0 $jupiter_pid 2>/dev/null; then
                kill -9 $jupiter_pid 2>/dev/null || true
            fi
        fi
        rm -f "$INSTANCE_JUPITER_PID_FILE"
    fi
    
    # 重置PID数组
    CHILD_PIDS=()
    
    sleep 5
    return 0
}

# 清理函数 (用于 Ctrl+C)
cleanup_and_exit() {
    echo ""
    log_info "正在终止这个实例的进程..."
    
    # 删除运行标记文件
    rm -f .jupiter_running 2>/dev/null
    
    # 只终止这个实例管理的进程
    for pid in "${CHILD_PIDS[@]}"; do
        if kill -0 $pid 2>/dev/null; then
            # 首先尝试发送 SIGTERM 以允许进程优雅退出
            kill -15 $pid 2>/dev/null || true
            # 等待一小段时间让进程退出
            sleep 1
            # 如果进程仍然存在，使用 SIGKILL
            if kill -0 $pid 2>/dev/null; then
                kill -9 $pid 2>/dev/null || true
            fi
        fi
    done
    
    # 清理这个实例的PID文件中记录的进程
    if [ -f "$INSTANCE_RUST_PID_FILE" ]; then
        local rust_pid=$(cat "$INSTANCE_RUST_PID_FILE")
        if kill -0 $rust_pid 2>/dev/null; then
            # 首先尝试发送 SIGTERM
            kill -15 $rust_pid 2>/dev/null || true
            sleep 1
            # 如果进程仍然存在，使用 SIGKILL
            if kill -0 $rust_pid 2>/dev/null; then
                kill -9 $rust_pid 2>/dev/null || true
            fi
        fi
        rm -f "$INSTANCE_RUST_PID_FILE"
    fi
    
    if [ -f "$INSTANCE_JUPITER_PID_FILE" ]; then
        local jupiter_pid=$(cat "$INSTANCE_JUPITER_PID_FILE")
        if kill -0 $jupiter_pid 2>/dev/null; then
            # 首先尝试发送 SIGTERM
            kill -15 $jupiter_pid 2>/dev/null || true
            sleep 1
            # 如果进程仍然存在，使用 SIGKILL
            if kill -0 $jupiter_pid 2>/dev/null; then
                kill -9 $jupiter_pid 2>/dev/null || true
            fi
        fi
        rm -f "$INSTANCE_JUPITER_PID_FILE"
    fi
    
    # 删除这个实例的PID文件
    rm -f "$INSTANCE_PID_FILE"
    
    log_info "清理完成"
    exit 1
}

# 启动服务
start_service() {
    local restart_interval
    restart_interval=$(get_restart_interval)
    [ "$restart_interval" -gt 0 ] && log_info "自动重启: ${restart_interval}分钟"
    
    # 检查是否需要启动本地 Jupiter
    if check_local_jupiter_enabled; then
        # 启动 Jupiter 并记录 PID
        if [[ "${DEBUG:-false}" == "true" ]]; then
            DEBUG=true ./run-jup.sh --debug &
            local jupiter_pid=$!
            CHILD_PIDS+=($jupiter_pid)
            echo $jupiter_pid > "$INSTANCE_JUPITER_PID_FILE"
        else
            ./run-jup.sh &
            local jupiter_pid=$!
            CHILD_PIDS+=($jupiter_pid)
            echo $jupiter_pid > "$INSTANCE_JUPITER_PID_FILE"
        fi
        sleep 5
    fi
    
    # 启动 rust-mev-bot 并记录 PID
    ./rust-mev-bot &
    local rust_pid=$!
    CHILD_PIDS+=($rust_pid)
    echo $rust_pid > "$INSTANCE_RUST_PID_FILE"
    
    return 0
}

# 设置信号处理
trap cleanup_and_exit SIGINT SIGTERM SIGHUP INT

# 清理之前的实例PID文件
cleanup_old_instances() {
    # 清理超过1天的实例PID文件
    find "$SCRIPT_DIR" -name ".instance_*.pid" -mtime +1 -delete 2>/dev/null
    find "$SCRIPT_DIR" -name ".rust_mev_bot_*.pid" -mtime +1 -delete 2>/dev/null
    find "$SCRIPT_DIR" -name ".jupiter_*.pid" -mtime +1 -delete 2>/dev/null
}

# 主循环
run_main_loop() {
    while true; do
        # Copy token-cache.json
        cp ~/jup/token-cache.json ./
        log_info "复制token-cache成功"
        cp ~/jup/minfile.json ./
        
        init_environment
        start_service
        
        local interval
        interval=$(get_restart_interval)
        
        if [[ "${DEBUG:-false}" == "true" ]] || [ "$interval" -eq 0 ]; then
            # 等待子进程，如果任何一个退出就重启
            wait -n ${CHILD_PIDS[@]}
            if [ "$interval" -eq 0 ]; then
                break
            fi
            cleanup_for_restart
            continue
        fi
        
        sleep "${interval}m"
        cleanup_for_restart
    done
}

# 主函数
main() {
    # 清理旧的实例文件
    cleanup_old_instances
    
    # 写入当前实例的PID
    echo $$ > "$INSTANCE_PID_FILE"
    
    # 解析命令行参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            --debug)
                export DEBUG=true
                shift
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                log_error "未知参数: $1"
                show_help
                exit 1
                ;;
        esac
    done

    run_main_loop
}

# 执行主函数
main "$@"
#!/bin/bash

kill_process_on_port() {
    local port=$1
    local pid=$(lsof -ti tcp:${port})
    if [ ! -z "$pid" ]; then
        kill -15 $pid
        sleep 2
        if kill -0 $pid 2>/dev/null; then
            kill -9 $pid
        fi
        sleep 3
    fi
}

kill_process_and_children() {
    local pid=$1
    local children=$(pgrep -P $pid)
    for child in $children; do
        kill_process_and_children $child
    done
    kill -15 $pid 2>/dev/null || kill -9 $pid
}

start_jupiter_api() {
    # Create a pipe for process communication
    mkfifo jupiter_pipe 2>/dev/null
    
    if [ -n "$YELLOWSTONE_URL" ]; then
        if [ -n "$YELLOWSTONE_XTOKEN" ]; then
            RUST_LOG=info ./jupiter-swap-api --rpc-url $RPC_URL -p $LOCAL_JUPITER_PORT $MARKET_CACHE_PARAM \
                --yellowstone-grpc-endpoint $YELLOWSTONE_URL --market-mode $MARKET_MODE \
                --yellowstone-grpc-x-token $YELLOWSTONE_XTOKEN --expose-quote-and-simulate \
                --allow-circular-arbitrage --enable-new-dexes 2>&1 > jupiter_pipe &
        else
            RUST_LOG=info ./jupiter-swap-api --rpc-url $RPC_URL -p $LOCAL_JUPITER_PORT $MARKET_CACHE_PARAM \
                --yellowstone-grpc-endpoint $YELLOWSTONE_URL --market-mode $MARKET_MODE \
                --expose-quote-and-simulate --allow-circular-arbitrage --enable-new-dexes 2>&1 > jupiter_pipe &
        fi
    else
        RUST_LOG=info ./jupiter-swap-api --rpc-url $RPC_URL -p $LOCAL_JUPITER_PORT $MARKET_CACHE_PARAM \
            --expose-quote-and-simulate --market-mode $MARKET_MODE \
            --allow-circular-arbitrage --enable-new-dexes 2>&1 > jupiter_pipe &
    fi
    echo $! > jupiter.pid
    
    # Start monitoring in background
    (while read line; do
        if echo "$line" | grep -q "panicked at jupiter-core/src/amms/mercurial_amm.rs"; then
            kill_process_and_children $(cat jupiter.pid)
            break
        fi
    done < jupiter_pipe) &
}

ulimit -n 100000

while true; do
    rm -f ./setEnv.sh
    rm -f ./token-cache.json
    rm -f jupiter.pid
    rm -f jupiter_pipe

    ./download      
    source ./setEnv.sh

    LOCAL_JUPITER_PORT=${LOCAL_JUPITER_PORT:-18080}

    if [ "$DISABLE_LOCAL_JUPITER" != "true" ]; then
        kill_process_on_port $LOCAL_JUPITER_PORT
    fi

    if [ "$DISABLE_LOCAL_JUPITER" != "true" ]; then
        if [ "$JUPITER_URL" = "http://0.0.0.0:$LOCAL_JUPITER_PORT" ] || [ "$JUPITER_URL" = "http://0.0.0.0:$LOCAL_JUPITER_PORT/" ]; then
            if [ -n "$JUPITER_RPC_URL" ]; then
                RPC_URL=$JUPITER_RPC_URL
            fi

            MARKET_CACHE_PARAM=""
            if [ "$USE_LOCAL_MARKET_CACHE" = "true" ]; then
                MARKET_CACHE_PARAM="--market-cache mainnet.json"
            fi

            if [ -n "$MARKET_MODE" ]; then
                MARKET_MODE="$MARKET_MODE"
            else
                MARKET_MODE="remote"
            fi

            start_jupiter_api
            JUPITER_PID=$(cat jupiter.pid)
            trap 'KEEP_RUNNING=false; [ "$DISABLE_LOCAL_JUPITER" != "true" ] && kill_process_and_children $JUPITER_PID; rm -f jupiter_pipe; exit 0' SIGINT
        else
            echo "Using external Jupiter API: $JUPITER_URL"
        fi

        sleep 5
    fi

    while true; do
        sleep 5
        if [ ! -z "$JUPITER_PID" ] && ! kill -0 $JUPITER_PID 2>/dev/null; then
            break
        fi
        
        if [ -n "$AUTO_RESTART" ] && [ "$AUTO_RESTART" -ne 0 ]; then
            if [ $(($(date +%s) - $(stat -f %m jupiter.pid))) -gt $((AUTO_RESTART * 60)) ]; then
                kill_process_and_children $JUPITER_PID
                break
            fi
        fi
    done

    sleep 5
done
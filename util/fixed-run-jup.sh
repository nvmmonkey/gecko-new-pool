#!/bin/bash

kill_process_on_port() {
    local port=$1
    local pid=$(lsof -ti tcp:${port})

    if [ ! -z "$pid" ]; then
        echo "Killing process on port $port with PID $pid"
        kill -15 $pid  # Try SIGTERM first
        sleep 2  # Give some time for the process to exit gracefully
        if kill -0 $pid 2>/dev/null; then  # Check if still running
            echo "Process on port $port did not terminate, using SIGKILL"
            kill -9 $pid
        fi
        sleep 3  # Additional wait after force kill
    else
        echo "No process to kill on port $port"
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

ulimit -n 100000

while true; do
  rm -f ./setEnv.sh
  rm -f ./token-cache.json

  # Step 1: Generate setEnv.sh and other setup commands
  ./download      
  source ./setEnv.sh

  LOCAL_JUPITER_PORT=${LOCAL_JUPITER_PORT:-18080}

  echo "Cleaning up... It's normal to see No such file or directory or No process to kill on port $LOCAL_JUPITER_PORT"

  if [ "$DISABLE_LOCAL_JUPITER" != "true" ]; then
    kill_process_on_port $LOCAL_JUPITER_PORT
  fi
  if [ "$DISABLE_LOCAL_JUPITER" != "true" ]; then
    # Only run jupiter-swap-api if JUPITER_URL is exactly "http://0.0.0.0:$LOCAL_JUPITER_PORT"
    if [ "$JUPITER_URL" = "http://0.0.0.0:$LOCAL_JUPITER_PORT" ] || [ "$JUPITER_URL" = "http://0.0.0.0:$LOCAL_JUPITER_PORT/" ]; then
      # Check if JUPITER_RPC_URL exists and use it; otherwise use RPC_URL
      if [ -n "$JUPITER_RPC_URL" ]; then
        RPC_URL=$JUPITER_RPC_URL
        echo "Using JUPITER_RPC_URL: $RPC_URL to start Jupiter API"
      else
        echo "Using default RPC_URL: $RPC_URL to start Jupiter API"
      fi
      echo "Dex included: $DEX_PROGRAM_IDS"
      echo "Dex excluded: $EXCLUDE_DEX_PROGRAM_IDS"

      # Additional parameter for --market-cache if USE_LOCAL_MARKET_CACHE is true
      MARKET_CACHE_PARAM=""
      if [ "$USE_LOCAL_MARKET_CACHE" = "true" ]; then
          echo "Using local market cache from mainnet.json"
          MARKET_CACHE_PARAM="--market-cache mainnet.json"
      fi

      # Load from .env if MARKET_MODE exist, otherwise use "remote"
      if [ -n "$MARKET_MODE" ]; then
        echo "Using MARKET_MODE: $MARKET_MODE"
      else
        echo "Using default MARKET_MODE: remote"
        MARKET_MODE="remote"
      fi

      # Check if YELLOWSTONE_URL is set and use it if available
      if [ -n "$YELLOWSTONE_URL" ]; then
          # Check if YELLOWSTONE_XTOKEN is set
          if [ -n "$YELLOWSTONE_XTOKEN" ]; then
              echo "Starting Jupiter API with YELLOWSTONE and XTOKEN"
              (RUST_LOG=info ./jupiter-swap-api --rpc-url $RPC_URL -p $LOCAL_JUPITER_PORT $MARKET_CACHE_PARAM --yellowstone-grpc-endpoint $YELLOWSTONE_URL --market-mode $MARKET_MODE --yellowstone-grpc-x-token $YELLOWSTONE_XTOKEN --expose-quote-and-simulate --allow-circular-arbitrage --enable-new-dexes 2>&1 | while read line; do
                echo "$line"
                if echo "$line" | grep -q "panicked at jupiter-core/src/amms/mercurial_amm.rs"; then
                  kill -9 $JUPITER_PID
                  break
                fi
              done) &
          else
              # If YELLOWSTONE_XTOKEN is not set, omit it from the command
              echo "Starting Jupiter API with YELLOWSTONE"
              (RUST_LOG=info ./jupiter-swap-api --rpc-url $RPC_URL -p $LOCAL_JUPITER_PORT $MARKET_CACHE_PARAM --yellowstone-grpc-endpoint $YELLOWSTONE_URL --market-mode $MARKET_MODE --expose-quote-and-simulate --allow-circular-arbitrage --enable-new-dexes 2>&1 | while read line; do
                echo "$line"
                if echo "$line" | grep -q "panicked at jupiter-core/src/amms/mercurial_amm.rs"; then
                  kill -9 $JUPITER_PID
                  break
                fi
              done) &
          fi
      else
          echo "Starting Jupiter API without YELLOWSTONE"
          (RUST_LOG=info ./jupiter-swap-api --rpc-url $RPC_URL -p $LOCAL_JUPITER_PORT $MARKET_CACHE_PARAM --expose-quote-and-simulate --market-mode $MARKET_MODE --allow-circular-arbitrage --enable-new-dexes 2>&1 | while read line; do
                echo "$line"
                if echo "$line" | grep -q "panicked at jupiter-core/src/amms/mercurial_amm.rs"; then
                  kill -9 $JUPITER_PID
                  break
                fi
              done) &
      fi
      JUPITER_PID=$!
      trap 'KEEP_RUNNING=false; [ "$DISABLE_LOCAL_JUPITER" != "true" ] && kill_process_and_children $JUPITER_PID; exit 0' SIGINT
    else
      echo "Using external Jupiter API: $JUPITER_URL"
    fi

    sleep 5
  fi

  echo "Auto restart: $AUTO_RESTART minutes"
  # Automatic restart after $AUTO_RESTART minutes if set and not 0
  if [ -n "$AUTO_RESTART" ] && [ "$AUTO_RESTART" -ne 0 ]; then
    sleep ${AUTO_RESTART}m
    echo "AUTO_RESTART is set. Restarting after $AUTO_RESTART minutes..."
    kill_process_and_children $JUPITER_PID
    echo "Restarting processes..."
    continue
  fi

  # Process monitoring and restart on crash
  while true; do
    if [ ! -z "$JUPITER_PID" ] && ! kill -0 $JUPITER_PID 2>/dev/null; then
      echo "Jupiter API process crashed. Restarting..."
      break
    fi
    sleep 5
  done

  echo "Restarting..."
  kill_process_and_children $JUPITER_PID
  echo "Restarting processes..."
done
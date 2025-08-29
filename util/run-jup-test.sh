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

extract_excluded_dexes_to_json() {
    local excluded_dexes="$1"
    local output_file="dexExcluded.json"
    
    if [ -z "$excluded_dexes" ]; then
        echo "No excluded DEX program IDs found. Creating empty JSON file."
        echo '{"excludedDexes": []}' > "$output_file"
    else
        echo "Extracting excluded DEX program IDs to $output_file"
        # Convert comma-separated string to JSON array
        # Remove any spaces and split by comma
        excluded_dexes_clean=$(echo "$excluded_dexes" | tr -d ' ')
        
        # Start building JSON
        echo '{"excludedDexes": [' > "$output_file"
        
        # Split by comma and add each as a JSON string
        IFS=',' read -ra DEX_ARRAY <<< "$excluded_dexes_clean"
        for i in "${!DEX_ARRAY[@]}"; do
            if [ $i -eq 0 ]; then
                echo "  \"${DEX_ARRAY[i]}\"" >> "$output_file"
            else
                echo "  ,\"${DEX_ARRAY[i]}\"" >> "$output_file"
            fi
        done
        
        echo ']}' >> "$output_file"
    fi
    
    echo "Excluded DEX program IDs exported to $output_file"
}

create_filtered_market_cache() {
    local excluded_dexes="$1"
    local original_file="mainnet_only_market.json"
    local filtered_file="mainnet-only_filtered.json"
    local backup_file="mainnet_only_market.json.backup"
    
    # Always restore from backup first if it exists
    if [ -f "$backup_file" ]; then
        echo "Restoring mainnet.json from backup..."
        cp "$backup_file" "$original_file"
    fi
    
    # Create backup if it doesn't exist
    if [ ! -f "$backup_file" ]; then
        echo "Creating backup of mainnet.json..."
        cp "$original_file" "$backup_file"
    fi
    
    if [ -z "$excluded_dexes" ]; then
        echo "No DEX program IDs to exclude. Using original mainnet.json"
        cp "$original_file" "$filtered_file"
        return
    fi
    
    echo "Creating filtered market cache excluding: $excluded_dexes"
    
    # Remove any spaces and split by comma
    excluded_dexes_clean=$(echo "$excluded_dexes" | tr -d ' ')
    
    # Convert comma-separated string to JSON array for jq
    IFS=',' read -ra DEX_ARRAY <<< "$excluded_dexes_clean"
    excluded_json_array="["
    for i in "${!DEX_ARRAY[@]}"; do
        if [ $i -eq 0 ]; then
            excluded_json_array="$excluded_json_array\"${DEX_ARRAY[i]}\""
        else
            excluded_json_array="$excluded_json_array,\"${DEX_ARRAY[i]}\""
        fi
    done
    excluded_json_array="$excluded_json_array]"
    
    echo "Filtering markets in single operation..."
    
    # Apply single jq filter to exclude all DEX program IDs at once
    jq --argjson excluded_list "$excluded_json_array" '
        map(select(.owner as $owner | $excluded_list | index($owner) | not))
    ' "$original_file" > "$filtered_file"
    
    # Count how many markets were removed
    original_count=$(jq '. | length' "$original_file")
    filtered_count=$(jq '. | length' "$filtered_file")
    removed_count=$((original_count - filtered_count))
    
    echo "Market cache filtering complete:"
    echo "  Original markets: $original_count"
    echo "  Filtered markets: $filtered_count"
    echo "  Removed markets: $removed_count"
    
    # Display which DEX program IDs were excluded
    for dex_id in "${DEX_ARRAY[@]}"; do
        if [ -n "$dex_id" ]; then
            echo "  Excluded DEX: $dex_id"
        fi
    done
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
    # Only run jupiter-swap-api if JUPITER_URL is a local address
    if [ "$JUPITER_URL" = "http://0.0.0.0:$LOCAL_JUPITER_PORT" ] || \
       [ "$JUPITER_URL" = "http://0.0.0.0:$LOCAL_JUPITER_PORT/" ] || \
       [ "$JUPITER_URL" = "http://127.0.0.1:$LOCAL_JUPITER_PORT" ] || \
       [ "$JUPITER_URL" = "http://127.0.0.1:$LOCAL_JUPITER_PORT/" ]; then
      # Check if JUPITER_RPC_URL exists and use it; otherwise use RPC_URL
      if [ -n "$JUPITER_RPC_URL" ]; then
        RPC_URL=$JUPITER_RPC_URL
        echo "Using JUPITER_RPC_URL: $RPC_URL to start Jupiter API"
      else
        echo "Using default RPC_URL: $RPC_URL to start Jupiter API"
      fi
      echo "Dex included: $DEX_PROGRAM_IDS"
      echo "Dex excluded: $EXCLUDE_DEX_PROGRAM_IDS"

      # Extract excluded DEX program IDs to JSON file
      extract_excluded_dexes_to_json "$EXCLUDE_DEX_PROGRAM_IDS"

      # Create filtered market cache excluding specified DEX program IDs
      create_filtered_market_cache "$EXCLUDE_DEX_PROGRAM_IDS"

      # Additional parameter for --market-cache if USE_LOCAL_MARKET_CACHE is true
      MARKET_CACHE_PARAM=""
      if [ "$USE_LOCAL_MARKET_CACHE" = "true" ]; then
          echo "Using local market cache from mainnet-only_filtered.json"
          MARKET_CACHE_PARAM="--market-cache mainnet-only_filtered.json"
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
              export GEYSER_STREAMING_CHUNK_COUNT=16
              RUST_LOG=info ./jupiter-swap-api --rpc-url $RPC_URL -p $LOCAL_JUPITER_PORT $MARKET_CACHE_PARAM --yellowstone-grpc-endpoint $YELLOWSTONE_URL --market-mode $MARKET_MODE --yellowstone-grpc-x-token $YELLOWSTONE_XTOKEN --expose-quote-and-simulate --enable-markets --enable-tokens --allow-circular-arbitrage --enable-new-dexes 2>&1 &
          else
              # If YELLOWSTONE_XTOKEN is not set, omit it from the command
              echo "Starting Jupiter API with YELLOWSTONE"
              export GEYSER_STREAMING_CHUNK_COUNT=16
              RUST_LOG=info ./jupiter-swap-api --rpc-url $RPC_URL -p $LOCAL_JUPITER_PORT $MARKET_CACHE_PARAM --yellowstone-grpc-endpoint $YELLOWSTONE_URL --market-mode $MARKET_MODE --expose-quote-and-simulate --allow-circular-arbitrage --enable-markets --enable-tokens --enable-new-dexes 2>&1 &
          fi
      else
          echo "Starting Jupiter API without YELLOWSTONE"
          export GEYSER_STREAMING_CHUNK_COUNT=16
          RUST_LOG=info ./jupiter-swap-api --rpc-url $RPC_URL -p $LOCAL_JUPITER_PORT $MARKET_CACHE_PARAM --expose-quote-and-simulate --market-mode $MARKET_MODE --allow-circular-arbitrage --enable-markets --enable-tokens --enable-new-dexes 2>&1 &
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
    echo "AUTO_RESTART is set. Restarting after $AUTO_RESTART minutes."
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
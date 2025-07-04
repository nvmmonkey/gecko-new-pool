#!/bin/bash

# download_market_cache.sh
# Downloads the latest market cache from Jupiter API and merges with custom markets
# Supports auto-rerun with configurable interval

# ============ CONFIGURATION ============
# Set AUTO_RERUN_MINUTES to 0 for single run, or any number > 0 for auto-rerun
# Examples:
#   AUTO_RERUN_MINUTES=0    # Run once and exit
#   AUTO_RERUN_MINUTES=30   # Run every 30 minutes
#   AUTO_RERUN_MINUTES=60   # Run every hour
AUTO_RERUN_MINUTES=0

# ============ FILE PATHS ============
MARKET_CACHE_URL="https://cache.jup.ag/markets?v=4"
RAW_FILE="raw_mainnet.json"
CUSTOM_FILE="custom_market.json"
OUTPUT_FILE="mainnet.json"

download_and_merge_markets() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] Starting market cache download and merge..."
    echo "URL: $MARKET_CACHE_URL"
    echo "Raw output: $RAW_FILE"

    # Download the market cache to raw file
    if wget "$MARKET_CACHE_URL" -O "$RAW_FILE"; then
        echo "✓ Market cache downloaded successfully to $RAW_FILE"
        
        # Validate JSON format of raw file
        if jq empty "$RAW_FILE" 2>/dev/null; then
            raw_count=$(jq '. | length' "$RAW_FILE")
            echo "✓ JSON validation passed for raw markets"
            echo "✓ Raw markets downloaded: $raw_count"
        else
            echo "✗ ERROR: Downloaded raw file is not valid JSON!"
            return 1
        fi
    else
        echo "✗ ERROR: Failed to download market cache!"
        return 1
    fi

    # Check if custom markets file exists
    if [ -f "$CUSTOM_FILE" ]; then
        echo ""
        echo "Found custom markets file: $CUSTOM_FILE"
        
        # Validate custom markets JSON
        if jq empty "$CUSTOM_FILE" 2>/dev/null; then
            custom_count=$(jq '. | length' "$CUSTOM_FILE")
            echo "✓ Custom markets JSON validation passed"
            echo "✓ Custom markets found: $custom_count"
            
            echo ""
            echo "Merging raw markets with custom markets..."
            
            # Merge raw markets with custom markets using jq
            if jq -s '.[0] + .[1]' "$RAW_FILE" "$CUSTOM_FILE" > "$OUTPUT_FILE"; then
                total_count=$(jq '. | length' "$OUTPUT_FILE")
                echo "✓ Markets merged successfully!"
                echo "✓ Total markets in $OUTPUT_FILE: $total_count"
                echo "  - Raw markets: $raw_count"
                echo "  - Custom markets: $custom_count"
                echo "  - Combined total: $total_count"
            else
                echo "✗ ERROR: Failed to merge markets!"
                return 1
            fi
        else
            echo "✗ ERROR: Custom markets file is not valid JSON!"
            echo "Using only raw markets..."
            cp "$RAW_FILE" "$OUTPUT_FILE"
            echo "✓ Raw markets copied to $OUTPUT_FILE"
        fi
    else
        echo ""
        echo "No custom markets file found ($CUSTOM_FILE)"
        echo "Using only raw markets..."
        cp "$RAW_FILE" "$OUTPUT_FILE"
        echo "✓ Raw markets copied to $OUTPUT_FILE"
    fi

    # Final validation and summary
    if jq empty "$OUTPUT_FILE" 2>/dev/null; then
        final_count=$(jq '. | length' "$OUTPUT_FILE")
        echo ""
        echo "=== SUMMARY ==="
        echo "✓ Final market cache created: $OUTPUT_FILE"
        echo "✓ Total markets: $final_count"
        
        # Show sample of markets (including any custom ones at the end)
        echo ""
        echo "Sample markets (first 2 and last 2):"
        echo "First 2 markets:"
        jq '.[0:2] | .[] | {pubkey: .pubkey, owner: .owner}' "$OUTPUT_FILE"
        
        if [ "$final_count" -gt 2 ]; then
            echo "Last 2 markets:"
            jq '.[-2:] | .[] | {pubkey: .pubkey, owner: .owner}' "$OUTPUT_FILE"
        fi
        
        echo ""
        echo "Market cache is ready for use!"
        echo "Set USE_LOCAL_MARKET_CACHE=true in your environment to use it."
        return 0
    else
        echo "✗ ERROR: Final output file is not valid JSON!"
        exit 1
    fi
}

# Signal handler for graceful shutdown
cleanup() {
    echo ""
    echo "Received interrupt signal. Exiting gracefully..."
    exit 0
}

# Set up signal trap
trap cleanup SIGINT SIGTERM

# Main execution logic
if [ "$AUTO_RERUN_MINUTES" -eq 0 ]; then
    # Single run mode
    echo "Running market cache download once..."
    download_and_merge_markets
    exit $?
else
    # Auto-rerun mode
    echo "Auto-rerun mode enabled: will run every $AUTO_RERUN_MINUTES minutes"
    echo "Press Ctrl+C to stop"
    echo ""
    
    # Validate interval
    if [ "$AUTO_RERUN_MINUTES" -lt 1 ]; then
        echo "✗ ERROR: AUTO_RERUN_MINUTES must be at least 1 minute"
        exit 1
    fi
    
    # Initial run
    download_and_merge_markets
    
    # Auto-rerun loop
    while true; do
        echo ""
        echo "Waiting $AUTO_RERUN_MINUTES minutes before next run..."
        echo "Next run scheduled at: $(date -d "+$AUTO_RERUN_MINUTES minutes" '+%Y-%m-%d %H:%M:%S')"
        
        # Sleep for the specified interval
        sleep "${AUTO_RERUN_MINUTES}m"
        
        echo ""
        echo "========================================"
        download_and_merge_markets
    done
fi
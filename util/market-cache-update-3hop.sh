#!/bin/bash

# download_market_cache.sh
# Downloads the latest market cache from Jupiter API and merges with custom markets
# Supports auto-rerun with configurable interval
# Now includes git pull, custom market file sync, market exclusion, and only-market filtering functionality

# ============ CONFIGURATION ============
# Set AUTO_RERUN_MINUTES to 0 for single run, or any number > 0 for auto-rerun
# Examples:
#   AUTO_RERUN_MINUTES=0    # Run once and exit
#   AUTO_RERUN_MINUTES=30   # Run every 30 minutes
#   AUTO_RERUN_MINUTES=60   # Run every hour
AUTO_RERUN_MINUTES=60

# Git and file sync configuration
GECKO_REPO_PATH="$HOME/gecko-new-pool"
CUSTOM_MARKET_SOURCE="$HOME/gecko-new-pool/util/custom_market.json"
JUP_DIRECTORY="$HOME/jup"
ENABLE_GIT_SYNC=true  # Set to false to disable git operations

# ============ FILE PATHS ============
MARKET_CACHE_URL="https://cache.jup.ag/markets?v=4"
RAW_FILE="raw_mainnet.json"
CUSTOM_FILE="custom_market.json"
EXCLUDE_FILE="exclude_market.json"
ONLY_FILE="only_market_3hop.json"
ONLY_CUSTOM_FILE="only_custom_market_3hop.json"
OUTPUT_FILE="mainnet.json"
ONLY_OUTPUT_FILE="mainnet_only_market_3hop.json"
BACKUP_FILE="mainnet.json.backup"
ONLY_BACKUP_FILE="mainnet_only_market_3hop.json.backup"
TEMP_FILE="temp_filtered.json"
TEMP_ONLY_FILE="temp_only_filtered.json"

sync_git_and_files() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    echo "[$timestamp] Starting git sync and file updates..."
    
    if [ "$ENABLE_GIT_SYNC" = false ]; then
        echo "Git sync disabled in configuration, skipping..."
        return 0
    fi
    
    # Check if gecko repo directory exists
    if [ ! -d "$GECKO_REPO_PATH" ]; then
        echo "✗ ERROR: Gecko repository not found at $GECKO_REPO_PATH"
        echo "Please ensure the repository is cloned to the correct location"
        return 1
    fi
    
    # Navigate to gecko repo and pull latest changes
    echo "Navigating to $GECKO_REPO_PATH"
    cd "$GECKO_REPO_PATH" || {
        echo "✗ ERROR: Failed to navigate to $GECKO_REPO_PATH"
        return 1
    }
    
    echo "Pulling latest changes from git (discarding local changes)..."
    
    # Force pull by discarding any local changes
    git fetch origin
    current_branch=$(git rev-parse --abbrev-ref HEAD)
    
    if git reset --hard "origin/$current_branch"; then
        cp ~/gecko-new-pool/util/run-jup.sh ~/jup
        cp ~/gecko-new-pool/util/custom_market.json ~/jup
        cp ~/gecko-new-pool/util/exclude_market.json ~/jup
        cp ~/gecko-new-pool/util/only_market_3hop.json ~/jup
        cp ~/gecko-new-pool/util/only_custom_market_3hop.json ~/jup
        # Also copy files to original working directory
        cp ~/gecko-new-pool/util/exclude_market.json "$ORIGINAL_WD/"
        cp ~/gecko-new-pool/util/only_market_3hop.json "$ORIGINAL_WD/"
        cp ~/gecko-new-pool/util/only_custom_market_3hop.json "$ORIGINAL_WD/"
        echo "✓ Git sync completed successfully"
        echo "✓ Using original files from GitHub"
    else
        echo "✗ ERROR: Git sync failed, continuing with existing files"
        echo "This might be due to network issues or repository problems"
        return 1
    fi
    
    # Check if custom market source file exists
    if [ ! -f "$CUSTOM_MARKET_SOURCE" ]; then
        echo "✗ WARNING: Custom market source file not found at $CUSTOM_MARKET_SOURCE"
        echo "Continuing without custom markets..."
        return 0
    fi
    
    # Create jup directory if it doesn't exist
    mkdir -p "$JUP_DIRECTORY"
    
    # Navigate back to original working directory for file operations
    cd "$ORIGINAL_WD" || {
        echo "✗ ERROR: Failed to navigate back to original working directory"
        return 1
    }
    
    # Copy custom market file to original directory
    echo "Copying custom market file..."
    if cp "$CUSTOM_MARKET_SOURCE" "$ORIGINAL_WD/$CUSTOM_FILE"; then
        echo "✓ Custom market file copied successfully"
        echo "  From: $CUSTOM_MARKET_SOURCE"
        echo "  To: $ORIGINAL_WD/$CUSTOM_FILE"
        
        # Validate the copied file
        if jq empty "$ORIGINAL_WD/$CUSTOM_FILE" 2>/dev/null; then
            custom_count=$(jq '. | length' "$ORIGINAL_WD/$CUSTOM_FILE")
            echo "✓ Custom market file validation passed ($custom_count markets)"
        else
            echo "⚠ WARNING: Copied custom market file is not valid JSON"
        fi
    else
        echo "✗ ERROR: Failed to copy custom market file"
        return 1
    fi
    
    echo "✓ Git sync and file updates completed"
    return 0
}

filter_excluded_markets() {
    local input_file="$1"
    local output_file="$2"
    
    echo ""
    echo "Checking for excluded markets..."
    
    # Check if exclude file exists
    if [ ! -f "$EXCLUDE_FILE" ]; then
        echo "No exclude file found ($EXCLUDE_FILE), skipping market filtering"
        cp "$input_file" "$output_file"
        return 0
    fi
    
    # Validate exclude file JSON format
    if ! jq empty "$EXCLUDE_FILE" 2>/dev/null; then
        echo "✗ WARNING: Exclude file is not valid JSON, skipping market filtering"
        cp "$input_file" "$output_file"
        return 0
    fi
    
    # Check if exclude file is an array
    if [ "$(jq -r 'type' "$EXCLUDE_FILE")" != "array" ]; then
        echo "✗ WARNING: Exclude file must be an array of pubkeys, skipping market filtering"
        cp "$input_file" "$output_file"
        return 0
    fi
    
    local exclude_count=$(jq '. | length' "$EXCLUDE_FILE")
    echo "✓ Found exclude file with $exclude_count pubkeys to filter out"
    
    # Show what pubkeys we're looking to exclude
    echo "Pubkeys to exclude:"
    jq -r '.[] | "  - " + .' "$EXCLUDE_FILE"
    
    # Get count before filtering
    local before_count=$(jq '. | length' "$input_file")
    
    # Filter out excluded markets using jq
    # This creates a new array excluding any objects where .pubkey matches any value in the exclude list
    if jq --argjson excludelist "$(cat "$EXCLUDE_FILE")" \
        'map(select(.pubkey as $pk | $excludelist | index($pk) == null))' \
        "$input_file" > "$output_file"; then
        
        local after_count=$(jq '. | length' "$output_file")
        local filtered_count=$((before_count - after_count))
        
        echo "✓ Market filtering completed successfully"
        echo "  - Markets before filtering: $before_count"
        echo "  - Markets after filtering: $after_count"
        echo "  - Markets filtered out: $filtered_count"
        
        # Show which markets were actually filtered (if any)
        if [ "$filtered_count" -gt 0 ]; then
            echo ""
            echo "Markets that were filtered out (matching exclude list):"
            jq --argjson excludelist "$(cat "$EXCLUDE_FILE")" -r \
                'map(select(.pubkey as $pk | $excludelist | index($pk) != null)) | .[] | "  - \(.pubkey) (\(.owner // "unknown owner"))"' \
                "$input_file" | head -10
            
            if [ "$filtered_count" -gt 10 ]; then
                echo "  ... and $((filtered_count - 10)) more"
            fi
        else
            echo ""
            echo "⚠ No markets were filtered - none of the excluded pubkeys were found in the market data"
        fi
        
        return 0
    else
        echo "✗ ERROR: Failed to filter markets, using unfiltered version"
        cp "$input_file" "$output_file"
        return 1
    fi
}

filter_only_markets() {
    local input_file="$1"
    local output_file="$2"
    
    echo ""
    echo "=========================================="
    echo "Processing only_market filtering..."
    
    # Check if only file exists
    if [ ! -f "$ONLY_FILE" ]; then
        echo "No only_market file found ($ONLY_FILE), skipping only-market filtering"
        return 0
    fi
    
    # Validate only file JSON format
    if ! jq empty "$ONLY_FILE" 2>/dev/null; then
        echo "✗ WARNING: Only file is not valid JSON, skipping only-market filtering"
        return 0
    fi
    
    # Check if only file is an array
    if [ "$(jq -r 'type' "$ONLY_FILE")" != "array" ]; then
        echo "✗ WARNING: Only file must be an array of pubkeys, skipping only-market filtering"
        return 0
    fi
    
    local only_count=$(jq '. | length' "$ONLY_FILE")
    
    # Check if the only file is empty
    if [ "$only_count" -eq 0 ]; then
        echo "✓ Only file is empty, skipping only-market filtering"
        echo "No $ONLY_OUTPUT_FILE will be created"
        return 0
    fi
    
    echo "✓ Found only file with $only_count pubkeys to include"
    
    # Show what pubkeys we're looking to include
    echo "Pubkeys to include (only these will remain):"
    jq -r '.[] | "  - " + .' "$ONLY_FILE"
    
    # Get count before filtering
    local before_count=$(jq '. | length' "$input_file")
    
    # Filter to keep only specified markets using jq
    if jq --argjson onlylist "$(cat "$ONLY_FILE")" \
        'map(select(.pubkey as $pk | $onlylist | index($pk) != null))' \
        "$input_file" > "$TEMP_ONLY_FILE"; then
        
        local after_count=$(jq '. | length' "$TEMP_ONLY_FILE")
        local filtered_count=$((before_count - after_count))
        
        echo "✓ Only-market filtering completed successfully"
        echo "  - Markets before filtering: $before_count"
        echo "  - Markets after filtering: $after_count"
        echo "  - Markets filtered out: $filtered_count"
        
        # Now add only_custom markets to the filtered result
        if [ -f "$ONLY_CUSTOM_FILE" ] && jq empty "$ONLY_CUSTOM_FILE" 2>/dev/null; then
            only_custom_count=$(jq '. | length' "$ONLY_CUSTOM_FILE")
            echo ""
            echo "Adding only_custom markets to only-market output..."
            
            # Merge filtered markets with only_custom markets
            if jq -s '.[0] + .[1]' "$TEMP_ONLY_FILE" "$ONLY_CUSTOM_FILE" > "$output_file"; then
                local final_count=$(jq '. | length' "$output_file")
                echo "✓ Only_custom markets added successfully!"
                echo "  - Filtered markets: $after_count"
                echo "  - Only_custom markets: $only_custom_count"
                echo "  - Final total: $final_count"
            else
                echo "✗ ERROR: Failed to merge only_custom markets, using only filtered markets"
                cp "$TEMP_ONLY_FILE" "$output_file"
            fi
        else
            echo "No only_custom markets to add"
            cp "$TEMP_ONLY_FILE" "$output_file"
        fi
        
        # Show which markets were found (if any)
        if [ "$after_count" -gt 0 ]; then
            echo ""
            echo "Markets that were kept (matching only list):"
            jq --argjson onlylist "$(cat "$ONLY_FILE")" -r \
                'map(select(.pubkey as $pk | $onlylist | index($pk) != null)) | .[] | "  - \(.pubkey) (\(.owner // "unknown owner"))"' \
                "$input_file" | head -10
            
            if [ "$after_count" -gt 10 ]; then
                echo "  ... and $((after_count - 10)) more"
            fi
        else
            echo ""
            echo "⚠ No markets were found - none of the only-list pubkeys were found in the market data"
            echo "This could mean:"
            echo "  1. The pubkeys in only_market.json don't exist in the current market data"
            echo "  2. The pubkeys might be formatted incorrectly"
        fi
        
        # Clean up temporary file
        rm -f "$TEMP_ONLY_FILE"
        return 0
    else
        echo "✗ ERROR: Failed to filter only markets"
        rm -f "$TEMP_ONLY_FILE"
        return 1
    fi
}

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

    # Check if custom markets file exists and merge
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
            if jq -s '.[0] + .[1]' "$RAW_FILE" "$CUSTOM_FILE" > "$TEMP_FILE"; then
                total_count=$(jq '. | length' "$TEMP_FILE")
                echo "✓ Markets merged successfully!"
                echo "✓ Total markets before filtering: $total_count"
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
            cp "$RAW_FILE" "$TEMP_FILE"
            echo "✓ Raw markets copied to temporary file"
        fi
    else
        echo ""
        echo "No custom markets file found ($CUSTOM_FILE)"
        echo "Using only raw markets..."
        cp "$RAW_FILE" "$TEMP_FILE"
        echo "✓ Raw markets copied to temporary file"
    fi

    # Apply exclusion filtering for regular mainnet.json
    echo ""
    echo "=========================================="
    echo "Processing regular market filtering (exclude_market.json)..."
    filter_excluded_markets "$TEMP_FILE" "$OUTPUT_FILE"

    # Apply only-market filtering for mainnet_only_market.json
    filter_only_markets "$RAW_FILE" "$ONLY_OUTPUT_FILE"

    # Final validation and summary for regular output
    if jq empty "$OUTPUT_FILE" 2>/dev/null; then
        final_count=$(jq '. | length' "$OUTPUT_FILE")
        
        # Store the latest mainnet.json as backup for the other script
        echo ""
        echo "Creating backup for main script: $BACKUP_FILE"
        cp "$OUTPUT_FILE" "$BACKUP_FILE"
        
        echo ""
        echo "=== REGULAR OUTPUT SUMMARY ==="
        echo "✓ Regular market cache created: $OUTPUT_FILE"
        echo "✓ Backup created: $BACKUP_FILE"
        echo "✓ Total markets after regular processing: $final_count"
    else
        echo "✗ ERROR: Regular output file is not valid JSON!"
        rm -f "$TEMP_FILE"
        exit 1
    fi

    # Final validation and summary for only-market output (if it exists)
    if [ -f "$ONLY_OUTPUT_FILE" ]; then
        if jq empty "$ONLY_OUTPUT_FILE" 2>/dev/null; then
            only_final_count=$(jq '. | length' "$ONLY_OUTPUT_FILE")
            
            # Store backup for only-market file
            echo "Creating backup for only-market file: $ONLY_BACKUP_FILE"
            cp "$ONLY_OUTPUT_FILE" "$ONLY_BACKUP_FILE"
            
            echo ""
            echo "=== ONLY-MARKET OUTPUT SUMMARY ==="
            echo "✓ Only-market cache created: $ONLY_OUTPUT_FILE"
            echo "✓ Backup created: $ONLY_BACKUP_FILE"
            echo "✓ Total markets in only-market file: $only_final_count"
            
            # Show sample of only-market markets
            echo ""
            echo "Sample only-markets (first 2 and last 2):"
            echo "First 2 markets:"
            jq '.[0:2] | .[] | {pubkey: .pubkey, owner: .owner}' "$ONLY_OUTPUT_FILE"
            
            if [ "$only_final_count" -gt 2 ]; then
                echo "Last 2 markets:"
                jq '.[-2:] | .[] | {pubkey: .pubkey, owner: .owner}' "$ONLY_OUTPUT_FILE"
            fi
        else
            echo "✗ ERROR: Only-market output file is not valid JSON!"
        fi
    fi

    # Show sample of regular markets
    echo ""
    echo "Sample regular markets (first 2 and last 2):"
    echo "First 2 markets:"
    jq '.[0:2] | .[] | {pubkey: .pubkey, owner: .owner}' "$OUTPUT_FILE"
    
    if [ "$final_count" -gt 2 ]; then
        echo "Last 2 markets:"
        jq '.[-2:] | .[] | {pubkey: .pubkey, owner: .owner}' "$OUTPUT_FILE"
    fi
    
    # Clean up temporary file
    rm -f "$TEMP_FILE"
    
    echo ""
    echo "Market cache processing completed!"
    echo "Regular cache: Set USE_LOCAL_MARKET_CACHE=true to use $OUTPUT_FILE"
    if [ -f "$ONLY_OUTPUT_FILE" ]; then
        echo "Only-market cache: Available as $ONLY_OUTPUT_FILE"
    fi
    
    return 0
}

run_complete_cycle() {
    # First sync git and files
    echo "========================================"
    sync_git_and_files
    
    # Then download and merge markets
    echo ""
    echo "========================================"
    download_and_merge_markets
    
    return $?
}

# Signal handler for graceful shutdown
cleanup() {
    echo ""
    echo "Received interrupt signal. Exiting gracefully..."
    # Clean up temporary files
    rm -f "$TEMP_FILE" "$TEMP_ONLY_FILE"
    exit 0
}

# Set up signal trap
trap cleanup SIGINT SIGTERM

# Store the original working directory
ORIGINAL_WD=$(pwd)

# Create jup directory if it doesn't exist, but stay in original directory
mkdir -p "$JUP_DIRECTORY"

# Ensure we're in the original directory for output files
cd "$ORIGINAL_WD" || {
    echo "✗ ERROR: Failed to return to original working directory"
    exit 1
}

echo "Working directory: $(pwd)"
echo "Git sync enabled: $ENABLE_GIT_SYNC"
echo "Gecko repo path: $GECKO_REPO_PATH"
echo "Custom market source: $CUSTOM_MARKET_SOURCE"
echo "Exclude file: $EXCLUDE_FILE"
echo "Only file: $ONLY_FILE"
echo "Only custom file: $ONLY_CUSTOM_FILE"
echo ""

# Main execution logic
if [ "$AUTO_RERUN_MINUTES" -eq 0 ]; then
    # Single run mode
    echo "Running market cache download once..."
    run_complete_cycle
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
    run_complete_cycle
    
    # Auto-rerun loop
    while true; do
        echo ""
        echo "Waiting $AUTO_RERUN_MINUTES minutes before next run..."
        echo "Next run scheduled at: $(date -d "+$AUTO_RERUN_MINUTES minutes" '+%Y-%m-%d %H:%M:%S')"
        
        # Sleep for the specified interval
        sleep "${AUTO_RERUN_MINUTES}m"
        
        echo ""
        echo "========================================"
        run_complete_cycle
    done
fi
#!/bin/bash

# Array of specific folder names to check
folders=("bot" "bot2" "bot3" "bot4" "bluechip" "bluechip-normal" "smallcapmeme" "stablecoin" "backrun-spam")

# Function to show current value
show_current_value() {
    local file=$1
    local current=$(awk '/MINT: So11111111111111111111111111111111111111112/{f=1} f&&/TRADE_RANGE:/{f=2} f==2&&/        TO: /{print $2;exit}' "$file")
    if [ ! -z "$current" ]; then
        local sol=$(echo "scale=9; ${current//_/} / 1000000000" | bc)
        echo "Current TRADE_RANGE TO value: $current lamports ($sol SOL)"
    fi
}

# Function to process each directory
process_directory() {
    local dir=$1
    echo -e "\n===== Processing directory: $dir ====="
    
    # Check if directory exists
    if [ ! -d "$dir" ]; then
        echo "Directory $dir does not exist"
        return
    fi
    
    # Check if config.yaml exists
    if [ -f "$dir/config.yaml" ]; then
        show_current_value "$dir/config.yaml"
        echo "Opening $dir/config.yaml in nano..."
        echo "Look for the line with 'TO:' under TRADE_RANGE section"
        echo "Press Enter to open nano..."
        read
        nano "$dir/config.yaml"
    else
        echo "config.yaml not found in $dir"
    fi
}

# Main script
echo "Starting config check and update process..."
for folder in "${folders[@]}"; do
    process_directory "$folder"
done

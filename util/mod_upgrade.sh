#!/bin/bash

# Loop through all directories in home directory
for dir in ~/*/; do
    if [ -d "$dir" ]; then
        echo "----------------------------------------"
        echo "Checking directory: $dir"
        
        # Check if upgrade.sh exists in this directory
        if [ -f "${dir}/upgrade.sh" ]; then
            echo "Found upgrade.sh in: $dir"
            echo "Executing: ${dir}/upgrade.sh"
            
            # Execute the upgrade.sh with bash
            cd "$dir"
            bash ./upgrade.sh
            cd ..
            
            echo "Finished executing: ${dir}/upgrade.sh"
        else
            echo "No upgrade.sh found in: $dir"
        fi
        echo "----------------------------------------"
    fi
done

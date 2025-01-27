#!/bin/bash

# Prompt for minutes with default value
read -p "Enter restart interval in minutes (default 30): " minutes
minutes=${minutes:-30}

while true; do
    ./rust-mev-bot
    echo "Process ended, waiting ${minutes} minutes before restart..."
    sleep $(( minutes * 60 ))
done

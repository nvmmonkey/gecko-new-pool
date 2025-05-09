#!/bin/bash

# Update and install required packages
sudo apt update


# Clone and setup gecko-new-pool



echo "Rust bot Installation completed."
cd ~/
mkdir onchain-bot
cd onchain-bot
wget https://sourceforge.net/projects/solanamevbotonchain/files/smb-onchain-0.0.5.zip
unzip smb-onchain-0.0.5.zip
if [ -f "./upgrade.sh" ]; then
    chmod +x ./upgrade.sh
    ./upgrade.sh
fi

cd ~/
tmux new-session -d -s onchain-bot

echo "Onchain bot Installation completed."
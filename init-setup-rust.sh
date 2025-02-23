#!/bin/bash

# Update and install required packages
sudo apt update


# Clone and setup gecko-new-pool

cd ~/
git clone https://github.com/SaoXuan/rust-mev-bot-shared
cp cd gecko-new-pool/util/custom-rust-run.sh ~/rust-mev-bot-shared/

tmux new-session -s rust-bot
cd ~/rust-mev-bot-shared


echo "Rust bot Installation completed."

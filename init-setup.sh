#!/bin/bash

# Update and install required packages
sudo apt update
sudo apt install -y tmux btop net-tools ipset curl wget unzip git lsof

# Install NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash

# Setup NVM environment
export NVM_DIR="$([ -z "${XDG_CONFIG_HOME-}" ] && printf %s "${HOME}/.nvm" || printf %s "${XDG_CONFIG_HOME}/nvm")"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Install Node.js
nvm install 22

# Create and setup project directory
mkdir -p ~/jup
cd ~/jup

# Download and extract the bot
wget https://sourceforge.net/projects/solanamevbot/files/solana-mev-bot-1.1.0.zip
unzip solana-mev-bot-1.1.0.zip

# Run upgrade script if it exists
if [ -f "./upgrade.sh" ]; then
    chmod +x ./upgrade.sh
    ./upgrade.sh
fi

# Clone and setup gecko-new-pool
cd ~/
git clone https://github.com/nvmmonkey/gecko-new-pool.git
cd gecko-new-pool
cp *.json ~/jup
cp *.js ~/jup
cd ~/jup
npm install
cd ~/
git clone https://github.com/SaoXuan/rust-mev-bot-shared

# Create IP sets script
cat > ~/create_ipsets.sh << 'EOL'
#!/bin/bash

declare -A URL_IPSETS=(
    ["amsterdam.mainnet.block-engine.jito.wtf"]="amsterdam"
    ["frankfurt.mainnet.block-engine.jito.wtf"]="frankfurt"
    ["ny.mainnet.block-engine.jito.wtf"]="ny"
    ["tokyo.mainnet.block-engine.jito.wtf"]="tokyo"
    ["slc.mainnet.block-engine.jito.wtf"]="slc"
    ["solana-api.instantnodes.io"]="instantnodes"
    ["api.mainnet-beta.solana.com"]="mainnet_beta"
    ["kessiah-4ap3n4-fast-mainnet.helius-rpc.com"]="helius_kessiah"
    ["cold-hanni-fast-mainnet.helius-rpc.com"]="helius_cold"
    ["darcy-ze7m7l-fast-mainnet.helius-rpc.com"]="helius_darcy"
    ["newest-withered-film.solana-mainnet.quiknode.pro"]="quiknode_newest"
    ["benedicta-vntcm3-fast-mainnet.helius-rpc.com"]="helius_benedicta"
    ["mainnet.helius-rpc.com"]="helius_mainnet"
)

for URL in "${!URL_IPSETS[@]}"; do
    IPSET_NAME="${URL_IPSETS[$URL]}"
    
    if ! sudo ipset list "$IPSET_NAME" &>/dev/null; then
        echo "Creating ipset: $IPSET_NAME"
        sudo ipset create "$IPSET_NAME" hash:ip
    fi
    
    echo "Pinging $URL..."
    PING_RESULT=$(ping -c 1 "$URL" | grep "PING")
    if [[ -z $PING_RESULT ]]; then
        echo "Failed to reach $URL. Skipping."
        continue
    fi
    
    RESOLVED_IP=$(echo "$PING_RESULT" | awk '{print $3}' | tr -d '()' | sed 's/:$//')
    
    if [[ -n $RESOLVED_IP ]]; then
        echo "Resolved $URL to IP: $RESOLVED_IP"
        echo "Flushing and updating ipset: $IPSET_NAME"
        sudo ipset flush "$IPSET_NAME"
        sudo ipset add "$IPSET_NAME" "$RESOLVED_IP"
    else
        echo "Failed to resolve IP for $URL. Skipping."
    fi
done

echo "IP sets updated successfully."
EOL

# Make the IP sets script executable
chmod +x ~/create_ipsets.sh

# Return to home directory
cd ~/

echo "Installation completed. Please run 'source ~/.bashrc' to activate NVM."

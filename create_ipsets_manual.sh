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
    ["rochell-medfy8-fast-mainnet.helius-rpc.com"]="helius_rochell"
    ["astrid-1a3mps-fast-mainnet.helius-rpc.com"]="helius_astrid"
    ["carma-qqy5fq-fast-mainnet.helius-rpc.com"]="helius_carma"
    ["carole-l8ne8x-fast-mainnet.helius-rpc.com"]="helius_carole"
)

for URL in "${!URL_IPSETS[@]}"; do
    IPSET_NAME="${URL_IPSETS[$URL]}"
    
    if ! sudo ipset list "$IPSET_NAME" &>/dev/null; then
        echo "Creating ipset: $IPSET_NAME"
        sudo ipset create "$IPSET_NAME" hash:ip
    fi
    
    echo "Resolving $URL..."
    RESOLVED_IP=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' \
        "https://$URL" \
        -w "%{remote_ip}" \
        -o /dev/null)
    
    if [[ -n $RESOLVED_IP ]]; then
        echo "Resolved $URL to IP: $RESOLVED_IP"
        echo "HTTP Status: $(curl -s -o /dev/null -w "%{http_code}" "https://$URL")"
        echo "Flushing and updating ipset: $IPSET_NAME"
        sudo ipset flush "$IPSET_NAME"
        sudo ipset add "$IPSET_NAME" "$RESOLVED_IP"
    else
        echo "Failed to resolve IP for $URL. Skipping."
    fi
    
    # Add a small delay to prevent rate limiting
    sleep 1
done

echo "IP sets updated successfully."
#!/bin/bash

# Check if script is run as root
if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root or with sudo"
    exit 1
fi

# Install UFW if not present
if ! command -v ufw &> /dev/null; then
    apt-get update
    apt-get install -y ufw
fi

# Reset UFW to default state
ufw --force reset

# Set default policies
ufw default deny incoming
ufw default allow outgoing

# Allow SSH (port 22)
ufw allow ssh

# Block port 18080 for all external connections
ufw deny 18080/tcp

# Allow localhost access to port 18080
ufw allow from 127.0.0.1 to any port 18080 proto tcp

# Enable UFW
echo "y" | ufw enable

# Show status
ufw status verbose

echo "UFW has been configured with SSH access and port 18080 rules."
echo "Port 18080 is now blocked for external connections but allowed for localhost."
echo "Please verify you can still access SSH in another terminal before closing this session."
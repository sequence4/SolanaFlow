#!/bin/bash
# Run this script on the EC2 host, not inside a container
set -euo pipefail

echo "Setting up 8GB swap file on host..."
sudo fallocate -l 8G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
sudo swapon -a        # activate now

echo "Swap status:"
swapon --show         # should show 8.0G

echo "Free memory after swap setup:"
free -h 
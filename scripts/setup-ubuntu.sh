#!/usr/bin/env bash
set -e

# --- Git ---
sudo apt-get update -y
sudo apt-get install -y git

# --- SSH key for Git ---
ssh-keygen -t ed25519 -C "sorengoyal712+aws@gmail.com" -f ~/.ssh/id_ed25519 -N ""
echo "=== Public key (add to GitHub/GitLab) ==="
cat ~/.ssh/id_ed25519.pub

# --- Node 24 (via NodeSource) ---
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs

# --- pnpm ---
sudo npm install -g pnpm

# --- Docker ---
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# --- Add user to docker group ---
sudo usermod -aG docker $USER

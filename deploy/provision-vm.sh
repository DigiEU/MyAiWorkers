#!/usr/bin/env bash
# Kjøres som root på en fersk Ubuntu 24.04 Hetzner-VM. Installerer Node, git,
# brannmur (kun SSH inn), og oppretter en uprivilegert 'agents'-bruker.
set -euo pipefail

echo "==> apt update/upgrade"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y

echo "==> grunnpakker"
apt-get install -y curl git ufw ca-certificates

echo "==> Node 22 LTS (NodeSource)"
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

echo "==> brannmur: kun SSH inn, alt ut"
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw --force enable

echo "==> uprivilegert bruker 'agents'"
id -u agents >/dev/null 2>&1 || adduser --disabled-password --gecos "" agents

echo "==> ferdig. node $(node -v), npm $(npm -v)"

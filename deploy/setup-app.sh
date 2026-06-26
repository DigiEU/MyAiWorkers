#!/usr/bin/env bash
# Kjøres som 'agents'-bruker PÅ VM-en, ETTER at deploy-nøkkelen er lagt til på
# GitHub (med write) og main er beskyttet. Kloner repoet og installerer appen.
set -euo pipefail

REPO_URL="git@github.com:hashtor2/DigitalEU.git"
BRANCH="${1:-feat/telegram-agents}"

cd "$HOME"

if [ ! -d "$HOME/.ssh" ]; then
  mkdir -p "$HOME/.ssh" && chmod 700 "$HOME/.ssh"
fi

# Deploy-nøkkel for repoet (lag den hvis den mangler; legg .pub til på GitHub).
if [ ! -f "$HOME/.ssh/id_ed25519" ]; then
  ssh-keygen -t ed25519 -N "" -C "digitaleu-vm-deploy" -f "$HOME/.ssh/id_ed25519"
  echo "=================================================================="
  echo " LEGG DENNE DEPLOY-NØKKELEN TIL PÅ GitHub (Settings -> Deploy keys,"
  echo " 'Allow write access'), så kjør dette skriptet på nytt:"
  echo "------------------------------------------------------------------"
  cat "$HOME/.ssh/id_ed25519.pub"
  echo "=================================================================="
  ssh-keyscan github.com >> "$HOME/.ssh/known_hosts" 2>/dev/null || true
  exit 0
fi

if [ ! -d "$HOME/DigitalEU" ]; then
  echo "==> kloner repo ($BRANCH)"
  git clone --branch "$BRANCH" "$REPO_URL" "$HOME/DigitalEU"
else
  echo "==> repo finnes; henter siste"
  git -C "$HOME/DigitalEU" fetch origin "$BRANCH" && git -C "$HOME/DigitalEU" checkout "$BRANCH" && git -C "$HOME/DigitalEU" pull --ff-only
fi

echo "==> npm install"
cd "$HOME/DigitalEU/tools/telegram-agents"
npm install

echo "==> ferdig. Sørg for at ~/digitaleu-bots.env finnes (chmod 600) med:"
echo "    OWNER_TELEGRAM_ID, BOT_0x_*-tokens og ANTHROPIC_API_KEY (sk-ant-...)"

#!/usr/bin/env bash
# Kjøres som 'agents'-bruker PÅ VM-en, ETTER at deploy-nøkkelen er lagt til på
# GitHub (med write) og main er beskyttet. Kloner AI Workers-appen, klargjør
# produktrepoet agentene jobber i, og installerer appen.
set -euo pipefail

APP_REPO_URL="${APP_REPO_URL:-git@github.com:DigiEU/MyAiWorkers.git}"
WORK_REPO_URL="${WORK_REPO_URL:-git@github.com:DigiEU/scannerandextention.git}"
APP_BRANCH="${1:-main}"
WORK_BRANCH="${WORK_BRANCH:-main}"
APP_DIR="$HOME/MyAiWorkers"
WORK_DIR="$HOME/scannerandextention"

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

if [ ! -d "$APP_DIR" ]; then
  echo "==> kloner AI Workers ($APP_BRANCH)"
  git clone --branch "$APP_BRANCH" "$APP_REPO_URL" "$APP_DIR"
else
  echo "==> AI Workers finnes; henter siste"
  git -C "$APP_DIR" fetch origin "$APP_BRANCH" && git -C "$APP_DIR" checkout "$APP_BRANCH" && git -C "$APP_DIR" pull --ff-only
fi

if [ ! -d "$WORK_DIR" ]; then
  echo "==> kloner produktrepo for agent-worktrees ($WORK_BRANCH)"
  git clone --branch "$WORK_BRANCH" "$WORK_REPO_URL" "$WORK_DIR"
else
  echo "==> produktrepo finnes; henter siste"
  git -C "$WORK_DIR" fetch origin "$WORK_BRANCH" && git -C "$WORK_DIR" checkout "$WORK_BRANCH" && git -C "$WORK_DIR" pull --ff-only
fi

echo "==> npm install"
cd "$APP_DIR"
npm install

echo "==> ferdig. Sørg for at ~/digitaleu-bots.env finnes (chmod 600) med:"
echo "    OWNER_TELEGRAM_ID, GEMINI_API_KEY (eller GOOGLE_API_KEY), BOT_0x_*-tokens"
echo "    Sett også WORK_REPO_PATH=$WORK_DIR hvis du ikke bruker standardstien."

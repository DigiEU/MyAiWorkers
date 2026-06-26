# Hetzner-deploy — runbook (Fase 3)

Alltid-på drift av Telegram-agentene på en EU-VM (Hetzner 🇩🇪). Følger
sikkerhetsmodellen i `docs/TELEGRAM_AGENTS.md` §6.

**Server:** CX22 (2 vCPU, 4 GB), Ubuntu 24.04, Falkenstein (fsn1). ~€4/mnd.
**Auth:** ekte `ANTHROPIC_API_KEY` (sk-ant-…) med spend-cap.
**Repo:** klones via deploy-nøkkel med write; `main` beskyttes på GitHub.

## Steg

### 0. Det du skaffer
- [ ] Hetzner Cloud **API-token** (read+write): Hetzner Console → prosjekt →
      Security → API Tokens → Generate. Lim til Claude når du blir bedt om det.
- [ ] `ANTHROPIC_API_KEY` (sk-ant-…) med månedlig spend-cap satt.

### 1. Server (skriptet via Hetzner API)
- Last opp en SSH-nøkkel for VM-tilgang.
- Opprett CX22 / Ubuntu 24.04 / fsn1 med den nøkkelen.
- Vent på `running`, hent offentlig IP.

### 2. Provisjonér (som root)
```bash
scp deploy/provision-vm.sh root@<IP>:/root/
ssh root@<IP> 'bash /root/provision-vm.sh'
```
Installerer Node 22, git, ufw (kun SSH inn), og 'agents'-brukeren.

### 3. Deploy-nøkkel for repoet (som agents)
```bash
ssh agents@<IP> 'bash -s' < deploy/setup-app.sh   # første kjøring lager nøkkel
```
Skriver ut en ed25519 public key. **Du:** legg den til på GitHub
(repo → Settings → Deploy keys → Add → huk av *Allow write access*).
**Du:** repo → Settings → Branches → beskytt `main` (block force-push + krev PR).

### 4. App + hemmeligheter (som agents)
```bash
ssh agents@<IP> 'bash -s' < deploy/setup-app.sh   # andre kjøring kloner + npm install
```
Opprett hemmelighetsfilen UTENFOR klonen (chmod 600):
```bash
ssh agents@<IP> 'umask 077; cat > ~/digitaleu-bots.env' <<'EOF'
OWNER_TELEGRAM_ID=539927333
BOT_01_CEO=...
BOT_02_MARKETER=...
BOT_03_WRITER=...
BOT_04_DESIGNER=...
ANTHROPIC_API_KEY=sk-ant-...
EOF
```

### 5. systemd-tjeneste (som root)
```bash
scp deploy/telegram-agents.service root@<IP>:/etc/systemd/system/
ssh root@<IP> 'systemctl daemon-reload && systemctl enable --now telegram-agents'
```

### 6. Verifiser
```bash
ssh root@<IP> 'systemctl status telegram-agents --no-pager'
ssh root@<IP> 'journalctl -u telegram-agents -n 30 --no-pager'   # audit-logg
```
Send melding til en bot fra mobilen. Den skal svare og jobbe på `agent/<rolle>`.

## Sikkerhetssjekk (før «live»)
- [ ] `main` beskyttet på GitHub (deploy-nøkkel kan ikke overskrive den).
- [ ] `~/digitaleu-bots.env` er chmod 600, eies av `agents`, ligger UTENFOR klonen.
- [ ] Ingen prod-secrets / brukerdata i klonen (service_role, Stripe live, OAuth).
- [ ] ufw aktiv: kun SSH inn.
- [ ] Tokens rotert etter at de har vært limt i en chat.
- [ ] Anthropic spend-cap satt.

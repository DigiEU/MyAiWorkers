# My AI Workers

Telegram-styrte AI-agenter for **digitaleu.me**. Hver persona i `personas/` blir
en egen Telegram-bot som kan utføre faktisk arbeid (lese/skrive filer, kjøre
kommandoer, committe) i sitt eget git worktree.

**AI motor:** Google Gemini (`GEMINI_API_KEY` / `GOOGLE_API_KEY`) med function calling.

**To-repo-modell:**
- Dette repoet = orchestrator + personas + deploy-kit (det VM-en *kjører*).
- Agentene jobber på en separat klone av produktmonorepoet
  (`DigiEU/scannerandextention`), pekt ut via `WORK_REPO_PATH`.
  Hver agent på branch `agent/<rolle>`, aldri `main`.

## Forutsetninger
- Node >= 20.
- Gemini API-nøkkel fra [Google AI Studio](https://aistudio.google.com/app/apikey).
- Hemmeligheter i `~/digitaleu-bots.env` (UTENFOR repoet):
  ```
  OWNER_TELEGRAM_ID=<din numeriske Telegram-ID>
  GEMINI_API_KEY=<din Gemini-nøkkel>
  # valgfritt: GEMINI_MODEL=gemini-2.5-pro
  BOT_01_CEO=<token>
  BOT_02_MARKETER=<token>
  ...
  ```

## Kommandoer
```bash
npm install
npm run verify          # validér tokens mot Telegram (getMe) — gratis
npm run smoke -- ceo    # lokal test: kjør én agent uten Telegram
npm run setup:worktrees # opprett worktrees i WORK_REPO
npm start               # start alle aktive bots (long-polling)
```

## Sikkerhet
- **Eier-allowlist:** hver bot ignorerer alle andre enn `OWNER_TELEGRAM_ID`.
- **Worktree-isolasjon:** hver agent på `agent/<rolle>`, aldri `main`.
- **Runtime-vakter:** hold deg i worktreet, ikke push main, ingen destruktive
  kommandoer, aldri eksponer hemmeligheter.
- **Ingen prod-secrets / brukerdata** i klonene agentene jobber i.

## Deploy
Alltid-på drift på Hetzner-VM (Falkenstein 🇩🇪). Se [`deploy/DEPLOY.md`](deploy/DEPLOY.md).

## Agentene (10)
CEO · Marketer · Writer · Designer · Engineer · Legal · Partnerships · Support ·
Research/Analyst · DevOps/Release. Personaene er self-contained system-prompts.

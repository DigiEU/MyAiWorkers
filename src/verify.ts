// Validerer hver konfigurert bot-token mot Telegram (getMe). Gratis, ingen
// agent-kjøring. Kjør: npm run verify
import { activeAgents, OWNER_ID, ENV_FILE } from "./config.js";

const agents = activeAgents();
console.log(`Env-fil:  ${ENV_FILE}`);
console.log(`Eier-ID:  ${OWNER_ID || "(MANGLER)"}`);
console.log(`Aktive agenter: ${agents.length}\n`);

for (const a of agents) {
  const token = process.env[a.envVar]!;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data: any = await res.json();
    if (data.ok) {
      console.log(`✅ ${a.role.padEnd(26)} @${data.result.username}`);
    } else {
      console.log(`❌ ${a.role.padEnd(26)} ${data.description}`);
    }
  } catch (e: any) {
    console.log(`❌ ${a.role.padEnd(26)} ${e.message}`);
  }
}

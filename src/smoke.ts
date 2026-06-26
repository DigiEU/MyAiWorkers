// Lokal røyktest: kjører ÉN agent gjennom Gemini uten Telegram.
import { activeAgents, ensureWorktree } from "./config.js";
import { runAgent } from "./agent.js";

const agents = activeAgents();
const wanted = process.argv[2] || "ceo";
const agent = agents.find((a) => a.key === wanted) || agents[0];

if (!agent) {
  console.error("Ingen aktive agenter.");
  process.exit(1);
}

console.log(`Røyktest: ${agent.role} (${agent.key})`);
const wt = await ensureWorktree(agent);
console.log(`Worktree: ${wt}\n--- agent-svar ---`);

const reply = await runAgent(
  agent,
  "In 2-3 sentences: confirm your role, what product you're working on, and which git branch you're on (run `git branch --show-current`). Do not modify any files.",
  wt,
);

console.log(reply);

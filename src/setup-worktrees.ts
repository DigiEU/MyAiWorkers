// Oppretter git worktrees for alle aktive agenter på forhånd. Kjør:
// npm run setup:worktrees   (ellers opprettes de lazily ved første melding)
import { activeAgents, ensureWorktree } from "./config.js";

for (const a of activeAgents()) {
  const wt = await ensureWorktree(a);
  console.log(`✅ ${a.role.padEnd(26)} ${a.branch} -> ${wt}`);
}

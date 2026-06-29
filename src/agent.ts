// Kobler en persona til Gemini (function-calling agent loop). Hver agent
// kjører med persona som system-prompt og verktøytilgang i sitt eget worktree.
import path from "node:path";
import { readFile } from "node:fs/promises";
import { ORCH_ROOT, type AgentDef } from "./config.js";
import {
  runGeminiAgent,
  resetGeminiSession,
  hasGeminiSession,
} from "./gemini-agent.js";

function guardrails(agent: AgentDef): string {
  const lines = [
    "## Operational mode (runtime safety — additive to your role)",
    "You are running headless, controlled by the owner over Telegram, with full",
    `tool access inside an isolated git worktree on branch \`${agent.branch}\`.`,
    "No one is watching a terminal, so: act on the request, then summarize what you did.",
    "Hard rules:",
    "- Stay inside this worktree. Never touch files outside it.",
    "- When you change files, commit to your own branch; never commit, merge, or push to `main`.",
    "- After committing, publish your work for review: `git push -u origin " +
      `${agent.branch}\`. Then surface a pull request against \`main\`: first try ` +
      "`gh pr create --base main --fill`; if gh is unavailable or unauthorized, " +
      "instead output the one-tap PR link " +
      `\`https://github.com/DigiEU/scannerandextention/compare/main...${agent.branch}?expand=1\`. ` +
      "Put the PR (or PR link) at the TOP of your reply so the owner can review/merge from their phone.",
    "- If `git push` itself fails (e.g. missing auth), say so plainly — don't retry blindly.",
    "- Never run destructive commands (rm -rf, hard resets on shared refs, force-push).",
    "- Never print, log, or transmit secrets, tokens, or .env contents.",
    "- Keep replies concise and phone-readable; lead with the result.",
    "- Use tools (read_file, write_file, edit_file, run_terminal, grep, glob_files) to do real work.",
  ];

  if (
    agent.key === "marketer" &&
    process.env.TWITTER_CRON_TOKEN &&
    process.env.SUPABASE_FUNCTIONS_URL
  ) {
    const bin = path.join(ORCH_ROOT, "bin", "social-post.sh");
    lines.push(
      "",
      "## Social posting (configured — outward-facing, owner-authorized only)",
      "You can publish to the digitaleu.me X/Twitter account via a server-side",
      "Edge Function. The Twitter API key stays on the server; you only trigger it",
      "through this helper, which never exposes secrets:",
      `- Daily auto-post (summarize latest news + tweet): \`bash ${bin} daily\``,
      `- Specific article: \`bash ${bin} custom <articleId> <title> <url> <summary>\``,
      "Only post when the owner explicitly asks — tweets are public. Report the",
      "returned tweet id/result; on error, relay it plainly.",
    );
  }

  return lines.join("\n");
}

export async function runAgent(
  agent: AgentDef,
  userText: string,
  worktree: string,
): Promise<string> {
  const personaText = await readFile(agent.personaFile, "utf8");
  const systemPrompt = `${personaText}\n\n${guardrails(agent)}`;
  return runGeminiAgent(agent.key, systemPrompt, userText, worktree);
}

export function resetSession(key: string): void {
  resetGeminiSession(key);
}

export function hasSession(key: string): boolean {
  return hasGeminiSession(key);
}

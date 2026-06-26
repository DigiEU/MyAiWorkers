// Konfigurasjon for "My AI Workers".
// To-repo-modell:
//  - ORCH_ROOT  = dette repoet (orchestrator + personas).
//  - WORK_REPO  = en separat klone av produktrepoet (DigitalEU) som agentene
//                 faktisk jobber i, hver på sin egen worktree/branch.
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import dotenv from "dotenv";
import { git } from "./git.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ORCH_ROOT = path.resolve(__dirname, "..");
export const PERSONA_DIR = path.join(ORCH_ROOT, "personas");

export const WORK_REPO =
  process.env.WORK_REPO_PATH || path.resolve(ORCH_ROOT, "..", "DigitalEU");

export const WORKTREE_ROOT = path.resolve(
  WORK_REPO,
  "..",
  "digitaleu-agent-worktrees",
);

export const ENV_FILE =
  process.env.BOTS_ENV_FILE || path.join(os.homedir(), "digitaleu-bots.env");

dotenv.config({ path: ENV_FILE });

const geminiKey =
  process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
if (!geminiKey) {
  console.warn(
    "⚠️  GEMINI_API_KEY (or GOOGLE_API_KEY) mangler i env-filen — agentene vil feile ved første melding.",
  );
}

// Fjern Anthropic-nøkkel hvis den fortsatt ligger i env — vi bruker kun Gemini nå.
if (process.env.ANTHROPIC_API_KEY) {
  delete process.env.ANTHROPIC_API_KEY;
}

export const OWNER_ID = Number(process.env.OWNER_TELEGRAM_ID || 0);

export interface AgentDef {
  key: string;
  role: string;
  envVar: string;
  personaFile: string;
  branch: string;
}

function persona(file: string): string {
  return path.join(PERSONA_DIR, file);
}

export const AGENTS: AgentDef[] = [
  { key: "ceo", role: "CEO / Chief Strategist", envVar: "BOT_01_CEO", personaFile: persona("01-ceo.md"), branch: "agent/ceo" },
  { key: "marketer", role: "CMO / Marketer", envVar: "BOT_02_MARKETER", personaFile: persona("02-marketer.md"), branch: "agent/marketer" },
  { key: "writer", role: "Editor / Writer", envVar: "BOT_03_WRITER", personaFile: persona("03-writer.md"), branch: "agent/writer" },
  { key: "designer", role: "Head of Design / UX", envVar: "BOT_04_DESIGNER", personaFile: persona("04-designer.md"), branch: "agent/designer" },
  { key: "engineer", role: "Lead Engineer", envVar: "BOT_05_ENGINEER", personaFile: persona("05-engineer.md"), branch: "agent/engineer" },
  { key: "legal", role: "Legal & Privacy Counsel", envVar: "BOT_06_LEGAL", personaFile: persona("06-legal.md"), branch: "agent/legal" },
  { key: "partnerships", role: "Head of Partnerships", envVar: "BOT_07_PARTNERSHIPS", personaFile: persona("07-partnerships.md"), branch: "agent/partnerships" },
  { key: "support", role: "Customer Support Lead", envVar: "BOT_08_SUPPORT", personaFile: persona("08-support.md"), branch: "agent/support" },
  { key: "researcher", role: "Research / Analyst", envVar: "BOT_09_RESEARCHER", personaFile: persona("09-researcher.md"), branch: "agent/researcher" },
  { key: "devops", role: "DevOps / Release", envVar: "BOT_10_DEVOPS", personaFile: persona("10-devops.md"), branch: "agent/devops" },
];

export function activeAgents(): AgentDef[] {
  return AGENTS.filter((a) => !!process.env[a.envVar]);
}

export function worktreePathFor(agent: AgentDef): string {
  return path.join(WORKTREE_ROOT, agent.key);
}

export async function ensureWorktree(agent: AgentDef): Promise<string> {
  const wt = worktreePathFor(agent);
  if (existsSync(path.join(wt, ".git"))) return wt;
  await git(["worktree", "add", "-B", agent.branch, wt, "HEAD"], WORK_REPO);
  return wt;
}

// Verktøy for Gemini-agenten — alle stier låses til worktree.
import { execFile } from "node:child_process";
import { glob } from "node:fs/promises";
import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { Type, type FunctionDeclaration } from "@google/genai";
import { getOptOutInstructions } from "@digitaleu/shared";

const pexec = promisify(execFile);
const MAX_READ_CHARS = 120_000;
const MAX_OUTPUT_CHARS = 40_000;
const MAX_TERMINAL_MS = 120_000;

const BLOCKED_COMMANDS = [
  /\brm\s+-rf\b/i,
  /\bgit\s+push\b[^\n]*--force\b/i,
  /\bgit\s+push\b[^\n]*-f\b/i,
  /\bgit\s+reset\s+--hard\b/i,
  /\bgit\s+clean\s+-fdx\b/i,
];

export const TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "read_file",
    description: "Read a UTF-8 text file relative to the worktree root.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: { type: Type.STRING, description: "Relative file path" },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Create or overwrite a UTF-8 text file in the worktree.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: { type: Type.STRING },
        content: { type: Type.STRING },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "edit_file",
    description: "Replace one exact string occurrence in a file.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: { type: Type.STRING },
        old_string: { type: Type.STRING },
        new_string: { type: Type.STRING },
      },
      required: ["path", "old_string", "new_string"],
    },
  },
  {
    name: "list_dir",
    description: "List files and directories at a path relative to the worktree.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: { type: Type.STRING, description: "Relative directory path (default .)" },
      },
    },
  },
  {
    name: "glob_files",
    description: "Find files matching a glob pattern relative to the worktree.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        pattern: { type: Type.STRING, description: "Glob pattern, e.g. src/**/*.ts" },
      },
      required: ["pattern"],
    },
  },
  {
    name: "grep",
    description: "Search for a regex pattern in files under the worktree.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        pattern: { type: Type.STRING },
        path: { type: Type.STRING, description: "Relative path to search (default .)" },
      },
      required: ["pattern"],
    },
  },
  {
    name: "run_terminal",
    description: "Run a shell command with cwd set to the worktree. Use for git, gh, npm, etc.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        command: { type: Type.STRING },
      },
      required: ["command"],
    },
  },
];

function resolveInWorktree(worktree: string, relPath: string): string {
  const base = path.resolve(worktree);
  const resolved = path.resolve(base, relPath || ".");
  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    throw new Error(`Path outside worktree: ${relPath}`);
  }
  return resolved;
}

function clip(text: string, max = MAX_OUTPUT_CHARS): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + `\n…[truncated ${text.length - max} chars]`;
}

function assertSafeCommand(command: string): void {
  for (const rule of BLOCKED_COMMANDS) {
    if (rule.test(command)) {
      throw new Error(`Blocked command: ${command}`);
    }
  }
}

async function grepFiles(
  worktree: string,
  pattern: string,
  relPath = ".",
): Promise<string> {
  const root = resolveInWorktree(worktree, relPath);
  const re = new RegExp(pattern, "gi");
  const hits: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    if (hits.length >= 80) return;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (hits.length >= 80) break;
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!entry.isFile()) continue;
      let text: string;
      try {
        text = await readFile(full, "utf8");
      } catch {
        continue;
      }
      const lines = text.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (re.test(lines[i]!)) {
          hits.push(`${path.relative(worktree, full)}:${i + 1}:${lines[i]}`);
          re.lastIndex = 0;
          if (hits.length >= 80) break;
        }
        re.lastIndex = 0;
      }
    }
  };
  await walk(root);
  return hits.length ? hits.join("\n") : "(no matches)";
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  worktree: string,
): Promise<{ ok: boolean; output: string }> {
  try {
    switch (name) {
      case "read_file": {
        const file = resolveInWorktree(worktree, String(args.path));
        const text = await readFile(file, "utf8");
        return { ok: true, output: clip(text, MAX_READ_CHARS) };
      }
      case "write_file": {
        const file = resolveInWorktree(worktree, String(args.path));
        await writeFile(file, String(args.content), "utf8");
        return { ok: true, output: `Wrote ${args.path}` };
      }
      case "edit_file": {
        const file = resolveInWorktree(worktree, String(args.path));
        const oldStr = String(args.old_string);
        const newStr = String(args.new_string);
        const text = await readFile(file, "utf8");
        if (!text.includes(oldStr)) {
          return { ok: false, output: `old_string not found in ${args.path}` };
        }
        await writeFile(file, text.replace(oldStr, newStr), "utf8");
        return { ok: true, output: `Edited ${args.path}` };
      }
      case "list_dir": {
        const dir = resolveInWorktree(worktree, String(args.path || "."));
        const entries = await readdir(dir);
        const lines: string[] = [];
        for (const entry of entries) {
          const full = path.join(dir, entry);
          const st = await stat(full);
          lines.push(`${st.isDirectory() ? "d" : "f"} ${entry}`);
        }
        return { ok: true, output: lines.join("\n") || "(empty)" };
      }
      case "glob_files": {
        const pattern = String(args.pattern);
        const matches: string[] = [];
        for await (const match of glob(path.join(worktree, pattern))) {
          matches.push(path.relative(worktree, match));
          if (matches.length >= 100) break;
        }
        return { ok: true, output: matches.join("\n") || "(no matches)" };
      }
      case "grep": {
        const output = await grepFiles(
          worktree,
          String(args.pattern),
          args.path ? String(args.path) : ".",
        );
        return { ok: true, output: clip(output) };
      }
      case "run_terminal": {
        const command = String(args.command);
        assertSafeCommand(command);
        const { stdout, stderr } = await pexec("/bin/bash", ["-lc", command], {
          cwd: worktree,
          maxBuffer: 1024 * 1024 * 8,
          timeout: MAX_TERMINAL_MS,
          env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
        });
        const combined = [stdout, stderr].filter(Boolean).join("\n").trim();
        return { ok: true, output: clip(combined || "(no output)") };
      }
      case "read_opt_out_guide": {
        const query = String(args.query || "");
        const brokerName = String(args.broker_name || "");
        const output = await getOptOutInstructions(query, brokerName);
        return { ok: true, output: clip(output, MAX_READ_CHARS) };
      }
      default:
        return { ok: false, output: `Unknown tool: ${name}` };
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, output: msg };
  }
}

// Tynn git-wrapper — kjører git som subprosess og returnerer stdout.
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const pexec = promisify(execFile);

export async function git(args: string[], cwd: string): Promise<string> {
  const { stdout } = await pexec("git", args, {
    cwd,
    maxBuffer: 1024 * 1024 * 10,
  });
  return stdout.trim();
}

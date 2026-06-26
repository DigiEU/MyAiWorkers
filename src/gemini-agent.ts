// Gemini-basert agent-loop med function calling og per-agent session-minne.
import {
  GoogleGenAI,
  type Content,
  type Part,
} from "@google/genai";
import { TOOL_DECLARATIONS, executeTool } from "./tools.js";

const MAX_TURNS = 30;
const MAX_HISTORY_MESSAGES = 40;

const sessions = new Map<string, Content[]>();

function getClient(): GoogleGenAI {
  const apiKey =
    process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY (or GOOGLE_API_KEY) is not set");
  }
  return new GoogleGenAI({ apiKey });
}

function modelName(): string {
  return process.env.GEMINI_MODEL || "gemini-2.5-pro";
}

function trimHistory(history: Content[]): Content[] {
  if (history.length <= MAX_HISTORY_MESSAGES) return history;
  return history.slice(-MAX_HISTORY_MESSAGES);
}

function textFromParts(parts: Part[] | undefined): string {
  if (!parts?.length) return "";
  return parts
    .map((p) => p.text ?? "")
    .filter(Boolean)
    .join("\n")
    .trim();
}

export async function runGeminiAgent(
  sessionKey: string,
  systemPrompt: string,
  userText: string,
  worktree: string,
): Promise<string> {
  const ai = getClient();
  const history = sessions.get(sessionKey) ?? [];
  history.push({ role: "user", parts: [{ text: userText }] });
  sessions.set(sessionKey, trimHistory(history));

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await ai.models.generateContent({
      model: modelName(),
      contents: sessions.get(sessionKey)!,
      config: {
        systemInstruction: systemPrompt,
        tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
      },
    });

    const modelParts = response.candidates?.[0]?.content?.parts ?? [];
    const functionCalls = response.functionCalls ?? [];

    sessions.get(sessionKey)!.push({ role: "model", parts: modelParts });

    if (!functionCalls.length) {
      const text = textFromParts(modelParts) || response.text || "";
      return text || "(no response)";
    }

    const toolResultParts: Part[] = [];
    for (const call of functionCalls) {
      const name = call.name ?? "unknown";
      const args = (call.args ?? {}) as Record<string, unknown>;
      const result = await executeTool(name, args, worktree);
      toolResultParts.push({
        functionResponse: {
          name,
          response: { output: result.output, ok: result.ok },
        },
      });
    }

    sessions.get(sessionKey)!.push({ role: "user", parts: toolResultParts });
  }

  return "(agent stopped: max tool turns reached)";
}

export function resetGeminiSession(sessionKey: string): void {
  sessions.delete(sessionKey);
}

export function hasGeminiSession(sessionKey: string): boolean {
  return sessions.has(sessionKey);
}

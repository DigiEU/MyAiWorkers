// Entrypoint: starter én Telegram-bot per agent som har en token i env-filen.
// Eier-allowlist på hver melding; ruter tekst til riktig agent; svarer i chatten.
import { Bot } from "grammy";
import {
  activeAgents,
  ensureWorktree,
  OWNER_ID,
} from "./config.js";
import { runAgent, resetSession, hasSession } from "./agent.js";

const TELEGRAM_LIMIT = 4000;

async function sendLong(ctx: any, text: string): Promise<void> {
  for (let i = 0; i < text.length; i += TELEGRAM_LIMIT) {
    await ctx.reply(text.slice(i, i + TELEGRAM_LIMIT));
  }
}

function main(): void {
  if (!OWNER_ID) {
    console.error("✋ OWNER_TELEGRAM_ID mangler i env-filen. Avbryter.");
    process.exit(1);
  }
  const agents = activeAgents();
  if (agents.length === 0) {
    console.error("✋ Fant ingen bot-tokens i env-filen. Avbryter.");
    process.exit(1);
  }

  console.log(`Eier: ${OWNER_ID}. Starter ${agents.length} bot(er) med Gemini...`);

  for (const agent of agents) {
    const token = process.env[agent.envVar]!;
    const bot = new Bot(token);

    bot.use(async (ctx, next) => {
      if (ctx.from?.id !== OWNER_ID) return;
      await next();
    });

    bot.command("start", (ctx) =>
      ctx.reply(
        `👋 ${agent.role} online (Gemini).\nSend en oppgave. /reset tømmer kontekst, /status viser tilstand, /ask <agent> <oppgave> delegerer til en annen agent.`,
      ),
    );
    bot.command("reset", (ctx) => {
      resetSession(agent.key);
      return ctx.reply("🔄 Kontekst tømt.");
    });
    bot.command("status", (ctx) =>
      ctx.reply(
        `Rolle: ${agent.role}\nBranch: ${agent.branch}\nModel: ${process.env.GEMINI_MODEL || "gemini-2.5-pro"}\nSession: ${
          hasSession(agent.key) ? "aktiv" : "fersk"
        }`,
      ),
    );

    bot.command("ask", async (ctx) => {
      const arg = (ctx.match || "").trim();
      const sp = arg.search(/\s/);
      const targetKey = (sp === -1 ? arg : arg.slice(0, sp)).toLowerCase();
      const task = sp === -1 ? "" : arg.slice(sp + 1).trim();
      const others = activeAgents().filter((a) => a.key !== agent.key);
      const target = others.find((a) => a.key === targetKey);
      if (!target || !task) {
        return ctx.reply(
          `Bruk: /ask <agent> <oppgave>\nAndre agenter: ${others
            .map((a) => a.key)
            .join(", ")}`,
        );
      }
      await ctx.reply(`📨 Sender til ${target.role} (${target.key})…`);
      const typing = setInterval(() => {
        ctx.replyWithChatAction("typing").catch(() => {});
      }, 6000);
      const ts = new Date().toISOString();
      console.log(`${ts} [${agent.key}] -> /ask ${target.key}: ${task.slice(0, 100).replace(/\s+/g, " ")}`);
      try {
        const wt = await ensureWorktree(target);
        const framed = `(Handoff from the ${agent.role}, relayed by the owner.) ${task}`;
        const reply = await runAgent(target, framed, wt);
        clearInterval(typing);
        await sendLong(ctx, `↩️ ${target.role}:\n\n${reply}`);
      } catch (e: any) {
        clearInterval(typing);
        await ctx.reply("⚠️ Handoff-feil: " + (e?.message ?? String(e)));
      }
    });

    bot.on("message:text", async (ctx) => {
      const text = ctx.message.text;
      if (text.startsWith("/")) return;

      const typing = setInterval(() => {
        ctx.replyWithChatAction("typing").catch(() => {});
      }, 6000);
      ctx.replyWithChatAction("typing").catch(() => {});

      const ts = new Date().toISOString();
      console.log(`${ts} [${agent.key}] <- ${text.slice(0, 120).replace(/\s+/g, " ")}`);

      try {
        const wt = await ensureWorktree(agent);
        const reply = await runAgent(agent, text, wt);
        clearInterval(typing);
        await sendLong(ctx, reply);
        console.log(`${new Date().toISOString()} [${agent.key}] -> ok (${reply.length} chars)`);
      } catch (e: any) {
        clearInterval(typing);
        await ctx.reply("⚠️ Feil: " + (e?.message ?? String(e)));
        console.error(`${new Date().toISOString()} [${agent.key}] -> error: ${e?.message ?? e}`);
      }
    });

    bot.catch((err) => console.error(`[${agent.key}]`, err.error ?? err));

    bot
      .start({
        onStart: (info) =>
          console.log(`✅ ${agent.role} live som @${info.username}`),
      })
      .catch((e: any) =>
        console.error(
          `❌ ${agent.role} (${agent.key}) kunne ikke starte: ${e?.message ?? e}`,
        ),
      );
  }
}

main();

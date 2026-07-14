import { NextRequest } from "next/server";
import { getOpenRouter } from "@/lib/openrouter";
import { retrieve, formatContext } from "@/lib/rag";
import { getBotByPublicKeyAsync, effectiveModel } from "@/lib/bots";
import { getActivePromptContent } from "@/lib/prompts";
import { appendMessage, ensureConversation } from "@/lib/conversations";
import { LANGUAGE_NAMES, normalizeLanguage } from "@/lib/voice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

type ChatRequest = {
  botKey?: string;
  messages: ChatMessage[];
  conversationId?: string | null;
  /** ISO 639-1 language detected from voice input, if any. */
  language?: string;
};

const SENTINEL_START = "[[FOLLOWUPS]]";
const SENTINEL_END = "[[/FOLLOWUPS]]";

const FOLLOWUPS_DIRECTIVE = `

After your answer, on a new line, emit exactly:
${SENTINEL_START}
- <short follow-up question 1>
- <short follow-up question 2>
- <short follow-up question 3>
${SENTINEL_END}
Each question must be ≤ 60 chars, plausible next questions a real user would ask given this exchange. If you genuinely cannot think of useful follow-ups, emit no ${SENTINEL_START} block at all.`;

function buildSystemMessage(
  systemPrompt: string,
  contextText: string,
  replyLanguage: string
): string {
  const base = contextText
    ? `${systemPrompt}\n\n--- CONTEXT ---\n${contextText}\n--- END CONTEXT ---`
    : systemPrompt + "\n\nNo relevant context was retrieved for this question.";
  const langName = LANGUAGE_NAMES[replyLanguage];
  const languageDirective =
    replyLanguage && replyLanguage !== "en" && langName
      ? `\n\nThe user is communicating in ${langName}. Reply in ${langName}. Context passages may be in another language — translate the relevant facts rather than quoting them verbatim.`
      : "";
  return base + languageDirective + FOLLOWUPS_DIRECTIVE;
}

function stripFollowups(text: string): string {
  const i = text.indexOf(SENTINEL_START);
  return i >= 0 ? text.slice(0, i).trimEnd() : text;
}

function parseFollowups(text: string): string[] {
  const startIdx = text.indexOf(SENTINEL_START);
  if (startIdx < 0) return [];
  const after = text.slice(startIdx + SENTINEL_START.length);
  const endIdx = after.indexOf(SENTINEL_END);
  const block = endIdx >= 0 ? after.slice(0, endIdx) : after;
  return block
    .split("\n")
    .map((l) => l.replace(/^[\s\-*•]+/, "").trim())
    .filter((l) => l.length > 0 && l.length <= 200)
    .slice(0, 3);
}

function jsonError(error: string, status: number): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: NextRequest) {
  let body: ChatRequest;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const { botKey, messages, conversationId } = body;
  if (!botKey) return jsonError("botKey is required", 400);
  const bot = await getBotByPublicKeyAsync(botKey);
  if (!bot) return jsonError("Unknown bot", 404);
  if (!Array.isArray(messages) || messages.length === 0) {
    return jsonError("messages must be a non-empty array", 400);
  }
  const model = effectiveModel(bot);
  if (!model) {
    return jsonError("No model configured. Set a default model in admin settings.", 500);
  }

  const convoId = await ensureConversation(bot.id, conversationId ?? null, model);
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const query = lastUser?.content ?? "";
  if (lastUser) {
    await appendMessage(convoId, "user", lastUser.content);
  }

  let chunks: Awaited<ReturnType<typeof retrieve>> = [];
  try {
    chunks = await retrieve(bot.id, query, 4);
  } catch (err) {
    console.error("RAG retrieval failed:", err);
  }
  const contextText = formatContext(chunks);

  let openrouter: ReturnType<typeof getOpenRouter>;
  try {
    openrouter = getOpenRouter();
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Failed to init LLM client", 500);
  }

  // Reply-language resolution: a fixed per-bot language wins over detection;
  // 'auto' follows the language detected from voice input (when confident).
  let replyLanguage = "";
  if (bot.reply_in_user_language) {
    const fixed = bot.voice_language !== "auto" ? normalizeLanguage(bot.voice_language) : "";
    replyLanguage = fixed || normalizeLanguage(body.language ?? "");
  }

  const systemPrompt = await getActivePromptContent(bot.id);
  const fullMessages: ChatMessage[] = [
    { role: "system", content: buildSystemMessage(systemPrompt, contextText, replyLanguage) },
    ...messages.filter((m) => m.role !== "system"),
  ];

  const encoder = new TextEncoder();
  const citations = chunks.map((c, i) => ({
    n: i + 1,
    source: c.source,
    chunkIndex: c.chunk_index,
    preview: c.content.slice(0, 200),
  }));

  let assistantBuffer = "";
  let forwardedSoFar = 0;
  let seenSentinel = false;
  // The reply is persisted exactly once, even when the client disconnects
  // mid-stream and enqueue starts throwing (BUG-05).
  let persisted = false;
  let persistedId: number | null = null;
  const HOLDBACK = SENTINEL_START.length;

  const stream = new ReadableStream({
    async start(controller) {
      function safeEnqueue(payload: string): boolean {
        try {
          controller.enqueue(encoder.encode(payload));
          return true;
        } catch {
          return false;
        }
      }

      async function persistReply() {
        if (persisted) return;
        persisted = true;
        const cleanReply = stripFollowups(assistantBuffer);
        if (cleanReply) persistedId = await appendMessage(convoId, "assistant", cleanReply, citations);
      }

      // first event: convo id (so the client can stitch turns together)
      safeEnqueue(`event: conversation\ndata: ${JSON.stringify({ id: convoId })}\n\n`);
      safeEnqueue(`event: citations\ndata: ${JSON.stringify(citations)}\n\n`);

      function forwardSafe() {
        if (seenSentinel) return;
        const idx = assistantBuffer.indexOf(SENTINEL_START, forwardedSoFar);
        if (idx >= 0) {
          if (idx > forwardedSoFar) {
            // Trailing whitespace before the sentinel never renders in the
            // persisted copy, so don't stream it either (BUG-11).
            const chunk = assistantBuffer.slice(forwardedSoFar, idx).trimEnd();
            if (chunk) {
              safeEnqueue(`event: delta\ndata: ${JSON.stringify({ text: chunk })}\n\n`);
            }
          }
          forwardedSoFar = assistantBuffer.length;
          seenSentinel = true;
          return;
        }
        const safeEnd = assistantBuffer.length - HOLDBACK;
        if (safeEnd > forwardedSoFar) {
          const chunk = assistantBuffer.slice(forwardedSoFar, safeEnd);
          safeEnqueue(`event: delta\ndata: ${JSON.stringify({ text: chunk })}\n\n`);
          forwardedSoFar = safeEnd;
        }
      }

      try {
        const completion = await openrouter.chat.completions.create({
          model,
          messages: fullMessages,
          stream: true,
        });

        for await (const part of completion) {
          if (req.signal.aborted) break;
          const delta = part.choices?.[0]?.delta?.content ?? "";
          if (delta) {
            assistantBuffer += delta;
            forwardSafe();
          }
        }

        // Flush any remaining held-back tail when no sentinel was ever seen.
        if (!seenSentinel && forwardedSoFar < assistantBuffer.length) {
          const tail = assistantBuffer.slice(forwardedSoFar);
          safeEnqueue(`event: delta\ndata: ${JSON.stringify({ text: tail })}\n\n`);
          forwardedSoFar = assistantBuffer.length;
        }

        const followups = parseFollowups(assistantBuffer);
        if (followups.length > 0) {
          safeEnqueue(`event: followups\ndata: ${JSON.stringify(followups)}\n\n`);
        }

        await persistReply();
        // The persisted message id lets the widget request TTS by reference
        // (server then ignores client-supplied text for this bot's audio).
        if (persistedId !== null) {
          safeEnqueue(`event: message\ndata: ${JSON.stringify({ id: persistedId })}\n\n`);
        }
        safeEnqueue(`event: done\ndata: {}\n\n`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await persistReply();
        safeEnqueue(`event: error\ndata: ${JSON.stringify({ message })}\n\n`);
      } finally {
        try {
          controller.close();
        } catch {
          // already closed/errored by the runtime — nothing to release
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

import { NextRequest } from "next/server";
import { getOpenRouter } from "@/lib/openrouter";
import { getBotByPublicKeyAsync, effectiveModel, toPublicConfig } from "@/lib/bots";
import { getActivePromptContent } from "@/lib/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Hist = { role: "user" | "assistant"; content: string };
type Body = { botKey?: string; partial?: string; history?: Hist[] };

function buildSuggestPrompt(botName: string, personaExcerpt: string, quickStarts: string[]): string {
  return `You are an autocomplete helper for the "${botName}" support chat.
Given the user's partial input and recent conversation history, return 3 plausible
short questions they might be typing, as a JSON object.

The assistant being asked has this persona (for topical grounding):
${personaExcerpt}

Rules:
- Output ONLY valid JSON: {"suggestions": ["...", "...", "..."]}
- Each suggestion ≤ 60 chars.
- Suggestions must be natural completions or related questions a real user might ask ${botName}.
- If the partial is too short or ambiguous, still return 3 cold-start questions${
    quickStarts.length > 0 ? ` in the spirit of: ${quickStarts.join(" / ")}` : ""
  }.
- Never echo the partial back verbatim — always complete or extend.`;
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ suggestions: [] });
  }

  const bot = body.botKey ? await getBotByPublicKeyAsync(body.botKey) : undefined;
  if (!bot) return Response.json({ suggestions: [] }, { status: body.botKey ? 404 : 400 });

  const partial = (body.partial ?? "").trim();
  const history = (body.history ?? []).slice(-4);

  const model = effectiveModel(bot);
  if (!model) return Response.json({ suggestions: [] });

  let openrouter: ReturnType<typeof getOpenRouter>;
  try {
    openrouter = getOpenRouter();
  } catch {
    return Response.json({ suggestions: [] });
  }

  const personaExcerpt = (await getActivePromptContent(bot.id)).slice(0, 600);
  const { quickStarts } = toPublicConfig(bot);

  const userPrompt = [
    `Recent conversation (most recent last):`,
    history.length > 0
      ? history.map((h) => `${h.role}: ${h.content}`).join("\n")
      : "(empty — cold start)",
    "",
    `User is currently typing: ${JSON.stringify(partial)}`,
    "",
    "Return the JSON now.",
  ].join("\n");

  try {
    const completion = await openrouter.chat.completions.create({
      model,
      messages: [
        { role: "system", content: buildSuggestPrompt(bot.name, personaExcerpt, quickStarts) },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      max_tokens: 200,
      stream: false,
    });

    const raw = completion.choices?.[0]?.message?.content ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return Response.json({ suggestions: [] });
    }
    const suggestions = Array.isArray((parsed as { suggestions?: unknown })?.suggestions)
      ? ((parsed as { suggestions: unknown[] }).suggestions
          .filter((s): s is string => typeof s === "string")
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && s.length <= 200)
          .slice(0, 3))
      : [];
    return Response.json({ suggestions });
  } catch (err) {
    console.error("suggest failed:", err);
    return Response.json({ suggestions: [] });
  }
}

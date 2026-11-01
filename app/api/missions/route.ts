import { FALLBACK_MISSIONS } from "@/lib/constants";

function shuffle<T>(a: T[]) {
  return [...a].sort(() => Math.random() - 0.5);
}

export async function POST(req: Request) {
  const { count = 4 } = await req.json().catch(() => ({}));
  const n = Math.min(Math.max(Number(count) || 1, 1), 8);
  const fallback = () => Response.json({ missions: shuffle(FALLBACK_MISSIONS).slice(0, n), source: "fallback" });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return fallback();

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-haiku-5-5",
        max_tokens: 400,
        messages: [{
          role: "user",
          content: `You write secret missions for a party game set inside a trotro (shared minibus) in Accra, Ghana. Players act the missions out loud in the room while friends play the driver and the mate. Write ${n} different missions, each under 14 words, funny and friendly, with light Ghanaian flavour. Return only a JSON array of strings.`,
        }],
      }),
    });
    const data = await r.json();
    const text = (data.content ?? []).map((c: any) => c.text ?? "").join("");
    const arr = JSON.parse(text.slice(text.indexOf("["), text.lastIndexOf("]") + 1));
    if (!Array.isArray(arr) || arr.length === 0) return fallback();
    return Response.json({ missions: arr.slice(0, n).map(String), source: "claude" });
  } catch {
    return fallback();
  }
}

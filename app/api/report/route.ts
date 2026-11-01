function template(s: any, score: number) {
  const lines = [];
  if (s.crashes > 1) lines.push(`${s.crashes} crashes. The trotro is now held together by prayer.`);
  if (s.wrongChange > 0) lines.push(`The mate got change wrong ${s.wrongChange} time${s.wrongChange > 1 ? "s" : ""}. Maths teacher has been informed.`);
  if (s.missedStops > 0) lines.push(`${s.missedStops} missed stop${s.missedStops > 1 ? "s" : ""}. Somebody is still walking back from Lapaz.`);
  if (s.policeFines > 0) lines.push(`Police collected GH₵${s.policeFines * 10}. They say thank you.`);
  if (lines.length === 0) lines.push("Smooth trip. Nobody complained. Suspicious.");
  const verdict = score > 60 ? "Station master material." : score > 20 ? "You will survive Circle traffic." : "Please park the trotro.";
  return `${lines.slice(0, 2).join(" ")} ${verdict}`;
}

export async function POST(req: Request) {
  const { stats = {}, score = 0, names = [] } = await req.json().catch(() => ({}));
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return Response.json({ report: template(stats, score) });

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-haiku-5-5",
        max_tokens: 200,
        messages: [{
          role: "user",
          content: `You are the station master at Circle trotro station in Accra roasting a crew after their shift in a party game. Crew: ${JSON.stringify(names)}. Final score: ${score}. Stats: ${JSON.stringify(stats)}. Write a trip report in 2 or 3 short sentences, funny and kind, light Ghanaian English. Mention names and specific stats. End with a one-line verdict. Plain text only, no em dashes.`,
        }],
      }),
    });
    const data = await r.json();
    const text = (data.content ?? []).map((c: any) => c.text ?? "").join("").trim();
    return Response.json({ report: text || template(stats, score) });
  } catch {
    return Response.json({ report: template(stats, score) });
  }
}

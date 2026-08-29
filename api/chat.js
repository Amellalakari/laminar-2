// Vercel serverless function. The API key lives here, never in the browser.
// Set ANTHROPIC_API_KEY in your Vercel project settings (or in .env for local dev).

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY is not set on the server" });
  }

  // Cap the request so a stray client cannot run up your bill.
  const body = req.body ?? {};
  const safe = {
    model: "claude-sonnet-4-6",
    max_tokens: Math.min(body.max_tokens ?? 1000, 1500),
    system: typeof body.system === "string" ? body.system.slice(0, 20000) : undefined,
    messages: Array.isArray(body.messages) ? body.messages.slice(-20) : [],
  };

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(safe),
    });
    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch (err) {
    return res.status(502).json({ error: "Upstream request failed" });
  }
}

import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

/* Serves /api/chat during `npm run dev` so the API key stays out of the browser.
   In production this route is handled by api/chat.js on Vercel instead.        */
function localApi(env) {
  return {
    name: "laminar-local-api",
    configureServer(server) {
      server.middlewares.use("/api/chat", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          return res.end(JSON.stringify({ error: "POST only" }));
        }

        const key = env.ANTHROPIC_API_KEY;
        if (!key) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          return res.end(JSON.stringify({
            error: "No API key. Create a file called .env.local in this folder containing ANTHROPIC_API_KEY=sk-ant-... then restart npm run dev.",
          }));
        }

        let raw = "";
        req.on("data", (c) => { raw += c; });
        req.on("end", async () => {
          try {
            const body = JSON.parse(raw || "{}");
            const safe = {
              model: "claude-sonnet-4-6",
              max_tokens: Math.min(body.max_tokens ?? 1000, 1500),
              system: typeof body.system === "string" ? body.system.slice(0, 20000) : undefined,
              messages: Array.isArray(body.messages) ? body.messages.slice(-20) : [],
            };
            const upstream = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": key,
                "anthropic-version": "2023-06-01",
              },
              body: JSON.stringify(safe),
            });
            const text = await upstream.text();
            res.statusCode = upstream.status;
            res.setHeader("Content-Type", "application/json");
            res.end(text);
          } catch (err) {
            res.statusCode = 502;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: String(err.message || err) }));
          }
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // third argument "" loads every variable, not just VITE_-prefixed ones
  const env = loadEnv(mode, process.cwd(), "");
  return { plugins: [react(), localApi(env)] };
});

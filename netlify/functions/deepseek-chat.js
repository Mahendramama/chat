// Supports DeepSeek native OR OpenRouter (choose via LLM_PROVIDER).
// Env:
//   LLM_PROVIDER = "deepseek" | "openrouter"
//   DEEPSEEK_API_KEY = <native key>     (for deepseek)
//   OPENROUTER_API_KEY = <sk-or-v1-...> (for openrouter)
//   PUBLIC_BASE_URL = https://<yoursite>.netlify.app (optional, for OpenRouter headers)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const PROVIDER = (process.env.LLM_PROVIDER || "deepseek").toLowerCase();

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  try {
    const { messages, model: modelIn = "deepseek-chat", temperature = 0.7 } =
      JSON.parse(event.body || "{}");

    if (!Array.isArray(messages) || messages.length === 0) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "messages[] required" }) };
    }

    if (PROVIDER === "openrouter") {
      // ---- OpenRouter path ----
      const key = (process.env.OPENROUTER_API_KEY || "").trim();
      if (!key) {
        return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: "OPENROUTER_API_KEY missing" }) };
      }

      // Map DeepSeek model names to OpenRouter names
      const modelMap = {
        "deepseek-chat": "deepseek/deepseek-chat",
        "deepseek-reasoner": "deepseek/deepseek-reasoner",
        "deepseek-coder": "deepseek/deepseek-coder",
      };
      const model = modelMap[modelIn] || modelIn;

      const referer =
        process.env.PUBLIC_BASE_URL ||
        event.headers.origin ||
        `https://${event.headers["x-forwarded-host"] || "localhost"}`;
      const title = "DeepSeek Chat (OpenRouter)";

      const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": referer, // OpenRouter recommends these
          "X-Title": title,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          stream: false,
        }),
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        return {
          statusCode: resp.status,
          headers: corsHeaders,
          body: JSON.stringify({ error: data?.error || "OpenRouter error", details: data }),
        };
      }
      const reply = data?.choices?.[0]?.message?.content ?? "";
      return { statusCode: 200, headers: { "Content-Type": "application/json", ...corsHeaders }, body: JSON.stringify({ reply, usage: data?.usage || null }) };
    }

    // ---- DeepSeek native path ----
    const deepseekKey = (process.env.DEEPSEEK_API_KEY || "").trim();
    if (!deepseekKey) {
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: "DEEPSEEK_API_KEY missing" }) };
    }

    // Try v1 first, then legacy
    const tryOnce = async (url) =>
      fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${deepseekKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: modelIn, messages, temperature, stream: false }),
      });

    let resp = await tryOnce("https://api.deepseek.com/v1/chat/completions");
    if (resp.status === 404 || resp.status === 400) {
      resp = await tryOnce("https://api.deepseek.com/chat/completions");
    }

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return {
        statusCode: resp.status,
        headers: corsHeaders,
        body: JSON.stringify({ error: data?.error?.message || "DeepSeek API error", details: data }),
      };
    }
    const reply = data?.choices?.[0]?.message?.content ?? "";
    return { statusCode: 200, headers: { "Content-Type": "application/json", ...corsHeaders }, body: JSON.stringify({ reply, usage: data?.usage || null }) };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: "Server error", details: String(err) }) };
  }
};

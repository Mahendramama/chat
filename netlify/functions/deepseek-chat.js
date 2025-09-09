// Netlify Function: calls DeepSeek (native) Chat Completions
// Env needed (Netlify → Site settings → Environment variables):
//   DEEPSEEK_API_KEY = <your deepseek native key>  (NOT sk-or-v1-...)
// Optional:
//   DEEPSEEK_API_URL = https://api.deepseek.com/v1/chat/completions  (or legacy)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const firstUrl = () =>
  (process.env.DEEPSEEK_API_URL || "https://api.deepseek.com/v1/chat/completions").trim();

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  try {
    const key = (process.env.DEEPSEEK_API_KEY || "").trim();
    if (!key || key.startsWith("sk-or-")) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({
          error:
            "Server is missing a valid DeepSeek *native* API key. Add DEEPSEEK_API_KEY in Netlify (not an OpenRouter key).",
        }),
      };
    }

    const { messages, model = "deepseek-chat", temperature = 0.7 } = JSON.parse(event.body || "{}");
    if (!Array.isArray(messages) || messages.length === 0) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "messages[] is required" }) };
    }

    const call = async (url) =>
      fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages, temperature, stream: false }),
      });

    // Try v1 first, then legacy once
    let url = firstUrl();
    let resp = await call(url);
    if (resp.status === 404 || resp.status === 400) {
      const alt = "https://api.deepseek.com/chat/completions";
      if (url !== alt) resp = await call(alt);
    }

    const data = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      const msg = data?.error?.message || "DeepSeek API error";
      return {
        statusCode: resp.status,
        headers: corsHeaders,
        body: JSON.stringify({ error: msg, status: resp.status, details: data }),
      };
    }

    const reply = data?.choices?.[0]?.message?.content ?? "";
    const usage = data?.usage ?? null;

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
      body: JSON.stringify({ reply, usage }),
    };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: "Server error", details: String(err) }) };
  }
};

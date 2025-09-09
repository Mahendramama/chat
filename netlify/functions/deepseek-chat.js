// OpenRouter chat function with max_tokens + timeout guard
// Env needed on Netlify:
//   OPENROUTER_API_KEY = sk-or-v1-....

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const TIMEOUT_MS = 23000; // keep under Netlify free function limit

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  try {
    const key = (process.env.OPENROUTER_API_KEY || "").trim();
    if (!key) {
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: "OPENROUTER_API_KEY missing" }) };
    }

    const payload = JSON.parse(event.body || "{}");
    const {
      messages,
      model = "deepseek/deepseek-chat-v3.1:free",
      temperature = 0.5,
      max_tokens = 650, // cap to avoid timeouts
    } = payload;

    if (!Array.isArray(messages) || !messages.length) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "messages[] required" }) };
    }

    const referer =
      process.env.PUBLIC_BASE_URL ||
      event.headers.origin ||
      `https://${event.headers["x-forwarded-host"] || "localhost"}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let resp, data, ok;
    try {
      resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": referer,
          "X-Title": "IAS SUPER 30 Chat",
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens,
          stream: false,
        }),
      });
      ok = resp.ok;
      data = await resp.json().catch(() => ({}));
    } catch (e) {
      clearTimeout(timer);
      const msg = (e && String(e).includes("AbortError")) ? "Request timed out (try fewer items)" : String(e);
      return { statusCode: 504, headers: corsHeaders, body: JSON.stringify({ error: msg }) };
    }
    clearTimeout(timer);

    if (!ok) {
      return {
        statusCode: resp.status,
        headers: corsHeaders,
        body: JSON.stringify({ error: data?.error || `HTTP ${resp.status}`, details: data }),
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

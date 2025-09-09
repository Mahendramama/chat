// Calls OpenRouter chat completions using your sk-or-v1-... key.
// Netlify env vars required:
//   OPENROUTER_API_KEY = sk-or-v1-xxxxxxxx
// Optional:
//   PUBLIC_BASE_URL = https://<your-site>.netlify.app  (used for recommended headers)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

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

    const { messages, model = "deepseek/deepseek-chat-v3.1:free", temperature = 0.7 } =
      JSON.parse(event.body || "{}");
    if (!Array.isArray(messages) || messages.length === 0) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "messages[] required" }) };
    }

    const referer =
      process.env.PUBLIC_BASE_URL ||
      event.headers.origin ||
      `https://${event.headers["x-forwarded-host"] || "localhost"}`;

    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        // Recommended headers for OpenRouter
        "HTTP-Referer": referer,
        "X-Title": "IAS SUPER 30 Chat",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        stream: false
      }),
    });

    const data = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      return {
        statusCode: resp.status,
        headers: corsHeaders,
        body: JSON.stringify({
          error: data?.error || "OpenRouter error",
          details: data
        }),
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
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Server error", details: String(err) }),
    };
  }
};

// netlify/functions/deepseek-chat.js
// Node 18+ runtime on Netlify. Keeps your DeepSeek API key server-side.
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// Prefer the common OpenAI-compatible path first:
const DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions";
// If your account uses the non-v1 path, change to:
// const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

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
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  try {
    if (!DEEPSEEK_API_KEY) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({
          error: "Missing DEEPSEEK_API_KEY in Netlify environment variables.",
        }),
      };
    }

    const { messages, model = "deepseek-chat", temperature = 0.7 } = JSON.parse(
      event.body || "{}"
    );

    if (!Array.isArray(messages) || messages.length === 0) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Request must include a messages array." }),
      };
    }

    const resp = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        stream: false, // keep simple; we'll simulate typing on the client
      }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      return {
        statusCode: resp.status,
        headers: corsHeaders,
        body: JSON.stringify({
          error: "DeepSeek API error",
          status: resp.status,
          details: data,
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

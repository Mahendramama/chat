// netlify/functions/chat.js
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: cors, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  try {
    const { messages = [], temperature = 0.7, model: rawModel = "deepseek-chat" } = JSON.parse(event.body || "{}");

    const DS_KEY = process.env.DEEPSEEK_API_KEY;
    const OR_KEY = process.env.OPENROUTER_API_KEY;

    // Choose provider automatically
    let provider = null;
    if (DS_KEY) provider = "deepseek";
    if (!provider && OR_KEY) provider = "openrouter";
    if (!provider) {
      return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Missing DEEPSEEK_API_KEY or OPENROUTER_API_KEY" }) };
    }

    if (provider === "deepseek") {
      // DeepSeek native API
      const url = "https://api.deepseek.com/chat/completions";
      const model = rawModel === "deepseek/deepseek-chat" ? "deepseek-chat" : rawModel;
      const dsRes = await fetch(url, {
        method: "POST",
        headers: { "Authorization": `Bearer ${DS_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, temperature, messages }),
      });
      const data = await dsRes.json();
      if (!dsRes.ok) return { statusCode: dsRes.status, headers: cors, body: JSON.stringify(data) };
      const reply = data?.choices?.[0]?.message?.content || "";
      return { statusCode: 200, headers: cors, body: JSON.stringify({ reply }) };
    }

    // OpenRouter API
    const url = "https://openrouter.ai/api/v1/chat/completions";
    // Normalize model name if your UI sends "deepseek-chat"
    const model = rawModel === "deepseek-chat" ? "deepseek/deepseek-chat" : rawModel;
    const orRes = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OR_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://your-netlify-site.netlify.app",
        "X-Title": "IAS SUPER 30",
      },
      body: JSON.stringify({ model, temperature, messages }),
    });
    const data = await orRes.json();
    if (!orRes.ok) return { statusCode: orRes.status, headers: cors, body: JSON.stringify(data) };
    const reply = data?.choices?.[0]?.message?.content || "";
    return { statusCode: 200, headers: cors, body: JSON.stringify({ reply }) };
  } catch (err) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: err.message || "Unknown error" }) };
  }
};

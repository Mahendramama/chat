// netlify/functions/chat.js
// Node 18+ has global fetch. CommonJS function handler for Netlify.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: cors, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  try {
    const { messages = [], temperature = 0.7, model = "deepseek-chat" } = JSON.parse(event.body || "{}");

    // Choose endpoint: DeepSeek native (default). If you prefer OpenRouter, see note below.
    const url = "https://api.deepseek.com/chat/completions";
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Missing DEEPSEEK_API_KEY" }) };
    }

    const dsRes = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        temperature,
        messages
      })
    });

    const data = await dsRes.json();
    if (!dsRes.ok) {
      return { statusCode: dsRes.status, headers: cors, body: JSON.stringify(data) };
    }

    const reply = data?.choices?.[0]?.message?.content || "";
    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({ reply })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify({ error: err.message || "Unknown error" })
    };
  }
};

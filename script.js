// ===== IAS SUPER 30 front-end =====
const API_ENDPOINT = "/.netlify/functions/chat";

const messagesEl = document.getElementById("messages");
const form = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const newChatBtn = document.getElementById("newChatBtn");
const modelEl = document.getElementById("model");
const tempEl = document.getElementById("temperature");
const tempVal = document.getElementById("tempVal");

const SYSTEM_PROMPT =
  "You are IAS SUPER 30, a helpful assistant for OPSC/UPSC exam preparation. " +
  "Be concise, factual, and avoid speculation. Prefer standard textbooks and official government sources. " +
  "If something is uncertain, say so.";

let chat = loadChat() || [
  { role: "system", content: SYSTEM_PROMPT },
  { role: "assistant", content: "Hi! Ask me anything about OPSC/UPSC prep." }
];
renderAll();

tempEl.addEventListener("input", () => (tempVal.textContent = tempEl.value));

newChatBtn.addEventListener("click", () => {
  chat = [{ role: "system", content: SYSTEM_PROMPT }];
  persistChat(); renderAll();
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = userInput.value.trim();
  if (!text) return;

  addMessage("user", text);
  userInput.value = "";
  autoResize(userInput);

  const placeholderId = addMessage("assistant", "…thinking…");

  try {
    const res = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: chat,
        temperature: Number(tempEl.value || 0.7),
        model: modelEl.value || "deepseek-chat"
      })
    });

    if (!res.ok) {
      const msg = await res.text();
      updateMessage(placeholderId, `❌ Error: ${res.status} ${msg}`);
      return;
    }

    const data = await res.json();
    const reply = data.reply?.trim() || "(no content)";
    // replace placeholder
    updateMessage(placeholderId, reply);
    chat.push({ role: "assistant", content: reply });
    persistChat();
  } catch (err) {
    updateMessage(placeholderId, `❌ Network error: ${err.message}`);
  }
});

// Simple autosize for textarea
userInput.addEventListener("input", () => autoResize(userInput));
function autoResize(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 200) + "px";
}

// ----- Chat rendering helpers -----
function renderAll() {
  messagesEl.innerHTML = "";
  chat
    .filter(m => m.role !== "system")
    .forEach(m => renderMessage(m.role, m.content));
  messagesEl.scrollTop = messagesEl.scrollHeight;
}
function addMessage(role, content) {
  chat.push({ role, content });
  const id = renderMessage(role, content);
  persistChat();
  return id;
}
function updateMessage(id, content) {
  const el = document.querySelector(`[data-id="${id}"] .content`);
  if (el) el.innerHTML = md(content);
}
let idCounter = 0;
function renderMessage(role, content) {
  const t = document.getElementById("msgTemplate");
  const node = t.content.cloneNode(true);
  const bubble = node.querySelector(".bubble");
  const metaRole = node.querySelector(".role");
  const contentEl = node.querySelector(".content");
  const copyBtn = node.querySelector(".copy");

  const id = `m${++idCounter}`;
  const isUser = role === "user";
  bubble.classList.add(isUser ? "user" : "assistant");
  bubble.dataset.id = id;
  metaRole.textContent = isUser ? "You" : "IAS SUPER 30";
  contentEl.innerHTML = md(content);

  copyBtn.addEventListener("click", () => {
    const plain = stripHtml(contentEl.innerHTML);
    navigator.clipboard.writeText(plain);
    copyBtn.textContent = "Copied!";
    setTimeout(() => (copyBtn.textContent = "Copy"), 1200);
  });

  messagesEl.appendChild(node);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return id;
}
function persistChat() {
  localStorage.setItem("ias_super_30_chat", JSON.stringify(chat));
}
function loadChat() {
  try { return JSON.parse(localStorage.getItem("ias_super_30_chat") || ""); }
  catch { return null; }
}

// Minimal Markdown (bold, code blocks, inline code, links, newlines)
function md(s = "") {
  let html = s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  html = html
    .replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${code}</code></pre>`)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, `<a href="$2" target="_blank" rel="noopener">$1</a>`)
    .replace(/\n/g, "<br>");
  return html;
}
function stripHtml(html) {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
}

import { invoke } from "@tauri-apps/api/core";
import { marked } from "marked";

// Wire shapes from agent-lab/docs/agentserver.md — kept minimal and
// loose (most fields optional) since this is a first version; a
// mismatch here just means a field renders as empty, not a crash.
interface WireSession {
  id: number;
  name: string;
  config_profile: string;
}

interface WireMessage {
  role: string;
  content?: string;
  tool_name?: string;
}

interface ChatResponse {
  response: string;
  messages: WireMessage[];
  error?: string;
}

let baseUrlEl: HTMLInputElement;
let tokenEl: HTMLInputElement;
let sessionSelectEl: HTMLSelectElement;
let newSessionNameEl: HTMLInputElement;
let messagesEl: HTMLElement;
let messageInputEl: HTMLInputElement;
let statusEl: HTMLElement;

let currentSessionId: number | null = null;

function connection() {
  const baseUrl = baseUrlEl.value.trim() || "http://127.0.0.1:8099";
  const token = tokenEl.value.trim();
  return { baseUrl, token };
}

function setStatus(text: string, isError = false) {
  statusEl.textContent = text;
  statusEl.style.color = isError ? "crimson" : "inherit";
}

function renderMessages(list: WireMessage[]) {
  messagesEl.innerHTML = "";
  for (const m of list) {
    const div = document.createElement("div");
    div.className = `message message-${m.role}`;
    const label = m.tool_name ? `${m.role} (${m.tool_name})` : m.role;

    const labelEl = document.createElement("strong");
    labelEl.textContent = label + ":";
    div.appendChild(labelEl);

    // Model replies are markdown (headers, bold, lists — see the course
    // profile's answers in particular); rendering it, not showing the
    // raw ** and # characters, is the whole point. Trusted content: this
    // is our own model's output via our own server, not third-party web
    // content, so skipping a sanitizer here is a deliberate corner, not
    // an oversight.
    const bodyEl = document.createElement("div");
    bodyEl.className = "message-body";
    bodyEl.innerHTML = marked.parse(m.content ?? "", { async: false }) as string;
    div.appendChild(bodyEl);

    messagesEl.appendChild(div);
  }
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function refreshSessions(selectId?: number) {
  const { baseUrl, token } = connection();
  try {
    const sessions = await invoke<WireSession[]>("list_sessions", { baseUrl, token });
    sessionSelectEl.innerHTML = "";
    for (const s of sessions) {
      const opt = document.createElement("option");
      opt.value = String(s.id);
      opt.textContent = `${s.name} (#${s.id}, ${s.config_profile})`;
      sessionSelectEl.appendChild(opt);
    }
    const wanted = selectId ?? currentSessionId;
    if (wanted !== null && sessions.some((s) => s.id === wanted)) {
      sessionSelectEl.value = String(wanted);
      currentSessionId = wanted;
    } else {
      currentSessionId = sessions.length > 0 ? sessions[0].id : null;
      if (currentSessionId !== null) sessionSelectEl.value = String(currentSessionId);
    }
    if (currentSessionId !== null) await loadMessages();
    setStatus(`${sessions.length} session(s) loaded.`);
  } catch (err) {
    setStatus(String(err), true);
  }
}

async function loadMessages() {
  if (currentSessionId === null) return;
  const { baseUrl, token } = connection();
  try {
    const messages = await invoke<WireMessage[]>("get_messages", {
      baseUrl,
      token,
      sessionId: currentSessionId,
    });
    renderMessages(messages);
  } catch (err) {
    setStatus(String(err), true);
  }
}

async function onCreateSession() {
  const name = newSessionNameEl.value.trim();
  if (!name) {
    setStatus("session name must not be empty", true);
    return;
  }
  const { baseUrl, token } = connection();
  try {
    const session = await invoke<WireSession>("create_session", { baseUrl, token, name });
    newSessionNameEl.value = "";
    await refreshSessions(session.id);
    setStatus(`created session #${session.id}.`);
  } catch (err) {
    setStatus(String(err), true);
  }
}

async function onSend(e: Event) {
  e.preventDefault();
  const message = messageInputEl.value.trim();
  if (!message || currentSessionId === null) return;
  const { baseUrl, token } = connection();
  messageInputEl.value = "";
  setStatus("sending…");
  try {
    const resp = await invoke<ChatResponse>("send_message", {
      baseUrl,
      token,
      sessionId: currentSessionId,
      message,
    });
    await loadMessages();
    setStatus(resp.error ? `error: ${resp.error}` : "ok");
  } catch (err) {
    setStatus(String(err), true);
    await loadMessages(); // the turn may still have been saved even on error
  }
}

window.addEventListener("DOMContentLoaded", () => {
  baseUrlEl = document.querySelector("#base-url")!;
  tokenEl = document.querySelector("#token")!;
  sessionSelectEl = document.querySelector("#session-select")!;
  newSessionNameEl = document.querySelector("#new-session-name")!;
  messagesEl = document.querySelector("#messages")!;
  messageInputEl = document.querySelector("#message-input")!;
  statusEl = document.querySelector("#status")!;

  baseUrlEl.value = "http://127.0.0.1:8099";

  document.querySelector("#create-session")!.addEventListener("click", onCreateSession);
  sessionSelectEl.addEventListener("change", () => {
    currentSessionId = Number(sessionSelectEl.value);
    loadMessages();
  });
  document
    .querySelector<HTMLFormElement>("#send-form")!
    .addEventListener("submit", onSend);
  tokenEl.addEventListener("change", () => refreshSessions());
});

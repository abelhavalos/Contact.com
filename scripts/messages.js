/****************************************************
 * CONTACT.COM — ULTRA FAST MESSAGES.JS
 ****************************************************/

const API_URL = "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

/* 1. INITIAL STATE & USER VALIDATION */
let loggedInUser = JSON.parse(localStorage.getItem("contact_user"));
if (!loggedInUser) window.location.href = "login.html";

loggedInUser.fullName = loggedInUser.fullName || loggedInUser.FullName || loggedInUser.email;
loggedInUser.profilePic = loggedInUser.profilePic || loggedInUser.ProfilePic || null;

const url = new URL(window.location.href);
const otherEmailParam = url.searchParams.get("otherEmail");
const conversationIdParam = url.searchParams.get("conversationId");
const communityId = url.searchParams.get("communityId");
const mode = communityId ? "community" : "private";
const finalOtherEmail = otherEmailParam || url.searchParams.get("email");
let chatTitle = url.searchParams.get("title") || "";

let activeConversationId = conversationIdParam || null;
let messages = [];
let communityMembers = [];
let otherUser = null;

const BUBBLE_PALETTE = [
  { bg: "#4A6CFF", text: "#FFFFFF" },
  { bg: "#6F8CFF", text: "#FFFFFF" },
  { bg: "#8FA3FF", text: "#000000" },
  { bg: "#AFC0FF", text: "#000000" },
  { bg: "#D1DDFF", text: "#000000" }
];

/****************************************************
 * 2. UI HELPERS (Defined early to prevent ReferenceErrors)
 ****************************************************/
function showChatLoader() {
  const el = document.getElementById("chatLoader");
  if (el) el.style.display = "flex";
}

function hideChatLoader() {
  const el = document.getElementById("chatLoader");
  if (el) el.style.display = "none";
}

function getUserColor(email) {
  if (!email) return BUBBLE_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = (hash << 5) - hash + email.charCodeAt(i);
    hash |= 0;
  }
  return BUBBLE_PALETTE[Math.abs(hash) % BUBBLE_PALETTE.length];
}

function getInitials(name) {
  if (!name) return "?";
  return name.split(" ").filter(Boolean).map(p => p[0]).join("").substring(0, 2).toUpperCase();
}

async function fileToBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

/****************************************************
 * 3. CORE CHAT FUNCTIONS
 ****************************************************/

async function loadMessagesOnce() {
  if (!activeConversationId) return;
  showChatLoader();
  try {
    const r = await fetch(`${API_URL}?module=getMessages&conversationId=${activeConversationId}`);
    const data = await r.json();
    messages = data.messages || [];
    renderAllMessages(messages);
  } catch (e) {
    console.error("Load failed", e);
  } finally {
    hideChatLoader();
  }
}

function renderAllMessages(list) {
  const container = document.getElementById("messages");
  if (!container) return;
  container.innerHTML = "";
  const fragment = document.createDocumentFragment();
  list.forEach(msg => fragment.appendChild(buildMessageRow(msg)));
  container.appendChild(fragment);
  container.scrollTop = container.scrollHeight;
}

function buildMessageRow(msg) {
  const isMe = msg.senderEmail === loggedInUser.email;
  const color = getUserColor(msg.senderEmail);
  const row = document.createElement("div");
  row.className = "msg-row";
  row.style.cssText = `display:flex; margin-bottom:10px; gap:8px; align-items:flex-end; justify-content:${isMe ? 'flex-end' : 'flex-start'};`;

  const avatar = document.createElement("div");
  avatar.style.width = "36px";
  
  // Avatar Logic
  let pic = null, name = msg.senderEmail;
  if (isMe) {
    pic = loggedInUser.profilePic;
    name = loggedInUser.fullName;
  } else if (mode === "community") {
    const s = communityMembers.find(m => m.email === msg.senderEmail) || {};
    pic = s.profilePic;
    name = s.fullName || msg.senderEmail;
  } else {
    pic = otherUser?.profilePic || otherUser?.ProfilePic;
    name = otherUser?.fullName || finalOtherEmail;
  }

  avatar.innerHTML = pic 
    ? `<img class="chat-avatar" src="${pic}" />` 
    : `<div class="chat-avatar-fallback">${getInitials(name)}</div>`;

  const bubble = document.createElement("div");
  bubble.style.cssText = `max-width:70%; padding:8px 12px; border-radius:16px; font-size:14px; background:${isMe ? color.bg : "#F3F4F6"}; color:${isMe ? color.text : "#111827"};`;
  
  if (msg.type === "image") bubble.innerHTML = `<img src="${msg.fileData}" class="chat-image">`;
  else if (msg.type === "document") bubble.innerHTML = `<a href="${msg.fileData}" download="${msg.fileName}" class="chat-doc">📄 ${msg.fileName}</a>`;
  else bubble.textContent = msg.text || "";

  if (isMe) { row.appendChild(bubble); row.appendChild(avatar); }
  else { row.appendChild(avatar); row.appendChild(bubble); }
  return row;
}

function sendMessage(payloadOverride = null) {
  const input = document.getElementById("messageInput");
  const text = (input?.value || "").trim();
  if (!payloadOverride && (!text || !activeConversationId)) return;

  const payload = payloadOverride || { module: "sendMessage", type: "text", text };
  const optimistic = { senderEmail: loggedInUser.email, ...payload };
  
  const container = document.getElementById("messages");
  container.appendChild(buildMessageRow(optimistic));
  container.scrollTop = container.scrollHeight;

  if (!payloadOverride) {
    fetch(`${API_URL}?module=sendMessage&conversationId=${activeConversationId}&senderEmail=${loggedInUser.email}&type=text&text=${encodeURIComponent(text)}`)
      .then(() => loadMessagesOnce());
    input.value = "";
  } else {
    fetch(API_URL, { method: "POST", body: JSON.stringify({ ...payload, conversationId: activeConversationId, senderEmail: loggedInUser.email }) })
      .then(() => loadMessagesOnce());
  }
}

/****************************************************
 * 4. DATA FETCHING (Parallel Tasks)
 ****************************************************/
async function loadOtherUserProfile() {
  const r = await fetch(`${API_URL}?module=getUserByEmail&email=${encodeURIComponent(finalOtherEmail)}`);
  const d = await r.json();
  otherUser = d?.user || {};
  const name = otherUser.fullName || otherUser.FullName || finalOtherEmail;
  const header = document.getElementById("headerTitle");
  if (header) header.innerHTML = `<div class="chat-header"><div class="chat-header-main">${chatTitle || name}</div></div>`;
}

async function loadCommunityMembers() {
  const r = await fetch(`${API_URL}?module=getCommunityMembers&communityId=${communityId}`);
  const d = await r.json();
  const emails = (d.members || []).map(m => typeof m === "string" ? m : m.email);
  const tasks = emails.map(async email => {
    const res = await fetch(`${API_URL}?module=getUserByEmail&email=${encodeURIComponent(email)}`);
    const data = await res.json();
    const u = data?.user || {};
    return { email, fullName: u.fullName || u.FullName || email, profilePic: u.profilePic || u.ProfilePic || null };
  });
  communityMembers = await Promise.all(tasks);
}

/****************************************************
 * 5. INITIALIZATION & EVENT LISTENERS
 ****************************************************/
function setupEventListeners() {
  document.getElementById("sendBtn")?.addEventListener("click", () => sendMessage());
  document.getElementById("messageInput")?.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  document.getElementById("toggleMembers")?.addEventListener("click", () => {
    document.getElementById("memberSidebar")?.classList.toggle("show");
  });

  ['Doc', 'Img'].forEach(type => {
    const btn = document.getElementById(`upload${type}Btn`);
    const inp = document.getElementById(`${type.toLowerCase()}Input`);
    if (btn && inp) {
      btn.onclick = () => inp.click();
      inp.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const base64 = await fileToBase64(file);
        sendMessage({ type: type === 'Doc' ? "document" : "image", fileName: file.name, fileData: base64 });
        e.target.value = "";
      };
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Initial UI
  loadNavbar();
  showChatLoader();
  setupEventListeners();

  // 2. Start Background & ID tasks
  const backgroundTasks = mode === "private" ? [loadOtherUserProfile()] : [loadCommunityMembers()];
  
  const getConvIdTask = (async () => {
    if (activeConversationId) return activeConversationId;
    const module = mode === "community" ? "startCommunityConversation" : "startConversation";
    const params = mode === "community" ? `&communityId=${communityId}` : `&otherEmail=${finalOtherEmail}`;
    const r = await fetch(`${API_URL}?module=${module}&userEmail=${loggedInUser.email}${params}`);
    const d = await r.json();
    return d.conversationId;
  })();

  // 3. Parallel Resolve
  const [convId] = await Promise.all([getConvIdTask, ...backgroundTasks]);
  activeConversationId = convId;

  if (activeConversationId) await loadMessagesOnce();
  else hideChatLoader();
});

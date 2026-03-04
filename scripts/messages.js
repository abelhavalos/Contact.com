/****************************************************
 * CONTACT.COM — ULTRA-FAST OPTIMIZED MESSAGES.JS
 ****************************************************/

const API_URL = "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

/* --- USER & PARAMS --- */
const loggedInUser = JSON.parse(localStorage.getItem("contact_user")) || (window.location.href = "login.html");
const url = new URL(window.location.href);
const communityId = url.searchParams.get("communityId");
const mode = communityId ? "community" : "private";
const finalOtherEmail = url.searchParams.get("otherEmail") || url.searchParams.get("email");
let chatTitle = url.searchParams.get("title") || "";

/* --- STATE --- */
let activeConversationId = url.searchParams.get("conversationId") || null;
let messages = [];
let otherUser = null;
let communityMembers = [];
let lastFetchedCount = 0;
let pollingInterval = null;

const BUBBLE_PALETTE = [
  { bg: "#4A6CFF", text: "#FFFFFF" },
  { bg: "#6F8CFF", text: "#FFFFFF" },
  { bg: "#8FA3FF", text: "#000000" },
  { bg: "#AFC0FF", text: "#000000" }
];

/****************************************************
 * STYLES (Dynamic Injection for Responsive Media)
 ****************************************************/
const fastStyle = document.createElement("style");
fastStyle.innerHTML = `
  .chat-image { 
    max-width: 100%; 
    border-radius: 12px; 
    cursor: zoom-in; 
    transition: transform 0.2s;
    display: block;
    background: #f0f4ff;
    min-height: 100px;
    object-fit: cover;
  }
  .chat-image:hover { opacity: 0.9; }
  .msg-bubble { 
    position: relative; 
    word-wrap: break-word; 
    line-height: 1.4;
  }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
  .new-msg { animation: fadeIn 0.3s ease-out forwards; }
`;
document.head.appendChild(fastStyle);

/****************************************************
 * HELPERS
 ****************************************************/
const getInitials = (n) => (n || "?").split(" ").filter(Boolean).map(p => p[0]).join("").substring(0, 2).toUpperCase();
const fileToBase64 = (f) => new Promise(r => { const rd = new FileReader(); rd.onload = () => r(rd.result); rd.readAsDataURL(f); });

function getUserColor(email) {
  let hash = 0;
  for (let i = 0; i < (email || "").length; i++) hash = (hash << 5) - hash + email.charCodeAt(i);
  return BUBBLE_PALETTE[Math.abs(hash) % BUBBLE_PALETTE.length];
}

/****************************************************
 * DATA FETCHING (PARALLEL)
 ****************************************************/
async function loadOtherUserProfile() {
  const r = await fetch(`${API_URL}?module=getUserByEmail&email=${encodeURIComponent(finalOtherEmail)}`);
  const d = await r.json();
  otherUser = d?.user || {};
  updateHeader();
}

function updateHeader() {
  const header = document.getElementById("headerTitle");
  if (!header) return;
  const name = otherUser?.fullName || otherUser?.FullName || finalOtherEmail;
  const pic = otherUser?.profilePic || otherUser?.ProfilePic;
  const avatar = pic ? `<img class="chat-avatar" src="${pic}" />` : `<div class="chat-avatar-fallback">${getInitials(name)}</div>`;
  
  header.innerHTML = `<div style="display:flex;align-items:center;gap:12px;">${chatTitle ? `<span>${chatTitle}</span>` : `${avatar}<span>${name}</span>`}</div>`;
}

/****************************************************
 * CORE MESSAGE ENGINE
 ****************************************************/
function startPolling() {
  if (pollingInterval) clearInterval(pollingInterval);
  loadMessages(); // Initial load
  // Adaptive polling: slower when tab is hidden
  pollingInterval = setInterval(() => {
    if (document.hidden) return; 
    if (activeConversationId) loadMessages();
  }, 1500);
}

async function loadMessages() {
  try {
    const r = await fetch(`${API_URL}?module=getMessages&conversationId=${activeConversationId}`);
    const data = await r.json();
    const backendMessages = (data.messages || []).slice(-15);

    // Only re-render if something changed
    if (JSON.stringify(backendMessages) !== JSON.stringify(messages.filter(m => !m.optimistic))) {
      const optimistic = messages.filter(m => m.optimistic);
      messages = [...backendMessages, ...optimistic];
      renderMessages(messages);
    }
  } catch (e) { console.error("Poll Error:", e); }
}

function renderMessages(list) {
  const container = document.getElementById("messages");
  if (!container) return;

  const fragment = document.createDocumentFragment();
  
  list.forEach((msg) => {
    const isMe = msg.senderEmail === loggedInUser.email;
    const color = getUserColor(msg.senderEmail);
    const senderName = isMe ? loggedInUser.fullName : (communityMembers.find(m => m.email === msg.senderEmail)?.fullName || msg.senderEmail);
    const pic = isMe ? loggedInUser.profilePic : communityMembers.find(m => m.email === msg.senderEmail)?.profilePic || otherUser?.profilePic;

    const row = document.createElement("div");
    row.className = "new-msg";
    row.style.cssText = `display:flex; justify-content:${isMe ? 'flex-end' : 'flex-start'}; align-items:flex-start; margin-bottom:18px; gap:10px;`;

    const avatarHTML = pic ? `<img class="chat-avatar" src="${pic}" />` : `<div class="chat-avatar-fallback">${getInitials(senderName)}</div>`;
    
    let content = "";
    if (msg.type === "image") {
      content = `<img src="${msg.fileData}" class="chat-image" onclick="window.open(this.src)" loading="lazy">`;
    } else if (msg.type === "document") {
      content = `<a href="${msg.fileData}" download="${msg.fileName}" class="chat-doc">📄 ${msg.fileName}</a>`;
    } else {
      content = `<div>${msg.text || ""}</div>`;
    }

    const bubbleHTML = `
      ${!isMe ? `<div style="width:50px;text-align:center;">${avatarHTML}<div style="font-size:10px;color:#999;margin-top:4px;">${senderName.split(' ')[0]}</div></div>` : ''}
      <div class="msg-bubble" style="max-width:70%; background:${isMe ? color.bg : '#f1f1f1'}; color:${isMe ? color.text : '#333'}; padding:12px; border-radius:16px; border-bottom-${isMe ? 'right' : 'left'}-radius:2px;">
        ${content}
      </div>
      ${isMe ? `<div style="width:50px;text-align:center;">${avatarHTML}<div style="font-size:10px;color:#999;margin-top:4px;">Me</div></div>` : ''}
    `;
    
    row.innerHTML = bubbleHTML;
    fragment.appendChild(row);
  });

  container.innerHTML = "";
  container.appendChild(fragment);
  container.scrollTop = container.scrollHeight;
}

/****************************************************
 * SEND ENGINE
 ****************************************************/
async function sendMessage(payloadOverride = null) {
  const input = document.getElementById("messageInput");
  const text = (input?.value || "").trim();
  if (!payloadOverride && (!text || !activeConversationId)) return;

  const payload = payloadOverride || { module: "sendMessage", type: "text", text: text };
  
  // OPTIMISTIC UI: Add to local array immediately
  const optimisticMsg = {
    senderEmail: loggedInUser.email,
    type: payload.type,
    text: payload.text,
    fileData: payload.fileData || null,
    fileName: payload.fileName || null,
    optimistic: true
  };

  messages.push(optimisticMsg);
  renderMessages(messages);
  if (input) input.value = "";

  try {
    let response;
    if (payload.type === "text") {
      const qs = `&conversationId=${encodeURIComponent(activeConversationId)}&senderEmail=${encodeURIComponent(loggedInUser.email)}&type=text&text=${encodeURIComponent(payload.text)}`;
      response = await fetch(`${API_URL}?module=sendMessage${qs}`, { method: "GET" });
    } else {
      response = await fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({ ...payload, conversationId: activeConversationId, senderEmail: loggedInUser.email })
      });
    }
    const result = await response.json();
    if (result.success) loadMessages();
  } catch (e) { console.error("Send failed:", e); }
}

/****************************************************
 * INITIALIZATION
 ****************************************************/
document.addEventListener("DOMContentLoaded", async () => {
  // 1. Setup Navbar
  const nav = document.getElementById("navbar");
  if (nav) nav.innerHTML = `<div class="logo">Contact<span>.</span>com</div><div class="nav-links"><a href="dashboard.html">Home</a><a href="#" onclick="logout()">Logout</a></div>`;

  // 2. Load Profiles & Conversation in Parallel
  const tasks = [mode === "private" ? loadOtherUserProfile() : loadCommunityInfo()];
  
  if (!activeConversationId) {
    const startUrl = mode === "community" 
      ? `${API_URL}?module=startCommunityConversation&communityId=${communityId}&userEmail=${loggedInUser.email}`
      : `${API_URL}?module=startConversation&userEmail=${loggedInUser.email}&otherEmail=${finalOtherEmail}`;
    
    const connTask = fetch(startUrl).then(r => r.json()).then(d => {
      activeConversationId = d.conversationId;
      startPolling();
    });
    tasks.push(connTask);
  } else {
    startPolling();
  }

  await Promise.all(tasks);

  // 3. Bind Inputs
  document.getElementById("sendBtn").onclick = () => sendMessage();
  document.getElementById("messageInput").onkeydown = (e) => (e.key === "Enter" && !e.shiftKey) && (e.preventDefault(), sendMessage());
  
  // Responsive Media Binding
  const bindFile = (btnId, inputId, type) => {
    document.getElementById(btnId).onclick = () => document.getElementById(inputId).click();
    document.getElementById(inputId).onchange = async (e) => {
      const file = e.target.files[0];
      if (file) sendMessage({ type, fileName: file.name, fileData: await fileToBase64(file), module: "sendMessage" });
    };
  };
  bindFile("uploadDocBtn", "docInput", "document");
  bindFile("uploadImgBtn", "imgInput", "image");
});

function logout() { localStorage.clear(); window.location.href = "index.html"; }

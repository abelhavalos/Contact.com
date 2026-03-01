/****************************************************
 * CONTACT.COM — ULTRA FAST MESSAGES.JS (V2)
 * - Parallel Meta Loading
 * - Delta-Sync via lastId
 * - Optimistic UI Rendering
 * - Color Caching
 ****************************************************/

const API_URL = "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

/* USER & STATE */
let loggedInUser = JSON.parse(localStorage.getItem("contact_user"));
if (!loggedInUser) window.location.href = "login.html";

loggedInUser.fullName = loggedInUser.fullName || loggedInUser.FullName || loggedInUser.email;
loggedInUser.profilePic = loggedInUser.profilePic || loggedInUser.ProfilePic || null;

const url = new URL(window.location.href);
const communityId = url.searchParams.get("communityId");
const mode = communityId ? "community" : "private";
const finalOtherEmail = url.searchParams.get("otherEmail") || url.searchParams.get("email");
const chatTitle = url.searchParams.get("title") || "";

let activeConversationId = url.searchParams.get("conversationId") || null;
let messages = []; // Local state of all messages
let communityMembers = [];
let otherUser = null;
let colorCache = {};

const BUBBLE_PALETTE = [
  { bg: "#4A6CFF", text: "#FFFFFF" },
  { bg: "#6F8CFF", text: "#FFFFFF" },
  { bg: "#8FA3FF", text: "#000000" },
  { bg: "#AFC0FF", text: "#000000" },
  { bg: "#D1DDFF", text: "#000000" }
];

/****************************************************
 * HELPERS
 ****************************************************/
function getUserColor(email) {
  if (colorCache[email]) return colorCache[email];
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = (hash << 5) - hash + email.charCodeAt(i);
    hash |= 0;
  }
  colorCache[email] = BUBBLE_PALETTE[Math.abs(hash) % BUBBLE_PALETTE.length];
  return colorCache[email];
}

function getInitials(name) {
  if (!name) return "?";
  return name.split(" ").filter(Boolean).map(p => p[0]).join("").substring(0, 2).toUpperCase();
}

function fileToBase64(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

/****************************************************
 * CORE INITIALIZATION
 ****************************************************/
async function initChat() {
  loadNavbar();
  showChatLoader();

  // 1. Resolve Conversation ID if missing
  if (!activeConversationId) {
    const setupUrl = mode === "community" 
      ? `${API_URL}?module=startCommunityConversation&communityId=${communityId}&userEmail=${loggedInUser.email}`
      : `${API_URL}?module=startConversation&userEmail=${loggedInUser.email}&otherEmail=${finalOtherEmail}`;
    
    try {
      const res = await fetch(setupUrl);
      const data = await res.json();
      activeConversationId = data.conversationId;
    } catch (e) { console.error("Conv Init Error:", e); }
  }

  // 2. Fire metadata and first message load in parallel
  const metaPromises = [];
  if (mode === "private") {
    metaPromises.push(loadOtherUserProfile());
  } else {
    metaPromises.push(loadCommunityInfo(), loadCommunityMembers());
  }

  // Initial full load (lastId = 0)
  await Promise.all([...metaPromises, syncMessages()]);
  
  hideChatLoader();

  // 3. Background Sync (Poll every 3 seconds for new messages)
  setInterval(() => syncMessages(), 3000);
}

/****************************************************
 * MESSAGING ENGINE (DELTA SYNC)
 ****************************************************/
async function syncMessages() {
  if (!activeConversationId) return;

  // Determine the last ID we have locally to request only new data
  const lastId = messages.reduce((max, m) => (m.messageId > max ? m.messageId : max), 0);
  
  try {
    const r = await fetch(`${API_URL}?module=getMessages&conversationId=${activeConversationId}&lastId=${lastId}`);
    const data = await r.json();
    const newMessages = data.messages || [];

    if (newMessages.length > 0) {
      const container = document.getElementById("messages");
      if (!container) return;

      const fragment = document.createDocumentFragment();
      
      newMessages.forEach(msg => {
        // Ensure we don't duplicate a message that was added optimistically
        const existing = document.getElementById(`msg-${msg.messageId}`);
        if (!existing) {
          messages.push(msg);
          fragment.appendChild(buildMessageRow(msg));
        }
      });

      container.appendChild(fragment);
      container.scrollTop = container.scrollHeight;
    }
  } catch (e) {
    console.error("Sync Error:", e);
  }
}

function buildMessageRow(msg) {
  const isMe = msg.senderEmail === loggedInUser.email;
  const color = getUserColor(msg.senderEmail);

  const row = document.createElement("div");
  // Use messageId if it exists, otherwise use a temporary timestamp ID
  row.id = `msg-${msg.messageId || 'temp-' + Date.now()}`;
  row.className = "msg-row";
  row.style = `display:flex; margin-bottom:10px; gap:8px; align-items:flex-end; justify-content:${isMe ? 'flex-end' : 'flex-start'}`;

  let pic, name;
  if (isMe) {
    pic = loggedInUser.profilePic;
    name = loggedInUser.fullName;
  } else if (mode === "community") {
    const sender = communityMembers.find(m => m.email === msg.senderEmail) || {};
    pic = sender.profilePic;
    name = sender.fullName || msg.senderEmail;
  } else {
    pic = otherUser?.profilePic || otherUser?.ProfilePic;
    name = otherUser?.fullName || otherUser?.FullName || finalOtherEmail;
  }

  const avatarHTML = pic 
    ? `<img class="chat-avatar" src="${pic}" />` 
    : `<div class="chat-avatar-fallback">${getInitials(name)}</div>`;

  const bubbleHTML = `
    <div style="max-width:70%; padding:8px 12px; border-radius:16px; font-size:14px; background:${isMe ? color.bg : '#F3F4F6'}; color:${isMe ? color.text : '#111827'}">
      ${renderMessageContent(msg)}
    </div>
  `;

  row.innerHTML = isMe ? `${bubbleHTML}<div style="width:36px">${avatarHTML}</div>` : `<div style="width:36px">${avatarHTML}</div>${bubbleHTML}`;
  return row;
}

function renderMessageContent(msg) {
  if (msg.type === "image") return `<img src="${msg.fileData}" class="chat-image" style="max-width:100%; border-radius:8px; min-height:150px; display:block;">`;
  if (msg.type === "document") return `<a href="${msg.fileData}" download="${msg.fileName}" class="chat-doc">📄 ${msg.fileName}</a>`;
  return msg.text || "";
}

function sendMessage(payloadOverride = null) {
  const input = document.getElementById("messageInput");
  const text = (input?.value || "").trim();
  if (!payloadOverride && (!text || !activeConversationId)) return;

  const payload = payloadOverride || { type: "text", text };

  // OPTIMISTIC UI: Render locally before server response
  const tempMsg = {
    messageId: 0, // Placeholder
    senderEmail: loggedInUser.email,
    ...payload
  };
  const container = document.getElementById("messages");
  container.appendChild(buildMessageRow(tempMsg));
  container.scrollTop = container.scrollHeight;
  if (input) input.value = "";

  // NETWORK SEND
  const isText = payload.type === "text";
  if (isText) {
    fetch(`${API_URL}?module=sendMessage&conversationId=${encodeURIComponent(activeConversationId)}&senderEmail=${encodeURIComponent(loggedInUser.email)}&type=text&text=${encodeURIComponent(text)}`)
      .then(() => syncMessages());
  } else {
    fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ 
        module: "sendMessage", 
        conversationId: activeConversationId, 
        senderEmail: loggedInUser.email, 
        ...payload 
      })
    }).then(() => syncMessages());
  }
}

/****************************************************
 * UI DATA FETCHERS
 ****************************************************/
async function loadOtherUserProfile() {
  try {
    const r = await fetch(`${API_URL}?module=getUserByEmail&email=${encodeURIComponent(finalOtherEmail)}`);
    const d = await r.json();
    otherUser = d?.user || {};
    updateHeader(otherUser.fullName || otherUser.FullName || finalOtherEmail, otherUser.profilePic || otherUser.ProfilePic);
  } catch (e) { console.error(e); }
}

async function loadCommunityInfo() {
  try {
    const r = await fetch(`${API_URL}?module=getCommunityById&communityId=${communityId}`);
    const d = await r.json();
    updateHeader(d?.community?.name || "Community", null);
  } catch (e) { console.error(e); }
}

async function loadCommunityMembers() {
  try {
    const r = await fetch(`${API_URL}?module=getCommunityMembers&communityId=${communityId}`);
    const d = await r.json();
    const emails = (d.members || []).map(m => typeof m === "string" ? m : m.email);

    const tasks = emails.map(async (email) => {
      const res = await fetch(`${API_URL}?module=getUserByEmail&email=${encodeURIComponent(email)}`);
      const data = await res.json();
      const u = data?.user || {};
      return { email, fullName: u.fullName || u.FullName || email, profilePic: u.profilePic || u.ProfilePic || null };
    });

    communityMembers = await Promise.all(tasks);
    renderCommunityMembersList(communityMembers);
  } catch (e) { console.error(e); }
}

function updateHeader(title, pic) {
  const header = document.getElementById("headerTitle");
  if (!header) return;
  const avatar = pic ? `<img class="chat-avatar" src="${pic}" />` : `<div class="chat-avatar-fallback">${getInitials(title)}</div>`;
  header.innerHTML = `<div class="chat-header">${chatTitle ? '' : avatar}<div class="chat-header-main">${chatTitle || title}</div></div>`;
}

/****************************************************
 * BOOTSTRAP & EVENTS
 ****************************************************/
document.addEventListener("DOMContentLoaded", () => {
  initChat();

  const sendBtn = document.getElementById("sendBtn");
  if (sendBtn) sendBtn.onclick = () => sendMessage();

  const messageInput = document.getElementById("messageInput");
  if (messageInput) {
    messageInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  // File Uploads
  const setupUpload = (btnId, inputId, type) => {
    const btn = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    if (btn && input) {
      btn.onclick = () => input.click();
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const base64 = await fileToBase64(file);
        sendMessage({ type, fileName: file.name, fileData: base64 });
        e.target.value = "";
      };
    }
  };
  setupUpload("uploadDocBtn", "docInput", "document");
  setupUpload("uploadImgBtn", "imgInput", "image");
});

function loadNavbar() {
  const nav = document.getElementById("navbar");
  if (nav) nav.innerHTML = `<div class="hamburger" onclick="toggleMenu()"><span></span><span></span><span></span></div><div class="logo">Contact<span>.</span>com</div><div class="nav-links"><a href="dashboard.html">Dashboard</a><a href="communities.html">Communities</a><a href="profile.html">Profile</a><a href="#" onclick="logout()">Logout</a></div>`;
}

function showChatLoader() { document.getElementById("chatLoader")?.style.setProperty("display", "flex"); }
function hideChatLoader() { document.getElementById("chatLoader")?.style.setProperty("display", "none"); }
function logout() { localStorage.removeItem("contact_user"); window.location.href = "index.html"; }

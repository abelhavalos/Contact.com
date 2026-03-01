/****************************************************
 * CONTACT.COM — HIGH-PERFORMANCE MESSAGES.JS
 * Optimized for: Parallel Loading, Delta-Sync, & 
 * Low-Latency UI updates.
 ****************************************************/

const API_URL = "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

/* USER & STATE */
let loggedInUser = JSON.parse(localStorage.getItem("contact_user"));
if (!loggedInUser) window.location.href = "login.html";

// Normalize user object
loggedInUser.fullName = loggedInUser.fullName || loggedInUser.FullName || loggedInUser.email;
loggedInUser.profilePic = loggedInUser.profilePic || loggedInUser.ProfilePic || null;

const url = new URL(window.location.href);
const communityId = url.searchParams.get("communityId");
const mode = communityId ? "community" : "private";
const finalOtherEmail = url.searchParams.get("otherEmail") || url.searchParams.get("email");
const chatTitle = url.searchParams.get("title") || "";

let activeConversationId = url.searchParams.get("conversationId") || null;
let messages = [];
let communityMembers = [];
let otherUser = null;
let colorCache = {}; // Optimization: Don't re-hash colors every frame
let lastSyncCount = 0; // Simple delta tracker

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
 * CORE INITIALIZATION (PARALLEL FETCHING)
 ****************************************************/
async function initChat() {
  loadNavbar();
  showChatLoader();

  // 1. Fire all metadata requests at once
  const metaPromises = [];
  if (mode === "private") {
    metaPromises.push(loadOtherUserProfile());
  } else {
    metaPromises.push(loadCommunityInfo(), loadCommunityMembers());
  }

  // 2. Resolve Conversation ID if missing
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

  // 3. Wait for metadata to finish then do first message load
  await Promise.all(metaPromises);
  await syncMessages(true); // true = first load
  
  hideChatLoader();

  // 4. Background Sync (Poll every 4 seconds)
  setInterval(() => syncMessages(false), 4000);
}

/****************************************************
 * MESSAGING ENGINE
 ****************************************************/
async function syncMessages(isFirstLoad = false) {
  if (!activeConversationId) return;

  const r = await fetch(`${API_URL}?module=getMessages&conversationId=${activeConversationId}`);
  const data = await r.json();
  const newMessages = data.messages || [];

  // Only render if count changed (Basic delta check)
  if (newMessages.length > lastSyncCount) {
    const container = document.getElementById("messages");
    if (!container) return;

    // If first load, clear and render all. Otherwise, just append the delta.
    if (isFirstLoad) {
      container.innerHTML = "";
      messages = newMessages;
      const fragment = document.createDocumentFragment();
      messages.forEach(msg => fragment.appendChild(buildMessageRow(msg)));
      container.appendChild(fragment);
    } else {
      const delta = newMessages.slice(lastSyncCount);
      delta.forEach(msg => {
        // Prevent adding optimistic duplicates
        if (!document.getElementById(`msg-${msg.id}`)) {
          container.appendChild(buildMessageRow(msg));
        }
      });
    }

    lastSyncCount = newMessages.length;
    container.scrollTop = container.scrollHeight;
  }
}

function buildMessageRow(msg) {
  const isMe = msg.senderEmail === loggedInUser.email;
  const color = getUserColor(msg.senderEmail);

  const row = document.createElement("div");
  row.id = `msg-${msg.id || Date.now()}`;
  row.className = "msg-row";
  row.style = `display:flex; margin-bottom:10px; gap:8px; align-items:flex-end; justify-content:${isMe ? 'flex-end' : 'flex-start'}`;

  // Avatar Logic
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
  if (msg.type === "image") return `<img src="${msg.fileData}" class="chat-image" style="max-width:100%; border-radius:8px; min-height:100px;">`;
  if (msg.type === "document") return `<a href="${msg.fileData}" download="${msg.fileName}" class="chat-doc">📄 ${msg.fileName}</a>`;
  return msg.text || "";
}

function sendMessage(payloadOverride = null) {
  const input = document.getElementById("messageInput");
  const text = (input?.value || "").trim();
  if (!payloadOverride && (!text || !activeConversationId)) return;

  const payload = payloadOverride || { type: "text", text };

  // OPTIMISTIC UI: Append immediately
  const tempMsg = {
    id: "temp-" + Date.now(),
    senderEmail: loggedInUser.email,
    ...payload
  };
  const container = document.getElementById("messages");
  container.appendChild(buildMessageRow(tempMsg));
  container.scrollTop = container.scrollHeight;
  if (input) input.value = "";

  // NETWORK SEND
  const isText = payload.type === "text";
  const fetchOptions = isText ? {} : {
    method: "POST",
    body: JSON.stringify({ 
      module: "sendMessage", 
      conversationId: activeConversationId, 
      senderEmail: loggedInUser.email, 
      ...payload 
    })
  };

  const url = isText 
    ? `${API_URL}?module=sendMessage&conversationId=${encodeURIComponent(activeConversationId)}&senderEmail=${encodeURIComponent(loggedInUser.email)}&type=text&text=${encodeURIComponent(text)}`
    : API_URL;

  fetch(url, fetchOptions).then(() => syncMessages());
}

/****************************************************
 * UI FETCHERS
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
  const r = await fetch(`${API_URL}?module=getCommunityById&communityId=${communityId}`);
  const d = await r.json();
  updateHeader(d?.community?.name || "Community", null);
}

function updateHeader(title, pic) {
  const header = document.getElementById("headerTitle");
  if (!header) return;
  const avatar = pic ? `<img class="chat-avatar" src="${pic}" />` : `<div class="chat-avatar-fallback">${getInitials(title)}</div>`;
  header.innerHTML = `<div class="chat-header">${chatTitle ? '' : avatar}<div class="chat-header-main">${chatTitle || title}</div></div>`;
}

// Sidebar and Navbar code (Simplified from your original)
function loadNavbar() {
  const nav = document.getElementById("navbar");
  if (nav) nav.innerHTML = `<div class="hamburger" onclick="toggleMenu()"><span></span><span></span><span></span></div><div class="logo">Contact<span>.</span>com</div><div class="nav-links"><a href="dashboard.html">Dashboard</a><a href="communities.html">Communities</a><a href="profile.html">Profile</a><a href="#" onclick="logout()">Logout</a></div>`;
}

/****************************************************
 * BOOTSTRAP
 ****************************************************/
document.addEventListener("DOMContentLoaded", initChat);

function showChatLoader() { document.getElementById("chatLoader")?.style.setProperty("display", "flex"); }
function hideChatLoader() { document.getElementById("chatLoader")?.style.setProperty("display", "none"); }
function logout() { localStorage.removeItem("contact_user"); window.location.href = "index.html"; }

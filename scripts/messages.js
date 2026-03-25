/****************************************************
 * CONTACT.COM — PRODUCTION MESSAGES.JS (FIXED ECHO)
 ****************************************************/

const API_URL = "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

/* 1. STATE & PARAMS */
let loggedInUser = JSON.parse(localStorage.getItem("contact_user"));
if (!loggedInUser) window.location.href = "login.html";

// Normalize user object
loggedInUser.fullName = loggedInUser.fullName || loggedInUser.FullName || loggedInUser.email;
loggedInUser.profilePic = loggedInUser.profilePic || loggedInUser.ProfilePic || null;

const url = new URL(window.location.href);
const communityId = url.searchParams.get("communityId") || url.searchParams.get("eventId");
const urlMode = url.searchParams.get("mode"); 
const mode = urlMode || (communityId ? "community" : "private");
const finalOtherEmail = url.searchParams.get("otherEmail") || url.searchParams.get("email");
let chatTitle = url.searchParams.get("name") || url.searchParams.get("title") || "";

let activeConversationId = url.searchParams.get("conversationId") || null;
let communityMembers = [];
let otherUser = null;
let pollingInterval = null; 
let renderedMessageIds = new Set(); // Stores official DB IDs

const BUBBLE_PALETTE = [
  { bg: "#4A6CFF", text: "#FFFFFF" },
  { bg: "#6F8CFF", text: "#FFFFFF" },
  { bg: "#8FA3FF", text: "#000000" },
  { bg: "#AFC0FF", text: "#000000" },
  { bg: "#D1DDFF", text: "#000000" }
];

/****************************************************
 * 2. HELPERS
 ****************************************************/
function getInitials(name) {
  if (!name) return "?";
  return name.split(" ").filter(Boolean).map(p => p[0]).join("").substring(0, 2).toUpperCase();
}

function getUserColor(email) {
  let hash = 0;
  for (let i = 0; i < (email || "").length; i++) {
    hash = (hash << 5) - hash + email.charCodeAt(i);
    hash |= 0;
  }
  return BUBBLE_PALETTE[Math.abs(hash) % BUBBLE_PALETTE.length];
}

function fileToBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

/****************************************************
 * 3. UI INITIALIZATION
 ****************************************************/
function loadNavbar() {
  const nav = document.getElementById("navbar");
  const navHTML = `
    <div class="hamburger" onclick="toggleMenu()"><span></span><span></span><span></span></div>
    <div class="logo">Contact<span>.</span>com</div>
    <div class="nav-links">
      <a href="dashboard.html">Dashboard</a>
      <a href="communities.html">Communities</a>
      <a href="events.html">Events</a>
      <a href="contacts.html">Contacts</a>
      <a href="profile.html">Profile</a>
      <a href="#" onclick="logout()">Logout</a>
    </div>`;
  if (nav) nav.innerHTML = navHTML;
}

function toggleMenu() {
  document.getElementById("mobileMenu")?.classList.toggle("show");
}

/****************************************************
 * 4. THE CORE FIX: RENDERING & DUPLICATE PREVENTION
 ****************************************************/

async function loadMessagesOnce(showSpinner = true) {
  if (!activeConversationId) return;
  const container = document.getElementById("messages");
  if (!container) return;

  try {
    const r = await fetch(`${API_URL}?module=getMessages&conversationId=${activeConversationId}`);
    const data = await r.json();
    const serverMessages = data.messages || [];

    let hasNew = false;

    serverMessages.forEach(msg => {
      // Create a unique key for the message
      const msgKey = msg.id ? String(msg.id) : `${msg.senderEmail}_${msg.timestamp}_${msg.text}`;
      
      if (!renderedMessageIds.has(msgKey)) {
        // 1. Remove the local optimistic "Saving..." version if it exists
        const tempId = `temp_${msg.text || msg.fileName}`;
        const existingTemp = document.getElementById(tempId);
        if (existingTemp) existingTemp.remove();

        // 2. Add to rendered list and append to UI
        const row = buildMessageRow(msg);
        row.id = `msg_${msgKey}`; // Permanent ID
        container.appendChild(row);
        renderedMessageIds.add(msgKey);
        hasNew = true;
      }
    });

    if (hasNew) container.scrollTop = container.scrollHeight;
  } catch (err) {
    console.warn("Polling error:", err);
  } finally {
    document.getElementById("chatLoader").style.display = "none";
  }
}

function sendMessage(payloadOverride = null) {
  const input = document.getElementById("messageInput");
  const text = (input?.value || "").trim();
  if (!payloadOverride && (!text || !activeConversationId)) return;

  const payload = payloadOverride || { module: "sendMessage", type: "text", text };
  const container = document.getElementById("messages");

  // OPTIMISTIC UI: Append locally immediately
  if (container) {
    const optMsg = { senderEmail: loggedInUser.email, ...payload, timestamp: Date.now() };
    const row = buildMessageRow(optMsg);
    // Give it a temporary ID based on content to track it
    row.id = `temp_${payload.text || payload.fileName}`;
    row.style.opacity = "0.7"; // Visual cue it's sending
    container.appendChild(row);
    container.scrollTop = container.scrollHeight;
  }

  if (!payloadOverride) input.value = "";

  // NETWORK CALL
  const params = new URLSearchParams({
    module: "sendMessage",
    conversationId: activeConversationId,
    senderEmail: loggedInUser.email,
    type: payload.type || "text",
    text: payload.text || "",
    fileName: payload.fileName || "",
    fileData: payload.fileData || ""
  });

  fetch(API_URL, { 
    method: "POST", 
    mode: 'no-cors', 
    body: JSON.stringify(Object.fromEntries(params)) 
  });
}

function buildMessageRow(msg) {
  const isMe = msg.senderEmail === loggedInUser.email;
  const color = getUserColor(msg.senderEmail);
  const row = document.createElement("div");
  row.className = "msg-row";
  row.style.cssText = `display:flex; margin-bottom:10px; gap:8px; align-items:flex-end; justify-content:${isMe ? 'flex-end' : 'flex-start'};`;

  let pic = null, name = msg.senderEmail;
  if (isMe) {
    pic = loggedInUser.profilePic;
    name = loggedInUser.fullName;
  } else {
    const s = communityMembers.find(m => m.email === msg.senderEmail) || otherUser || {};
    pic = s.profilePic || s.ProfilePic;
    name = s.fullName || s.FullName || msg.senderEmail;
  }

  const avatarHTML = pic 
    ? `<img class="chat-avatar" src="${pic}" style="width:36px; height:36px; border-radius:50%; object-fit:cover;" />` 
    : `<div class="chat-avatar-fallback" style="width:36px; height:36px; border-radius:50%; background:#ddd; display:flex; align-items:center; justify-content:center; font-size:12px;">${getInitials(name)}</div>`;

  const bubble = document.createElement("div");
  bubble.className = "chat-bubble";
  bubble.style.cssText = `max-width:70%; padding:8px 12px; border-radius:16px; font-size:14px; background:${isMe ? color.bg : "#F3F4F6"}; color:${isMe ? color.text : "#111827"}; position:relative;`;
  
  if (msg.type === "image" || msg.fileData?.startsWith("data:image")) {
    bubble.innerHTML = `<img src="${msg.fileData}" style="max-width:100%; border-radius:8px; cursor:pointer;" onclick="openImageModal('${msg.fileData}')">`;
  } else if (msg.type === "document") {
    bubble.innerHTML = `<a href="${msg.fileData}" download="${msg.fileName}" style="color:inherit; text-decoration:none;">📄 ${msg.fileName}</a>`;
  } else {
    bubble.textContent = msg.text || "";
  }

  const avatarWrapper = document.createElement("div");
  avatarWrapper.innerHTML = avatarHTML;

  if (isMe) {
    row.appendChild(bubble);
    row.appendChild(avatarWrapper);
  } else {
    row.appendChild(avatarWrapper);
    row.appendChild(bubble);
  }
  return row;
}

/****************************************************
 * 5. POLLING & EVENTS
 ****************************************************/
function startPolling() {
  if (pollingInterval) clearInterval(pollingInterval);
  pollingInterval = setInterval(() => loadMessagesOnce(false), 4000); 
}

function setupEventListeners() {
  document.getElementById("sendBtn")?.addEventListener("click", () => sendMessage());
  document.getElementById("messageInput")?.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });

  document.getElementById("uploadImgBtn")?.addEventListener("click", () => document.getElementById("imgInput").click());
  document.getElementById("imgInput")?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const b64 = await fileToBase64(file);
    sendMessage({ type: "image", fileName: file.name, fileData: b64 });
    e.target.value = "";
  });
}

/****************************************************
 * 6. INIT
 ****************************************************/
document.addEventListener("DOMContentLoaded", async () => {
  loadNavbar();
  setupEventListeners();

  const header = document.getElementById("headerTitle");
  if (header && chatTitle) {
    header.innerHTML = `<div class="chat-header"><div class="chat-header-main">${chatTitle}</div></div>`;
  }

  try {
    // 1. Resolve Conversation ID
    if (!activeConversationId) {
      const isGroup = (mode === "community" || mode === "event");
      const mod = isGroup ? "startCommunityConversation" : "startConversation";
      const p = isGroup ? `&communityId=${communityId}` : `&otherEmail=${finalOtherEmail}`;
      
      const r = await fetch(`${API_URL}?module=${mod}&userEmail=${loggedInUser.email}${p}`);
      const d = await r.json();
      activeConversationId = d.conversationId;
    }

    // 2. Load Members if Group
    if (mode !== "private") {
      const r = await fetch(`${API_URL}?module=getCommunityMembers&communityId=${communityId}`);
      const d = await r.json();
      const emails = (d.members || []).map(m => typeof m === "string" ? m : m.email);
      communityMembers = emails.map(email => ({ email, fullName: email })); // Basic fallback
    }

    // 3. Kick off messages
    if (activeConversationId) {
      await loadMessagesOnce(true);
      startPolling(); 
    }
  } catch (err) {
    console.error("Init error:", err);
  }
});

function logout() {
  if (pollingInterval) clearInterval(pollingInterval);
  localStorage.removeItem("contact_user");
  window.location.href = "index.html";
}

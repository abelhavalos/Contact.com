/****************************************************
 * CONTACT.COM — FINAL PRODUCTION MESSAGES.JS
 ****************************************************/

const API_URL = "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

/* 1. STATE & PARAMS */
let loggedInUser = JSON.parse(localStorage.getItem("contact_user"));
if (!loggedInUser) window.location.href = "login.html";

const url = new URL(window.location.href);
const communityId = url.searchParams.get("communityId") || url.searchParams.get("eventId");
const finalOtherEmail = url.searchParams.get("otherEmail") || url.searchParams.get("email");
const mode = url.searchParams.get("mode") || (communityId ? "community" : "private");
let chatTitle = url.searchParams.get("name") || url.searchParams.get("title") || "";

let activeConversationId = url.searchParams.get("conversationId") || null;
let communityMembers = [];
let pollingInterval = null; 
let renderedMessageIds = new Set();

const BUBBLE_PALETTE = [
  { bg: "#4A6CFF", text: "#FFFFFF" },
  { bg: "#6F8CFF", text: "#FFFFFF" },
  { bg: "#8FA3FF", text: "#000000" }
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
  }
  return BUBBLE_PALETTE[Math.abs(hash) % BUBBLE_PALETTE.length];
}

/****************************************************
 * 3. AVATARS & MEMBERS LOGIC
 ****************************************************/
async function loadCommunityMembers() {
  if (!communityId) return;
  try {
    const r = await fetch(`${API_URL}?module=getCommunityMembers&communityId=${communityId}`);
    const d = await r.json();
    
    // Fetch full profiles for each member to get their avatars
    const emails = (d.members || []).map(m => typeof m === "string" ? m : m.email);
    const tasks = emails.map(async (email) => {
      const res = await fetch(`${API_URL}?module=getUserByEmail&email=${encodeURIComponent(email)}`);
      const userData = await res.json();
      return userData.user || { email };
    });

    communityMembers = await Promise.all(tasks);
    renderSidebarMembers();
  } catch (err) { console.error("Member load failed", err); }
}

function renderSidebarMembers() {
  const container = document.getElementById("memberSidebar");
  if (!container) return;
  container.innerHTML = "<h3>Members</h3>";
  communityMembers.forEach(m => {
    const name = m.fullName || m.FullName || m.email;
    const pic = m.profilePic || m.ProfilePic;
    container.innerHTML += `
      <div class="member-row" style="display:flex; align-items:center; gap:10px; padding:8px; cursor:pointer;" onclick="window.location.href='public-profile.html?email=${m.email}'">
        ${pic ? `<img src="${pic}" class="chat-avatar" style="width:30px; height:30px; border-radius:50%;">` : `<div class="avatar-fallback">${getInitials(name)}</div>`}
        <span>${name}</span>
      </div>`;
  });
}

/****************************************************
 * 4. MESSAGE RENDERING (NO ECHO / CORRECT AVATAR)
 ****************************************************/
async function loadMessagesOnce() {
  if (!activeConversationId) return;
  const container = document.getElementById("messages");
  if (!container) return;

  try {
    const r = await fetch(`${API_URL}?module=getMessages&conversationId=${activeConversationId}`);
    const data = await r.json();
    let serverMessages = data.messages || [];

    // FIX: Sort by timestamp so they don't jump around
    serverMessages.sort((a, b) => a.timestamp - b.timestamp);

    serverMessages.forEach(msg => {
      const msgKey = msg.id ? String(msg.id) : `${msg.senderEmail}_${msg.timestamp}`;
      
      if (!renderedMessageIds.has(msgKey)) {
        // Remove local optimistic version
        const tempId = `temp_${msg.text || msg.fileName}`;
        const tempEl = document.getElementById(tempId);
        if (tempEl) tempEl.remove();

        const row = buildMessageRow(msg);
        row.id = `msg_${msgKey}`;
        container.appendChild(row);
        renderedMessageIds.add(msgKey);
      }
    });
    container.scrollTop = container.scrollHeight;
  } catch (err) { console.warn(err); }
}

function buildMessageRow(msg) {
  const isMe = msg.senderEmail === loggedInUser.email;
  const row = document.createElement("div");
  row.className = "msg-row";
  row.style.cssText = `display:flex; margin-bottom:12px; gap:8px; align-items:flex-end; justify-content:${isMe ? 'flex-end' : 'flex-start'};`;

  // FIX: Find the correct avatar from the communityMembers list
  let userProfile = isMe ? loggedInUser : communityMembers.find(m => m.email === msg.senderEmail);
  const name = userProfile?.fullName || userProfile?.FullName || msg.senderEmail;
  const pic = userProfile?.profilePic || userProfile?.ProfilePic;

  const avatarHTML = pic 
    ? `<img src="${pic}" class="chat-avatar" style="width:36px; height:36px; border-radius:50%; object-fit:cover;">` 
    : `<div class="chat-avatar-fallback" style="width:36px; height:36px; border-radius:50%; background:#ccc; display:flex; align-items:center; justify-content:center; font-size:12px;">${getInitials(name)}</div>`;

  const bubble = document.createElement("div");
  const color = getUserColor(msg.senderEmail);
  bubble.style.cssText = `max-width:70%; padding:10px 14px; border-radius:18px; font-size:14px; background:${isMe ? color.bg : "#E9ECEF"}; color:${isMe ? color.text : "#000"};`;
  
  if (msg.type === "image" || (msg.fileData && msg.fileData.includes("data:image"))) {
    bubble.innerHTML = `<img src="${msg.fileData}" style="max-width:100%; border-radius:10px; cursor:pointer;" onclick="window.open('${msg.fileData}')">`;
  } else {
    bubble.textContent = msg.text || "";
  }

  const avatarDiv = document.createElement("div");
  avatarDiv.innerHTML = avatarHTML;

  if (isMe) {
    row.appendChild(bubble);
    row.appendChild(avatarDiv);
  } else {
    row.appendChild(avatarDiv);
    row.appendChild(bubble);
  }
  return row;
}

/****************************************************
 * 5. EVENTS & INITIALIZATION
 ****************************************************/
function setupEventListeners() {
  document.getElementById("sendBtn")?.onclick = () => sendMessage();
  
  // FIX: Make the Members button functional
  document.getElementById("toggleMembers")?.onclick = () => {
    const sidebar = document.getElementById("memberSidebar");
    if (sidebar) sidebar.classList.toggle("show");
  };

  document.getElementById("messageInput")?.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
}

async function sendMessage() {
  const input = document.getElementById("messageInput");
  const text = input.value.trim();
  if (!text || !activeConversationId) return;

  // Optimistic UI
  const container = document.getElementById("messages");
  const tempId = `temp_${text}`;
  const row = buildMessageRow({ senderEmail: loggedInUser.email, text, timestamp: Date.now() });
  row.id = tempId;
  row.style.opacity = "0.6";
  container.appendChild(row);
  container.scrollTop = container.scrollHeight;

  input.value = "";

  await fetch(API_URL, {
    method: "POST",
    mode: "no-cors",
    body: JSON.stringify({
      module: "sendMessage",
      conversationId: activeConversationId,
      senderEmail: loggedInUser.email,
      type: "text",
      text: text
    })
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  setupEventListeners();
  const header = document.getElementById("headerTitle");
  if (header && chatTitle) header.innerText = chatTitle;

  // 1. Get Conversation ID
  if (!activeConversationId) {
    const mod = (mode === "private") ? "startConversation" : "startCommunityConversation";
    const p = (mode === "private") ? `&otherEmail=${finalOtherEmail}` : `&communityId=${communityId}`;
    const r = await fetch(`${API_URL}?module=${mod}&userEmail=${loggedInUser.email}${p}`);
    const d = await r.json();
    activeConversationId = d.conversationId;
  }

  // 2. Fetch Members (needed for avatars)
  if (mode !== "private") await loadCommunityMembers();

  // 3. Start Polling
  if (activeConversationId) {
    await loadMessagesOnce();
    setInterval(loadMessagesOnce, 4000);
  }
});

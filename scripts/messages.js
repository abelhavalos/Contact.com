/****************************************************
 * CONTACT.COM — STABLE & ULTRA-FAST MESSAGES.JS
 ****************************************************/

const API_URL = "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

/* 1. STATE & PARAMS */
let loggedInUser = JSON.parse(localStorage.getItem("contact_user"));
if (!loggedInUser) window.location.href = "login.html";

loggedInUser.fullName = loggedInUser.fullName || loggedInUser.FullName || loggedInUser.email;
loggedInUser.profilePic = loggedInUser.profilePic || loggedInUser.ProfilePic || null;

const url = new URL(window.location.href);
const communityId = url.searchParams.get("communityId");
const mode = communityId ? "community" : "private";
const finalOtherEmail = url.searchParams.get("otherEmail") || url.searchParams.get("email");
let chatTitle = url.searchParams.get("title") || "";

let activeConversationId = url.searchParams.get("conversationId") || null;
let renderedMessageIds = new Set();
let communityMembers = [];
let otherUser = null;
let isFetching = false;

const BUBBLE_PALETTE = [
  { bg: "#4A6CFF", text: "#FFFFFF" }, { bg: "#6F8CFF", text: "#FFFFFF" },
  { bg: "#8FA3FF", text: "#000000" }, { bg: "#AFC0FF", text: "#000000" },
  { bg: "#D1DDFF", text: "#000000" }
];

/****************************************************
 * 2. CORE UI (NAVBAR & LOADERS)
 ****************************************************/
window.toggleMenu = () => {
  const menu = document.getElementById("mobileMenu");
  if (menu) menu.classList.toggle("show");
};

function loadNavbar() {
  const nav = document.getElementById("navbar");
  if (!nav) return;

  const navHTML = `
    <div class="hamburger" onclick="window.toggleMenu()"><span></span><span></span><span></span></div>
    <div class="logo">Contact<span>.</span>com</div>
    <div class="nav-links">
      <a href="dashboard.html">Dashboard</a>
      <a href="communities.html">Communities</a>
      <a href="events.html">Events</a>
      <a href="contacts.html">Contacts</a>
      <a href="profile.html">Profile</a>
      <a href="#" onclick="localStorage.removeItem('contact_user'); location.href='index.html'">Logout</a>
    </div>`;
  
  nav.innerHTML = navHTML;
  const mob = document.getElementById("mobileMenu");
  if (mob) mob.innerHTML = navHTML.split('nav-links">')[1].split('</div>')[0];
}

const getInitials = (n) => n ? n.split(" ").filter(Boolean).map(p => p[0]).join("").substring(0, 2).toUpperCase() : "?";
const getUserColor = (e) => {
  let h = 0; for (let i = 0; i < (e || "").length; i++) h = (h << 5) - h + e.charCodeAt(i);
  return BUBBLE_PALETTE[Math.abs(h) % BUBBLE_PALETTE.length];
};

/****************************************************
 * 3. FAST RENDERING ENGINE
 ****************************************************/
function getMessageHTML(msg) {
  const isMe = msg.senderEmail === loggedInUser.email;
  const color = getUserColor(msg.senderEmail);
  const avatar = `<div class="chat-avatar-fallback">${getInitials(msg.senderEmail)}</div>`;
  
  // Minimalist content rendering for speed
  let content = (msg.text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  if (msg.type === "image") content = `<img src="${msg.fileData}" class="chat-image" style="max-width:100%; border-radius:8px;">`;
  if (msg.type === "document") content = `<a href="${msg.fileData}" download="${msg.fileName}">📄 ${msg.fileName}</a>`;

  const bubbleStyle = `max-width:70%; padding:8px 12px; border-radius:16px; font-size:14px; background:${isMe ? color.bg : "#F3F4F6"}; color:${isMe ? color.text : "#111827"};`;
  const rowStyle = `display:flex; margin-bottom:10px; gap:8px; align-items:flex-end; justify-content:${isMe ? 'flex-end' : 'flex-start'};`;

  return `<div class="msg-row" data-id="${msg.id}" style="${rowStyle}">
    ${isMe ? `<div style="${bubbleStyle}">${content}</div>${avatar}` : `${avatar}<div style="${bubbleStyle}">${content}</div>`}
  </div>`;
}

async function syncMessages() {
  if (!activeConversationId || isFetching) return;
  isFetching = true;
  try {
    const r = await fetch(`${API_URL}?module=getMessages&conversationId=${activeConversationId}`);
    const data = await r.json();
    const container = document.getElementById("messages");
    if (container && data.messages) {
      const newMsgs = data.messages.filter(m => !renderedMessageIds.has(m.id));
      if (newMsgs.length > 0) {
        let html = "";
        newMsgs.forEach(m => { html += getMessageHTML(m); renderedMessageIds.add(m.id); });
        container.insertAdjacentHTML('beforeend', html);
        container.scrollTop = container.scrollHeight;
      }
    }
  } catch (e) { console.error("Sync Error", e); }
  isFetching = false;
}

/****************************************************
 * 4. ACTIONS
 ****************************************************/
async function sendMessage(payloadOverride = null) {
  const input = document.getElementById("messageInput");
  const text = (input?.value || "").trim();
  if (!payloadOverride && !text) return;

  // Optimistic Render
  const container = document.getElementById("messages");
  const tempId = "temp_" + Date.now();
  const payload = payloadOverride || { type: "text", text };
  
  container.insertAdjacentHTML('beforeend', getMessageHTML({ id: tempId, senderEmail: loggedInUser.email, ...payload }));
  container.scrollTop = container.scrollHeight;
  renderedMessageIds.add(tempId);
  if (!payloadOverride) input.value = "";

  try {
    const params = payloadOverride 
      ? { method: "POST", body: JSON.stringify({ ...payload, module: "sendMessage", conversationId: activeConversationId, senderEmail: loggedInUser.email }) }
      : { method: "GET" };
    
    const fetchUrl = payloadOverride ? API_URL : `${API_URL}?module=sendMessage&conversationId=${activeConversationId}&senderEmail=${loggedInUser.email}&type=text&text=${encodeURIComponent(text)}`;
    
    await fetch(fetchUrl, params);
    syncMessages(); 
  } catch (e) { console.error("Send Error", e); }
}

/****************************************************
 * 5. INITIALIZATION
 ****************************************************/
document.addEventListener("DOMContentLoaded", async () => {
  loadNavbar();
  
  // UI Listeners
  document.getElementById("sendBtn")?.addEventListener("click", () => sendMessage());
  document.getElementById("messageInput")?.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });

  // Start Core Engine
  try {
    if (!activeConversationId) {
      const mod = mode === "community" ? "startCommunityConversation" : "startConversation";
      const p = mode === "community" ? `&communityId=${communityId}` : `&otherEmail=${finalOtherEmail}`;
      const res = await fetch(`${API_URL}?module=${mod}&userEmail=${loggedInUser.email}${p}`);
      const d = await res.json();
      activeConversationId = d.conversationId;
    }

    // Load messages first!
    await syncMessages();
    setInterval(syncMessages, 3000);

    // Load background data (Member list, etc.) WITHOUT blocking the chat
    if (mode === "community") {
      fetch(`${API_URL}?module=getCommunityMembers&communityId=${communityId}`)
        .then(r => r.json())
        .then(d => {
          const list = document.getElementById("memberSidebar");
          if (list) list.innerHTML = "<h3>Members</h3>" + d.members.map(m => `<div class="member">${m}</div>`).join("");
        });
    }
  } catch (e) {
    console.error("Init Error", e);
  }
});

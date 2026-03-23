/****************************************************
 * CONTACT.COM — PRODUCTION MESSAGES.JS (ANTI-DUPLICATE)
 ****************************************************/

const API_URL = "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

/* 1. STATE & PARAMS */
let loggedInUser = JSON.parse(localStorage.getItem("contact_user"));
if (!loggedInUser) window.location.href = "login.html";

loggedInUser.fullName = loggedInUser.fullName || loggedInUser.FullName || loggedInUser.email;
loggedInUser.profilePic = loggedInUser.profilePic || loggedInUser.ProfilePic || null;

const url = new URL(window.location.href);
const otherEmailParam = url.searchParams.get("otherEmail");
const conversationIdParam = url.searchParams.get("conversationId");
const communityId = url.searchParams.get("communityId");
const urlMode = url.searchParams.get("mode"); 
const mode = urlMode || (communityId ? "community" : "private");

const finalOtherEmail = otherEmailParam || url.searchParams.get("email");
let chatTitle = url.searchParams.get("name") || url.searchParams.get("title") || "";

let activeConversationId = conversationIdParam || null;
let communityMembers = [];
let otherUser = null;
let pollingInterval = null; 
let renderedMessageIds = new Set(); // THE MASTER LIST

const BUBBLE_PALETTE = [
  { bg: "#4A6CFF", text: "#FFFFFF" },
  { bg: "#6F8CFF", text: "#FFFFFF" },
  { bg: "#8FA3FF", text: "#000000" },
  { bg: "#AFC0FF", text: "#000000" },
  { bg: "#D1DDFF", text: "#000000" }
];

/****************************************************
 * 2. HELPERS & UI
 ****************************************************/
function showChatLoader() { const el = document.getElementById("chatLoader"); if (el) el.style.display = "flex"; }
function hideChatLoader() { const el = document.getElementById("chatLoader"); if (el) el.style.display = "none"; }
function getInitials(name) { return (name || "?").split(" ").filter(Boolean).map(p => p[0]).join("").substring(0, 2).toUpperCase(); }

function getUserColor(email) {
  let hash = 0;
  for (let i = 0; i < (email || "").length; i++) { hash = (hash << 5) - hash + email.charCodeAt(i); hash |= 0; }
  return BUBBLE_PALETTE[Math.abs(hash) % BUBBLE_PALETTE.length];
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/****************************************************
 * 3. CORE LOGIC (THE FIX)
 ****************************************************/

async function loadMessagesOnce(showSpinner = true) {
  if (!activeConversationId) return;
  if (showSpinner) showChatLoader();

  try {
    const r = await fetch(`${API_URL}?module=getMessages&conversationId=${activeConversationId}`);
    const data = await r.json();
    const serverMessages = data.messages || [];
    const container = document.getElementById("messages");
    if (!container) return;

    let addedCount = 0;
    const fragment = document.createDocumentFragment();

    serverMessages.forEach(msg => {
      // FIX: Create a "Matching Key" to check against local optimistic messages
      const content = msg.text || msg.fileName || "";
      const matchKey = `sent_${msg.type}_${content}`;
      const uniqueIdKey = msg.id ? String(msg.id) : null;

      // Only render if we haven't seen this ID AND it doesn't match a recently sent local item
      if ((uniqueIdKey && !renderedMessageIds.has(uniqueIdKey)) && !renderedMessageIds.has(matchKey)) {
        fragment.appendChild(buildMessageRow(msg));
        if (uniqueIdKey) renderedMessageIds.add(uniqueIdKey);
        addedCount++;
      }
    });

    if (addedCount > 0) {
      container.appendChild(fragment);
      container.scrollTop = container.scrollHeight;
    }
  } catch (err) { console.warn("Sync failed:", err); } 
  finally { if (showSpinner) hideChatLoader(); }
}

function sendMessage(payloadOverride = null) {
  const input = document.getElementById("messageInput");
  const text = (input?.value || "").trim();
  if (!payloadOverride && (!text || !activeConversationId)) return;

  const payload = payloadOverride || { module: "sendMessage", type: "text", text };
  
  // FIX: Register the content lock IMMEDIATELY
  const content = payload.text || payload.fileName || "";
  const lockKey = `sent_${payload.type}_${content}`;
  renderedMessageIds.add(lockKey);

  // Optimistic UI Render
  const container = document.getElementById("messages");
  if (container) {
    const optMsg = { senderEmail: loggedInUser.email, ...payload, timestamp: Date.now() };
    container.appendChild(buildMessageRow(optMsg));
    container.scrollTop = container.scrollHeight;
  }

  if (!payloadOverride) {
    input.value = "";
    fetch(`${API_URL}?module=sendMessage&conversationId=${activeConversationId}&senderEmail=${loggedInUser.email}&type=text&text=${encodeURIComponent(text)}`, { mode: 'no-cors' });
  } else {
    fetch(API_URL, { 
      method: "POST", 
      mode: 'no-cors',
      body: JSON.stringify({ ...payload, conversationId: activeConversationId, senderEmail: loggedInUser.email }) 
    });
  }
}

/****************************************************
 * 4. RENDERING & DATA FETCH
 ****************************************************/

function buildMessageRow(msg) {
  const isMe = msg.senderEmail === loggedInUser.email;
  const color = getUserColor(msg.senderEmail);
  const row = document.createElement("div");
  row.className = "msg-row";
  row.style.cssText = `display:flex; margin-bottom:10px; gap:8px; align-items:flex-end; justify-content:${isMe ? 'flex-end' : 'flex-start'};`;

  let pic = isMe ? loggedInUser.profilePic : null;
  let name = isMe ? loggedInUser.fullName : msg.senderEmail;

  if (!isMe && (mode === "community" || mode === "event")) {
    const s = communityMembers.find(m => m.email === msg.senderEmail) || {};
    pic = s.profilePic;
    name = s.fullName || msg.senderEmail;
  }

  const avatarHTML = pic 
    ? `<img class="chat-avatar" src="${pic}" />` 
    : `<div class="chat-avatar-fallback">${getInitials(name)}</div>`;

  const bubble = document.createElement("div");
  bubble.style.cssText = `max-width:70%; padding:8px 12px; border-radius:16px; font-size:14px; background:${isMe ? color.bg : "#F3F4F6"}; color:${isMe ? color.text : "#111827"};`;
  
  if (msg.type === "image") {
    bubble.innerHTML = `<img src="${msg.fileData}" class="chat-image-preview" onclick="openImageModal('${msg.fileData}')">`;
  } else if (msg.type === "document") {
    bubble.innerHTML = `<a href="${msg.fileData}" download="${msg.fileName}" style="color:inherit; text-decoration:none;">📄 ${msg.fileName}</a>`;
  } else {
    bubble.textContent = msg.text || "";
  }

  const avatarWrapper = document.createElement("div");
  avatarWrapper.style.width = "36px";
  avatarWrapper.innerHTML = avatarHTML;

  if (isMe) { row.appendChild(bubble); row.appendChild(avatarWrapper); } 
  else { row.appendChild(avatarWrapper); row.appendChild(bubble); }
  return row;
}

async function loadCommunityInfo() {
  const header = document.getElementById("headerTitle");
  if (header && chatTitle) {
    header.innerHTML = `<div class="chat-header"><div class="chat-header-main">${chatTitle}</div></div>`;
    if (mode === "event") return; 
  }
  const r = await fetch(`${API_URL}?module=getCommunityById&communityId=${communityId}`);
  const d = await r.json();
  if (header && d.success) header.innerHTML = `<div class="chat-header"><div class="chat-header-main">${d.community.name}</div></div>`;
}

async function loadCommunityMembers() {
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
  renderMembers();
}

function renderMembers() {
  const container = document.getElementById("memberSidebar");
  if (!container) return;
  container.innerHTML = "<h3>Members</h3>";
  communityMembers.forEach(m => {
    const div = document.createElement("div");
    div.className = "member-row";
    div.style.cssText = "display:flex; align-items:center; gap:10px; margin-bottom:12px; cursor:pointer;";
    div.onclick = () => window.location.href = `public-profile.html?email=${encodeURIComponent(m.email)}`;
    const avatar = m.profilePic ? `<img class="chat-avatar" src="${m.profilePic}" />` : `<div class="chat-avatar-fallback">${getInitials(m.fullName)}</div>`;
    div.innerHTML = `${avatar}<span>${m.fullName}</span>`;
    container.appendChild(div);
  });
}

/****************************************************
 * 5. INIT & POLLING
 ****************************************************/

function startPolling() {
  if (pollingInterval) clearInterval(pollingInterval);
  pollingInterval = setInterval(() => { if (activeConversationId) loadMessagesOnce(false); }, 4000); 
}

document.addEventListener("DOMContentLoaded", async () => {
  // Navbar & Modal
  const nav = document.getElementById("navbar");
  if (nav) nav.innerHTML = `<div class="logo">Contact<span>.</span>com</div><div class="nav-links"><a href="dashboard.html">Dashboard</a><a href="communities.html">Communities</a><a href="events.html">Events</a><a href="#" onclick="logout()">Logout</a></div>`;
  
  if (!document.getElementById("imageModal")) {
    const m = document.createElement("div"); m.id = "imageModal"; 
    m.innerHTML = `<span onclick="this.parentElement.style.display='none'">&times;</span><img id="modalImage">`;
    document.body.appendChild(m);
  }

  setupEventListeners();
  if (mode === "private") { /* Private logic here */ } 
  else { await loadCommunityInfo(); await loadCommunityMembers(); }

  if (!activeConversationId) {
    const isGroup = (mode === "community" || mode === "event");
    const mod = isGroup ? "startCommunityConversation" : "startConversation";
    const p = isGroup ? `&communityId=${communityId}` : `&otherEmail=${finalOtherEmail}`;
    const r = await fetch(`${API_URL}?module=${mod}&userEmail=${loggedInUser.email}${p}`);
    const d = await r.json();
    activeConversationId = d.conversationId;
  }

  if (activeConversationId) { await loadMessagesOnce(true); startPolling(); }
});

function setupEventListeners() {
  document.getElementById("sendBtn")?.onclick = () => sendMessage();
  document.getElementById("uploadImgBtn")?.onclick = () => document.getElementById("imgInput").click();
  document.getElementById("imgInput")?.onchange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const b64 = await fileToBase64(file);
      sendMessage({ module: "sendMessage", type: "image", fileName: file.name, fileData: b64 });
    }
  };
}

function openImageModal(src) { 
  const m = document.getElementById("imageModal"); 
  document.getElementById("modalImage").src = src; 
  m.style.display = "flex"; 
}

function logout() { localStorage.removeItem("contact_user"); window.location.href = "index.html"; }

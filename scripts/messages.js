/****************************************************
 * CONTACT.COM — FINAL PRODUCTION MESSAGES.JS
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

async function fileToBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

/****************************************************
 * 3. UI & MEMBERS SIDEBAR
 ****************************************************/
function loadNavbar() {
  const nav = document.getElementById("navbar");
  if (nav) {
    nav.innerHTML = `
      <div class="hamburger" onclick="toggleMenu()"><span></span><span></span><span></span></div>
      <div class="logo">Contact<span>.</span>com</div>
      <div class="nav-links">
        <a href="dashboard.html">Dashboard</a>
        <a href="communities.html">Communities</a>
        <a href="contacts.html">Contacts</a>
        <a href="profile.html">Profile</a>
        <a href="#" onclick="logout()">Logout</a>
      </div>`;
  }
}

function toggleMenu() {
  document.getElementById("mobileMenu")?.classList.toggle("show");
}

async function loadCommunityMembers() {
  if (!communityId) return;
  try {
    const r = await fetch(`${API_URL}?module=getCommunityMembers&communityId=${communityId}`);
    const d = await r.json();
    const emails = (d.members || []).map(m => typeof m === "string" ? m : m.email);

    const tasks = emails.map(async (email) => {
      try {
        const res = await fetch(`${API_URL}?module=getUserByEmail&email=${encodeURIComponent(email)}`);
        const userData = await res.json();
        return userData.user || { email };
      } catch { return { email }; }
    });

    communityMembers = await Promise.all(tasks);
    renderSidebarMembers();
  } catch (err) { console.error("Failed to load members", err); }
}

function renderSidebarMembers() {
  const container = document.getElementById("memberSidebar");
  if (!container) return;
  container.innerHTML = "<h3>Members</h3>";
  communityMembers.forEach(m => {
    const name = m.fullName || m.FullName || m.email;
    const pic = m.profilePic || m.ProfilePic;
    const row = document.createElement("div");
    row.className = "member-row";
    row.style.cssText = "display:flex; align-items:center; gap:10px; padding:10px; cursor:pointer;";
    row.onclick = () => window.location.href = `public-profile.html?email=${encodeURIComponent(m.email)}`;
    
    const avatar = pic 
      ? `<img src="${pic}" style="width:30px; height:30px; border-radius:50%; object-fit:cover;">` 
      : `<div style="width:30px; height:30px; border-radius:50%; background:#ccc; display:flex; align-items:center; justify-content:center; font-size:10px;">${getInitials(name)}</div>`;

    row.innerHTML = `${avatar}<span>${name}</span>`;
    container.appendChild(row);
  });
}

/****************************************************
 * 4. MESSAGING CORE
 ****************************************************/
async function loadMessagesOnce() {
  if (!activeConversationId) return;
  const container = document.getElementById("messages");
  if (!container) return;

  try {
    const r = await fetch(`${API_URL}?module=getMessages&conversationId=${activeConversationId}`);
    const data = await r.json();
    const serverMessages = (data.messages || []).sort((a, b) => a.timestamp - b.timestamp);

    serverMessages.forEach(msg => {
      const msgKey = msg.id ? String(msg.id) : `${msg.senderEmail}_${msg.timestamp}`;
      if (!renderedMessageIds.has(msgKey)) {
        const tempId = `temp_${msg.text || msg.fileName}`;
        document.getElementById(tempId)?.remove();

        const row = buildMessageRow(msg);
        row.id = `msg_${msgKey}`;
        container.appendChild(row);
        renderedMessageIds.add(msgKey);
      }
    });
    container.scrollTop = container.scrollHeight;
  } catch (err) { console.warn("Polling error", err); }
}

function buildMessageRow(msg) {
  const isMe = msg.senderEmail === loggedInUser.email;
  const color = getUserColor(msg.senderEmail);
  const row = document.createElement("div");
  row.className = "msg-row";
  row.style.cssText = `display:flex; margin-bottom:12px; gap:8px; align-items:flex-end; justify-content:${isMe ? 'flex-end' : 'flex-start'};`;

  // Restore Avatars: Check communityMembers list for the other user's photo
  let userProfile = isMe ? loggedInUser : communityMembers.find(m => m.email === msg.senderEmail) || otherUser || {};
  const name = userProfile.fullName || userProfile.FullName || msg.senderEmail;
  const pic = userProfile.profilePic || userProfile.ProfilePic;

  const avatarHTML = pic 
    ? `<img class="chat-avatar" src="${pic}" style="width:36px; height:36px; border-radius:50%; object-fit:cover;" />` 
    : `<div class="chat-avatar-fallback" style="width:36px; height:36px; border-radius:50%; background:#ddd; display:flex; align-items:center; justify-content:center; font-size:12px;">${getInitials(name)}</div>`;

  const bubble = document.createElement("div");
  bubble.style.cssText = `max-width:70%; padding:10px 14px; border-radius:18px; font-size:14px; background:${isMe ? color.bg : "#E9ECEF"}; color:${isMe ? color.text : "#000"}; position:relative;`;
  
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

async function sendMessage(payloadOverride = null) {
  const input = document.getElementById("messageInput");
  const text = (input?.value || "").trim();
  if (!payloadOverride && (!text || !activeConversationId)) return;

  const payload = payloadOverride || { type: "text", text: text };
  const container = document.getElementById("messages");

  // Optimistic UI
  const tempId = `temp_${payload.text || payload.fileName}`;
  const row = buildMessageRow({ senderEmail: loggedInUser.email, ...payload, timestamp: Date.now() });
  row.id = tempId;
  row.style.opacity = "0.6";
  container.appendChild(row);
  container.scrollTop = container.scrollHeight;

  if (!payloadOverride) input.value = "";

  try {
    await fetch(API_URL, {
      method: "POST",
      mode: "no-cors",
      body: JSON.stringify({
        module: "sendMessage",
        conversationId: activeConversationId,
        senderEmail: loggedInUser.email,
        ...payload
      })
    });
  } catch (err) { console.error("Send failed", err); }
}

/****************************************************
 * 5. INIT & EVENT LISTENERS
 ****************************************************/
function setupEventListeners() {
  // Members List Button
  const memberBtn = document.getElementById("toggleMembers");
  if (memberBtn) {
    memberBtn.onclick = () => {
      document.getElementById("memberSidebar")?.classList.toggle("show");
    };
  }

  // Send Button
  const sendBtn = document.getElementById("sendBtn");
  if (sendBtn) {
    sendBtn.onclick = () => sendMessage();
  }

  // Enter Key
  document.getElementById("messageInput")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Image Upload
  const imgBtn = document.getElementById("uploadImgBtn");
  const imgInp = document.getElementById("imgInput");
  if (imgBtn && imgInp) {
    imgBtn.onclick = () => imgInp.click();
    imgInp.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const b64 = await fileToBase64(file);
      sendMessage({ type: "image", fileName: file.name, fileData: b64 });
      e.target.value = "";
    };
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  loadNavbar();
  setupEventListeners();

  const header = document.getElementById("headerTitle");
  if (header && chatTitle) header.innerText = chatTitle;

  try {
    // 1. Get Conversation ID
    if (!activeConversationId) {
      const mod = (mode === "private") ? "startConversation" : "startCommunityConversation";
      const p = (mode === "private") ? `&otherEmail=${finalOtherEmail}` : `&communityId=${communityId}`;
      const r = await fetch(`${API_URL}?module=${mod}&userEmail=${loggedInUser.email}${p}`);
      const d = await r.json();
      activeConversationId = d.conversationId;
    }

    // 2. Fetch Members (crucial for avatars)
    if (mode !== "private") await loadCommunityMembers();

    // 3. Start Polling
    if (activeConversationId) {
      await loadMessagesOnce();
      setInterval(loadMessagesOnce, 4000);
    }
  } catch (err) { console.error("Initialization failed", err); }
});

function logout() {
  localStorage.removeItem("contact_user");
  window.location.href = "index.html";
}

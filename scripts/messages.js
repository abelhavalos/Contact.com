/****************************************************
 * CONTACT.COM — ULTRA FAST MESSAGES.JS (FIXED SIDEBAR)
 ****************************************************/

const API_URL =
  "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

/* USER */
let loggedInUser = JSON.parse(localStorage.getItem("contact_user"));
if (!loggedInUser) window.location.href = "login.html";
loggedInUser.fullName = loggedInUser.fullName || loggedInUser.FullName || loggedInUser.email;
loggedInUser.profilePic = loggedInUser.profilePic || loggedInUser.ProfilePic || null;

/* URL PARAMS */
const url = new URL(window.location.href);
const otherEmailParam = url.searchParams.get("otherEmail");
const conversationIdParam = url.searchParams.get("conversationId");
const communityId = url.searchParams.get("communityId");
const mode = communityId ? "community" : "private";

const paramEmail = url.searchParams.get("email");
const paramTitle = url.searchParams.get("title");
const finalOtherEmail = otherEmailParam || paramEmail;
let chatTitle = paramTitle || "";

/* STATE */
let activeConversationId = conversationIdParam || null;
let messages = [];
let communityMembers = [];
let otherUser = null;

/* COLORS */
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
  return name.split(" ").filter(Boolean).map((p) => p[0]).join("").substring(0, 2).toUpperCase();
}

function fileToBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

/****************************************************
 * NAVBAR & SIDEBAR TOGGLE
 ****************************************************/
function loadNavbar() {
  const nav = document.getElementById("navbar");
  if (nav) {
    nav.innerHTML = `
      <div class="hamburger" onclick="toggleMenu(event)">
        <span></span><span></span><span></span>
      </div>
      <div class="logo">Contact<span>.</span>com</div>
      <div class="nav-links">
        <a href="dashboard.html">Dashboard</a>
        <a href="communities.html">Communities</a>
        <a href="events.html">Events</a>
        <a href="contacts.html">Contacts</a>
        <a href="profile.html">Profile</a>
        <a href="#" onclick="logout()">Logout</a>
      </div>
    `;
  }

  const mobileMenu = document.getElementById("mobileMenu");
  if (mobileMenu) {
    mobileMenu.innerHTML = `
      <a href="dashboard.html">Dashboard</a>
      <a href="communities.html">Communities</a>
      <a href="events.html">Events</a>
      <a href="contacts.html">Contacts</a>
      <a href="profile.html">Profile</a>
      <a href="#" onclick="logout()">Logout</a>
    `;
  }
}

function toggleMenu(e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById("mobileMenu");
  if (menu) menu.classList.toggle("show");
}

// Global click listener to close sidebars
document.addEventListener("click", (e) => {
  // Close Mobile Navbar
  const mobileMenu = document.getElementById("mobileMenu");
  if (mobileMenu && mobileMenu.classList.contains("show") && !mobileMenu.contains(e.target) && !e.target.closest(".hamburger")) {
    mobileMenu.classList.remove("show");
  }

  // Close Member Sidebar on Mobile
  const sidebar = document.getElementById("memberSidebar");
  const toggleBtn = document.getElementById("toggleMembers");
  if (sidebar && sidebar.classList.contains("active") && !sidebar.contains(e.target) && !e.target.closest("#toggleMembers")) {
    sidebar.classList.remove("active");
    if (toggleBtn) {
        toggleBtn.classList.remove("active");
        toggleBtn.innerText = "Members";
    }
  }
});

function logout() {
  localStorage.removeItem("contact_user");
  window.location.href = "index.html";
}

/****************************************************
 * HEADERS
 ****************************************************/
async function loadOtherUserProfile() {
  const r = await fetch(`${API_URL}?module=getUserByEmail&email=${encodeURIComponent(finalOtherEmail)}`);
  const d = await r.json();
  otherUser = d?.user || {};

  const fullName = otherUser.fullName || otherUser.FullName || finalOtherEmail;
  const initials = getInitials(fullName);

  const avatar = otherUser.profilePic || otherUser.ProfilePic
      ? `<img class="chat-avatar" src="${otherUser.profilePic || otherUser.ProfilePic}" />`
      : `<div class="chat-avatar-fallback">${initials}</div>`;

  const header = document.getElementById("headerTitle");
  if (!header) return;

  header.innerHTML = chatTitle
    ? `<div class="chat-header"><div class="chat-header-main">${chatTitle}</div></div>`
    : `<div class="chat-header">${avatar}<div class="chat-header-main">${fullName}</div></div>`;
}

async function loadCommunityInfo() {
  const r = await fetch(`${API_URL}?module=getCommunityById&communityId=${communityId}`);
  const d = await r.json();
  const name = d?.community?.name || "Community";

  const header = document.getElementById("headerTitle");
  if (!header) return;

  header.innerHTML = `<div class="chat-header"><div class="chat-header-main">${name}</div></div>`;
}

/****************************************************
 * COMMUNITY MEMBERS
 ****************************************************/
async function loadCommunityMembers() {
  const r = await fetch(`${API_URL}?module=getCommunityMembers&communityId=${communityId}`);
  const d = await r.json();

  const emails = (d.members || []).map((m) => typeof m === "string" ? m : m.email);

  const tasks = emails.map(async (email) => {
    try {
      const r = await fetch(`${API_URL}?module=getUserByEmail&email=${encodeURIComponent(email)}`);
      const d = await r.json();
      const u = d?.user || {};
      return {
        email,
        fullName: u.fullName || u.FullName || email,
        profilePic: u.profilePic || u.ProfilePic || null
      };
    } catch {
      return { email, fullName: email, profilePic: null };
    }
  });

  communityMembers = await Promise.all(tasks);
  renderCommunityMembersList(communityMembers);
}

function renderCommunityMembersList(list) {
  const container = document.getElementById("memberSidebar");
  if (!container) return;

  container.innerHTML = "<h3>Members</h3>";
  const fragment = document.createDocumentFragment();

  list.forEach((m) => {
    const initials = getInitials(m.fullName);
    const avatar = m.profilePic
      ? `<img class="chat-avatar" src="${m.profilePic}" />`
      : `<div class="chat-avatar-fallback">${initials}</div>`;

    const row = document.createElement("div");
    row.className = "member";
    row.style.cursor = "pointer";
    row.style.marginBottom = "12px";
    row.onclick = () => (window.location.href = `public-profile.html?email=${encodeURIComponent(m.email)}`);

    row.innerHTML = `
      <div class="member-row" style="display:flex; align-items:center; gap:10px;">
        ${avatar}
        <div class="member-name" style="color:#333; font-weight:500;">${m.fullName}</div>
      </div>
    `;
    fragment.appendChild(row);
  });

  container.appendChild(fragment);
}

/****************************************************
 * MESSAGES
 ****************************************************/
async function loadMessagesOnce() {
  if (!activeConversationId) return;
  showChatLoader();

  const r = await fetch(`${API_URL}?module=getMessages&conversationId=${activeConversationId}`);
  const data = await r.json();

  messages = data.messages || [];
  renderAllMessages(messages);
  hideChatLoader();
}

function renderMessageContent(msg) {
  if (msg.type === "image") return `<img src="${msg.fileData}" class="chat-image" style="max-width:100%; border-radius:10px;">`;
  if (msg.type === "document") return `<a href="${msg.fileData}" download="${msg.fileName}" class="chat-doc" style="color:inherit; text-decoration:underline;">📄 ${msg.fileName}</a>`;
  return msg.text || "";
}

function renderAllMessages(list) {
  const container = document.getElementById("messageList");
  if (!container) return;

  container.innerHTML = "";
  const fragment = document.createDocumentFragment();
  list.forEach((msg) => fragment.appendChild(buildMessageRow(msg)));

  container.appendChild(fragment);
  const msgArea = document.getElementById("messages");
  if(msgArea) msgArea.scrollTop = msgArea.scrollHeight;
}

function buildMessageRow(msg) {
  const isMe = msg.senderEmail === loggedInUser.email;
  const contentHTML = renderMessageContent(msg);
  const color = getUserColor(msg.senderEmail);

  const row = document.createElement("div");
  row.className = "msg-row";
  row.style.display = "flex";
  row.style.marginBottom = "15px";
  row.style.gap = "8px";
  row.style.alignItems = "flex-end";
  row.style.justifyContent = isMe ? "flex-end" : "flex-start";

  const initials = isMe ? getInitials(loggedInUser.fullName) : getInitials(msg.senderEmail);
  let pic = isMe ? loggedInUser.profilePic : null;

  if (!isMe) {
      if (mode === "community") {
          const s = communityMembers.find(m => m.email === msg.senderEmail);
          if (s) pic = s.profilePic;
      } else if (otherUser) {
          pic = otherUser.profilePic || otherUser.ProfilePic;
      }
  }

  const avatar = pic 
    ? `<img class="chat-avatar" src="${pic}" style="width:32px; height:32px; border-radius:50%;" />`
    : `<div class="chat-avatar-fallback" style="width:32px; height:32px; border-radius:50%; font-size:12px; background:#eee; display:flex; align-items:center; justify-content:center;">${initials}</div>`;

  const bubble = document.createElement("div");
  bubble.style.maxWidth = "70%";
  bubble.style.padding = "10px 14px";
  bubble.style.borderRadius = isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px";
  bubble.style.fontSize = "14px";
  bubble.style.background = isMe ? color.bg : "#E5E7EB";
  bubble.style.color = isMe ? color.text : "#1F2937";
  bubble.innerHTML = contentHTML;

  if (isMe) {
    row.innerHTML = `<div style="display:flex; flex-direction:column; align-items:flex-end;"><div style="font-size:10px; color:#999; margin-bottom:2px;">You</div></div>`;
    row.appendChild(bubble);
    row.innerHTML += `<div style="margin-left:5px;">${avatar}</div>`;
  } else {
    row.innerHTML = `<div style="margin-right:5px;">${avatar}</div>`;
    row.appendChild(bubble);
  }

  return row;
}

function appendSingleMessage(msg) {
  const container = document.getElementById("messageList");
  if (!container) return;
  container.appendChild(buildMessageRow(msg));
  const msgArea = document.getElementById("messages");
  if(msgArea) msgArea.scrollTop = msgArea.scrollHeight;
}

/****************************************************
 * SEND LOGIC
 ****************************************************/
function sendMessage(payloadOverride = null) {
  const input = document.getElementById("messageInput");
  const text = (input?.value || "").trim();
  if (!payloadOverride && (!text || !activeConversationId)) return;

  const payload = payloadOverride || { module: "sendMessage", type: "text", text };
  const optimisticMsg = {
    id: "temp_" + Date.now(),
    senderEmail: loggedInUser.email,
    type: payload.type,
    text: payload.text,
    fileName: payload.fileName || null,
    fileData: payload.fileData || null
  };

  appendSingleMessage(optimisticMsg);
  if (input) input.value = "";

  const body = JSON.stringify({
    ...payload,
    conversationId: activeConversationId,
    senderEmail: loggedInUser.email
  });

  fetch(API_URL, { method: "POST", body })
    .then(r => r.json())
    .then(() => loadMessagesOnce())
    .catch(console.error);
}

/****************************************************
 * DOM READY
 ****************************************************/
document.addEventListener("DOMContentLoaded", async () => {
  loadNavbar();
  showChatLoader();

  // SIDEBAR TOGGLE LOGIC (FIXED)
  const toggleBtn = document.getElementById("toggleMembers");
  const sidebar = document.getElementById("memberSidebar");

  if (toggleBtn && sidebar) {
    toggleBtn.onclick = (e) => {
        e.stopPropagation();
        const isActive = sidebar.classList.toggle("active");
        toggleBtn.classList.toggle("active");
        toggleBtn.innerText = isActive ? "Close" : "Members";
    };
  }

  if (mode === "private") {
    if (toggleBtn) toggleBtn.style.display = "none";
    if (sidebar) sidebar.style.display = "none";
    await loadOtherUserProfile();
  } else {
    await loadCommunityInfo();
    await loadCommunityMembers();
  }

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

  // File Upload Triggers
  document.getElementById("uploadDocBtn").onclick = () => document.getElementById("docInput").click();
  document.getElementById("uploadImgBtn").onclick = () => document.getElementById("imgInput").click();

  document.getElementById("docInput").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const base64 = await fileToBase64(file);
    sendMessage({ type: "document", fileName: file.name, fileData: base64 });
    e.target.value = "";
  };

  document.getElementById("imgInput").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const base64 = await fileToBase64(file);
    sendMessage({ type: "image", fileName: file.name, fileData: base64 });
    e.target.value = "";
  };

  if (activeConversationId) {
    loadMessagesOnce();
  } else {
    let fetchUrl = mode === "community" 
        ? `${API_URL}?module=startCommunityConversation&communityId=${communityId}&userEmail=${loggedInUser.email}`
        : `${API_URL}?module=startConversation&userEmail=${loggedInUser.email}&otherEmail=${finalOtherEmail}`;
    
    const r = await fetch(fetchUrl);
    const d = await r.json();
    activeConversationId = d.conversationId;
    loadMessagesOnce();
  }
});

function showChatLoader() { document.getElementById("chatLoader").style.display = "flex"; }
function hideChatLoader() { document.getElementById("chatLoader").style.display = "none"; }

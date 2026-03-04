/****************************************************
 * CONTACT.COM — FULL MESSAGES.JS
 ****************************************************/

const API_URL = "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

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
const paramName = url.searchParams.get("name");
const paramTitle = url.searchParams.get("title");
const finalOtherEmail = otherEmailParam || paramEmail;
let chatTitle = paramTitle || "";

let activeConversationId = conversationIdParam || null;
let messages = [];
let otherUser = null;
let communityMembers = [];
let pollingInterval = null;

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
 * NAVBAR
 ****************************************************/
function loadNavbar() {
  const nav = document.getElementById("navbar");
  if (nav) {
    nav.innerHTML = `
      <div class="hamburger" onclick="toggleMenu()">
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
      </div>`;
  }
  const mobileMenu = document.getElementById("mobileMenu");
  if (mobileMenu) {
    mobileMenu.innerHTML = `
      <a href="dashboard.html">Dashboard</a>
      <a href="communities.html">Communities</a>
      <a href="events.html">Events</a>
      <a href="contacts.html">Contacts</a>
      <a href="profile.html">Profile</a>
      <a href="#" onclick="logout()">Logout</a>`;
  }
}

function toggleMenu() {
  const menu = document.getElementById("mobileMenu");
  if (menu) menu.classList.toggle("show");
}

function logout() {
  localStorage.removeItem("contact_user");
  window.location.href = "index.html";
}

/****************************************************
 * CACHE
 ****************************************************/
function cacheMembers(list) {
  if (!communityId) return;
  localStorage.setItem("cached_members_" + communityId, JSON.stringify(list));
}

function loadCachedMembers() {
  const raw = localStorage.getItem("cached_members_" + communityId);
  return raw ? JSON.parse(raw) : [];
}

/****************************************************
 * COMMUNITY MEMBERS & SKELETONS
 ****************************************************/
function renderCommunityMembersSkeletons(count = 8) {
  const container = document.getElementById("memberSidebar");
  if (!container) return;
  container.innerHTML = "<h3>Members</h3>";
  for (let i = 0; i < count; i++) {
    container.innerHTML += `
      <div class="member" style="margin-bottom:16px; display:flex; align-items:center; gap:10px;">
        <div style="width:44px; height:44px; border-radius:50%; background:#dbe4ff; animation:pulse 1.4s infinite;"></div>
        <div style="width:60%; height:14px; border-radius:6px; background:#e6ecff; animation:pulse 1.4s infinite;"></div>
      </div>`;
  }
}

async function primeCommunityMembers() {
  const cached = loadCachedMembers();
  if (cached.length) {
    communityMembers = cached;
    renderCommunityMembersList(cached);
  } else {
    renderCommunityMembersSkeletons(8);
  }
  await loadCommunityMembers();
}

async function loadCommunityMembers() {
  const r = await fetch(`${API_URL}?module=getCommunityMembers&communityId=${communityId}`);
  const d = await r.json();
  const emails = (d.members || []).map((m) => typeof m === "string" ? m : m.email);
  hydrateMemberProfiles(emails);
}

async function hydrateMemberProfiles(emails) {
  const fullProfiles = [];
  for (const email of emails) {
    try {
      const r = await fetch(`${API_URL}?module=getUserByEmail&email=${encodeURIComponent(email)}`);
      const d = await r.json();
      const u = d?.user || {};
      fullProfiles.push({
        email,
        fullName: u.fullName || u.FullName || email,
        profilePic: u.profilePic || u.ProfilePic || null
      });
    } catch {
      fullProfiles.push({ email, fullName: email, profilePic: null });
    }
  }
  communityMembers = fullProfiles;
  cacheMembers(fullProfiles);
  renderCommunityMembersList(fullProfiles);
  renderMessages(messages); // CRITICAL: Re-render chat once profiles are loaded
}

function renderCommunityMembersList(list) {
  const container = document.getElementById("memberSidebar");
  if (!container) return;
  container.innerHTML = "<h3>Members</h3>";
  list.forEach((m) => {
    const initials = getInitials(m.fullName);
    const avatarHTML = m.profilePic
      ? `<img class="chat-avatar" src="${m.profilePic}" />`
      : `<div class="chat-avatar-fallback">${initials}</div>`;
    container.innerHTML += `
      <div class="member" style="margin-bottom:16px; cursor:pointer; display:flex; align-items:center; gap:10px;"
           onclick="window.location.href='public-profile.html?email=${encodeURIComponent(m.email)}'">
          ${avatarHTML}
          <div style="font-weight:600;">${m.fullName}</div>
      </div>`;
  });
}

/****************************************************
 * MESSAGES & POLLING
 ****************************************************/
function startPolling() {
  if (pollingInterval) clearInterval(pollingInterval);
  loadMessages();
  pollingInterval = setInterval(() => {
    if (activeConversationId) loadMessages();
  }, 1000);
}

async function loadMessages() {
  const r = await fetch(`${API_URL}?module=getMessages&conversationId=${activeConversationId}`);
  const data = await r.json();
  let backendMessages = (data.messages || []).slice(-15);
  const optimistic = messages.filter((m) => m.optimistic);
  messages = [...backendMessages, ...optimistic];
  renderMessages(messages);
}

function renderMessageContent(msg) {
  if (msg.type === "image") return `<img src="${msg.fileData}" class="chat-image" style="max-width:100%; border-radius:8px;">`;
  if (msg.type === "document") return `<a href="${msg.fileData}" download="${msg.fileName}" class="chat-doc">📄 ${msg.fileName}</a>`;
  return msg.text || "";
}

function renderMessages(list) {
  const container = document.getElementById("messages");
  if (!container) return;
  container.innerHTML = "";

  list.forEach((msg) => {
    const isMe = msg.senderEmail === loggedInUser.email;
    let sender = communityMembers.find(m => m.email === msg.senderEmail);
    
    // If not found in community list, check if it's "the other person" in private chat
    let name = isMe ? loggedInUser.fullName : (sender?.fullName || msg.senderEmail);
    let pic = isMe ? loggedInUser.profilePic : (sender?.profilePic || null);
    
    const color = getUserColor(msg.senderEmail);
    const initials = getInitials(name);
    const avatarHTML = pic 
      ? `<img class="chat-avatar" src="${pic}" />` 
      : `<div class="chat-avatar-fallback">${initials}</div>`;

    const row = document.createElement("div");
    row.style.cssText = `display:flex; justify-content:${isMe ? 'flex-end' : 'flex-start'}; align-items:flex-start; margin-bottom:18px; gap:10px;`;

    const bubbleHTML = `
      ${!isMe ? `<div style="width:70px;text-align:center;">${avatarHTML}<div style="font-size:11px;color:#666;margin-top:4px;">${name.split(' ')[0]}</div></div>` : ''}
      <div style="max-width:65%;">
        <div style="background:${isMe ? color.bg : '#F0F0F0'}; color:${isMe ? color.text : '#333'}; padding:10px 14px; border-radius:14px; word-wrap: break-word;">
          ${renderMessageContent(msg)}
        </div>
      </div>
      ${isMe ? `<div style="width:70px;text-align:center;">${avatarHTML}<div style="font-size:11px;color:#666;margin-top:4px;">Me</div></div>` : ''}
    `;

    row.innerHTML = bubbleHTML;
    container.appendChild(row);
  });
  container.scrollTop = container.scrollHeight;
}

/****************************************************
 * SEND LOGIC
 ****************************************************/
function sendMessage(payloadOverride = null) {
  const input = document.getElementById("messageInput");
  const text = (input?.value || "").trim();
  if (!payloadOverride && !text) return;

  const payload = payloadOverride || { module: "sendMessage", type: "text", text: text };
  
  // Optimistic UI
  messages.push({ senderEmail: loggedInUser.email, text: text, optimistic: true, ...payload });
  renderMessages(messages);
  if (input) input.value = "";

  if (payload.type === "text") {
    fetch(`${API_URL}?module=sendMessage&conversationId=${activeConversationId}&senderEmail=${loggedInUser.email}&type=text&text=${encodeURIComponent(text)}`)
      .then(() => loadMessages());
  } else {
    fetch(API_URL, { method: "POST", body: JSON.stringify({ ...payload, conversationId: activeConversationId, senderEmail: loggedInUser.email }) })
      .then(() => loadMessages());
  }
}

/****************************************************
 * DOM READY
 ****************************************************/
document.addEventListener("DOMContentLoaded", async () => {
  loadNavbar();

  if (mode === "private") {
    const sidebar = document.getElementById("memberSidebar");
    if (sidebar) sidebar.style.display = "none";
    
    // Load Private Chat Target
    const r = await fetch(`${API_URL}?module=getUserByEmail&email=${encodeURIComponent(finalOtherEmail)}`);
    const d = await r.json();
    otherUser = d?.user || {};
    document.getElementById("headerTitle").innerText = chatTitle || otherUser.fullName || finalOtherEmail;

    // Start/Get Conversation
    const convR = await fetch(`${API_URL}?module=startConversation&userEmail=${loggedInUser.email}&otherEmail=${finalOtherEmail}`);
    const convD = await convR.json();
    activeConversationId = convD.conversationId;
    startPolling();
  } else {
    // Community Mode
    const infoR = await fetch(`${API_URL}?module=getCommunityById&communityId=${communityId}`);
    const infoD = await infoR.json();
    document.getElementById("headerTitle").innerText = infoD?.community?.name || "Community";

    await primeCommunityMembers();

    const convR = await fetch(`${API_URL}?module=startCommunityConversation&communityId=${communityId}&userEmail=${loggedInUser.email}`);
    const convD = await convR.json();
    activeConversationId = convD.conversationId;
    startPolling();
  }

  // Bind Events
  document.getElementById("sendBtn").onclick = () => sendMessage();
  document.getElementById("messageInput").onkeydown = (e) => { if (e.key === "Enter") sendMessage(); };
  
  // File Handlers
  const setupFile = (btnId, inputId, type) => {
    const btn = document.getElementById(btnId);
    if (btn) btn.onclick = () => document.getElementById(inputId).click();
    document.getElementById(inputId).onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        const base64 = await fileToBase64(file);
        sendMessage({ type, fileName: file.name, fileData: base64 });
      }
    };
  };
  setupFile("uploadDocBtn", "docInput", "document");
  setupFile("uploadImgBtn", "imgInput", "image");
});

const skeletonStyleInject = document.createElement("style");
skeletonStyleInject.innerHTML = `@keyframes pulse { 0% { opacity: 0.55; } 50% { opacity: 1; } 100% { opacity: 0.55; } }`;
document.head.appendChild(skeletonStyleInject);

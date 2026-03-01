/****************************************************
 * CONTACT.COM — ULTRA FAST MESSAGES.JS (V3)
 * - Parallel Meta Loading
 * - Delta-Sync via lastId
 * - Anti-Flicker Reconciliation
 * - Full Image/Doc Support
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
let messages = []; 
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

// Custom BTOA that handles Unicode/Emojis safely for data-tagging
function safeBtoa(str) {
  return btoa(unescape(encodeURIComponent(str || "")));
}

/****************************************************
 * CORE INITIALIZATION
 ****************************************************/
async function initChat() {
  loadNavbar();
  showChatLoader();

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

  const metaPromises = [];
  if (mode === "private") {
    metaPromises.push(loadOtherUserProfile());
  } else {
    metaPromises.push(loadCommunityInfo(), loadCommunityMembers());
  }

  await Promise.all([...metaPromises, syncMessages()]);
  hideChatLoader();

  setInterval(() => syncMessages(), 3500);
}

/****************************************************
 * MESSAGING ENGINE (ANTI-FLICKER)
 ****************************************************/
async function syncMessages() {
  if (!activeConversationId) return;

  const lastId = messages.reduce((max, m) => (m.messageId > max ? m.messageId : max), 0);
  
  try {
    const r = await fetch(`${API_URL}?module=getMessages&conversationId=${activeConversationId}&lastId=${lastId}`);
    const data = await r.json();
    const newMessages = data.messages || [];

    if (newMessages.length > 0) {
      const container = document.getElementById("messages");
      const fragment = document.createDocumentFragment();
      
      newMessages.forEach(msg => {
        // RECONCILIATION: Look for a temporary bubble matching this content
        const lookupTag = safeBtoa(msg.text || msg.fileName);
        const tempElement = document.querySelector(`[data-temp-content="${lookupTag}"]`);
        
        if (tempElement) {
          // Confirming existing bubble
          tempElement.id = `msg-${msg.messageId}`;
          tempElement.removeAttribute('data-temp-content');
          tempElement.style.opacity = "1"; 
          messages.push(msg);
        } else if (!document.getElementById(`msg-${msg.messageId}`)) {
          // Adding new bubble from other user
          messages.push(msg);
          fragment.appendChild(buildMessageRow(msg));
        }
      });

      container.appendChild(fragment);
      container.scrollTop = container.scrollHeight;
    }
  } catch (e) { console.error("Sync Error:", e); }
}

function buildMessageRow(msg) {
  const isMe = msg.senderEmail === loggedInUser.email;
  const color = getUserColor(msg.senderEmail);

  const row = document.createElement("div");
  row.id = `msg-${msg.messageId || 'temp-' + Date.now()}`;
  row.className = "msg-row";
  row.style = `display:flex; margin-bottom:12px; gap:8px; align-items:flex-end; justify-content:${isMe ? 'flex-end' : 'flex-start'}; transition: opacity 0.3s ease;`;

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
    <div style="max-width:70%; padding:10px 14px; border-radius:18px; font-size:14px; background:${isMe ? color.bg : '#F1F1F1'}; color:${isMe ? color.text : '#111827'}">
      ${renderMessageContent(msg)}
    </div>
  `;

  row.innerHTML = isMe ? `${bubbleHTML}<div style="width:36px">${avatarHTML}</div>` : `<div style="width:36px">${avatarHTML}</div>${bubbleHTML}`;
  return row;
}

function renderMessageContent(msg) {
  if (msg.type === "image") return `<img src="${msg.fileData}" class="chat-image" style="max-width:100%; border-radius:10px; min-height:100px; display:block; margin-top:4px;">`;
  if (msg.type === "document") return `<a href="${msg.fileData}" download="${msg.fileName}" class="chat-doc" style="text-decoration:none; color:inherit; font-weight:bold;">📄 ${msg.fileName}</a>`;
  return msg.text || "";
}

function sendMessage(payloadOverride = null) {
  const input = document.getElementById("messageInput");
  const text = (input?.value || "").trim();
  if (!payloadOverride && (!text || !activeConversationId)) return;

  const payload = payloadOverride || { type: "text", text };

  // OPTIMISTIC RENDER
  const container = document.getElementById("messages");
  const row = buildMessageRow({ messageId: 0, senderEmail: loggedInUser.email, ...payload });
  
  // Tag it for syncMessages to find later
  row.setAttribute('data-temp-content', safeBtoa(payload.text || payload.fileName));
  row.style.opacity = "0.6"; 
  
  container.appendChild(row);
  container.scrollTop = container.scrollHeight;
  if (input) input.value = "";

  // NETWORK
  const isText = payload.type === "text";
  const url = isText 
    ? `${API_URL}?module=sendMessage&conversationId=${encodeURIComponent(activeConversationId)}&senderEmail=${encodeURIComponent(loggedInUser.email)}&type=text&text=${encodeURIComponent(text)}`
    : API_URL;

  const options = isText ? {} : {
    method: "POST",
    body: JSON.stringify({ module: "sendMessage", conversationId: activeConversationId, senderEmail: loggedInUser.email, ...payload })
  };

  fetch(url, options).then(() => syncMessages());
}

/****************************************************
 * UI FETCHERS & EVENTS
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

function renderCommunityMembersList(list) {
  const container = document.getElementById("memberSidebar");
  if (!container) return;
  container.innerHTML = "<h3>Members</h3>";
  list.forEach(m => {
    const row = document.createElement("div");
    row.className = "member-row";
    row.style = "display:flex; align-items:center; gap:8px; margin-bottom:10px; cursor:pointer;";
    row.onclick = () => window.location.href = `public-profile.html?email=${encodeURIComponent(m.email)}`;
    const avatar = m.profilePic ? `<img class="chat-avatar" src="${m.profilePic}" />` : `<div class="chat-avatar-fallback">${getInitials(m.fullName)}</div>`;
    row.innerHTML = `${avatar}<div class="member-name">${m.fullName}</div>`;
    container.appendChild(row);
  });
}

function updateHeader(title, pic) {
  const header = document.getElementById("headerTitle");
  if (!header) return;
  const avatar = pic ? `<img class="chat-avatar" src="${pic}" />` : `<div class="chat-avatar-fallback">${getInitials(title)}</div>`;
  header.innerHTML = `<div class="chat-header">${chatTitle ? '' : avatar}<div class="chat-header-main">${chatTitle || title}</div></div>`;
}

document.addEventListener("DOMContentLoaded", () => {
  initChat();
  document.getElementById("sendBtn")?.addEventListener("click", () => sendMessage());
  document.getElementById("messageInput")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });

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

function toggleMenu() { document.getElementById("mobileMenu")?.classList.toggle("show"); }
function showChatLoader() { document.getElementById("chatLoader")?.style.setProperty("display", "flex"); }
function hideChatLoader() { document.getElementById("chatLoader")?.style.setProperty("display", "none"); }
function logout() { localStorage.removeItem("contact_user"); window.location.href = "index.html"; }

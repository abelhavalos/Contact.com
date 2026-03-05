/****************************************************
 * CONTACT.COM — ULTRA FAST MESSAGES.JS
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
const mode = communityId ? "community" : "private";
const finalOtherEmail = otherEmailParam || url.searchParams.get("email");
let chatTitle = url.searchParams.get("title") || "";

let activeConversationId = conversationIdParam || null;
let messages = [];
let communityMembers = [];
let otherUser = null;

const BUBBLE_PALETTE = [
  { bg: "#4A6CFF", text: "#FFFFFF" },
  { bg: "#6F8CFF", text: "#FFFFFF" },
  { bg: "#8FA3FF", text: "#000000" },
  { bg: "#AFC0FF", text: "#000000" },
  { bg: "#D1DDFF", text: "#000000" }
];

/****************************************************
 * 2. HELPERS (At the top to avoid ReferenceErrors)
 ****************************************************/
function showChatLoader() {
  const el = document.getElementById("chatLoader");
  if (el) el.style.display = "flex";
}

function hideChatLoader() {
  const el = document.getElementById("chatLoader");
  if (el) el.style.display = "none";
}

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
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

/****************************************************
 * 3. UI COMPONENTS
 ****************************************************/
function loadNavbar() {
  const nav = document.getElementById("navbar");
  const mobileMenu = document.getElementById("mobileMenu");
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
 * 4. DATA FETCHING & RENDERING
 ****************************************************/
async function loadOtherUserProfile() {
  if (!finalOtherEmail) return;
  const r = await fetch(`${API_URL}?module=getUserByEmail&email=${encodeURIComponent(finalOtherEmail)}`);
  const d = await r.json();
  otherUser = d?.user || {};
  const name = otherUser.fullName || otherUser.FullName || finalOtherEmail;
  const pic = otherUser.profilePic || otherUser.ProfilePic;
  
  const header = document.getElementById("headerTitle");
  if (header) {
    const avatarHTML = pic 
      ? `<img class="chat-avatar" src="${pic}" />` 
      : `<div class="chat-avatar-fallback">${getInitials(name)}</div>`;
    header.innerHTML = `<div class="chat-header">${avatarHTML}<div class="chat-header-main">${chatTitle || name}</div></div>`;
  }
}

async function loadCommunityInfo() {
  const r = await fetch(`${API_URL}?module=getCommunityById&communityId=${communityId}`);
  const d = await r.json();
  const name = d?.community?.name || "Community";
  const header = document.getElementById("headerTitle");
  if (header) header.innerHTML = `<div class="chat-header"><div class="chat-header-main">${name}</div></div>`;
}

async function loadCommunityMembers() {
  const r = await fetch(`${API_URL}?module=getCommunityMembers&communityId=${communityId}`);
  const d = await r.json();
  const emails = (d.members || []).map(m => typeof m === "string" ? m : m.email);

  const tasks = emails.map(async (email) => {
    try {
      const res = await fetch(`${API_URL}?module=getUserByEmail&email=${encodeURIComponent(email)}`);
      const data = await res.json();
      const u = data?.user || {};
      return { email, fullName: u.fullName || u.FullName || email, profilePic: u.profilePic || u.ProfilePic || null };
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
  list.forEach(m => {
    const row = document.createElement("div");
    row.className = "member";
    row.style.marginBottom = "12px";
    row.onclick = () => window.location.href = `public-profile.html?email=${encodeURIComponent(m.email)}`;
    
    const avatar = m.profilePic 
      ? `<img class="chat-avatar" src="${m.profilePic}" />` 
      : `<div class="chat-avatar-fallback">${getInitials(m.fullName)}</div>`;

    row.innerHTML = `<div class="member-row" style="display:flex; align-items:center; gap:10px; cursor:pointer;">
      ${avatar}<div class="member-name">${m.fullName}</div></div>`;
    fragment.appendChild(row);
  });
  container.appendChild(fragment);
}

async function loadMessagesOnce() {
  if (!activeConversationId) return;
  showChatLoader();
  const r = await fetch(`${API_URL}?module=getMessages&conversationId=${activeConversationId}`);
  const data = await r.json();
  messages = data.messages || [];
  
  const container = document.getElementById("messages");
  if (container) {
    container.innerHTML = "";
    const fragment = document.createDocumentFragment();
    messages.forEach(msg => fragment.appendChild(buildMessageRow(msg)));
    container.appendChild(fragment);
    container.scrollTop = container.scrollHeight;
  }
  hideChatLoader();
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
  } else if (mode === "community") {
    const s = communityMembers.find(m => m.email === msg.senderEmail) || {};
    pic = s.profilePic;
    name = s.fullName || msg.senderEmail;
  } else {
    pic = otherUser?.profilePic || otherUser?.ProfilePic;
    name = otherUser?.fullName || finalOtherEmail;
  }

  const avatarHTML = pic 
    ? `<img class="chat-avatar" src="${pic}" />` 
    : `<div class="chat-avatar-fallback">${getInitials(name)}</div>`;

  const bubble = document.createElement("div");
  bubble.style.cssText = `max-width:70%; padding:8px 12px; border-radius:16px; font-size:14px; background:${isMe ? color.bg : "#F3F4F6"}; color:${isMe ? color.text : "#111827"};`;
  
  if (msg.type === "image") {
    bubble.innerHTML = `<img src="${msg.fileData}" class="chat-image" style="max-width:100%; border-radius:8px; display:block;">`;
  } else if (msg.type === "document") {
    bubble.innerHTML = `<a href="${msg.fileData}" download="${msg.fileName}" class="chat-doc" style="color:inherit; text-decoration:none;">📄 ${msg.fileName}</a>`;
  } else {
    bubble.textContent = msg.text || "";
  }

  const avatarWrapper = document.createElement("div");
  avatarWrapper.style.cssText = "width:36px; display:flex; justify-content:center;";
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
 * 5. SEND LOGIC
 ****************************************************/
function sendMessage(payloadOverride = null) {
  const input = document.getElementById("messageInput");
  const text = (input?.value || "").trim();
  
  if (!payloadOverride && (!text || !activeConversationId)) return;

  const payload = payloadOverride || { module: "sendMessage", type: "text", text };
  
  const container = document.getElementById("messages");
  if (container) {
    const optMsg = { senderEmail: loggedInUser.email, ...payload };
    container.appendChild(buildMessageRow(optMsg));
    container.scrollTop = container.scrollHeight;
  }

  if (!payloadOverride) {
    input.value = "";
    fetch(`${API_URL}?module=sendMessage&conversationId=${activeConversationId}&senderEmail=${loggedInUser.email}&type=text&text=${encodeURIComponent(text)}`)
      .then(() => loadMessagesOnce(false)); // 🔥 PASS FALSE HERE
  } else {
    fetch(API_URL, { 
      method: "POST", 
      body: JSON.stringify({ ...payload, conversationId: activeConversationId, senderEmail: loggedInUser.email }) 
    })
    .then(() => loadMessagesOnce(false)); // 🔥 PASS FALSE HERE
  }
}

/****************************************************
 * 6. INIT & EVENT LISTENERS
 ****************************************************/
function setupEventListeners() {
  document.getElementById("sendBtn")?.addEventListener("click", () => sendMessage());
  
  document.getElementById("messageInput")?.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) { 
      e.preventDefault(); 
      sendMessage(); 
    }
  });

  document.getElementById("toggleMembers")?.addEventListener("click", () => {
    document.getElementById("memberSidebar")?.classList.toggle("show");
  });

  // RESTORED: Image & Document Upload Logic
  const uploadConfigs = [
    { btnId: "uploadDocBtn", inputId: "docInput", type: "document" },
    { btnId: "uploadImgBtn", inputId: "imgInput", type: "image" }
  ];

  uploadConfigs.forEach(cfg => {
    const btn = document.getElementById(cfg.btnId);
    const inp = document.getElementById(cfg.inputId);
    
    if (btn && inp) {
      btn.onclick = () => inp.click();
      inp.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
          const b64 = await fileToBase64(file);
          sendMessage({ 
            module: "sendMessage",
            type: cfg.type, 
            fileName: file.name, 
            fileData: b64 
          });
        } catch (err) {
          console.error("File processing failed", err);
        }
        e.target.value = ""; // Clear input for next use
      };
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  // Define structure first
  loadNavbar();
  showChatLoader();
  setupEventListeners();

  const backgroundTasks = [];
  if (mode === "private") {
    const toggle = document.getElementById("toggleMembers");
    if (toggle) toggle.style.display = "none";
    backgroundTasks.push(loadOtherUserProfile());
  } else {
    backgroundTasks.push(loadCommunityInfo());
    backgroundTasks.push(loadCommunityMembers());
  }

  const getConvId = (async () => {
    if (activeConversationId) return activeConversationId;
    const mod = mode === "community" ? "startCommunityConversation" : "startConversation";
    const p = mode === "community" ? `&communityId=${communityId}` : `&otherEmail=${finalOtherEmail}`;
    const r = await fetch(`${API_URL}?module=${mod}&userEmail=${loggedInUser.email}${p}`);
    const d = await r.json();
    return d.conversationId;
  })();

  try {
    const [id] = await Promise.all([getConvId, ...backgroundTasks]);
    activeConversationId = id;
    if (activeConversationId) {
      await loadMessagesOnce();
    } else {
      hideChatLoader();
    }
  } catch (err) {
    console.error("Init failed", err);
    hideChatLoader();
  }
});

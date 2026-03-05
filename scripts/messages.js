/****************************************************
 * CONTACT.COM — FULL PRODUCTION MESSAGES.JS
 * NAVBAR RESTORED + ULTRA FAST RENDERING
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
  { bg: "#4A6CFF", text: "#FFFFFF" },
  { bg: "#6F8CFF", text: "#FFFFFF" },
  { bg: "#8FA3FF", text: "#000000" },
  { bg: "#AFC0FF", text: "#000000" },
  { bg: "#D1DDFF", text: "#000000" }
];

/****************************************************
 * 2. HELPERS & UI COMPONENTS
 ****************************************************/
const showChatLoader = () => { const el = document.getElementById("chatLoader"); if (el) el.style.display = "flex"; };
const hideChatLoader = () => { const el = document.getElementById("chatLoader"); if (el) el.style.display = "none"; };

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

function toggleMenu() {
  const menu = document.getElementById("mobileMenu");
  if (menu) menu.classList.toggle("show");
}

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
      <a href="#" onclick="localStorage.removeItem('contact_user'); window.location.href='index.html'">Logout</a>
    </div>`;
  
  if (nav) nav.innerHTML = navHTML;
  if (mobileMenu) {
    mobileMenu.innerHTML = `
      <a href="dashboard.html">Dashboard</a>
      <a href="communities.html">Communities</a>
      <a href="events.html">Events</a>
      <a href="contacts.html">Contacts</a>
      <a href="profile.html">Profile</a>
      <a href="#" onclick="localStorage.removeItem('contact_user'); window.location.href='index.html'">Logout</a>`;
  }
}

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

/****************************************************
 * 3. FAST RENDERING & SYNC ENGINE
 ****************************************************/

function getMessageHTML(msg) {
  const isMe = msg.senderEmail === loggedInUser.email;
  const color = getUserColor(msg.senderEmail);
  
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

  const avatar = pic 
    ? `<img class="chat-avatar" src="${pic}" loading="lazy" />` 
    : `<div class="chat-avatar-fallback">${getInitials(name)}</div>`;

  let content = "";
  if (msg.type === "image") {
    content = `<img src="${msg.fileData}" class="chat-image" style="max-width:100%; border-radius:8px; display:block;">`;
  } else if (msg.type === "document") {
    content = `<a href="${msg.fileData}" download="${msg.fileName}" class="chat-doc" style="color:inherit; text-decoration:none;">📄 ${msg.fileName}</a>`;
  } else {
    content = (msg.text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  const bubbleStyle = `max-width:70%; padding:8px 12px; border-radius:16px; font-size:14px; background:${isMe ? color.bg : "#F3F4F6"}; color:${isMe ? color.text : "#111827"}; overflow-wrap: break-word;`;
  const rowStyle = `display:flex; margin-bottom:10px; gap:8px; align-items:flex-end; justify-content:${isMe ? 'flex-end' : 'flex-start'};`;
  const avatarPart = `<div style="width:36px; flex-shrink:0; display:flex; justify-content:center;">${avatar}</div>`;
  const bubblePart = `<div style="${bubbleStyle}">${content}</div>`;

  return `
    <div class="msg-row" data-id="${msg.id}" style="${rowStyle}">
      ${isMe ? bubblePart + avatarPart : avatarPart + bubblePart}
    </div>`;
}

async function syncMessages(showSpinner = false) {
  if (!activeConversationId || isFetching) return;
  if (showSpinner) showChatLoader();
  
  isFetching = true;
  try {
    const r = await fetch(`${API_URL}?module=getMessages&conversationId=${activeConversationId}`);
    const data = await r.json();
    const serverMessages = data.messages || [];
    const container = document.getElementById("messages");
    if (!container) return;

    const newMessages = serverMessages.filter(msg => !renderedMessageIds.has(msg.id));

    if (newMessages.length > 0) {
      let htmlBuffer = "";
      newMessages.forEach(msg => {
        htmlBuffer += getMessageHTML(msg);
        renderedMessageIds.add(msg.id);
      });

      container.insertAdjacentHTML('beforeend', htmlBuffer);
      container.scrollTop = container.scrollHeight;
    }
  } catch (err) {
    console.error("Sync failed", err);
  } finally {
    isFetching = false;
    hideChatLoader();
  }
}

/****************************************************
 * 4. USER & COMMUNITY DATA
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
    const avatarHTML = pic ? `<img class="chat-avatar" src="${pic}" />` : `<div class="chat-avatar-fallback">${getInitials(name)}</div>`;
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
  let html = "<h3>Members</h3>";
  list.forEach(m => {
    const avatar = m.profilePic ? `<img class="chat-avatar" src="${m.profilePic}" />` : `<div class="chat-avatar-fallback">${getInitials(m.fullName)}</div>`;
    html += `<div class="member" onclick="window.location.href='public-profile.html?email=${encodeURIComponent(m.email)}'">
               <div class="member-row" style="display:flex; align-items:center; gap:10px; cursor:pointer; margin-bottom:12px;">
                 ${avatar}<div class="member-name">${m.fullName}</div>
               </div>
             </div>`;
  });
  container.innerHTML = html;
}

/****************************************************
 * 5. ACTIONS & EVENTS
 ****************************************************/
function sendMessage(payloadOverride = null) {
  const input = document.getElementById("messageInput");
  const text = (input?.value || "").trim();
  if (!payloadOverride && (!text || !activeConversationId)) return;

  const tempId = "temp_" + Date.now();
  const payload = payloadOverride || { type: "text", text };
  
  const container = document.getElementById("messages");
  if (container) {
    const optMsg = { id: tempId, senderEmail: loggedInUser.email, ...payload };
    container.insertAdjacentHTML('beforeend', getMessageHTML(optMsg));
    container.scrollTop = container.scrollHeight;
    renderedMessageIds.add(tempId); 
  }

  if (!payloadOverride) {
    input.value = "";
    fetch(`${API_URL}?module=sendMessage&conversationId=${activeConversationId}&senderEmail=${loggedInUser.email}&type=text&text=${encodeURIComponent(text)}`)
      .then(() => syncMessages(false));
  } else {
    fetch(API_URL, { 
      method: "POST", 
      body: JSON.stringify({ ...payload, module: "sendMessage", conversationId: activeConversationId, senderEmail: loggedInUser.email }) 
    }).then(() => syncMessages(false));
  }
}

function setupEventListeners() {
  document.getElementById("sendBtn")?.addEventListener("click", () => sendMessage());
  document.getElementById("messageInput")?.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  document.getElementById("toggleMembers")?.addEventListener("click", () => {
    document.getElementById("memberSidebar")?.classList.toggle("show");
  });

  const configs = [{b: "uploadDocBtn", i: "docInput", t: "document"}, {b: "uploadImgBtn", i: "imgInput", t: "image"}];
  configs.forEach(cfg => {
    const btn = document.getElementById(cfg.b), inp = document.getElementById(cfg.i);
    if (btn && inp) {
      btn.onclick = () => inp.click();
      inp.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const b64 = await fileToBase64(file);
        sendMessage({ type: cfg.t, fileName: file.name, fileData: b64 });
        e.target.value = "";
      };
    }
  });
}

/****************************************************
 * 6. INITIALIZATION
 ****************************************************/
document.addEventListener("DOMContentLoaded", async () => {
  loadNavbar(); // Restored Navbar & Logo
  showChatLoader();
  setupEventListeners();

  const backgroundTasks = [];
  if (mode === "private") {
    const t = document.getElementById("toggleMembers"); if (t) t.style.display = "none";
    backgroundTasks.push(loadOtherUserProfile());
  } else {
    backgroundTasks.push(loadCommunityInfo(), loadCommunityMembers());
  }

  try {
    if (!activeConversationId) {
      const mod = mode === "community" ? "startCommunityConversation" : "startConversation";
      const p = mode === "community" ? `&communityId=${communityId}` : `&otherEmail=${finalOtherEmail}`;
      const r = await fetch(`${API_URL}?module=${mod}&userEmail=${loggedInUser.email}${p}`);
      const d = await r.json();
      activeConversationId = d.conversationId;
    }
    
    await Promise.all(backgroundTasks);
    await syncMessages(true);

    // Sync loop: 3 seconds
    setInterval(() => syncMessages(false), 3000);

  } catch (err) {
    console.error("Init failed", err);
  } finally {
    hideChatLoader();
  }
});

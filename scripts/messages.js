/****************************************************
 * CONTACT.COM — FULL MESSAGES.JS
 ****************************************************/

const API_URL = "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

/* --- CSS FOR RESPONSIVE IMAGES & AVATARS --- */
const style = document.createElement('style');
style.innerHTML = `
  .chat-image {
    max-width: 100%;
    max-height: 350px;
    height: auto;
    border-radius: 12px;
    display: block;
    margin-top: 8px;
    object-fit: contain;
    cursor: pointer;
    border: 1px solid rgba(0,0,0,0.1);
  }
  .chat-avatar {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    object-fit: cover;
  }
  .chat-avatar-fallback {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: #dbe4ff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    color: #4A6CFF;
    font-size: 14px;
  }
  .chat-doc {
    display: inline-block;
    padding: 8px 12px;
    background: rgba(0,0,0,0.05);
    border-radius: 8px;
    text-decoration: none;
    color: #4A6CFF;
    font-weight: 500;
  }
`;
document.head.appendChild(style);

/* USER STATE */
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

let activeConversationId = conversationIdParam || null;
let messages = [];
let otherUser = null;
let communityMembers = [];
let pollingInterval = null;

const BUBBLE_PALETTE = [
  { bg: "#4A6CFF", text: "#FFFFFF" },
  { bg: "#6F8CFF", text: "#FFFFFF" },
  { bg: "#8FA3FF", text: "#000000" }
];

/****************************************************
 * NAVBAR & NAVIGATION
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

function toggleMenu() {
  const menu = document.getElementById("mobileMenu");
  if (menu) menu.classList.toggle("show");
}

function logout() {
  localStorage.removeItem("contact_user");
  window.location.href = "index.html";
}

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
 * RENDERING ENGINE (UNIFIED)
 ****************************************************/
function renderMessageContent(msg) {
  if (msg.type === "image") {
    return `<img src="${msg.fileData}" class="chat-image" onclick="window.open(this.src)">`;
  }
  if (msg.type === "document") {
    return `<a href="${msg.fileData}" download="${msg.fileName}" class="chat-doc">📄 ${msg.fileName}</a>`;
  }
  return msg.text || "";
}

function renderMessages(list) {
  const container = document.getElementById("messages");
  if (!container) return;
  container.innerHTML = "";

  list.forEach((msg) => {
    const isMe = msg.senderEmail === loggedInUser.email;
    
    // Member/Sender Lookup
    let senderName, senderPic;
    if (isMe) {
      senderName = loggedInUser.fullName;
      senderPic = loggedInUser.profilePic;
    } else if (mode === "community") {
      const member = communityMembers.find(m => m.email === msg.senderEmail);
      senderName = member ? member.fullName : msg.senderEmail;
      senderPic = member ? member.profilePic : null;
    } else {
      senderName = otherUser?.fullName || finalOtherEmail;
      senderPic = otherUser?.profilePic;
    }

    const initials = getInitials(senderName);
    const avatarHTML = senderPic 
      ? `<img class="chat-avatar" src="${senderPic}" />`
      : `<div class="chat-avatar-fallback">${initials}</div>`;

    const color = getUserColor(msg.senderEmail);
    const contentHTML = renderMessageContent(msg);

    const row = document.createElement("div");
    row.style.cssText = `display:flex; align-items:flex-start; margin-bottom:18px; gap:12px; ${isMe ? 'flex-direction:row-reverse;' : ''}`;

    row.innerHTML = `
      <div style="width:60px; text-align:center; flex-shrink:0;">
        ${avatarHTML}
        <div style="font-size:11px; color:#666; margin-top:4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
          ${senderName.split(' ')[0]}
        </div>
      </div>
      <div style="max-width:70%; ${isMe ? 'display:flex; justify-content:flex-end;' : ''}">
        <div style="background:${isMe ? color.bg : '#f0f0f0'}; color:${isMe ? color.text : '#333'}; padding:12px 16px; border-radius:18px; border-${isMe ? 'tr' : 'tl'}-radius:2px; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">
          ${contentHTML}
        </div>
      </div>
    `;
    container.appendChild(row);
  });
  container.scrollTop = container.scrollHeight;
}

/****************************************************
 * COMMUNITY MEMBER MANAGEMENT
 ****************************************************/
async function primeCommunityMembers() {
  const cached = JSON.parse(localStorage.getItem("cached_members_" + communityId) || "[]");
  if (cached.length) {
    communityMembers = cached;
    renderCommunityMembersList(cached);
  }
  await loadCommunityMembers();
}

async function loadCommunityMembers() {
  const r = await fetch(`${API_URL}?module=getCommunityMembers&communityId=${communityId}`);
  const d = await r.json();
  const emails = (d.members || []).map(m => typeof m === "string" ? m : m.email);
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
  localStorage.setItem("cached_members_" + communityId, JSON.stringify(fullProfiles));
  renderCommunityMembersList(fullProfiles);
  renderMessages(messages); 
}

function renderCommunityMembersList(list) {
  const container = document.getElementById("memberSidebar");
  if (!container) return;
  container.innerHTML = "<h3>Members</h3>";
  list.forEach((m) => {
    const avatarHTML = m.profilePic 
      ? `<img class="chat-avatar" src="${m.profilePic}" style="width:30px;height:30px;"/>`
      : `<div class="chat-avatar-fallback" style="width:30px;height:30px;font-size:10px;">${getInitials(m.fullName)}</div>`;
    
    container.innerHTML += `
      <div class="member" style="display:flex; align-items:center; gap:10px; margin-bottom:12px; cursor:pointer;" onclick="window.location.href='public-profile.html?email=${encodeURIComponent(m.email)}'">
        ${avatarHTML}
        <div style="font-weight:600; font-size:14px;">${m.fullName}</div>
      </div>
    `;
  });
}

/****************************************************
 * MESSAGING LOGIC
 ****************************************************/
async function loadMessages() {
  if (!activeConversationId) return;
  const r = await fetch(`${API_URL}?module=getMessages&conversationId=${activeConversationId}`);
  const data = await r.json();
  let backendMessages = (data.messages || []).slice(-15);
  const optimistic = messages.filter(m => m.optimistic);
  messages = [...backendMessages, ...optimistic];
  renderMessages(messages);
}

function startPolling() {
  if (pollingInterval) clearInterval(pollingInterval);
  loadMessages();
  pollingInterval = setInterval(() => { if (activeConversationId) loadMessages(); }, 2000);
}

function sendMessage(payloadOverride = null) {
  const input = document.getElementById("messageInput");
  const text = (input?.value || "").trim();
  if (!payloadOverride && !text) return;

  const payload = payloadOverride || { module: "sendMessage", type: "text", text: text };
  
  // Optimistic UI
  const opt = { ...payload, senderEmail: loggedInUser.email, optimistic: true, timestamp: Date.now() };
  messages.push(opt);
  renderMessages(messages);
  if (input) input.value = "";

  if (payload.type === "text") {
    const getUrl = `${API_URL}?module=sendMessage&conversationId=${encodeURIComponent(activeConversationId)}&senderEmail=${encodeURIComponent(loggedInUser.email)}&type=text&text=${encodeURIComponent(payload.text)}`;
    fetch(getUrl).then(() => loadMessages());
  } else {
    fetch(API_URL, { 
        method: "POST", 
        body: JSON.stringify({ ...payload, conversationId: activeConversationId, senderEmail: loggedInUser.email }) 
    }).then(() => loadMessages());
  }
}

/****************************************************
 * INITIALIZATION
 ****************************************************/
document.addEventListener("DOMContentLoaded", async () => {
  loadNavbar();

  if (mode === "private") {
    const sidebar = document.getElementById("memberSidebar");
    if (sidebar) sidebar.style.display = "none";
    
    const r = await fetch(`${API_URL}?module=getUserByEmail&email=${encodeURIComponent(finalOtherEmail)}`);
    const d = await r.json();
    otherUser = d?.user || {};
    document.getElementById("headerTitle").innerText = chatTitle || otherUser.fullName || finalOtherEmail;
    
    fetch(`${API_URL}?module=startConversation&userEmail=${loggedInUser.email}&otherEmail=${finalOtherEmail}`)
      .then(r => r.json()).then(d => { activeConversationId = d.conversationId; startPolling(); });
  } else {
    // Community Mode
    const r = await fetch(`${API_URL}?module=getCommunityById&communityId=${communityId}`);
    const d = await r.json();
    document.getElementById("headerTitle").innerText = d?.community?.name || "Community";
    
    await primeCommunityMembers();
    
    const convR = await fetch(`${API_URL}?module=startCommunityConversation&communityId=${communityId}&userEmail=${loggedInUser.email}`);
    const convD = await convR.json();
    activeConversationId = convD.conversationId;
    startPolling();
  }

  // Setup UI Listeners
  document.getElementById("sendBtn").onclick = () => sendMessage();
  document.getElementById("messageInput").onkeydown = (e) => { if (e.key === "Enter") sendMessage(); };
  
  const setupFile = (btnId, inputId, type) => {
    document.getElementById(btnId).onclick = () => document.getElementById(inputId).click();
    document.getElementById(inputId).onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        const base64 = await fileToBase64(file);
        sendMessage({ type, fileName: file.name, fileData: base64 });
      }
    };
  };
  setupFile("uploadImgBtn", "imgInput", "image");
  setupFile("uploadDocBtn", "docInput", "document");
});

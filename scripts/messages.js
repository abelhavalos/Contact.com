/****************************************************
 * CONTACT.COM — PRODUCTION MESSAGES.JS
 * Supports: Private, Community, and Event Modes
 ****************************************************/

const API_URL = "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

/* 1. STATE & PARAMS */
let loggedInUser = JSON.parse(localStorage.getItem("contact_user"));
if (!loggedInUser) window.location.href = "login.html";

// Normalize user data
loggedInUser.fullName = loggedInUser.fullName || loggedInUser.FullName || loggedInUser.email;
loggedInUser.profilePic = loggedInUser.profilePic || loggedInUser.ProfilePic || null;

const url = new URL(window.location.href);
const communityId = url.searchParams.get("communityId");
const eventId = url.searchParams.get("eventId");
const otherEmailParam = url.searchParams.get("otherEmail") || url.searchParams.get("email");

// Determine Mode
let mode = "private";
if (communityId) mode = "community";
else if (eventId) mode = "event";

let chatTitle = url.searchParams.get("title") || "";
let activeConversationId = url.searchParams.get("conversationId") || null;
let groupMembers = []; 
let otherUser = null;
let pollingInterval = null; 
let renderedMessageIds = new Set();

const BUBBLE_PALETTE = [
  { bg: "#4A6CFF", text: "#FFFFFF" },
  { bg: "#6F8CFF", text: "#FFFFFF" },
  { bg: "#8FA3FF", text: "#000000" },
  { bg: "#AFC0FF", text: "#000000" },
  { bg: "#D1DDFF", text: "#000000" }
];

/****************************************************
 * 2. HELPERS
 ****************************************************/
function showChatLoader() { document.getElementById("chatLoader") && (document.getElementById("chatLoader").style.display = "flex"); }
function hideChatLoader() { document.getElementById("chatLoader") && (document.getElementById("chatLoader").style.display = "none"); }

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

function openImageModal(imgSrc) {
  const modal = document.getElementById("imageModal");
  const modalImg = document.getElementById("modalImage");
  if (modal && modalImg) { modal.style.display = "flex"; modalImg.src = imgSrc; }
}

function closeImageModal() {
  const modal = document.getElementById("imageModal");
  if (modal) modal.style.display = "none";
}

/****************************************************
 * 3. UI COMPONENTS & NAVBAR
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
  if (mobileMenu) mobileMenu.innerHTML = navHTML.replace('class="nav-links"', 'class="mobile-nav-links"');
}

function initImageModal() {
  if (document.getElementById("imageModal")) return;
  const modal = document.createElement("div");
  modal.id = "imageModal";
  modal.innerHTML = `<span id="modalClose">&times;</span><img id="modalImage">`;
  modal.onclick = (e) => { if (e.target.id === "imageModal" || e.target.id === "modalClose") closeImageModal(); };
  document.body.appendChild(modal);
}

function toggleMenu() { document.getElementById("mobileMenu")?.classList.toggle("show"); }

function logout() {
  if (pollingInterval) clearInterval(pollingInterval);
  localStorage.removeItem("contact_user");
  window.location.href = "index.html";
}

/****************************************************
 * 4. DATA FETCHING (UNIFIED)
 ****************************************************/
async function loadChatHeaderInfo() {
  const header = document.getElementById("headerTitle");
  if (!header) return;

  if (mode === "private") {
    const r = await fetch(`${API_URL}?module=getUserByEmail&email=${encodeURIComponent(otherEmailParam)}`);
    const d = await r.json();
    otherUser = d?.user || {};
    const name = otherUser.fullName || otherUser.FullName || otherEmailParam;
    const pic = otherUser.profilePic || otherUser.ProfilePic;
    const avatar = pic ? `<img class="chat-avatar" src="${pic}" />` : `<div class="chat-avatar-fallback">${getInitials(name)}</div>`;
    header.innerHTML = `<div class="chat-header">${avatar}<div class="chat-header-main">${chatTitle || name}</div></div>`;
  } else {
    const mod = mode === "community" ? "getCommunityById" : "getEventById";
    const idParam = mode === "community" ? `communityId=${communityId}` : `eventId=${eventId}`;
    const r = await fetch(`${API_URL}?module=${mod}&${idParam}`);
    const d = await r.json();
    const name = d?.community?.name || d?.event?.title || "Group Chat";
    header.innerHTML = `<div class="chat-header"><div class="chat-header-main">${name}</div></div>`;
  }
}

async function loadGroupMembers() {
  if (mode === "private") return;
  const mod = mode === "community" ? "getCommunityMembers" : "getEventMembers";
  const idParam = mode === "community" ? `communityId=${communityId}` : `eventId=${eventId}`;

  try {
    const r = await fetch(`${API_URL}?module=${mod}&${idParam}`);
    const d = await r.json();
    const emails = (d.members || []).map(m => typeof m === "string" ? m : m.email);

    const tasks = emails.map(async (email) => {
      const res = await fetch(`${API_URL}?module=getUserByEmail&email=${encodeURIComponent(email)}`);
      const data = await res.json();
      const u = data?.user || {};
      return { email, fullName: u.fullName || u.FullName || email, profilePic: u.profilePic || u.ProfilePic || null };
    });

    groupMembers = await Promise.all(tasks);
    renderMembersSidebar(groupMembers);
  } catch (err) { console.error("Failed to load members", err); }
}

function renderMembersSidebar(list) {
  const container = document.getElementById("memberSidebar");
  if (!container) return;
  container.innerHTML = "<h3>Members</h3>";
  list.forEach(m => {
    const row = document.createElement("div");
    row.className = "member-row";
    row.style.cssText = "display:flex; align-items:center; gap:10px; cursor:pointer; margin-bottom:12px;";
    row.onclick = () => window.location.href = `public-profile.html?email=${encodeURIComponent(m.email)}`;
    
    const avatar = m.profilePic ? `<img class="chat-avatar" src="${m.profilePic}" />` : `<div class="chat-avatar-fallback">${getInitials(m.fullName)}</div>`;
    row.innerHTML = `${avatar}<div class="member-name">${m.fullName}</div>`;
    container.appendChild(row);
  });
}

/****************************************************
 * 5. MESSAGE LOGIC
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
    serverMessages.forEach(msg => {
      const uniqueKey = msg.id || `${msg.senderEmail}_${msg.timestamp}_${msg.text}`;
      const contentKey = msg.senderEmail === loggedInUser.email ? `sent_${msg.text || msg.fileName || ""}` : null;

      if (!renderedMessageIds.has(uniqueKey) && (!contentKey || !renderedMessageIds.has(contentKey))) {
        container.appendChild(buildMessageRow(msg));
        renderedMessageIds.add(uniqueKey);
        if (contentKey) renderedMessageIds.add(contentKey);
        addedCount++;
      }
    });

    if (addedCount > 0) container.scrollTop = container.scrollHeight;
  } catch (err) { console.warn("Polling error:", err); } 
  finally { if (showSpinner) hideChatLoader(); }
}

function sendMessage(payloadOverride = null) {
  const input = document.getElementById("messageInput");
  const text = (input?.value || "").trim();
  if (!payloadOverride && (!text || !activeConversationId)) return;

  const payload = payloadOverride || { module: "sendMessage", type: "text", text };
  const lockKey = `sent_${payload.text || payload.fileName || ""}`;
  renderedMessageIds.add(lockKey);

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
    fetch(API_URL, { method: "POST", mode: 'no-cors', body: JSON.stringify({ ...payload, conversationId: activeConversationId, senderEmail: loggedInUser.email }) });
  }
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
  } else if (mode === "community" || mode === "event") {
    const s = groupMembers.find(m => m.email === msg.senderEmail) || {};
    pic = s.profilePic;
    name = s.fullName || msg.senderEmail;
  } else {
    pic = otherUser?.profilePic || otherUser?.ProfilePic;
    name = otherUser?.fullName || otherEmailParam;
  }

  const avatarHTML = pic ? `<img class="chat-avatar" src="${pic}" />` : `<div class="chat-avatar-fallback">${getInitials(name)}</div>`;
  const bubble = document.createElement("div");
  bubble.style.cssText = `max-width:70%; padding:8px 12px; border-radius:16px; font-size:14px; background:${isMe ? color.bg : "#F3F4F6"}; color:${isMe ? color.text : "#111827"};`;
  
  if (msg.type === "image") {
    bubble.innerHTML = `<img src="${msg.fileData}" class="chat-image-preview" style="max-width:200px; border-radius:8px; cursor:pointer;">`;
    bubble.onclick = () => openImageModal(msg.fileData);
  } else if (msg.type === "document") {
    bubble.innerHTML = `<a href="${msg.fileData}" download="${msg.fileName}" style="color:inherit; text-decoration:none;">📄 ${msg.fileName}</a>`;
  } else {
    bubble.textContent = msg.text || "";
  }

  const avatarWrapper = document.createElement("div");
  avatarWrapper.style.cssText = "width:36px; display:flex; justify-content:center;";
  avatarWrapper.innerHTML = avatarHTML;

  if (isMe) { row.appendChild(bubble); row.appendChild(avatarWrapper); } 
  else { row.appendChild(avatarWrapper); row.appendChild(bubble); }
  return row;
}

function startPolling() {
  if (pollingInterval) clearInterval(pollingInterval);
  pollingInterval = setInterval(() => loadMessagesOnce(false), 4000);
}

/****************************************************
 * 6. INITIALIZATION
 ****************************************************/
function setupEventListeners() {
  document.getElementById("sendBtn")?.addEventListener("click", () => sendMessage());
  document.getElementById("messageInput")?.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
  document.getElementById("toggleMembers")?.addEventListener("click", () => document.getElementById("memberSidebar")?.classList.toggle("show"));

  // File Uploads
  const config = [{ b: "uploadDocBtn", i: "docInput", t: "document" }, { b: "uploadImgBtn", i: "imgInput", t: "image" }];
  config.forEach(cfg => {
    const btn = document.getElementById(cfg.b), inp = document.getElementById(cfg.i);
    if (!btn || !inp) return;
    btn.onclick = () => inp.click();
    inp.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        const b64 = await fileToBase64(file);
        sendMessage({ module: "sendMessage", type: cfg.t, fileName: file.name, fileData: b64 });
      }
      e.target.value = ""; 
    };
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  loadNavbar();
  initImageModal();
  setupEventListeners();
  showChatLoader();

  const backgroundTasks = [loadChatHeaderInfo(), loadGroupMembers()];
  
  try {
    if (!activeConversationId) {
      let mod = "startConversation", params = `&otherEmail=${encodeURIComponent(otherEmailParam)}`;
      if (mode === "community") { mod = "startCommunityConversation"; params = `&communityId=${communityId}`; }
      else if (mode === "event") { mod = "startEventConversation"; params = `&eventId=${eventId}`; }

      const r = await fetch(`${API_URL}?module=${mod}&userEmail=${loggedInUser.email}${params}`);
      const d = await r.json();
      activeConversationId = d.conversationId;
    }

    await Promise.all(backgroundTasks);
    if (activeConversationId) { await loadMessagesOnce(true); startPolling(); } 
    else { hideChatLoader(); }
  } catch (err) { console.error("Init failed", err); hideChatLoader(); }
});

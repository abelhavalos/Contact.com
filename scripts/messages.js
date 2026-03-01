/****************************************************
 * CONTACT.COM — MESSAGES.JS (V17 - FINAL THEME)
 * - Fixed: File Picker Recursion
 * - Fixed: Desktop/Mobile Sidebar Logic
 * - Theme: Left-anchored Navbar & Member List
 ****************************************************/

const API_URL = "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

/* USER & PARAMS */
let loggedInUser = JSON.parse(localStorage.getItem("contact_user"));
if (!loggedInUser) window.location.href = "login.html";
loggedInUser.fullName = loggedInUser.fullName || loggedInUser.FullName || loggedInUser.email;

const url = new URL(window.location.href);
const otherEmailParam = url.searchParams.get("otherEmail") || url.searchParams.get("email");
const communityId = url.searchParams.get("communityId");
const mode = communityId ? "community" : "private";

/* STATE */
let activeConversationId = url.searchParams.get("conversationId") || null;
let messages = [];
let communityMembers = [];
let otherUser = null;

const BUBBLE_PALETTE = [
  { bg: "#4A6CFF", text: "#FFFFFF" },
  { bg: "#6F8CFF", text: "#FFFFFF" },
  { bg: "#8FA3FF", text: "#000000" }
];

/****************************************************
 * HELPERS
 ****************************************************/
function getInitials(name) {
  if (!name) return "?";
  return name.split(" ").filter(Boolean).map(p => p[0]).join("").substring(0, 2).toUpperCase();
}

function fileToBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

/****************************************************
 * NAVBAR & UI THEME
 ****************************************************/
function loadNavbar() {
  const nav = document.getElementById("navbar");
  if (!nav) return;
  
  const navLinks = `
    <a href="dashboard.html">Dashboard</a>
    <a href="communities.html">Communities</a>
    <a href="events.html">Events</a>
    <a href="contacts.html">Contacts</a>
    <a href="profile.html">Profile</a>
    <a href="#" onclick="logout()" style="color:#ff4a4a !important;">Logout</a>
  `;

  nav.innerHTML = `
    <div class="hamburger" onclick="toggleMenu()"><span></span><span></span><span></span></div>
    <div class="logo">Contact<span>.</span>com</div>
    <div class="nav-links">${navLinks}</div>
  `;
  const mobileMenu = document.getElementById("mobileMenu");
  if (mobileMenu) mobileMenu.innerHTML = navLinks;
}

function toggleMenu() { document.getElementById("mobileMenu").classList.toggle("show"); }
function logout() { localStorage.removeItem("contact_user"); window.location.href = "index.html"; }

/****************************************************
 * COMMUNITY MEMBERS
 ****************************************************/
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
    } catch { return { email, fullName: email, profilePic: null }; }
  });

  communityMembers = await Promise.all(tasks);
  renderCommunityMembersList(communityMembers);
}

function renderCommunityMembersList(list) {
  const container = document.getElementById("memberSidebar");
  if (!container) return;

  container.innerHTML = "<h3>Participants</h3>";
  list.forEach((m) => {
    const initials = getInitials(m.fullName);
    const avatar = m.profilePic 
      ? `<img class="chat-avatar" src="${m.profilePic}" />`
      : `<div class="chat-avatar-fallback">${initials}</div>`;

    const row = document.createElement("div");
    row.className = "member";
    row.style = "display:flex; align-items:center; gap:10px; margin-bottom:12px; cursor:pointer;";
    row.onclick = () => window.location.href = `public-profile.html?email=${encodeURIComponent(m.email)}`;
    row.innerHTML = `${avatar}<div class="member-name" style="font-weight:600; font-size:14px;">${m.fullName}</div>`;
    container.appendChild(row);
  });
}

/****************************************************
 * RENDERING ENGINE
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

function renderAllMessages(list) {
  const container = document.getElementById("messages");
  if (!container) return;
  container.innerHTML = "";
  list.forEach((msg) => container.appendChild(buildMessageRow(msg)));
  container.scrollTop = container.scrollHeight;
}

function buildMessageRow(msg) {
  const isMe = msg.senderEmail === loggedInUser.email;
  const row = document.createElement("div");
  row.className = "msg-row";
  row.style = `display:flex; margin-bottom:12px; gap:8px; align-items:flex-end; justify-content:${isMe ? 'flex-end' : 'flex-start'};`;

  const bubble = document.createElement("div");
  bubble.style = `max-width:75%; padding:10px 14px; border-radius:18px; font-size:14px; background:${isMe ? '#4A6CFF' : '#F3F4F6'}; color:${isMe ? '#fff' : '#111'};`;
  
  if (msg.type === "image") {
    bubble.innerHTML = `<img src="${msg.fileData}" style="max-width:100%; border-radius:10px; cursor:pointer;" onclick="window.open(this.src)">`;
  } else if (msg.type === "document") {
    bubble.innerHTML = `<a href="${msg.fileData}" download="${msg.fileName}" style="color:inherit; font-weight:700;">📄 ${msg.fileName}</a>`;
  } else {
    bubble.innerText = msg.text || "";
  }

  row.appendChild(bubble);
  return row;
}

/****************************************************
 * SEND & FILE PICKERS (FIXED)
 ****************************************************/
async function sendMessage(payloadOverride = null) {
  const input = document.getElementById("messageInput");
  const text = (input?.value || "").trim();
  if (!payloadOverride && !text) return;

  const payload = payloadOverride || { module: "sendMessage", type: "text", text };
  if (input) input.value = "";

  // Optimistic UI
  messages.push({ ...payload, senderEmail: loggedInUser.email });
  renderAllMessages(messages);

  const body = JSON.stringify({
    module: "sendMessage",
    conversationId: activeConversationId,
    senderEmail: loggedInUser.email,
    ...payload
  });

  await fetch(API_URL, { method: "POST", body });
  loadMessagesOnce();
}

function setupPickers() {
  const btnImg = document.getElementById("uploadImgBtn");
  const inImg = document.getElementById("imgInput");
  const btnDoc = document.getElementById("uploadDocBtn");
  const inDoc = document.getElementById("docInput");

  // Re-attach fresh listeners to prevent looping
  if (btnImg && inImg) {
    const newBtnImg = btnImg.cloneNode(true);
    btnImg.parentNode.replaceChild(newBtnImg, btnImg);
    newBtnImg.onclick = (e) => { e.stopImmediatePropagation(); inImg.click(); };
    inImg.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const base64 = await fileToBase64(file);
      await sendMessage({ type: "image", fileName: file.name, fileData: base64 });
      e.target.value = "";
    };
  }

  if (btnDoc && inDoc) {
    const newBtnDoc = btnDoc.cloneNode(true);
    btnDoc.parentNode.replaceChild(newDocBtn, btnDoc);
    newBtnDoc.onclick = (e) => { e.stopImmediatePropagation(); inDoc.click(); };
    inDoc.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const base64 = await fileToBase64(file);
      await sendMessage({ type: "document", fileName: file.name, fileData: base64 });
      e.target.value = "";
    };
  }
}

/****************************************************
 * DOM READY
 ****************************************************/
document.addEventListener("DOMContentLoaded", async () => {
  loadNavbar();
  setupPickers();

  const toggle = document.getElementById("toggleMembers");
  const sidebar = document.getElementById("memberSidebar");

  if (mode === "private") {
    if (toggle) toggle.style.display = "none";
    if (sidebar) sidebar.style.display = "none";
  } else {
    await loadCommunityMembers();
    if (toggle) {
        toggle.onclick = () => sidebar.classList.toggle("show");
    }
  }

  // Conversation setup
  if (!activeConversationId) {
    const setupUrl = mode === "community" 
      ? `${API_URL}?module=startCommunityConversation&communityId=${communityId}&userEmail=${loggedInUser.email}`
      : `${API_URL}?module=startConversation&userEmail=${loggedInUser.email}&otherEmail=${otherEmailParam}`;
    const r = await fetch(setupUrl);
    const d = await r.json();
    activeConversationId = d.conversationId;
  }

  loadMessagesOnce();
  
  document.getElementById("sendBtn").onclick = () => sendMessage();
  document.getElementById("messageInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
});

function showChatLoader() { const el = document.getElementById("chatLoader"); if (el) el.style.display = "flex"; }
function hideChatLoader() { const el = document.getElementById("chatLoader"); if (el) el.style.display = "none"; }

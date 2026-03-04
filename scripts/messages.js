/****************************************************
 * CONTACT.COM — FULL MESSAGES.JS (NON-BLOCKING UI)
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
const finalOtherEmail = otherEmailParam || url.searchParams.get("email");
let chatTitle = url.searchParams.get("title") || "";

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
 * HELPERS & UI SETUP
 ****************************************************/
function getUserColor(email) {
  if (!email) return BUBBLE_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < email.length; i++) hash = (hash << 5) - hash + email.charCodeAt(i);
  return BUBBLE_PALETTE[Math.abs(hash) % BUBBLE_PALETTE.length];
}

function getInitials(name) {
  if (!name) return "?";
  return name.split(" ").filter(Boolean).map(p => p[0]).join("").substring(0, 2).toUpperCase();
}

async function fileToBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

function loadNavbar() {
  const nav = document.getElementById("navbar");
  if (nav) {
    nav.innerHTML = `<div class="hamburger" onclick="toggleMenu()"><span></span><span></span><span></span></div>
      <div class="logo">Contact<span>.</span>com</div>
      <div class="nav-links">
        <a href="dashboard.html">Dashboard</a><a href="communities.html">Communities</a>
        <a href="events.html">Events</a><a href="contacts.html">Contacts</a>
        <a href="profile.html">Profile</a><a href="#" onclick="logout()">Logout</a>
      </div>`;
  }
}
function toggleMenu() { document.getElementById("mobileMenu")?.classList.toggle("show"); }
function logout() { localStorage.removeItem("contact_user"); window.location.href = "index.html"; }

/****************************************************
 * CORE MESSAGING
 ****************************************************/
async function loadMessages() {
  if (!activeConversationId) return;
  try {
    const r = await fetch(`${API_URL}?module=getMessages&conversationId=${activeConversationId}`);
    const data = await r.json();
    let backendMessages = (data.messages || []).slice(-15);
    const optimistic = messages.filter(m => m.optimistic);
    messages = [...backendMessages, ...optimistic];
    renderMessages(messages);
  } catch (e) { console.error("Poll error", e); }
}

function startPolling() {
  if (pollingInterval) clearInterval(pollingInterval);
  loadMessages();
  pollingInterval = setInterval(loadMessages, 2000);
}

function renderMessages(list) {
  const container = document.getElementById("messages");
  if (!container) return;
  container.innerHTML = "";

  list.forEach((msg) => {
    const isMe = msg.senderEmail === loggedInUser.email;
    const color = getUserColor(msg.senderEmail);
    const content = msg.type === "image" ? `<img src="${msg.fileData}" style="max-width:200px;border-radius:10px;">` : (msg.text || "");
    
    container.innerHTML += `
      <div style="display:flex; justify-content:${isMe ? 'flex-end' : 'flex-start'}; margin-bottom:15px;">
        <div style="background:${isMe ? color.bg : '#eee'}; color:${isMe ? color.text : '#333'}; padding:10px 14px; border-radius:14px; max-width:70%;">
          ${content}
        </div>
      </div>`;
  });
  container.scrollTop = container.scrollHeight;
}

async function sendMessage(payloadOverride = null) {
  const input = document.getElementById("messageInput");
  const text = (input?.value || "").trim();
  if (!payloadOverride && (!text || !activeConversationId)) return;

  const payload = payloadOverride || { type: "text", text: text };
  
  // Optimistic Update
  messages.push({ senderEmail: loggedInUser.email, text: payload.text, type: payload.type, fileData: payload.fileData, optimistic: true });
  renderMessages(messages);
  if (input) input.value = "";

  const params = `module=sendMessage&conversationId=${activeConversationId}&senderEmail=${loggedInUser.email}&type=${payload.type}&text=${encodeURIComponent(payload.text || "")}`;
  
  if (payload.type === "text") {
    await fetch(`${API_URL}?${params}`);
  } else {
    await fetch(API_URL, { method: "POST", body: JSON.stringify({ module: "sendMessage", conversationId: activeConversationId, senderEmail: loggedInUser.email, ...payload }) });
  }
  loadMessages();
}

/****************************************************
 * INITIALIZATION (THE FIX)
 ****************************************************/
document.addEventListener("DOMContentLoaded", () => {
  // 1. Setup UI & Navbar IMMEDIATELY
  loadNavbar();
  const input = document.getElementById("messageInput");
  const btn = document.getElementById("sendBtn");
  
  // FORCE ENABLE
  if (input) { input.disabled = false; input.focus(); }
  if (btn) { btn.disabled = false; btn.style.opacity = "1"; }

  // 2. ATTACH LISTENERS IMMEDIATELY (Don't wait for API)
  if (btn) btn.onclick = () => sendMessage();
  if (input) {
    input.onkeydown = (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    };
  }

  // 3. Kick off async background tasks
  initializeApp();
});

async function initializeApp() {
  // A. Start Conversation
  if (!activeConversationId) {
    const startUrl = mode === "community" 
      ? `${API_URL}?module=startCommunityConversation&communityId=${communityId}&userEmail=${loggedInUser.email}`
      : `${API_URL}?module=startConversation&userEmail=${loggedInUser.email}&otherEmail=${finalOtherEmail}`;
    
    const r = await fetch(startUrl);
    const d = await r.json();
    activeConversationId = d.conversationId;
  }

  // B. Load Profiles/Community Info in Background
  if (mode === "private") {
    fetch(`${API_URL}?module=getUserByEmail&email=${encodeURIComponent(finalOtherEmail)}`)
      .then(r => r.json()).then(d => {
        otherUser = d.user;
        document.getElementById("headerTitle").innerText = chatTitle || d.user.fullName || finalOtherEmail;
      });
  } else {
    // Start community loading without blocking the polling
    loadCommunityInfo();
    primeCommunityMembers();
  }

  // C. Start polling once we have an ID
  if (activeConversationId) startPolling();
}

// Keep your existing helper functions for community
async function loadCommunityInfo() {
  const r = await fetch(`${API_URL}?module=getCommunityById&communityId=${communityId}`);
  const d = await r.json();
  document.getElementById("headerTitle").innerText = d?.community?.name || "Community";
}

async function primeCommunityMembers() {
  const r = await fetch(`${API_URL}?module=getCommunityMembers&communityId=${communityId}`);
  const d = await r.json();
  const emails = (d.members || []).map(m => typeof m === "string" ? m : m.email);
  // Hydrate profiles in background
  for (const email of emails) {
    fetch(`${API_URL}?module=getUserByEmail&email=${encodeURIComponent(email)}`)
      .then(res => res.json()).then(pd => {
        const u = pd?.user || {};
        communityMembers.push({ email, fullName: u.fullName || email, profilePic: u.profilePic || null });
      });
  }
}

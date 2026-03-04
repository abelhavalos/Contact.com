/****************************************************
 * CONTACT.COM — FAST MESSAGES.JS (FORCE ENABLED UI)
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
const finalOtherEmail = otherEmailParam || paramEmail;
let chatTitle = url.searchParams.get("title") || "";

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
 * HELPERS (getUserColor, getInitials, fileToBase64) 
 * (Same as your original code)
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
 * UI COMPONENTS (Navbar, Cache, Rendering)
 * (Logic preserved from your original code)
 ****************************************************/
function loadNavbar() {
  const nav = document.getElementById("navbar");
  if (nav) {
    nav.innerHTML = `
      <div class="hamburger" onclick="toggleMenu()"><span></span><span></span><span></span></div>
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

function renderMessages(list) {
  const container = document.getElementById("messages");
  if (!container) return;
  container.innerHTML = "";

  list.forEach((msg) => {
    const isMe = msg.senderEmail === loggedInUser.email;
    const contentHTML = msg.type === "image" ? `<img src="${msg.fileData}" class="chat-image">` : (msg.text || "");
    const color = getUserColor(msg.senderEmail);

    container.innerHTML += `
      <div style="display:flex; justify-content:${isMe ? 'flex-end' : 'flex-start'}; margin-bottom:18px; gap:10px;">
        <div style="max-width:60%; background:${isMe ? color.bg : '#F0F0F0'}; color:${isMe ? color.text : '#333'}; padding:10px 14px; border-radius:14px;">
          ${contentHTML}
        </div>
      </div>`;
  });
  container.scrollTop = container.scrollHeight;
}

/****************************************************
 * MESSAGING LOGIC
 ****************************************************/
async function loadMessages() {
  if (!activeConversationId) return;
  try {
    const r = await fetch(`${API_URL}?module=getMessages&conversationId=${activeConversationId}`);
    const data = await r.json();
    let backendMessages = (data.messages || []).slice(-10);
    const optimistic = messages.filter((m) => m.optimistic);
    messages = [...backendMessages, ...optimistic];
    renderMessages(messages);
  } catch (e) { console.error("Polling error", e); }
}

function startPolling() {
  if (pollingInterval) clearInterval(pollingInterval);
  loadMessages();
  pollingInterval = setInterval(() => { if (activeConversationId) loadMessages(); }, 1500);
}

function sendMessage(payloadOverride = null) {
  const input = document.getElementById("messageInput");
  const text = (input?.value || "").trim();

  if (!payloadOverride && (!text || !activeConversationId)) {
      if (!activeConversationId && text) alert("Still connecting to chat...");
      return;
  }

  const payload = payloadOverride || { module: "sendMessage", type: "text", text: text };

  // Optimistic UI
  messages.push({ senderEmail: loggedInUser.email, text: payload.text, type: payload.type, optimistic: true });
  renderMessages(messages);
  if (input) input.value = "";

  // Sending Logic (GET for text, POST for files)
  if (payload.type === "text") {
    fetch(`${API_URL}?module=sendMessage&conversationId=${activeConversationId}&senderEmail=${loggedInUser.email}&type=text&text=${encodeURIComponent(payload.text)}`)
      .then(() => loadMessages());
  } else {
    fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ module: "sendMessage", conversationId: activeConversationId, senderEmail: loggedInUser.email, ...payload })
    }).then(() => loadMessages());
  }
}

/****************************************************
 * DOM READY — THE FIX
 ****************************************************/
document.addEventListener("DOMContentLoaded", () => {
  // 1. Immediate UI setup (Non-blocking)
  loadNavbar();
  
  const sendBtn = document.getElementById("sendBtn");
  const messageInput = document.getElementById("messageInput");

  // 2. FORCE ENABLE & ATTACH LISTENERS FIRST
  if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.style.opacity = "1";
      sendBtn.onclick = () => sendMessage();
  }
  
  if (messageInput) {
      messageInput.disabled = false;
      messageInput.addEventListener("keydown", (e) => {
          if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
          }
      });
  }

  // 3. Start Background Tasks (Don't 'await' them here)
  initializeChatFlow();
});

async function initializeChatFlow() {
    // Hide/Show sidebars based on mode
    if (mode === "private") {
        document.getElementById("toggleMembers")?.style.setProperty("display", "none");
        document.getElementById("memberSidebar")?.style.setProperty("display", "none");
    }

    // Load Header Info
    if (mode === "community") {
        loadCommunityInfo(); // Async but non-blocking
        primeCommunityMembers();
    } else {
        loadOtherUserProfile();
    }

    // Set up Conversation ID
    if (activeConversationId) {
        startPolling();
    } else if (mode === "community") {
        const r = await fetch(`${API_URL}?module=startCommunityConversation&communityId=${communityId}&userEmail=${loggedInUser.email}`);
        const d = await r.json();
        activeConversationId = d.conversationId;
        startPolling();
    } else if (finalOtherEmail) {
        const r = await fetch(`${API_URL}?module=startConversation&userEmail=${loggedInUser.email}&otherEmail=${finalOtherEmail}`);
        const d = await r.json();
        activeConversationId = d.conversationId;
        startPolling();
    }
}

// Background loading helpers
async function loadOtherUserProfile() {
    const r = await fetch(`${API_URL}?module=getUserByEmail&email=${encodeURIComponent(finalOtherEmail)}`);
    const d = await r.json();
    otherUser = d?.user || {};
    document.getElementById("headerTitle").innerText = chatTitle || otherUser.fullName || finalOtherEmail;
}

async function loadCommunityInfo() {
    const r = await fetch(`${API_URL}?module=getCommunityById&communityId=${communityId}`);
    const d = await r.json();
    document.getElementById("headerTitle").innerText = d?.community?.name || "Community";
}

async function primeCommunityMembers() {
    // Basic implementation to fill sidebar
    const r = await fetch(`${API_URL}?module=getCommunityMembers&communityId=${communityId}`);
    const d = await r.json();
    // (Your existing member hydration logic can go here)
}

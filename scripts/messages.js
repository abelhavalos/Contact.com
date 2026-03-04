/****************************************************
 * CONTACT.COM — FAST MESSAGES.JS (FIXED)
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
 * UI HELPERS
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

function getInitials(name) {
  if (!name) return "?";
  return name.split(" ").filter(Boolean).map(p => p[0]).join("").substring(0, 2).toUpperCase();
}

function getUserColor(email) {
  let hash = 0;
  for (let i = 0; i < email.length; i++) hash = (hash << 5) - hash + email.charCodeAt(i);
  return BUBBLE_PALETTE[Math.abs(hash) % BUBBLE_PALETTE.length];
}

/****************************************************
 * CORE MESSAGING LOGIC
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
    let sender = communityMembers.find(m => m.email === msg.senderEmail);
    
    let name = isMe ? "Me" : (sender?.fullName || msg.senderEmail);
    let pic = isMe ? loggedInUser.profilePic : (sender?.profilePic || null);
    const color = getUserColor(msg.senderEmail);

    const row = document.createElement("div");
    row.style.cssText = `display:flex; justify-content:${isMe ? 'flex-end' : 'flex-start'}; margin-bottom:15px; gap:10px;`;
    
    row.innerHTML = `
      <div style="max-width:75%; ${isMe ? 'text-align:right' : ''}">
        <div style="font-size:10px; color:#888; margin-bottom:2px;">${name}</div>
        <div style="background:${isMe ? color.bg : '#eee'}; color:${isMe ? color.text : '#333'}; padding:10px 14px; border-radius:14px; display:inline-block;">
          ${msg.type === "image" ? `<img src="${msg.fileData}" style="max-width:200px; border-radius:8px;">` : (msg.text || "")}
        </div>
      </div>
    `;
    container.appendChild(row);
  });
  container.scrollTop = container.scrollHeight;
}

async function sendMessage() {
  const input = document.getElementById("messageInput");
  const text = input.value.trim();
  if (!text || !activeConversationId) return;

  messages.push({ senderEmail: loggedInUser.email, text: text, optimistic: true });
  renderMessages(messages);
  input.value = "";

  const sendUrl = `${API_URL}?module=sendMessage&conversationId=${activeConversationId}&senderEmail=${loggedInUser.email}&type=text&text=${encodeURIComponent(text)}`;
  await fetch(sendUrl);
  loadMessages();
}

/****************************************************
 * HYDRATION (BACKGROUND)
 ****************************************************/
async function hydrateMembers() {
  const r = await fetch(`${API_URL}?module=getCommunityMembers&communityId=${communityId}`);
  const d = await r.json();
  const emails = (d.members || []).map(m => typeof m === "string" ? m : m.email);
  
  for (const email of emails) {
    const pr = await fetch(`${API_URL}?module=getUserByEmail&email=${encodeURIComponent(email)}`);
    const pd = await pr.json();
    const u = pd?.user || {};
    communityMembers.push({
      email,
      fullName: u.fullName || u.FullName || email,
      profilePic: u.profilePic || u.ProfilePic || null
    });
  }
  renderMessages(messages); // Refresh once names are known
}

/****************************************************
 * DOM READY
 ****************************************************/
document.addEventListener("DOMContentLoaded", async () => {
  loadNavbar();

  // 1. Get/Start Conversation Immediately
  let startUrl = mode === "community" 
    ? `${API_URL}?module=startCommunityConversation&communityId=${communityId}&userEmail=${loggedInUser.email}`
    : `${API_URL}?module=startConversation&userEmail=${loggedInUser.email}&otherEmail=${finalOtherEmail}`;

  try {
    const res = await fetch(startUrl);
    const data = await res.json();
    activeConversationId = data.conversationId;
    
    // 2. Once ID exists, start the UI
    if (activeConversationId) {
      startPolling();
      
      // Setup Send Button
      document.getElementById("sendBtn").onclick = sendMessage;
      document.getElementById("messageInput").onkeydown = (e) => {
        if (e.key === "Enter") sendMessage();
      };
    }
  } catch (e) { console.error("Initialization failed", e); }

  // 3. Load Metadata in background (Don't 'await' these, let them run)
  if (mode === "community") {
    hydrateMembers();
  } else {
    fetch(`${API_URL}?module=getUserByEmail&email=${encodeURIComponent(finalOtherEmail)}`)
      .then(r => r.json())
      .then(d => {
        otherUser = d.user;
        document.getElementById("headerTitle").innerText = chatTitle || d.user.fullName || finalOtherEmail;
      });
  }
});

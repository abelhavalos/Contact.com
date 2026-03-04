/****************************************************
 * CONTACT.COM — FULL MESSAGES.JS (ASYNC LOAD FIX)
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
 * NAVBAR & NAVIGATION
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
function toggleMenu() { const menu = document.getElementById("mobileMenu"); if (menu) menu.classList.toggle("show"); }
function logout() { localStorage.removeItem("contact_user"); window.location.href = "index.html"; }

/****************************************************
 * DATA FETCHING & POLLING
 ****************************************************/
function startPolling() {
  if (pollingInterval) clearInterval(pollingInterval);
  loadMessages(); // Initial load
  pollingInterval = setInterval(() => {
    if (activeConversationId) loadMessages();
  }, 1500);
}

async function loadMessages() {
  try {
    const r = await fetch(`${API_URL}?module=getMessages&conversationId=${activeConversationId}`);
    const data = await r.json();
    let backendMessages = (data.messages || []).slice(-15);
    const optimistic = messages.filter(m => m.optimistic);
    messages = [...backendMessages, ...optimistic];
    renderMessages(messages);
  } catch (e) { console.error("Polling error:", e); }
}

async function loadOtherUserProfile() {
  if (!finalOtherEmail) return;
  const r = await fetch(`${API_URL}?module=getUserByEmail&email=${encodeURIComponent(finalOtherEmail)}`);
  const d = await r.json();
  otherUser = d?.user || {};
  document.getElementById("headerTitle").innerText = chatTitle || otherUser.fullName || finalOtherEmail;
}

async function primeCommunityMembers() {
  const cached = JSON.parse(localStorage.getItem("cached_members_" + communityId) || "[]");
  if (cached.length) {
    communityMembers = cached;
    renderCommunityMembersList(cached);
  }
  
  const r = await fetch(`${API_URL}?module=getCommunityMembers&communityId=${communityId}`);
  const d = await r.json();
  const emails = (d.members || []).map(m => typeof m === "string" ? m : m.email);
  
  const fullProfiles = [];
  for (const email of emails) {
    try {
      const pr = await fetch(`${API_URL}?module=getUserByEmail&email=${encodeURIComponent(email)}`);
      const pd = await pr.json();
      const u = pd?.user || {};
      fullProfiles.push({
        email,
        fullName: u.fullName || u.FullName || email,
        profilePic: u.profilePic || u.ProfilePic || null
      });
    } catch { fullProfiles.push({ email, fullName: email, profilePic: null }); }
  }
  communityMembers = fullProfiles;
  localStorage.setItem("cached_members_" + communityId, JSON.stringify(fullProfiles));
  renderCommunityMembersList(fullProfiles);
  renderMessages(messages); // Refresh chat to show names/pics
}

/****************************************************
 * RENDERING
 ****************************************************/
function getInitials(name) {
  if (!name) return "?";
  return name.split(" ").filter(Boolean).map(p => p[0]).join("").substring(0, 2).toUpperCase();
}

function renderMessages(list) {
  const container = document.getElementById("messages");
  if (!container) return;
  container.innerHTML = "";

  list.forEach((msg) => {
    const isMe = msg.senderEmail === loggedInUser.email;
    let sender = communityMembers.find(m => m.email === msg.senderEmail);
    
    let name = isMe ? loggedInUser.fullName : (sender?.fullName || msg.senderEmail);
    let pic = isMe ? loggedInUser.profilePic : (sender?.profilePic || null);
    
    const initials = getInitials(name);
    const avatarHTML = pic 
      ? `<img style="width:40px;height:40px;border-radius:50%;object-fit:cover;" src="${pic}" />` 
      : `<div style="width:40px;height:40px;border-radius:50%;background:#ddd;display:flex;align-items:center;justify-content:center;font-size:12px;">${initials}</div>`;

    const row = document.createElement("div");
    row.style.cssText = `display:flex; justify-content:${isMe ? 'flex-end' : 'flex-start'}; margin-bottom:15px; gap:10px;`;
    
    row.innerHTML = `
      ${!isMe ? avatarHTML : ''}
      <div style="max-width:70%;">
        <div style="font-size:10px; color:#888; margin-bottom:2px; ${isMe ? 'text-align:right' : ''}">${name}</div>
        <div style="background:${isMe ? '#4A6CFF' : '#eee'}; color:${isMe ? '#fff' : '#333'}; padding:8px 12px; border-radius:12px;">
          ${msg.text || ""}
        </div>
      </div>
      ${isMe ? avatarHTML : ''}
    `;
    container.appendChild(row);
  });
  container.scrollTop = container.scrollHeight;
}

function renderCommunityMembersList(list) {
  const container = document.getElementById("memberSidebar");
  if (!container) return;
  container.innerHTML = "<h3>Members</h3>";
  list.forEach(m => {
    container.innerHTML += `<div style="padding:5px 0; font-size:14px;">• ${m.fullName}</div>`;
  });
}

/****************************************************
 * BOOTSTRAP
 ****************************************************/
document.addEventListener("DOMContentLoaded", async () => {
  loadNavbar();

  // 1. Resolve Conversation ID first (Crucial for loading chat)
  if (!activeConversationId) {
    let convUrl = mode === "community" 
      ? `${API_URL}?module=startCommunityConversation&communityId=${communityId}&userEmail=${loggedInUser.email}`
      : `${API_URL}?module=startConversation&userEmail=${loggedInUser.email}&otherEmail=${finalOtherEmail}`;
    
    const r = await fetch(convUrl);
    const d = await r.json();
    activeConversationId = d.conversationId;
  }

  // 2. Start polling immediately
  if (activeConversationId) startPolling();

  // 3. Load metadata in background (won't block the chat from appearing)
  if (mode === "private") {
    loadOtherUserProfile();
  } else {
    primeCommunityMembers();
  }

  // 4. Send Button
  document.getElementById("sendBtn").onclick = () => {
    const input = document.getElementById("messageInput");
    const text = input.value.trim();
    if (!text) return;
    
    // Optimistic
    messages.push({ senderEmail: loggedInUser.email, text: text, optimistic: true });
    renderMessages(messages);
    input.value = "";

    fetch(`${API_URL}?module=sendMessage&conversationId=${activeConversationId}&senderEmail=${loggedInUser.email}&type=text&text=${encodeURIComponent(text)}`)
      .then(() => loadMessages());
  };
});

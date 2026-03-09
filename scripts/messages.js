/****************************************************
 * CONTACT.COM — BULLETPROOF PRODUCTION READY
 * FIXES: NAVBAR, MEMBERLIST, SYNC, & CROSS-USER VIEW
 ****************************************************/

const API_URL = "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

/* 1. GLOBAL STATE */
let loggedInUser = JSON.parse(localStorage.getItem("contact_user")) || {};
const url = new URL(window.location.href);
const communityId = url.searchParams.get("communityId");
const mode = communityId ? "community" : "private";
const finalOtherEmail = url.searchParams.get("otherEmail") || url.searchParams.get("email");

let activeConversationId = url.searchParams.get("conversationId") || null;
let communityMembers = [];
let renderedMessageIds = new Set();
let isSyncing = false;

/****************************************************
 * 2. UI - INDEPENDENT COMPONENTS
 ****************************************************/

// Run immediately to ensure Navbar is never blank
function initNavbar() {
  const nav = document.getElementById("navbar");
  const html = `
    <div class="hamburger" onclick="document.getElementById('mobileMenu').classList.toggle('show')"><span></span><span></span><span></span></div>
    <div class="logo">Contact<span>.</span>com</div>
    <div class="nav-links">
      <a href="dashboard.html">Dashboard</a>
      <a href="communities.html">Communities</a>
      <a href="contacts.html">Contacts</a>
      <a href="profile.html">Profile</a>
      <a href="#" onclick="localStorage.clear(); location.href='index.html'">Logout</a>
    </div>`;
  if (nav) nav.innerHTML = html;
  const mob = document.getElementById("mobileMenu");
  if (mob) mob.innerHTML = html;
}

const getInitials = (n) => n ? n.split(/[ @]/).filter(Boolean).map(p => p[0]).join("").substring(0, 2).toUpperCase() : "?";

function buildRow(msg) {
  const isMe = msg.senderEmail === (loggedInUser.email || loggedInUser.Email);
  const row = document.createElement("div");
  row.className = "msg-row";
  row.style.cssText = `display:flex; margin-bottom:12px; gap:10px; align-items:flex-end; justify-content:${isMe ? 'flex-end' : 'flex-start'};`;

  // Find user details for avatar
  const mem = communityMembers.find(m => (m.email || m.Email) === msg.senderEmail) || { email: msg.senderEmail };
  const pic = mem.profilePic || mem.ProfilePic;
  const name = mem.fullName || mem.FullName || msg.senderEmail;

  const avatar = pic 
    ? `<img src="${pic}" style="width:36px; height:36px; border-radius:50%; object-fit:cover;">`
    : `<div style="width:36px; height:36px; border-radius:50%; background:#4A6CFF; color:white; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:bold;">${getInitials(name)}</div>`;

  const bubble = `<div style="max-width:70%; padding:10px 14px; border-radius:18px; font-size:14px; background:${isMe ? "#4A6CFF" : "#F1F1F1"}; color:${isMe ? "white" : "#111"};">${msg.text || ""}</div>`;
  const avatarCol = `<div style="width:36px; flex-shrink:0;">${avatar}</div>`;

  row.innerHTML = isMe ? `${bubble}${avatarCol}` : `${avatarCol}${bubble}`;
  return row;
}

/****************************************************
 * 3. CORE SYNC ENGINE (REAL-TIME)
 ****************************************************/

async function sync() {
  if (!activeConversationId || isSyncing) return;
  isSyncing = true;
  try {
    const r = await fetch(`${API_URL}?module=getMessages&conversationId=${activeConversationId}`);
    const d = await r.json();
    const container = document.getElementById("messages");
    if (container && d.messages) {
      let hasNew = false;
      d.messages.forEach(msg => {
        if (!renderedMessageIds.has(msg.id)) {
          container.appendChild(buildRow(msg));
          renderedMessageIds.add(msg.id);
          hasNew = true;
        }
      });
      if (hasNew) container.scrollTop = container.scrollHeight;
    }
  } catch (e) { console.error("Sync Error:", e); }
  isSyncing = false;
}

async function loadSidebar() {
  const sidebar = document.getElementById("memberSidebar");
  if (!sidebar || mode !== "community") return;

  try {
    const r = await fetch(`${API_URL}?module=getCommunityMembers&communityId=${communityId}`);
    const d = await r.json();
    sidebar.innerHTML = "<h3>Members</h3>";
    for (const email of (d.members || [])) {
      const res = await fetch(`${API_URL}?module=getUserByEmail&email=${encodeURIComponent(email)}`);
      const ud = await res.json();
      const user = ud.user || { email };
      communityMembers.push(user); // Important for chat avatars

      const item = document.createElement("div");
      item.style.cssText = "display:flex; align-items:center; gap:10px; margin-bottom:12px; cursor:pointer;";
      item.innerHTML = `<div style="width:30px; height:30px; border-radius:50%; background:#eee; display:flex; align-items:center; justify-content:center; font-size:10px;">${getInitials(user.fullName || email)}</div> <span>${user.fullName || email.split('@')[0]}</span>`;
      item.onclick = () => window.location.href=`public-profile.html?email=${email}`;
      sidebar.appendChild(item);
    }
  } catch (e) { console.warn("Sidebar failed, but chat will continue."); }
}

/****************************************************
 * 4. INITIALIZATION
 ****************************************************/

document.addEventListener("DOMContentLoaded", async () => {
  initNavbar();
  
  // Setup Interaction
  const send = async () => {
    const inp = document.getElementById("messageInput");
    const val = inp.value.trim();
    if (!val || !activeConversationId) return;
    inp.value = "";
    // Optimistic UI
    document.getElementById("messages").appendChild(buildRow({ senderEmail: (loggedInUser.email || loggedInUser.Email), text: val }));
    document.getElementById("messages").scrollTop = 99999;
    
    await fetch(`${API_URL}?module=sendMessage&conversationId=${activeConversationId}&senderEmail=${loggedInUser.email || loggedInUser.Email}&type=text&text=${encodeURIComponent(val)}`);
    sync(); // Immediate sync after sending
  };

  document.getElementById("sendBtn").onclick = send;
  document.getElementById("messageInput").onkeydown = (e) => { if(e.key === "Enter") send(); };
  document.getElementById("toggleMembers").onclick = () => document.getElementById("memberSidebar").classList.toggle("show");

  // Load Context & Start Heartbeat
  try {
    // Step 1: Establish Conversation
    if (!activeConversationId) {
      const mod = mode === "community" ? "startCommunityConversation" : "startConversation";
      const p = mode === "community" ? `&communityId=${communityId}` : `&otherEmail=${finalOtherEmail}`;
      const r = await fetch(`${API_URL}?module=${mod}&userEmail=${loggedInUser.email || loggedInUser.Email}${p}`);
      const d = await r.json();
      activeConversationId = d.conversationId;
    }

    // Step 2: Set Title (Don't wait for sidebar)
    if (mode === "community") {
      fetch(`${API_URL}?module=getCommunityById&communityId=${communityId}`)
        .then(r => r.json()).then(d => { document.getElementById("headerTitle").innerText = d.community?.name || "Community"; });
      loadSidebar(); // Sidebar loads in background
    } else {
      fetch(`${API_URL}?module=getUserByEmail&email=${encodeURIComponent(finalOtherEmail)}`)
        .then(r => r.json()).then(d => { document.getElementById("headerTitle").innerText = d.user?.fullName || finalOtherEmail; });
      if (document.getElementById("toggleMembers")) document.getElementById("toggleMembers").style.display = "none";
    }

    // Step 3: Launch Sync Heartbeat
    await sync(); 
    setInterval(sync, 3000); // 3-second heartbeat for other users' messages

  } catch (e) { console.error("Critical Init Error:", e); }
});

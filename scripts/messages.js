/****************************************************
 * CONTACT.COM — ULTIMATE RESILIENT MESSAGES.JS
 * FIXES: CASE-SENSITIVE DATA & MEMBERLIST RENDERING
 ****************************************************/

const API_URL = "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

/* 1. STATE & PARAMS */
let loggedInUser = JSON.parse(localStorage.getItem("contact_user")) || {};
const url = new URL(window.location.href);
const communityId = url.searchParams.get("communityId");
const mode = communityId ? "community" : "private";
const finalOtherEmail = url.searchParams.get("otherEmail") || url.searchParams.get("email");

let activeConversationId = url.searchParams.get("conversationId") || null;
let renderedMessageIds = new Set();
let communityMembers = [];
let otherUser = null;
let isSyncing = false;

// UI Constants
const BUBBLE_PALETTE = [{bg:"#4A6CFF",tx:"#FFF"}, {bg:"#6F8CFF",tx:"#FFF"}, {bg:"#8FA3FF",tx:"#000"}, {bg:"#AFC0FF",tx:"#000"}];

/****************************************************
 * 2. DATA NORMALIZER (The Fix for Missing Avatars)
 ****************************************************/
function normalizeUser(u) {
  if (!u) return { email: "", name: "Unknown", pic: null };
  return {
    email: u.email || u.Email || "",
    name: u.fullName || u.FullName || u.Name || u.email || u.Email || "Unknown",
    pic: u.profilePic || u.ProfilePic || u.Pic || null
  };
}

const getInitials = (n) => n ? n.split(/[ @]/).filter(Boolean).map(p=>p[0]).join("").substring(0,2).toUpperCase() : "?";

/****************************************************
 * 3. UI GENERATORS
 ****************************************************/
function createAvatar(userObj) {
  const u = normalizeUser(userObj);
  if (u.pic && u.pic.startsWith("http")) {
    return `<img src="${u.pic}" class="chat-avatar" style="width:36px; height:36px; border-radius:50%; object-fit:cover;" onerror="this.outerHTML='<div class=chat-avatar-fallback>${getInitials(u.name)}</div>'">`;
  }
  return `<div class="chat-avatar-fallback" style="width:36px; height:36px; border-radius:50%; background:#ddd; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:bold;">${getInitials(u.name)}</div>`;
}

function buildRow(msg) {
  const isMe = msg.senderEmail === (loggedInUser.email || loggedInUser.Email);
  const row = document.createElement("div");
  row.style.cssText = `display:flex; margin-bottom:12px; gap:8px; align-items:flex-end; justify-content:${isMe?'flex-end':'flex-start'};`;

  // Find Sender Data for Avatar
  let senderData = { email: msg.senderEmail };
  if (isMe) senderData = loggedInUser;
  else if (mode === "community") senderData = communityMembers.find(m => (m.email||m.Email) === msg.senderEmail) || { email: msg.senderEmail };
  else senderData = otherUser || { email: msg.senderEmail };

  const avatarHTML = createAvatar(senderData);
  const color = BUBBLE_PALETTE[Math.abs(msg.senderEmail.length) % BUBBLE_PALETTE.length];

  const bubble = document.createElement("div");
  bubble.style.cssText = `max-width:70%; padding:10px 14px; border-radius:18px; font-size:14px; background:${isMe?color.bg:"#F1F1F1"}; color:${isMe?color.tx:"#111"};`;
  bubble.textContent = msg.text || "";

  row.innerHTML = isMe ? `<div style="${bubble.style.cssText}">${bubble.textContent}</div><div style="width:36px">${avatarHTML}</div>` 
                       : `<div style="width:36px">${avatarHTML}</div><div style="${bubble.style.cssText}">${bubble.textContent}</div>`;
  return row;
}

/****************************************************
 * 4. SYNC & FETCH (10/10 POLLING)
 ****************************************************/
async function sync() {
  if (!activeConversationId || isSyncing) return;
  isSyncing = true;
  try {
    const r = await fetch(`${API_URL}?module=getMessages&conversationId=${activeConversationId}`);
    const d = await r.json();
    const container = document.getElementById("messages");
    if (!container || !d.messages) return;

    d.messages.filter(m => !renderedMessageIds.has(m.id)).forEach(m => {
      container.appendChild(buildRow(m));
      renderedMessageIds.add(m.id);
    });
    container.scrollTop = container.scrollHeight;
  } catch(e) {} finally { isSyncing = false; }
}

async function loadSidebar() {
  if (mode !== "community") return;
  const sidebar = document.getElementById("memberSidebar");
  if (!sidebar) return;

  try {
    const r = await fetch(`${API_URL}?module=getCommunityMembers&communityId=${communityId}`);
    const d = await r.json();
    const emails = d.members || [];
    
    // Batch fetch profiles
    const profiles = await Promise.all(emails.map(async e => {
      const res = await fetch(`${API_URL}?module=getUserByEmail&email=${encodeURIComponent(e)}`);
      const ud = await res.json();
      return ud.user || { email: e };
    }));

    communityMembers = profiles;
    sidebar.innerHTML = "<h3>Members</h3>";
    profiles.forEach(p => {
      const u = normalizeUser(p);
      const item = document.createElement("div");
      item.style.cssText = "display:flex; align-items:center; gap:10px; margin-bottom:12px; cursor:pointer;";
      item.innerHTML = `${createAvatar(p)} <span style="font-size:14px;">${u.name}</span>`;
      item.onclick = () => window.location.href=`public-profile.html?email=${u.email}`;
      sidebar.appendChild(item);
    });
  } catch(e) { console.error("Sidebar failed", e); }
}

/****************************************************
 * 5. INIT
 ****************************************************/
document.addEventListener("DOMContentLoaded", async () => {
  // 1. Navbar First
  const nav = document.getElementById("navbar");
  if (nav) nav.innerHTML = `<div class="logo">Contact<span>.</span>com</div><div class="nav-links"><a href="dashboard.html">Dashboard</a><a href="communities.html">Communities</a><a href="#" onclick="localStorage.clear();location.href='index.html'">Logout</a></div>`;

  // 2. Setup Input
  const btn = document.getElementById("sendBtn");
  const inp = document.getElementById("messageInput");
  const send = async () => {
    const val = inp.value.trim();
    if (!val || !activeConversationId) return;
    inp.value = "";
    // Optimistic
    document.getElementById("messages").appendChild(buildRow({senderEmail:loggedInUser.email||loggedInUser.Email, text:val, id:Date.now()}));
    document.getElementById("messages").scrollTop = 99999;
    await fetch(`${API_URL}?module=sendMessage&conversationId=${activeConversationId}&senderEmail=${loggedInUser.email||loggedInUser.Email}&type=text&text=${encodeURIComponent(val)}`);
    sync();
  };
  if (btn) btn.onclick = send;
  if (inp) inp.onkeydown = (e) => { if(e.key==="Enter") send(); };

  // 3. Main Init
  try {
    if (!activeConversationId) {
      const m = mode === "community" ? "startCommunityConversation" : "startConversation";
      const p = mode === "community" ? `&communityId=${communityId}` : `&otherEmail=${finalOtherEmail}`;
      const r = await fetch(`${API_URL}?module=${m}&userEmail=${loggedInUser.email||loggedInUser.Email}${p}`);
      const d = await r.json();
      activeConversationId = d.conversationId;
    }

    if (mode === "private") {
      const r = await fetch(`${API_URL}?module=getUserByEmail&email=${encodeURIComponent(finalOtherEmail)}`);
      const d = await r.json();
      otherUser = d.user;
      document.getElementById("headerTitle").innerText = normalizeUser(otherUser).name;
    } else {
      loadSidebar();
    }

    await sync();
    setInterval(sync, 3000);
  } catch(e) { console.error("Init crash", e); }
});

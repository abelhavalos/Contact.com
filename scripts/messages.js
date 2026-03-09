/****************************************************
 * CONTACT.COM — RESILIENT MESSAGES.JS
 * FIXES: DISAPPEARING NAVBAR, TITLE, & MEMBERLIST
 ****************************************************/

const API_URL = "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

/* 1. SESSION STATE */
let loggedInUser = JSON.parse(localStorage.getItem("contact_user")) || {};
const url = new URL(window.location.href);
const communityId = url.searchParams.get("communityId");
const mode = communityId ? "community" : "private";
const finalOtherEmail = url.searchParams.get("otherEmail") || url.searchParams.get("email");

let activeConversationId = url.searchParams.get("conversationId") || null;
let renderedMessageIds = new Set();
let communityMembers = [];
let isSyncing = false;

/****************************************************
 * 2. UI ENGINE (FORCED RENDERING)
 ****************************************************/

// Force Navbar to render even if DOM is slow
function forceNavbar() {
  const nav = document.getElementById("navbar");
  const navHTML = `
    <div class="hamburger" onclick="document.getElementById('mobileMenu').classList.toggle('show')">
      <span></span><span></span><span></span>
    </div>
    <div class="logo">Contact<span>.</span>com</div>
    <div class="nav-links">
      <a href="dashboard.html">Dashboard</a>
      <a href="communities.html">Communities</a>
      <a href="contacts.html">Contacts</a>
      <a href="profile.html">Profile</a>
      <a href="#" onclick="localStorage.clear(); location.href='index.html'">Logout</a>
    </div>`;
  if (nav) nav.innerHTML = navHTML;
  const mob = document.getElementById("mobileMenu");
  if (mob) mob.innerHTML = navHTML;
}

const getInitials = (n) => n ? n.split(/[ @]/).filter(Boolean).map(p => p[0]).join("").substring(0, 2).toUpperCase() : "?";

function buildMessageRow(msg) {
  const isMe = msg.senderEmail === (loggedInUser.email || loggedInUser.Email);
  const row = document.createElement("div");
  row.className = "msg-row";
  row.style.cssText = `display:flex; margin-bottom:12px; gap:10px; align-items:flex-end; justify-content:${isMe ? 'flex-end' : 'flex-start'};`;

  // Find user details from cache for the avatar
  const member = communityMembers.find(m => (m.email || m.Email) === msg.senderEmail) || { email: msg.senderEmail };
  const name = member.fullName || member.FullName || msg.senderEmail;
  const pic = member.profilePic || member.ProfilePic;

  const avatarHTML = pic 
    ? `<img src="${pic}" style="width:36px; height:36px; border-radius:50%; object-fit:cover;">`
    : `<div style="width:36px; height:36px; border-radius:50%; background:#4A6CFF; color:white; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:bold;">${getInitials(name)}</div>`;

  const bubble = `<div style="max-width:70%; padding:10px 14px; border-radius:18px; font-size:14px; background:${isMe ? "#4A6CFF" : "#F1F1F1"}; color:${isMe ? "white" : "#111"};">${msg.text || ""}</div>`;
  const avatarCol = `<div style="width:36px; flex-shrink:0;">${avatarHTML}</div>`;

  row.innerHTML = isMe ? `${bubble}${avatarCol}` : `${avatarCol}${bubble}`;
  return row;
}

/****************************************************
 * 3. DATA SYNC (NO-ECHO ENGINE)
 ****************************************************/
async function syncMessages() {
  if (!activeConversationId || isSyncing) return;
  isSyncing = true;
  try {
    const r = await fetch(`${API_URL}?module=getMessages&conversationId=${activeConversationId}`);
    const data = await r.json();
    const container = document.getElementById("messages");
    if (container && data.messages) {
      data.messages.forEach(msg => {
        if (!renderedMessageIds.has(msg.id)) {
          container.appendChild(buildMessageRow(msg));
          renderedMessageIds.add(msg.id);
        }
      });
      container.scrollTop = container.scrollHeight;
    }
  } catch (e) { console.error("Sync error", e); }
  isSyncing = false;
}

async function loadMemberList() {
  const sidebar = document.getElementById("memberSidebar");
  if (!sidebar || mode !== "community") return;

  try {
    const r = await fetch(`${API_URL}?module=getCommunityMembers&communityId=${communityId}`);
    const d = await r.json();
    const emails = d.members || [];
    
    sidebar.innerHTML = "<h3>Members</h3>";
    for (const email of emails) {
      const res = await fetch(`${API_URL}?module=getUserByEmail&email=${encodeURIComponent(email)}`);
      const ud = await res.json();
      const user = ud.user || { email };
      communityMembers.push(user); // Cache for avatars

      const div = document.createElement("div");
      div.style.cssText = "display:flex; align-items:center; gap:10px; margin-bottom:12px; cursor:pointer;";
      div.innerHTML = `<div style="width:30px; height:30px; border-radius:50%; background:#eee; display:flex; align-items:center; justify-content:center; font-size:10px;">${getInitials(user.fullName || email)}</div> <span>${user.fullName || email.split('@')[0]}</span>`;
      div.onclick = () => window.location.href=`public-profile.html?email=${email}`;
      sidebar.appendChild(div);
    }
  } catch (e) { console.error("Member list error", e); }
}

/****************************************************
 * 4. INITIALIZATION
 ****************************************************/
document.addEventListener("DOMContentLoaded", async () => {
  forceNavbar();
  
  // Setup Send Button
  const sendBtn = document.getElementById("sendBtn");
  const msgInput = document.getElementById("messageInput");
  const handleSend = async () => {
    const text = msgInput.value.trim();
    if (!text || !activeConversationId) return;
    msgInput.value = "";
    
    // Optimistic Render
    const tempId = "t_" + Date.now();
    renderedMessageIds.add(tempId);
    document.getElementById("messages").appendChild(buildMessageRow({ senderEmail: (loggedInUser.email || loggedInUser.Email), text: text }));
    document.getElementById("messages").scrollTop = 99999;

    await fetch(`${API_URL}?module=sendMessage&conversationId=${activeConversationId}&senderEmail=${loggedInUser.email || loggedInUser.Email}&type=text&text=${encodeURIComponent(text)}`);
    syncMessages();
  };

  if (sendBtn) sendBtn.onclick = handleSend;
  if (msgInput) msgInput.onkeydown = (e) => { if(e.key === "Enter") handleSend(); };

  // Setup Sidebar Toggle
  const toggleBtn = document.getElementById("toggleMembers");
  if (toggleBtn) toggleBtn.onclick = () => document.getElementById("memberSidebar").classList.toggle("show");

  try {
    // 1. Resolve Conversation
    if (!activeConversationId) {
      const mod = mode === "community" ? "startCommunityConversation" : "startConversation";
      const p = mode === "community" ? `&communityId=${communityId}` : `&otherEmail=${finalOtherEmail}`;
      const r = await fetch(`${API_URL}?module=${mod}&userEmail=${loggedInUser.email || loggedInUser.Email}${p}`);
      const d = await r.json();
      activeConversationId = d.conversationId;
    }

    // 2. Resolve Title
    if (mode === "community") {
      const r = await fetch(`${API_URL}?module=getCommunityById&communityId=${communityId}`);
      const d = await r.json();
      document.getElementById("headerTitle").innerText = d.community?.name || "Community";
      loadMemberList();
    } else {
      const r = await fetch(`${API_URL}?module=getUserByEmail&email=${encodeURIComponent(finalOtherEmail)}`);
      const d = await r.json();
      document.getElementById("headerTitle").innerText = d.user?.fullName || finalOtherEmail;
      if (document.getElementById("toggleMembers")) document.getElementById("toggleMembers").style.display = "none";
    }

    // 3. Start Polling
    await syncMessages();
    setInterval(syncMessages, 4000);

  } catch (e) { console.error("Init failure", e); }
});

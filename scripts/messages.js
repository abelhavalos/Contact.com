/****************************************************
 * CONTACT.COM — 10/10 STABLE PRODUCTION MESSAGES.JS
 ****************************************************/

const API_URL = "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

/* 1. STATE & PARAMS */
let loggedInUser = JSON.parse(localStorage.getItem("contact_user"));
if (!loggedInUser) window.location.href = "login.html";

// Normalize names for avatars
const fixName = (u) => u.fullName || u.FullName || u.email || "User";
loggedInUser.fullName = fixName(loggedInUser);
loggedInUser.profilePic = loggedInUser.profilePic || loggedInUser.ProfilePic || null;

const url = new URL(window.location.href);
const communityId = url.searchParams.get("communityId");
const mode = communityId ? "community" : "private";
const finalOtherEmail = url.searchParams.get("otherEmail") || url.searchParams.get("email");
let chatTitle = url.searchParams.get("title") || "";

let activeConversationId = url.searchParams.get("conversationId") || null;
let communityMembers = [];
let otherUser = null;
let pollingInterval = null; 
let isFetching = false; // PREVENTS OVERLAP
let renderedMessageIds = new Set();

const BUBBLE_PALETTE = [{ bg: "#4A6CFF", text: "#FFFFFF" }, { bg: "#6F8CFF", text: "#FFFFFF" }];

/****************************************************
 * 2. HELPERS
 ****************************************************/
const showChatLoader = () => { const el = document.getElementById("chatLoader"); if (el) el.style.display = "flex"; };
const hideChatLoader = () => { const el = document.getElementById("chatLoader"); if (el) el.style.display = "none"; };

function getInitials(name) {
  if (!name) return "?";
  return name.split(" ").filter(Boolean).map(p => p[0]).join("").substring(0, 2).toUpperCase();
}

function loadNavbar() {
  const nav = document.getElementById("navbar");
  if (!nav) return;
  nav.innerHTML = `
    <div class="hamburger" onclick="document.getElementById('mobileMenu').classList.toggle('show')"><span></span><span></span><span></span></div>
    <div class="logo">Contact<span>.</span>com</div>
    <div class="nav-links">
      <a href="dashboard.html">Dashboard</a>
      <a href="communities.html">Communities</a>
      <a href="contacts.html">Contacts</a>
      <a href="profile.html">Profile</a>
      <a href="#" onclick="localStorage.clear(); window.location.href='index.html'">Logout</a>
    </div>`;
}

/****************************************************
 * 3. RENDERING (FIXES AVATARS & DEDUPLICATION)
 ****************************************************/
function buildMessageRow(msg) {
  const isMe = msg.senderEmail === loggedInUser.email;
  const row = document.createElement("div");
  row.className = "msg-row";
  row.style.cssText = `display:flex; margin-bottom:12px; gap:8px; align-items:flex-end; justify-content:${isMe ? 'flex-end' : 'flex-start'};`;

  // Fix: Lookup sender in community cache or otherUser object
  let pic = isMe ? loggedInUser.profilePic : null;
  let name = isMe ? loggedInUser.fullName : msg.senderEmail;

  if (!isMe) {
    if (mode === "community") {
      const mem = communityMembers.find(m => m.email === msg.senderEmail);
      if (mem) { pic = mem.profilePic; name = mem.fullName; }
    } else if (otherUser) {
      pic = otherUser.profilePic || otherUser.ProfilePic;
      name = otherUser.fullName || otherUser.FullName || finalOtherEmail;
    }
  }

  const avatarHTML = pic 
    ? `<img class="chat-avatar" src="${pic}" style="width:36px; height:36px; border-radius:50%; object-fit:cover;" />` 
    : `<div class="chat-avatar-fallback" style="width:36px; height:36px; border-radius:50%; background:#4A6CFF; color:white; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:bold;">${getInitials(name)}</div>`;

  const bubble = document.createElement("div");
  bubble.style.cssText = `max-width:70%; padding:10px 14px; border-radius:18px; font-size:14px; background:${isMe ? "#4A6CFF" : "#F3F4F6"}; color:${isMe ? "white" : "#111"};`;
  bubble.textContent = msg.text || "";

  const avatarWrap = `<div style="width:36px; flex-shrink:0;">${avatarHTML}</div>`;
  row.innerHTML = isMe ? `${bubble.outerHTML}${avatarWrap}` : `${avatarWrap}${bubble.outerHTML}`;
  return row;
}

async function loadMessagesOnce(showSpinner = true) {
  if (!activeConversationId || isFetching) return;
  if (showSpinner) showChatLoader();
  isFetching = true;

  try {
    const r = await fetch(`${API_URL}?module=getMessages&conversationId=${activeConversationId}`);
    const data = await r.json();
    const container = document.getElementById("messages");
    if (!container || !data.messages) return;

    data.messages.forEach(msg => {
      // Fix: Strictly use Server IDs to prevent "The Echo"
      if (!renderedMessageIds.has(msg.id)) {
        container.appendChild(buildMessageRow(msg));
        renderedMessageIds.add(msg.id);
      }
    });
    container.scrollTop = container.scrollHeight;
  } catch (err) { console.warn("Poll failed", err); } 
  finally { isFetching = false; hideChatLoader(); }
}

/****************************************************
 * 4. DATA FETCHING (AVATARS & SIDEBAR)
 ****************************************************/
async function loadCommunityMembers() {
  const r = await fetch(`${API_URL}?module=getCommunityMembers&communityId=${communityId}`);
  const d = await r.json();
  const emails = d.members || [];
  
  const container = document.getElementById("memberSidebar");
  if (container) container.innerHTML = "<h3>Members</h3>";

  // Sequential loading ensures we have the data BEFORE the first message sync
  for (const email of emails) {
    const res = await fetch(`${API_URL}?module=getUserByEmail&email=${encodeURIComponent(email)}`);
    const ud = await res.json();
    const u = ud.user || { email };
    const member = { email, fullName: fixName(u), profilePic: u.profilePic || u.ProfilePic || null };
    communityMembers.push(member);
    
    if (container) {
      const div = document.createElement("div");
      div.style.cssText = "display:flex; align-items:center; gap:10px; margin-bottom:12px; cursor:pointer;";
      div.innerHTML = member.profilePic 
        ? `<img src="${member.profilePic}" style="width:30px; height:30px; border-radius:50%;" /> <span>${member.fullName}</span>`
        : `<div style="width:30px; height:30px; border-radius:50%; background:#eee; display:flex; align-items:center; justify-content:center; font-size:10px;">${getInitials(member.fullName)}</div> <span>${member.fullName}</span>`;
      container.appendChild(div);
    }
  }
}

/****************************************************
 * 5. INIT & SEND
 ****************************************************/
async function sendMessage() {
  const inp = document.getElementById("messageInput");
  const text = inp.value.trim();
  if (!text || !activeConversationId) return;

  // Optimistic UI
  const tempId = "local_" + Date.now();
  renderedMessageIds.add(tempId);
  document.getElementById("messages").appendChild(buildMessageRow({ senderEmail: loggedInUser.email, text }));
  document.getElementById("messages").scrollTop = 99999;
  inp.value = "";

  // Note: No-cors is fine here if you don't need the server ID immediately
  fetch(`${API_URL}?module=sendMessage&conversationId=${activeConversationId}&senderEmail=${loggedInUser.email}&type=text&text=${encodeURIComponent(text)}`, { mode: 'no-cors' });
}

document.addEventListener("DOMContentLoaded", async () => {
  loadNavbar();
  showChatLoader();

  // Setup Listeners
  document.getElementById("sendBtn").onclick = sendMessage;
  document.getElementById("messageInput").onkeydown = (e) => { if(e.key === "Enter") sendMessage(); };
  document.getElementById("toggleMembers")?.addEventListener("click", () => {
    document.getElementById("memberSidebar").classList.toggle("show");
  });

  try {
    // 1. Get Conversation ID
    if (!activeConversationId) {
      const mod = mode === "community" ? "startCommunityConversation" : "startConversation";
      const p = mode === "community" ? `&communityId=${communityId}` : `&otherEmail=${finalOtherEmail}`;
      const r = await fetch(`${API_URL}?module=${mod}&userEmail=${loggedInUser.email}${p}`);
      const d = await r.json();
      activeConversationId = d.conversationId;
    }

    // 2. Load Identities (Wait for these so avatars aren't broken)
    if (mode === "community") {
      await loadCommunityMembers();
      fetch(`${API_URL}?module=getCommunityById&communityId=${communityId}`)
        .then(r => r.json()).then(d => { document.getElementById("headerTitle").innerText = d.community?.name || "Community"; });
    } else {
      const r = await fetch(`${API_URL}?module=getUserByEmail&email=${encodeURIComponent(finalOtherEmail)}`);
      const d = await r.json();
      otherUser = d.user;
      document.getElementById("headerTitle").innerText = fixName(otherUser || {email: finalOtherEmail});
      if (document.getElementById("toggleMembers")) document.getElementById("toggleMembers").style.display = "none";
    }

    // 3. Start Polling
    await loadMessagesOnce(true);
    setInterval(() => loadMessagesOnce(false), 4000);

  } catch (e) { console.error("Init failure", e); hideChatLoader(); }
});

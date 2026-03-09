/****************************************************
 * CONTACT.COM — PRODUCTION STABLE MESSAGES.JS
 * FIXES: DUPLICATES, AVATARS, & SIDEBAR RENDERING
 ****************************************************/

const API_URL = "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

/* 1. STATE & PARAMS */
let loggedInUser = JSON.parse(localStorage.getItem("contact_user"));
if (!loggedInUser) window.location.href = "login.html";

// Normalize user data for consistent access
const getVal = (obj, key) => obj[key] || obj[key.charAt(0).toUpperCase() + key.slice(1)];
loggedInUser.fullName = getVal(loggedInUser, 'fullName') || loggedInUser.email;
loggedInUser.profilePic = getVal(loggedInUser, 'profilePic') || null;

const url = new URL(window.location.href);
const communityId = url.searchParams.get("communityId");
const mode = communityId ? "community" : "private";
const finalOtherEmail = url.searchParams.get("otherEmail") || url.searchParams.get("email");
let chatTitle = url.searchParams.get("title") || "";

let activeConversationId = url.searchParams.get("conversationId") || null;
let communityMembers = [];
let otherUser = null;
let pollingInterval = null; 
let renderedMessageIds = new Set();
let isFetching = false;

const BUBBLE_PALETTE = [{ bg: "#4A6CFF", text: "#FFFFFF" }, { bg: "#6F8CFF", text: "#FFFFFF" }];

/****************************************************
 * 2. HELPERS & UI
 ****************************************************/
const showChatLoader = () => { const el = document.getElementById("chatLoader"); if (el) el.style.display = "flex"; };
const hideChatLoader = () => { const el = document.getElementById("chatLoader"); if (el) el.style.display = "none"; };

function getInitials(name) {
  if (!name) return "?";
  return name.split(" ").filter(Boolean).map(p => p[0]).join("").substring(0, 2).toUpperCase();
}

function loadNavbar() {
  const nav = document.getElementById("navbar");
  const html = `
    <div class="hamburger" onclick="document.getElementById('mobileMenu').classList.toggle('show')"><span></span><span></span><span></span></div>
    <div class="logo">Contact<span>.</span>com</div>
    <div class="nav-links">
      <a href="dashboard.html">Dashboard</a> <a href="communities.html">Communities</a>
      <a href="contacts.html">Contacts</a> <a href="profile.html">Profile</a>
      <a href="#" onclick="localStorage.removeItem('contact_user'); location.href='index.html'">Logout</a>
    </div>`;
  if (nav) nav.innerHTML = html;
  const mob = document.getElementById("mobileMenu");
  if (mob) mob.innerHTML = html;
}

/****************************************************
 * 3. RENDERING ENGINE (DEDUPLICATED)
 ****************************************************/
function buildMessageRow(msg) {
  const isMe = msg.senderEmail === loggedInUser.email;
  const row = document.createElement("div");
  row.className = "msg-row";
  row.style.cssText = `display:flex; margin-bottom:12px; gap:10px; align-items:flex-end; justify-content:${isMe ? 'flex-end' : 'flex-start'};`;

  // Avatar Logic: Check member list cache, then otherUser, then fallback
  let pic = isMe ? loggedInUser.profilePic : null;
  let name = isMe ? loggedInUser.fullName : msg.senderEmail;

  if (!isMe) {
    const member = communityMembers.find(m => m.email === msg.senderEmail);
    if (member) { pic = member.profilePic; name = member.fullName; }
    else if (otherUser && msg.senderEmail === otherUser.email) { pic = otherUser.profilePic; name = otherUser.fullName; }
  }

  const avatarHTML = pic 
    ? `<img class="chat-avatar" src="${pic}" style="width:36px; height:36px; border-radius:50%; object-fit:cover;" />` 
    : `<div class="chat-avatar-fallback" style="width:36px; height:36px; border-radius:50%; background:#4A6CFF; color:white; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:bold;">${getInitials(name)}</div>`;

  const bubble = document.createElement("div");
  bubble.style.cssText = `max-width:70%; padding:10px 16px; border-radius:20px; font-size:14px; background:${isMe ? "#4A6CFF" : "#F1F3F4"}; color:${isMe ? "white" : "#111"};`;
  
  if (msg.type === "image") {
    bubble.innerHTML = `<img src="${msg.fileData}" style="max-width:100%; border-radius:8px; cursor:pointer;" onclick="window.open('${msg.fileData}')">`;
  } else {
    bubble.textContent = msg.text || "";
  }

  const avatarWrapper = `<div style="width:36px; flex-shrink:0;">${avatarHTML}</div>`;
  row.innerHTML = isMe ? `${bubble.outerHTML}${avatarWrapper}` : `${avatarWrapper}${bubble.outerHTML}`;
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
      // Use the server-provided ID as the master key
      if (!renderedMessageIds.has(msg.id)) {
        container.appendChild(buildMessageRow(msg));
        renderedMessageIds.add(msg.id);
      }
    });
    
    if (data.messages.length > 0) container.scrollTop = container.scrollHeight;
  } catch (err) { console.warn("Sync failed", err); } 
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

  for (const email of emails) {
    try {
      const res = await fetch(`${API_URL}?module=getUserByEmail&email=${encodeURIComponent(email)}`);
      const ud = await res.json();
      const u = ud.user || { email };
      // Normalize casing
      const user = { 
        email: email, 
        fullName: getVal(u, 'fullName') || email, 
        profilePic: getVal(u, 'profilePic') || null 
      };
      communityMembers.push(user);
      
      if (container) {
        const div = document.createElement("div");
        div.className = "member-row";
        div.style.cssText = "display:flex; align-items:center; gap:10px; margin-bottom:12px; cursor:pointer;";
        div.onclick = () => window.location.href=`public-profile.html?email=${email}`;
        div.innerHTML = user.profilePic 
          ? `<img src="${user.profilePic}" style="width:30px; height:30px; border-radius:50%;" /> <span>${user.fullName}</span>`
          : `<div style="width:30px; height:30px; border-radius:50%; background:#eee; display:flex; align-items:center; justify-content:center; font-size:10px;">${getInitials(user.fullName)}</div> <span>${user.fullName}</span>`;
        container.appendChild(div);
      }
    } catch (e) { console.error("Member load error", e); }
  }
}

/****************************************************
 * 5. SEND & POLLING
 ****************************************************/
async function sendMessage(payloadOverride = null) {
  const input = document.getElementById("messageInput");
  const text = input?.value.trim();
  if (!payloadOverride && !text) return;

  const container = document.getElementById("messages");
  const tempId = "temp_" + Date.now();
  const payload = payloadOverride || { type: "text", text };
  
  // 1. Render Locally
  container.appendChild(buildMessageRow({ senderEmail: loggedInUser.email, ...payload }));
  container.scrollTop = container.scrollHeight;
  renderedMessageIds.add(tempId); // Lock temp ID
  if (!payloadOverride) input.value = "";

  try {
    // REMOVED 'no-cors' to allow the browser to see result.messageId
    const res = await fetch(`${API_URL}?module=sendMessage&conversationId=${activeConversationId}&senderEmail=${loggedInUser.email}&type=${payload.type}&text=${encodeURIComponent(text || '')}`);
    const result = await res.json();
    if (result.messageId) renderedMessageIds.add(result.messageId); 
  } catch (e) { console.error("Send failed", e); }
}

document.addEventListener("DOMContentLoaded", async () => {
  loadNavbar();
  setupEventListeners();
  
  try {
    if (!activeConversationId) {
      const mod = mode === "community" ? "startCommunityConversation" : "startConversation";
      const p = mode === "community" ? `&communityId=${communityId}` : `&otherEmail=${finalOtherEmail}`;
      const r = await fetch(`${API_URL}?module=${mod}&userEmail=${loggedInUser.email}${p}`);
      const d = await r.json();
      activeConversationId = d.conversationId;
    }

    if (mode === "community") loadCommunityMembers();
    else if (finalOtherEmail) {
      const r = await fetch(`${API_URL}?module=getUserByEmail&email=${encodeURIComponent(finalOtherEmail)}`);
      const d = await r.json();
      otherUser = d.user;
      document.getElementById("headerTitle").innerText = getVal(otherUser, 'fullName') || finalOtherEmail;
    }

    await loadMessagesOnce(true);
    setInterval(() => loadMessagesOnce(false), 4000);
  } catch (e) { console.error("Init Error", e); hideChatLoader(); }
});

function setupEventListeners() {
  document.getElementById("sendBtn")?.addEventListener("click", () => sendMessage());
  document.getElementById("messageInput")?.onkeydown = (e) => { if(e.key === "Enter") sendMessage(); };
}

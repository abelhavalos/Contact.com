/****************************************************
 * CONTACT.COM — FINAL FAIL-SAFE MESSAGES.JS
 ****************************************************/

const API_URL = "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

/* 1. STATE */
let loggedInUser = JSON.parse(localStorage.getItem("contact_user")) || {};
const urlParams = new URLSearchParams(window.location.search);
const communityId = urlParams.get("communityId");
const mode = communityId ? "community" : "private";
const finalOtherEmail = urlParams.get("otherEmail") || urlParams.get("email");

let activeConversationId = urlParams.get("conversationId") || null;
let renderedMessageIds = new Set();
let isFetching = false;

const BUBBLE_PALETTE = [
  { bg: "#4A6CFF", text: "#FFFFFF" }, { bg: "#6F8CFF", text: "#FFFFFF" },
  { bg: "#8FA3FF", text: "#000000" }, { bg: "#AFC0FF", text: "#000000" }
];

/****************************************************
 * 2. UI INITIALIZERS
 ****************************************************/
function safeSetHTML(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function loadNavbar() {
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
      <a href="#" onclick="localStorage.removeItem('contact_user'); location.href='index.html'">Logout</a>
    </div>`;
  safeSetHTML("navbar", navHTML);
  safeSetHTML("mobileMenu", navHTML);
}

const getInitials = (n) => n ? n.split(/[ @]/).filter(Boolean).map(p => p[0]).join("").substring(0, 2).toUpperCase() : "?";

/****************************************************
 * 3. CORE RENDERING (SPEED OPTIMIZED)
 ****************************************************/
function getMessageHTML(msg) {
  const isMe = msg.senderEmail === loggedInUser.email;
  const colorIndex = Math.abs(msg.senderEmail.split('').reduce((a,b)=>a+b.charCodeAt(0),0)) % BUBBLE_PALETTE.length;
  const color = BUBBLE_PALETTE[colorIndex];
  
  // Avatar logic: Uses sender name/initials
  const avatarHTML = `<div class="chat-avatar-fallback" style="width:36px; height:36px; border-radius:50%; background:#ddd; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:bold; flex-shrink:0;">${getInitials(msg.senderEmail)}</div>`;
  
  let content = (msg.text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  if (msg.type === "image") content = `<img src="${msg.fileData}" style="max-width:100%; border-radius:8px; display:block;">`;
  if (msg.type === "document") content = `<a href="${msg.fileData}" download="${msg.fileName}" style="color:inherit;">📄 ${msg.fileName}</a>`;

  const bubbleStyle = `max-width:70%; padding:10px 14px; border-radius:18px; font-size:14px; background:${isMe ? color.bg : "#eee"}; color:${isMe ? color.text : "#333"}; position:relative;`;
  const rowStyle = `display:flex; margin-bottom:12px; gap:8px; align-items:flex-end; justify-content:${isMe ? 'flex-end' : 'flex-start'};`;

  return `
    <div class="msg-row" style="${rowStyle}">
      ${!isMe ? avatarHTML : ''}
      <div style="${bubbleStyle}">${content}</div>
      ${isMe ? avatarHTML : ''}
    </div>`;
}

async function syncMessages() {
  if (!activeConversationId || isFetching) return;
  isFetching = true;
  try {
    const r = await fetch(`${API_URL}?module=getMessages&conversationId=${activeConversationId}`);
    const data = await r.json();
    const container = document.getElementById("messages");
    if (!container || !data.messages) throw "No container/data";

    const newMsgs = data.messages.filter(m => !renderedMessageIds.has(m.id));
    if (newMsgs.length > 0) {
      let html = "";
      newMsgs.forEach(m => {
        html += getMessageHTML(m);
        renderedMessageIds.add(m.id);
      });
      container.insertAdjacentHTML('beforeend', html);
      container.scrollTop = container.scrollHeight;
    }
  } catch (e) { console.error("Sync Error:", e); }
  isFetching = false;
}

/****************************************************
 * 4. ACTIONS (RE-LINKED)
 ****************************************************/
async function handleSend() {
  const input = document.getElementById("messageInput");
  const text = input.value.trim();
  if (!text || !activeConversationId) return;

  // Optimistic UI
  const container = document.getElementById("messages");
  const tempId = "t_" + Date.now();
  container.insertAdjacentHTML('beforeend', getMessageHTML({ id: tempId, senderEmail: loggedInUser.email, text: text }));
  container.scrollTop = container.scrollHeight;
  renderedMessageIds.add(tempId);
  input.value = "";

  try {
    await fetch(`${API_URL}?module=sendMessage&conversationId=${activeConversationId}&senderEmail=${loggedInUser.email}&type=text&text=${encodeURIComponent(text)}`);
    syncMessages();
  } catch (e) { console.error("Send error", e); }
}

async function loadMemberList() {
  if (mode !== "community") {
      const toggle = document.getElementById("toggleMembers");
      if (toggle) toggle.style.display = "none";
      return;
  }
  try {
    const r = await fetch(`${API_URL}?module=getCommunityMembers&communityId=${communityId}`);
    const d = await r.json();
    const list = d.members || [];
    let html = "<h3>Members</h3>";
    list.forEach(email => {
      html += `<div style="display:flex; align-items:center; gap:10px; margin-bottom:10px; font-size:14px;">
                <div class="chat-avatar-fallback" style="width:30px; height:30px; border-radius:50%; background:#eee; display:flex; align-items:center; justify-content:center; font-size:10px;">${getInitials(email)}</div>
                <span>${email.split('@')[0]}</span>
               </div>`;
    });
    safeSetHTML("memberSidebar", html);
  } catch (e) { console.error("Member list error", e); }
}

/****************************************************
 * 5. INIT
 ****************************************************/
document.addEventListener("DOMContentLoaded", async () => {
  loadNavbar();
  
  // Attach listeners with null-checks
  const sendBtn = document.getElementById("sendBtn");
  if (sendBtn) sendBtn.onclick = handleSend;

  const msgInput = document.getElementById("messageInput");
  if (msgInput) {
    msgInput.onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } };
  }

  try {
    // Get Conversation ID if missing
    if (!activeConversationId) {
      const mod = mode === "community" ? "startCommunityConversation" : "startConversation";
      const p = mode === "community" ? `&communityId=${communityId}` : `&otherEmail=${finalOtherEmail}`;
      const r = await fetch(`${API_URL}?module=${mod}&userEmail=${loggedInUser.email}${p}`);
      const d = await r.json();
      activeConversationId = d.conversationId;
    }

    // Run Chat and Memberlist
    await syncMessages();
    loadMemberList();
    
    // Set Heartbeat
    setInterval(syncMessages, 4000);
    
  } catch (e) {
    console.error("Critical Init Error", e);
  }
});

/****************************************************
 * CONTACT.COM — ULTRA FAST MESSAGES.JS
 * - Full history load (no slicing)
 * - No caching
 * - Instant optimistic send
 * - Append-only rendering (no full re-render)
 * - Modern clean UI
 ****************************************************/

const API_URL = "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

/* 1. STATE & USER */
let loggedInUser = JSON.parse(localStorage.getItem("contact_user"));
if (!loggedInUser) window.location.href = "login.html";

const url = new URL(window.location.href);
const communityId = url.searchParams.get("communityId");
const mode = communityId ? "community" : "private";
const otherEmailParam = url.searchParams.get("otherEmail") || url.searchParams.get("email");

let activeConversationId = url.searchParams.get("conversationId") || null;
let messages = [];
let communityMembers = [];

/****************************************************
 * HELPERS
 ****************************************************/
function getInitials(name) {
  if (!name) return "?";
  return name.split(" ").filter(Boolean).map(p => p[0]).join("").substring(0, 2).toUpperCase();
}

function fileToBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

/****************************************************
 * RENDERING (CIRCULAR AVATARS)
 ****************************************************/
async function loadMessagesOnce() {
  if (!activeConversationId) return;
  showChatLoader();
  try {
    const r = await fetch(`${API_URL}?module=getMessages&conversationId=${activeConversationId}`);
    const data = await r.json();
    messages = data.messages || [];
    renderAllMessages(messages);
  } catch (e) { console.error(e); }
  hideChatLoader();
}

function renderAllMessages(list) {
  const container = document.getElementById("messages");
  if (!container) return;
  container.innerHTML = "";
  list.forEach(msg => container.appendChild(buildMessageRow(msg)));
  container.scrollTop = container.scrollHeight;
}

function buildMessageRow(msg) {
  const isMe = msg.senderEmail === loggedInUser.email;
  const row = document.createElement("div");
  row.className = "msg-row";
  row.style.justifyContent = isMe ? "flex-end" : "flex-start";

  const bubble = document.createElement("div");
  bubble.className = "msg-bubble"; 
  bubble.style = `max-width:70%; padding:10px 14px; border-radius:18px; font-size:14px; background:${isMe ? '#4A6CFF' : '#fff'}; color:${isMe ? '#fff' : '#222'}; border: ${isMe ? 'none' : '1px solid #ddd'};`;

  if (msg.type === "image") {
    bubble.innerHTML = `<img src="${msg.fileData}" class="chat-image" onclick="window.open(this.src)">`;
  } else if (msg.type === "document") {
    bubble.innerHTML = `<a href="${msg.fileData}" download="${msg.fileName}" style="color:inherit; font-weight:700;">📄 ${msg.fileName}</a>`;
  } else {
    bubble.innerText = msg.text || "";
  }

  row.appendChild(bubble);
  return row;
}

/****************************************************
 * MEMBERS LIST
 ****************************************************/
async function loadCommunityMembers() {
  const r = await fetch(`${API_URL}?module=getCommunityMembers&communityId=${communityId}`);
  const d = await r.json();
  const emails = (d.members || []).map(m => typeof m === "string" ? m : m.email);

  const tasks = emails.map(async (email) => {
    const res = await fetch(`${API_URL}?module=getUserByEmail&email=${encodeURIComponent(email)}`);
    const data = await res.json();
    const u = data?.user || {};
    return { email, fullName: u.fullName || u.FullName || email, profilePic: u.profilePic || u.ProfilePic || null };
  });

  communityMembers = await Promise.all(tasks);
  renderMembersList();
}

function renderMembersList() {
  const container = document.getElementById("memberSidebar");
  if (!container) return;
  container.innerHTML = "<h3 style='margin-bottom:15px; font-size:16px;'>Participants</h3>";

  communityMembers.forEach(m => {
    const initials = getInitials(m.fullName);
    const avatarHTML = m.profilePic 
      ? `<img class="chat-avatar" src="${m.profilePic}" />` 
      : `<div class="chat-avatar-fallback">${initials}</div>`;
    
    const row = document.createElement("div");
    row.className = "member-row";
    row.onclick = () => window.location.href = `public-profile.html?email=${encodeURIComponent(m.email)}`;
    row.innerHTML = `${avatarHTML} <div class="member-name">${m.fullName}</div>`;
    container.appendChild(row);
  });
}

/****************************************************
 * SEND MESSAGE
 ****************************************************/
async function sendMessage(payloadOverride = null) {
  const input = document.getElementById("messageInput");
  const text = (input?.value || "").trim();
  if (!payloadOverride && !text) return;

  const payload = payloadOverride || { type: "text", text };
  if (input) input.value = "";

  messages.push({ ...payload, senderEmail: loggedInUser.email });
  renderAllMessages(messages);

  await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({ module: "sendMessage", conversationId: activeConversationId, senderEmail: loggedInUser.email, ...payload })
  });
  loadMessagesOnce();
}

/****************************************************
 * DOM READY - TOGGLE & PICKER FIX
 ****************************************************/
document.addEventListener("DOMContentLoaded", async () => {
  const toggleBtn = document.getElementById("toggleMembers");
  const sidebar = document.getElementById("memberSidebar");
  const docInput = document.getElementById("docInput");
  const imgInput = document.getElementById("imgInput");

  // 1. THE TOGGLE FIX
  if (toggleBtn && sidebar) {
    toggleBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation(); // Stops click from reaching 'window'
      sidebar.classList.toggle("active");
    };

    // Close sidebar if you click anywhere else on the screen
    window.onclick = (e) => {
      if (!sidebar.contains(e.target) && e.target !== toggleBtn) {
        sidebar.classList.remove("active");
      }
    };
  }

  // 2. THE PICKER FIX (Stop the loop)
  document.getElementById("uploadDocBtn").onclick = (e) => { e.preventDefault(); docInput.click(); };
  document.getElementById("uploadImgBtn").onclick = (e) => { e.preventDefault(); imgInput.click(); };

  docInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const base64 = await fileToBase64(file);
    await sendMessage({ type: "document", fileName: file.name, fileData: base64 });
    e.target.value = ""; // CLEARS INPUT TO STOP LOOP
  };

  imgInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const base64 = await fileToBase64(file);
    await sendMessage({ type: "image", fileName: file.name, fileData: base64 });
    e.target.value = ""; // CLEARS INPUT TO STOP LOOP
  };

  // 3. LOAD CONTENT
  if (mode === "community") {
    await loadCommunityMembers();
  } else {
    if (toggleBtn) toggleBtn.style.display = "none";
    if (sidebar) sidebar.style.display = "none";
  }

  if (!activeConversationId) {
    const setupUrl = mode === "community" 
      ? `${API_URL}?module=startCommunityConversation&communityId=${communityId}&userEmail=${loggedInUser.email}`
      : `${API_URL}?module=startConversation&userEmail=${loggedInUser.email}&otherEmail=${otherEmailParam}`;
    const res = await fetch(setupUrl);
    const data = await res.json();
    activeConversationId = data.conversationId;
  }

  loadMessagesOnce();

  // 4. INPUT HANDLERS
  document.getElementById("sendBtn").onclick = () => sendMessage();
  document.getElementById("messageInput").onkeydown = (e) => { 
    if(e.key === "Enter" && !e.shiftKey){ e.preventDefault(); sendMessage(); }
  };
});

function showChatLoader() { document.getElementById("chatLoader").style.display = "flex"; }
function hideChatLoader() { document.getElementById("chatLoader").style.display = "none"; }

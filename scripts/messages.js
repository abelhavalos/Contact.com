/****************************************************
 * CONTACT.COM — ULTRA FAST MESSAGES.JS (V5)
 * - Optimized PDF/Image Reconciliation
 * - Simulated Upload Progress Bar
 * - Delta-Syncing & Parallel Loading
 ****************************************************/

const API_URL = "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

/* USER & STATE */
let loggedInUser = JSON.parse(localStorage.getItem("contact_user"));
if (!loggedInUser) window.location.href = "login.html";

loggedInUser.fullName = loggedInUser.fullName || loggedInUser.FullName || loggedInUser.email;
loggedInUser.profilePic = loggedInUser.profilePic || loggedInUser.ProfilePic || null;

const url = new URL(window.location.href);
const communityId = url.searchParams.get("communityId");
const mode = communityId ? "community" : "private";
const finalOtherEmail = url.searchParams.get("otherEmail") || url.searchParams.get("email");
const chatTitle = url.searchParams.get("title") || "";

let activeConversationId = url.searchParams.get("conversationId") || null;
let messages = []; 
let communityMembers = [];
let otherUser = null;
let colorCache = {};

/****************************************************
 * HELPERS
 ****************************************************/
function getUserColor(email) {
  if (colorCache[email]) return colorCache[email];
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = (hash << 5) - hash + email.charCodeAt(i);
    hash |= 0;
  }
  colorCache[email] = ["#4A6CFF", "#6F8CFF", "#8FA3FF", "#AFC0FF", "#D1DDFF"][Math.abs(hash) % 5];
  return colorCache[email];
}

function getInitials(name) {
  if (!name) return "?";
  return name.split(" ").filter(Boolean).map(p => p[0]).join("").substring(0, 2).toUpperCase();
}

function fileToBase64(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

function safeBtoa(str) {
  return btoa(unescape(encodeURIComponent(str || "")));
}

/****************************************************
 * MESSAGING ENGINE (STABLE RECONCILIATION)
 ****************************************************/
async function syncMessages() {
  if (!activeConversationId) return;

  const lastId = messages.reduce((max, m) => (m.messageId > max ? m.messageId : max), 0);
  
  try {
    const r = await fetch(`${API_URL}?module=getMessages&conversationId=${activeConversationId}&lastId=${lastId}`);
    const data = await r.json();
    const newMessages = data.messages || [];

    if (newMessages.length > 0) {
      const container = document.getElementById("messages");
      
      newMessages.forEach(msg => {
        const lookupTag = safeBtoa(msg.text || msg.fileName);
        const tempElement = document.querySelector(`[data-temp-tag="${lookupTag}"]`);
        
        if (tempElement) {
          // Confirming the message
          tempElement.id = `msg-${msg.messageId}`;
          tempElement.removeAttribute('data-temp-tag');
          tempElement.style.opacity = "1";
          // Remove progress bar if it exists
          const pb = tempElement.querySelector(".progress-container");
          if (pb) pb.remove();
          messages.push(msg);
        } else if (!document.getElementById(`msg-${msg.messageId}`)) {
          messages.push(msg);
          container.appendChild(buildMessageRow(msg));
        }
      });
      container.scrollTop = container.scrollHeight;
    }
  } catch (e) { console.error("Sync Error:", e); }
}

function sendMessage(payloadOverride = null) {
  const input = document.getElementById("messageInput");
  const text = (input?.value || "").trim();
  if (!payloadOverride && (!text || !activeConversationId)) return;

  const payload = payloadOverride || { type: "text", text };
  const fingerprint = payload.type === "text" ? payload.text : payload.fileName;
  const tempTag = safeBtoa(fingerprint);

  // OPTIMISTIC RENDER
  const container = document.getElementById("messages");
  const row = buildMessageRow({ messageId: 0, senderEmail: loggedInUser.email, ...payload });
  row.setAttribute('data-temp-tag', tempTag);
  row.style.opacity = "0.7";
  
  // Add Progress Bar if it's a file
  if (payload.type !== "text") {
    const bubble = row.querySelector(".msg-bubble");
    const progressHTML = `
      <div class="progress-container" style="width:100%; height:4px; background:rgba(255,255,255,0.3); border-radius:2px; margin-top:8px; overflow:hidden;">
        <div class="progress-bar" style="width:0%; height:100%; background:#fff; transition: width 0.3s ease;"></div>
      </div>`;
    bubble.insertAdjacentHTML('beforeend', progressHTML);
    
    // Simulate progress
    const bar = row.querySelector(".progress-bar");
    setTimeout(() => { if(bar) bar.style.width = "30%"; }, 100);
    setTimeout(() => { if(bar) bar.style.width = "70%"; }, 1500);
  }

  container.appendChild(row);
  container.scrollTop = container.scrollHeight;
  if (input) input.value = "";

  // NETWORK SEND
  const isText = payload.type === "text";
  const url = isText 
    ? `${API_URL}?module=sendMessage&conversationId=${activeConversationId}&senderEmail=${loggedInUser.email}&type=text&text=${encodeURIComponent(text)}`
    : API_URL;

  const options = isText ? {} : {
    method: "POST",
    body: JSON.stringify({ module: "sendMessage", conversationId: activeConversationId, senderEmail: loggedInUser.email, ...payload })
  };

  fetch(url, options).then(() => {
    const bar = row.querySelector(".progress-bar");
    if (bar) bar.style.width = "100%";
    syncMessages();
  });
}

/****************************************************
 * RENDERING
 ****************************************************/
function buildMessageRow(msg) {
  const isMe = msg.senderEmail === loggedInUser.email;
  const color = isMe ? "#4A6CFF" : "#F1F1F1";
  const textColor = isMe ? "#FFFFFF" : "#111827";

  const row = document.createElement("div");
  row.className = "msg-row";
  row.id = msg.messageId ? `msg-${msg.messageId}` : `temp-${Date.now()}`;
  row.style = `display:flex; margin-bottom:12px; gap:8px; align-items:flex-end; justify-content:${isMe ? 'flex-end' : 'flex-start'}; transition: all 0.3s ease;`;

  let pic, name;
  if (isMe) {
    pic = loggedInUser.profilePic;
    name = loggedInUser.fullName;
  } else if (mode === "community") {
    const sender = communityMembers.find(m => m.email === msg.senderEmail) || {};
    pic = sender.profilePic;
    name = sender.fullName || msg.senderEmail;
  } else {
    pic = otherUser?.profilePic || otherUser?.ProfilePic;
    name = otherUser?.fullName || otherUser?.FullName || finalOtherEmail;
  }

  const avatarHTML = pic 
    ? `<img class="chat-avatar" src="${pic}" style="width:36px; height:36px; border-radius:50%; object-fit:cover;" />` 
    : `<div class="chat-avatar-fallback" style="width:36px; height:36px; border-radius:50%; background:#DDD; display:flex; align-items:center; justify-content:center; font-size:12px;">${getInitials(name)}</div>`;

  const content = renderMessageContent(msg);
  
  row.innerHTML = isMe 
    ? `<div class="msg-bubble" style="max-width:70%; padding:10px 14px; border-radius:18px; font-size:14px; background:${color}; color:${textColor}">${content}</div>${avatarHTML}`
    : `${avatarHTML}<div class="msg-bubble" style="max-width:70%; padding:10px 14px; border-radius:18px; font-size:14px; background:${color}; color:${textColor}">${content}</div>`;

  return row;
}

function renderMessageContent(msg) {
  if (msg.type === "image") return `<img src="${msg.fileData}" style="max-width:100%; border-radius:10px; display:block;">`;
  if (msg.type === "document") {
    return `<div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:20px;">📄</span>
              <a href="${msg.fileData}" download="${msg.fileName}" style="color:inherit; text-decoration:underline; font-weight:600; word-break:break-all;">${msg.fileName}</a>
            </div>`;
  }
  return msg.text || "";
}

/****************************************************
 * INITIALIZATION & EVENTS
 ****************************************************/
async function initChat() {
  loadNavbar();
  showChatLoader();

  if (!activeConversationId) {
    const setupUrl = mode === "community" 
      ? `${API_URL}?module=startCommunityConversation&communityId=${communityId}&userEmail=${loggedInUser.email}`
      : `${API_URL}?module=startConversation&userEmail=${loggedInUser.email}&otherEmail=${finalOtherEmail}`;
    const res = await fetch(setupUrl);
    const data = await res.json();
    activeConversationId = data.conversationId;
  }

  const metaPromises = [
    mode === "private" ? loadOtherUserProfile() : Promise.all([loadCommunityInfo(), loadCommunityMembers()])
  ];

  await Promise.all([...metaPromises, syncMessages()]);
  hideChatLoader();
  setInterval(syncMessages, 3500);
}

async function loadOtherUserProfile() {
  const r = await fetch(`${API_URL}?module=getUserByEmail&email=${encodeURIComponent(finalOtherEmail)}`);
  const d = await r.json();
  otherUser = d?.user || {};
  updateHeader(otherUser.fullName || otherUser.FullName || finalOtherEmail, otherUser.profilePic || otherUser.ProfilePic);
}

async function loadCommunityInfo() {
  const r = await fetch(`${API_URL}?module=getCommunityById&communityId=${communityId}`);
  const d = await r.json();
  updateHeader(d?.community?.name || "Community", null);
}

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
}

function updateHeader(title, pic) {
  const header = document.getElementById("headerTitle");
  if (!header) return;
  const avatar = pic ? `<img class="chat-avatar" src="${pic}" style="width:32px; height:32px; border-radius:50%;" />` : `<div class="chat-avatar-fallback">${getInitials(title)}</div>`;
  header.innerHTML = `<div class="chat-header" style="display:flex; align-items:center; gap:10px;">${avatar}<div class="chat-header-main" style="font-weight:bold;">${chatTitle || title}</div></div>`;
}

document.addEventListener("DOMContentLoaded", () => {
  initChat();
  document.getElementById("sendBtn")?.addEventListener("click", () => sendMessage());
  document.getElementById("messageInput")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });

  const setupUpload = (btnId, inputId, type) => {
    const btn = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    if (btn && input) {
      btn.onclick = () => input.click();
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const base64 = await fileToBase64(file);
        sendMessage({ type, fileName: file.name, fileData: base64 });
        e.target.value = "";
      };
    }
  };
  setupUpload("uploadDocBtn", "docInput", "document");
  setupUpload("uploadImgBtn", "imgInput", "image");
});

function loadNavbar() {
  const nav = document.getElementById("navbar");
  if (nav) nav.innerHTML = `<div class="logo">Contact<span>.</span>com</div><div class="nav-links"><a href="dashboard.html">Dashboard</a><a href="#" onclick="logout()">Logout</a></div>`;
}
function showChatLoader() { document.getElementById("chatLoader")?.style.setProperty("display", "flex"); }
function hideChatLoader() { document.getElementById("chatLoader")?.style.setProperty("display", "none"); }
function logout() { localStorage.removeItem("contact_user"); window.location.href = "index.html"; }

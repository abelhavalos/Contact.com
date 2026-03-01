/****************************************************
 * CONTACT.COM — ULTRA FAST MESSAGES.JS (V7)
 * - Click-to-Zoom Image Overlay
 * - Anti-Flicker File Sync & Progress Bar
 * - Toast Notification System
 * - Fixed Responsive Navbar (Desktop & Mobile)
 ****************************************************/

const API_URL = "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

/* STATE */
let loggedInUser = JSON.parse(localStorage.getItem("contact_user"));
if (!loggedInUser) window.location.href = "login.html";

loggedInUser.fullName = loggedInUser.fullName || loggedInUser.FullName || loggedInUser.email;
const url = new URL(window.location.href);
const communityId = url.searchParams.get("communityId");
const mode = communityId ? "community" : "private";
const finalOtherEmail = url.searchParams.get("otherEmail") || url.searchParams.get("email");
let activeConversationId = url.searchParams.get("conversationId") || null;
let messages = []; 
let communityMembers = [];
let otherUser = null;

/****************************************************
 * IMAGE OVERLAY (ZOOM)
 ****************************************************/
function openImageOverlay(src) {
  let overlay = document.getElementById("image-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "image-overlay";
    overlay.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:10000; display:none; align-items:center; justify-content:center; cursor:pointer;";
    overlay.innerHTML = `<img id="overlay-img" style="max-width:90%; max-height:90%; border-radius:8px; transition: transform 0.3s ease;">`;
    overlay.onclick = () => overlay.style.display = "none";
    document.body.appendChild(overlay);
  }
  document.getElementById("overlay-img").src = src;
  overlay.style.display = "flex";
}

/****************************************************
 * TOAST NOTIFICATIONS
 ****************************************************/
function showToast(msg, type = "error") {
  let toast = document.getElementById("chat-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "chat-toast";
    toast.style = "position:fixed; top:80px; right:20px; padding:12px 20px; border-radius:8px; color:white; font-weight:bold; z-index:9999; transition: opacity 0.4s ease; box-shadow: 0 4px 12px rgba(0,0,0,0.15); pointer-events:none;";
    document.body.appendChild(toast);
  }
  toast.style.backgroundColor = type === "error" ? "#EF4444" : "#10B981";
  toast.innerText = msg;
  toast.style.opacity = "1";
  setTimeout(() => { toast.style.opacity = "0"; }, 4000);
}

/****************************************************
 * NAVBAR (FIXED MOBILE & DESKTOP)
 ****************************************************/
function loadNavbar() {
  const nav = document.getElementById("navbar");
  if (!nav) return;

  nav.innerHTML = `
    <div class="nav-container" style="display:flex; justify-content:space-between; align-items:center; width:100%; height:60px; padding: 0 20px; background:#fff; border-bottom:1px solid #eee;">
      <div class="logo" style="font-weight:bold; font-size:1.3rem; cursor:pointer;" onclick="window.location.href='dashboard.html'">Contact<span style="color:#4A6CFF;">.</span>com</div>
      
      <div class="nav-links desktop-nav" style="display:flex; gap:25px;">
        <a href="dashboard.html" style="text-decoration:none; color:#333;">Dashboard</a>
        <a href="communities.html" style="text-decoration:none; color:#333;">Communities</a>
        <a href="events.html" style="text-decoration:none; color:#333;">Events</a>
        <a href="contacts.html" style="text-decoration:none; color:#333;">Contacts</a>
        <a href="profile.html" style="text-decoration:none; color:#333;">Profile</a>
        <a href="#" onclick="logout()" style="text-decoration:none; color:#EF4444; font-weight:bold;">Logout</a>
      </div>

      <div class="hamburger" onclick="toggleMenu()" style="cursor:pointer; display:none; flex-direction:column; gap:5px;">
        <div style="width:25px; height:2px; background:#333;"></div>
        <div style="width:25px; height:2px; background:#333;"></div>
        <div style="width:25px; height:2px; background:#333;"></div>
      </div>
    </div>

    <div id="mobileMenu" style="display:none; flex-direction:column; background:white; width:100%; position:absolute; top:60px; left:0; border-bottom:1px solid #ddd; z-index:1000; box-shadow:0 4px 10px rgba(0,0,0,0.1);">
        <a href="dashboard.html" style="padding:15px; border-bottom:1px solid #eee; text-decoration:none; color:#333;">Dashboard</a>
        <a href="communities.html" style="padding:15px; border-bottom:1px solid #eee; text-decoration:none; color:#333;">Communities</a>
        <a href="events.html" style="padding:15px; border-bottom:1px solid #eee; text-decoration:none; color:#333;">Events</a>
        <a href="contacts.html" style="padding:15px; border-bottom:1px solid #eee; text-decoration:none; color:#333;">Contacts</a>
        <a href="profile.html" style="padding:15px; border-bottom:1px solid #eee; text-decoration:none; color:#333;">Profile</a>
        <a href="#" onclick="logout()" style="padding:15px; color:#EF4444; text-decoration:none; font-weight:bold;">Logout</a>
    </div>
  `;

  const style = document.createElement('style');
  style.innerHTML = `
    @media (max-width: 850px) {
      .desktop-nav { display: none !important; }
      .hamburger { display: flex !important; }
    }
    .msg-bubble img { cursor: zoom-in; transition: transform 0.2s; }
    .msg-bubble img:hover { transform: scale(1.02); }
  `;
  document.head.appendChild(style);
}

function toggleMenu() {
  const menu = document.getElementById("mobileMenu");
  if (menu) menu.style.display = (menu.style.display === "none" || menu.style.display === "") ? "flex" : "none";
}

/****************************************************
 * MESSAGING ENGINE
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
        const fingerprint = msg.type === "text" ? msg.text : msg.fileName;
        const lookupTag = btoa(unescape(encodeURIComponent(fingerprint)));
        const tempElement = document.querySelector(`[data-temp-tag="${lookupTag}"]`);
        
        if (tempElement) {
          tempElement.id = `msg-${msg.messageId}`;
          tempElement.removeAttribute('data-temp-tag');
          tempElement.style.opacity = "1";
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
  const tempTag = btoa(unescape(encodeURIComponent(fingerprint)));

  const container = document.getElementById("messages");
  const row = buildMessageRow({ messageId: 0, senderEmail: loggedInUser.email, ...payload });
  row.setAttribute('data-temp-tag', tempTag);
  row.style.opacity = "0.7";
  
  if (payload.type !== "text") {
    const bubble = row.querySelector(".msg-bubble");
    bubble.insertAdjacentHTML('beforeend', `
      <div class="progress-container" style="width:100%; height:4px; background:rgba(255,255,255,0.2); border-radius:2px; margin-top:8px; overflow:hidden;">
        <div class="progress-bar" style="width:10%; height:100%; background:#fff; transition: width 0.5s ease;"></div>
      </div>`);
    setTimeout(() => { 
      const bar = row.querySelector(".progress-bar");
      if(bar) bar.style.width = "80%"; 
    }, 100);
  }

  container.appendChild(row);
  container.scrollTop = container.scrollHeight;
  if (input) input.value = "";

  const isText = payload.type === "text";
  const url = isText ? `${API_URL}?module=sendMessage&conversationId=${activeConversationId}&senderEmail=${loggedInUser.email}&type=text&text=${encodeURIComponent(text)}` : API_URL;
  const options = isText ? {} : { method: "POST", body: JSON.stringify({ module: "sendMessage", conversationId: activeConversationId, senderEmail: loggedInUser.email, ...payload }) };

  fetch(url, options)
    .then(async (r) => {
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      syncMessages();
    })
    .catch((err) => {
      row.remove();
      showToast("Failed to send: " + err.message);
    });
}

/****************************************************
 * RENDERING
 ****************************************************/
function buildMessageRow(msg) {
  const isMe = msg.senderEmail === loggedInUser.email;
  const row = document.createElement("div");
  row.className = "msg-row";
  row.id = msg.messageId ? `msg-${msg.messageId}` : `temp-${Date.now()}`;
  row.style = `display:flex; margin-bottom:15px; gap:10px; align-items:flex-end; justify-content:${isMe ? 'flex-end' : 'flex-start'}; transition: all 0.3s ease;`;

  row.innerHTML = `
    <div class="msg-bubble" style="max-width:75%; padding:12px 16px; border-radius:18px; font-size:14px; background:${isMe ? "#4A6CFF" : "#F1F1F1"}; color:${isMe ? "#FFF" : "#111"}; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
      ${renderMessageContent(msg)}
    </div>
  `;
  return row;
}

function renderMessageContent(msg) {
  if (msg.type === "image") {
    return `<img src="${msg.fileData}" onclick="openImageOverlay('${msg.fileData}')" style="max-width:100%; border-radius:10px; display:block; margin:2px 0;">`;
  }
  if (msg.type === "document") {
    return `<div style="display:flex; align-items:center; gap:10px;"><span style="font-size:24px;">📄</span><a href="${msg.fileData}" download="${msg.fileName}" style="color:inherit; text-decoration:underline; font-weight:600; font-size:13px; word-break:break-all;">${msg.fileName}</a></div>`;
  }
  return msg.text || "";
}

/****************************************************
 * BOOTSTRAP
 ****************************************************/
async function initChat() {
  loadNavbar();
  showChatLoader();
  if (!activeConversationId) {
    const setupUrl = mode === "community" ? `${API_URL}?module=startCommunityConversation&communityId=${communityId}&userEmail=${loggedInUser.email}` : `${API_URL}?module=startConversation&userEmail=${loggedInUser.email}&otherEmail=${finalOtherEmail}`;
    const res = await fetch(setupUrl);
    const data = await res.json();
    activeConversationId = data.conversationId;
  }
  await syncMessages();
  hideChatLoader();
  setInterval(syncMessages, 4000);
}

document.addEventListener("DOMContentLoaded", () => {
  initChat();
  document.getElementById("sendBtn")?.addEventListener("click", () => sendMessage());
  document.getElementById("messageInput")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  
  const setupFile = (btnId, inputId, type) => {
    const btn = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    if (btn && input) {
      btn.onclick = () => input.click();
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
          if (file.size > 1024 * 1024 * 50) return showToast("File is too large (Max 50MB)");
          sendMessage({ type, fileName: file.name, fileData: await fileToBase64(file) });
        }
        e.target.value = "";
      };
    }
  };
  setupFile("uploadDocBtn", "docInput", "document");
  setupFile("uploadImgBtn", "imgInput", "image");
});

function showChatLoader() { document.getElementById("chatLoader")?.style.setProperty("display", "flex"); }
function hideChatLoader() { document.getElementById("chatLoader")?.style.setProperty("display", "none"); }
function logout() { localStorage.removeItem("contact_user"); window.location.href = "index.html"; }

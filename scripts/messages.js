/****************************************************
 * CONTACT.COM — OPTIMIZED RENDERING & RESPONSIVE MEDIA
 ****************************************************/

const API_URL = "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

/* --- CSS INJECTION FOR RESPONSIVE IMAGES --- */
const style = document.createElement('style');
style.innerHTML = `
  .chat-image-container {
    width: 100%;
    margin-top: 5px;
  }
  .chat-image {
    max-width: 100%;
    max-height: 300px;
    height: auto;
    border-radius: 10px;
    display: block;
    cursor: pointer;
    object-fit: contain;
    background: rgba(0,0,0,0.05);
    transition: transform 0.2s;
  }
  .chat-image:hover { transform: scale(1.02); }
  .chat-doc {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: rgba(255,255,255,0.2);
    border-radius: 8px;
    text-decoration: none;
    color: inherit !important;
    font-size: 13px;
  }
`;
document.head.appendChild(style);

/* --- USER & STATE --- */
let loggedInUser = JSON.parse(localStorage.getItem("contact_user"));
if (!loggedInUser) window.location.href = "login.html";
loggedInUser.fullName = loggedInUser.fullName || loggedInUser.FullName || loggedInUser.email;

const url = new URL(window.location.href);
const communityId = url.searchParams.get("communityId");
const mode = communityId ? "community" : "private";
const finalOtherEmail = url.searchParams.get("otherEmail") || url.searchParams.get("email");
let chatTitle = url.searchParams.get("title") || "";
let activeConversationId = url.searchParams.get("conversationId") || null;

let messages = [];
let otherUser = null;
let communityMembers = [];
let pollingInterval = null;
let lastMessageJson = ""; // To prevent unnecessary re-renders

const BUBBLE_PALETTE = [
  { bg: "#4A6CFF", text: "#FFFFFF" },
  { bg: "#6F8CFF", text: "#FFFFFF" },
  { bg: "#8FA3FF", text: "#000000" }
];

/****************************************************
 * HELPERS
 ****************************************************/
const getInitials = (n) => (n || "?").split(" ").filter(Boolean).map(p => p[0]).join("").toUpperCase().substring(0, 2);
const fileToBase64 = (f) => new Promise(r => { const rd = new FileReader(); rd.onload = () => r(rd.result); rd.readAsDataURL(f); });

function getUserColor(email) {
  let hash = 0;
  for (let i = 0; i < (email || "").length; i++) { hash = (hash << 5) - hash + email.charCodeAt(i); hash |= 0; }
  return BUBBLE_PALETTE[Math.abs(hash) % BUBBLE_PALETTE.length];
}

/****************************************************
 * RENDERING LOGIC (FIXED & RESPONSIVE)
 ****************************************************/
function renderMessageContent(msg) {
  if (msg.type === "image" || (msg.fileData && msg.type === "image")) {
    return `<div class="chat-image-container">
              <img src="${msg.fileData}" class="chat-image" onclick="window.open(this.src, '_blank')">
            </div>`;
  }
  if (msg.type === "document") {
    return `<a href="${msg.fileData}" download="${msg.fileName}" class="chat-doc">📄 ${msg.fileName || "File"}</a>`;
  }
  return `<span>${msg.text || ""}</span>`;
}

function renderMessages(list) {
  // Prevent flicker: only re-render if data actually changed
  const currentJson = JSON.stringify(list);
  if (currentJson === lastMessageJson) return;
  lastMessageJson = currentJson;

  const container = document.getElementById("messages");
  if (!container) return;
  
  // Create a fragment for high-speed DOM updates
  const fragment = document.createDocumentFragment();

  list.forEach((msg) => {
    const isMe = msg.senderEmail === loggedInUser.email;
    const color = getUserColor(msg.senderEmail);
    
    // Resolve Sender Info
    let senderName, senderPic;
    if (isMe) {
      senderName = loggedInUser.fullName;
      senderPic = loggedInUser.profilePic;
    } else if (mode === "community") {
      const m = communityMembers.find(cm => cm.email === msg.senderEmail);
      senderName = m?.fullName || msg.senderEmail;
      senderPic = m?.profilePic;
    } else {
      senderName = otherUser?.fullName || finalOtherEmail;
      senderPic = otherUser?.profilePic;
    }

    const row = document.createElement("div");
    row.style.cssText = `display:flex; justify-content:${isMe ? 'flex-end' : 'flex-start'}; align-items:flex-end; margin-bottom:18px; gap:8px; width: 100%;`;

    const avatarHTML = senderPic 
      ? `<img class="chat-avatar" src="${senderPic}" style="width:32px; height:32px; border-radius:50%; object-fit:cover;" />`
      : `<div class="chat-avatar-fallback" style="width:32px; height:32px; border-radius:50%; background:#ccc; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:bold;">${getInitials(senderName)}</div>`;

    const bubble = `
      ${!isMe ? avatarHTML : ''}
      <div style="max-width:75%; display:flex; flex-direction:column; align-items:${isMe ? 'flex-end' : 'flex-start'};">
        <div style="font-size:10px; color:#888; margin-bottom:2px; margin-left:4px; margin-right:4px;">${senderName.split(' ')[0]}</div>
        <div style="background:${isMe ? color.bg : '#E9ECEF'}; color:${isMe ? color.text : '#212529'}; padding:10px 14px; border-radius:${isMe ? '16px 16px 2px 16px' : '16px 16px 16px 2px'}; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
          ${renderMessageContent(msg)}
        </div>
      </div>
      ${isMe ? avatarHTML : ''}
    `;

    row.innerHTML = bubble;
    fragment.appendChild(row);
  });

  container.innerHTML = "";
  container.appendChild(fragment);
  container.scrollTop = container.scrollHeight;
}

/****************************************************
 * DATA & POLLING
 ****************************************************/
async function loadMessages() {
  if (!activeConversationId) return;
  try {
    const r = await fetch(`${API_URL}?module=getMessages&conversationId=${activeConversationId}`);
    const data = await r.json();
    let backendMessages = (data.messages || []).slice(-15); // Limit for speed
    const optimistic = messages.filter(m => m.optimistic);
    messages = [...backendMessages, ...optimistic];
    renderMessages(messages);
  } catch (e) { console.error("Poll error"); }
}

function startPolling() {
  if (pollingInterval) clearInterval(pollingInterval);
  loadMessages();
  pollingInterval = setInterval(loadMessages, 1500); // 1.5s is smoother for GS limit
}

function sendMessage(payloadOverride = null) {
  const input = document.getElementById("messageInput");
  const text = (input?.value || "").trim();
  if (!payloadOverride && !text) return;

  const payload = payloadOverride || { module: "sendMessage", type: "text", text: text };
  
  // Optimistic UI
  const opt = { ...payload, senderEmail: loggedInUser.email, optimistic: true, timestamp: Date.now() };
  messages.push(opt);
  renderMessages(messages);
  if (input) input.value = "";

  const body = JSON.stringify({ ...payload, conversationId: activeConversationId, senderEmail: loggedInUser.email, module: "sendMessage" });
  
  fetch(API_URL, { method: "POST", body: body })
    .then(r => r.json())
    .then(d => { if(d.success) loadMessages(); })
    .catch(e => console.error("Send failed", e));
}

/****************************************************
 * APP INIT
 ****************************************************/
document.addEventListener("DOMContentLoaded", async () => {
  // Load Navbar & Headers
  if (mode === "private") {
    document.getElementById("memberSidebar")?.remove();
    const r = await fetch(`${API_URL}?module=getUserByEmail&email=${encodeURIComponent(finalOtherEmail)}`);
    const d = await r.json();
    otherUser = d?.user || {};
    document.getElementById("headerTitle").innerText = chatTitle || otherUser.fullName || finalOtherEmail;
    startConversation();
  } else {
    await loadCommunityInfo();
    await primeCommunityMembers();
    await startCommunityConversation();
  }

  // Event Listeners
  document.getElementById("sendBtn").onclick = () => sendMessage();
  document.getElementById("messageInput").onkeydown = (e) => { if(e.key === "Enter") sendMessage(); };
  
  // Multi-modal Uploads
  const handleUpload = async (e, type) => {
    const file = e.target.files[0];
    if (file) {
      const b64 = await fileToBase64(file);
      sendMessage({ type: type, fileName: file.name, fileData: b64 });
    }
    e.target.value = "";
  };
  document.getElementById("imgInput").onchange = (e) => handleUpload(e, "image");
  document.getElementById("docInput").onchange = (e) => handleUpload(e, "document");
  document.getElementById("uploadImgBtn").onclick = () => document.getElementById("imgInput").click();
  document.getElementById("uploadDocBtn").onclick = () => document.getElementById("docInput").click();
});

/* Original logic for Start Conversation preserved... */
function startConversation() {
  fetch(`${API_URL}?module=startConversation&userEmail=${loggedInUser.email}&otherEmail=${finalOtherEmail}`)
    .then(r => r.json()).then(d => { activeConversationId = d.conversationId; startPolling(); });
}
async function startCommunityConversation() {
  const r = await fetch(`${API_URL}?module=startCommunityConversation&communityId=${communityId}&userEmail=${loggedInUser.email}`);
  const d = await r.json();
  activeConversationId = d.conversationId;
  startPolling();
}
async function loadCommunityInfo() {
  const r = await fetch(`${API_URL}?module=getCommunityById&communityId=${communityId}`);
  const d = await r.json();
  document.getElementById("headerTitle").innerText = d?.community?.name || "Community";
}
async function primeCommunityMembers() {
  const r = await fetch(`${API_URL}?module=getCommunityMembers&communityId=${communityId}`);
  const d = await r.json();
  communityMembers = d.members || [];
}

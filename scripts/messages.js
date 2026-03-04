/****************************************************
 * CONTACT.COM — FAST MESSAGES.JS (FIXED RENDERING)
 ****************************************************/

const API_URL = "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

/* --- RESPONSIVE IMAGE CSS --- */
const style = document.createElement('style');
style.innerHTML = `
  .chat-image {
    max-width: 100%;
    max-height: 350px;
    height: auto;
    border-radius: 8px;
    display: block;
    margin-top: 5px;
    object-fit: contain;
    cursor: pointer;
  }
  .chat-avatar {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    object-fit: cover;
  }
  .chat-avatar-fallback {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: #dbe4ff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    color: #4A6CFF;
    font-size: 14px;
  }
`;
document.head.appendChild(style);

/* USER */
let loggedInUser = JSON.parse(localStorage.getItem("contact_user"));
if (!loggedInUser) window.location.href = "login.html";
loggedInUser.fullName = loggedInUser.fullName || loggedInUser.FullName || loggedInUser.email;
loggedInUser.profilePic = loggedInUser.profilePic || loggedInUser.ProfilePic || null;

/* URL PARAMS */
const url = new URL(window.location.href);
const otherEmailParam = url.searchParams.get("otherEmail");
const conversationIdParam = url.searchParams.get("conversationId");
const communityId = url.searchParams.get("communityId");
const mode = communityId ? "community" : "private";

const paramEmail = url.searchParams.get("email");
const paramTitle = url.searchParams.get("title");
const finalOtherEmail = otherEmailParam || paramEmail;
let chatTitle = paramTitle || "";

let activeConversationId = conversationIdParam || null;
let messages = [];
let otherUser = null;
let communityMembers = [];
let pollingInterval = null;

const BUBBLE_PALETTE = [
  { bg: "#4A6CFF", text: "#FFFFFF" },
  { bg: "#6F8CFF", text: "#FFFFFF" },
  { bg: "#8FA3FF", text: "#000000" }
];

/****************************************************
 * HELPERS & RENDERING ENGINE
 ****************************************************/
function getUserColor(email) {
  if (!email) return BUBBLE_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = (hash << 5) - hash + email.charCodeAt(i);
    hash |= 0;
  }
  return BUBBLE_PALETTE[Math.abs(hash) % BUBBLE_PALETTE.length];
}

function getInitials(name) {
  if (!name) return "?";
  return name.split(" ").filter(Boolean).map((p) => p[0]).join("").substring(0, 2).toUpperCase();
}

function fileToBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

function renderMessageContent(msg) {
  if (msg.type === "image") {
    return `<img src="${msg.fileData}" class="chat-image" onclick="window.open(this.src)">`;
  }
  if (msg.type === "document") {
    return `<a href="${msg.fileData}" download="${msg.fileName}" class="chat-doc">📄 ${msg.fileName}</a>`;
  }
  return msg.text || "";
}

/* --- THE UNIFIED RENDERER --- */
function renderMessages(list) {
  const container = document.getElementById("messages");
  if (!container) return;
  container.innerHTML = "";

  list.forEach((msg) => {
    const isMe = msg.senderEmail === loggedInUser.email;
    
    // Member Lookup Logic
    let senderName, senderPic;
    if (isMe) {
      senderName = loggedInUser.fullName;
      senderPic = loggedInUser.profilePic;
    } else if (mode === "community") {
      const member = communityMembers.find(m => m.email === msg.senderEmail);
      senderName = member ? member.fullName : msg.senderEmail;
      senderPic = member ? member.profilePic : null;
    } else {
      senderName = otherUser?.fullName || finalOtherEmail;
      senderPic = otherUser?.profilePic;
    }

    const initials = getInitials(senderName);
    const avatarHTML = senderPic 
      ? `<img class="chat-avatar" src="${senderPic}" />`
      : `<div class="chat-avatar-fallback">${initials}</div>`;

    const color = getUserColor(msg.senderEmail);
    const contentHTML = renderMessageContent(msg);

    const messageRow = document.createElement("div");
    messageRow.style.cssText = `display:flex; align-items:flex-start; margin-bottom:18px; gap:10px; ${isMe ? 'justify-content:flex-end;' : ''}`;

    const bubbleHTML = `
      ${!isMe ? `<div style="width:70px;text-align:center;">${avatarHTML}<div style="font-size:12px;color:#666;margin-top:4px;">${senderName.split(' ')[0]}</div></div>` : ''}
      <div style="max-width:65%;">
        <div style="background:${isMe ? color.bg : '#eee'}; color:${isMe ? color.text : '#333'}; padding:10px 14px; border-radius:14px; word-break: break-word;">
          ${contentHTML}
        </div>
      </div>
      ${isMe ? `<div style="width:70px;text-align:center;">${avatarHTML}<div style="font-size:12px;color:#666;margin-top:4px;">${senderName.split(' ')[0]}</div></div>` : ''}
    `;

    messageRow.innerHTML = bubbleHTML;
    container.appendChild(messageRow);
  });

  container.scrollTop = container.scrollHeight;
}

/****************************************************
 * DATA FETCHING
 ****************************************************/
async function loadMessages() {
  if (!activeConversationId) return;
  const r = await fetch(`${API_URL}?module=getMessages&conversationId=${activeConversationId}`);
  const data = await r.json();
  let backendMessages = (data.messages || []).slice(-15);
  const optimistic = messages.filter((m) => m.optimistic);
  messages = [...backendMessages, ...optimistic];
  renderMessages(messages);
}

function startPolling() {
  if (pollingInterval) clearInterval(pollingInterval);
  loadMessages();
  pollingInterval = setInterval(() => { if (activeConversationId) loadMessages(); }, 1500); 
}

/* Preserved Community Member Logic with fix for rendering triggers */
async function hydrateMemberProfiles(emails) {
  const fullProfiles = [];
  for (const email of emails) {
    try {
      const r = await fetch(`${API_URL}?module=getUserByEmail&email=${encodeURIComponent(email)}`);
      const d = await r.json();
      const u = d?.user || {};
      fullProfiles.push({
        email,
        fullName: u.fullName || u.FullName || email,
        profilePic: u.profilePic || u.ProfilePic || null
      });
    } catch {
      fullProfiles.push({ email, fullName: email, profilePic: null });
    }
  }
  communityMembers = fullProfiles;
  cacheMembers(fullProfiles);
  renderCommunityMembersList(fullProfiles);
  renderMessages(messages); // Re-render chat now that we have names/pics
}

/****************************************************
 * BOOTSTRAP
 ****************************************************/
document.addEventListener("DOMContentLoaded", async () => {
  loadNavbar();
  
  if (mode === "private") {
    document.getElementById("memberSidebar")?.style.setProperty('display', 'none');
    await loadOtherUserProfile();
  } else {
    await loadCommunityInfo();
    await primeCommunityMembers(); // This now triggers a re-render once profiles load
  }

  // Messaging Setup
  if (activeConversationId) {
    startPolling();
  } else if (mode === "community") {
    await startCommunityConversation();
  } else if (finalOtherEmail) {
    startConversation();
  }

  // Event Listeners
  document.getElementById("sendBtn").onclick = () => sendMessage();
  document.getElementById("messageInput").onkeydown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };
  
  // File Upload Logic (Preserved from your original)
  const setupUpload = (btnId, inputId, type) => {
    const btn = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    if(btn && input) {
      btn.onclick = () => input.click();
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if(!file) return;
        const base64 = await fileToBase64(file);
        sendMessage({ type, fileName: file.name, fileData: base64 });
        e.target.value = "";
      };
    }
  };
  setupUpload("uploadDocBtn", "docInput", "document");
  setupUpload("uploadImgBtn", "imgInput", "image");
});

// Original navigation and messaging helper functions (sendMessage, logout, etc) 
// remain as provided in your script to maintain backend compatibility.

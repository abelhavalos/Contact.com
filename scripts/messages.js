/****************************************************
 * CONTACT.COM — FAST MESSAGES.JS (PRIVATE + COMMUNITY)
 ****************************************************/

const API_URL =
  "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

/* USER */
let loggedInUser = JSON.parse(localStorage.getItem("contact_user"));
if (!loggedInUser) window.location.href = "login.html";
loggedInUser.fullName =
  loggedInUser.fullName || loggedInUser.FullName || loggedInUser.email;
loggedInUser.profilePic =
  loggedInUser.profilePic || loggedInUser.ProfilePic || null;

/* URL PARAMS */
const url = new URL(window.location.href);

// Original params
const otherEmailParam = url.searchParams.get("otherEmail");
const conversationIdParam = url.searchParams.get("conversationId");
const communityId = url.searchParams.get("communityId");
const mode = communityId ? "community" : "private";

// Event → private chat params
const paramEmail = url.searchParams.get("email");
const paramName = url.searchParams.get("name");
const paramTitle = url.searchParams.get("title");

// Normalize private chat target
const finalOtherEmail = otherEmailParam || paramEmail;

// Store event title for header
let chatTitle = paramTitle || "";

let activeConversationId = conversationIdParam || null;
let messages = [];
let otherUser = null;
let communityMembers = [];

const BUBBLE_PALETTE = [
  { bg: "#4A6CFF", text: "#FFFFFF" },
  { bg: "#6F8CFF", text: "#FFFFFF" },
  { bg: "#8FA3FF", text: "#000000" },
  { bg: "#AFC0FF", text: "#000000" },
  { bg: "#D1DDFF", text: "#000000" }
];

let pollingInterval = null;

/****************************************************
 * HELPERS
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
  return name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
}

function fileToBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

/****************************************************
 * NAVBAR
 ****************************************************/
function loadNavbar() {
  const nav = document.getElementById("navbar");
  if (nav) {
    nav.innerHTML = `
      <div class="hamburger" onclick="toggleMenu()">
        <span></span><span></span><span></span>
      </div>
      <div class="logo">Contact<span>.</span>com</div>
      <div class="nav-links">
        <a href="dashboard.html">Dashboard</a>
        <a href="communities.html">Communities</a>
        <a href="events.html">Events</a>
        <a href="contacts.html">Contacts</a>
        <a href="profile.html">Profile</a>
        <a href="#" onclick="logout()">Logout</a>
      </div>
    `;
  }

  const mobileMenu = document.getElementById("mobileMenu");
  if (mobileMenu) {
    mobileMenu.innerHTML = `
      <a href="dashboard.html">Dashboard</a>
      <a href="communities.html">Communities</a>
      <a href="events.html">Events</a>
      <a href="contacts.html">Contacts</a>
      <a href="profile.html">Profile</a>
      <a href="#" onclick="logout()">Logout</a>
    `;
  }
}

function toggleMenu() {
  const menu = document.getElementById("mobileMenu");
  if (menu) menu.classList.toggle("show");
}

function logout() {
  localStorage.removeItem("contact_user");
  window.location.href = "index.html";
}

/****************************************************
 * CACHE
 ****************************************************/
function cacheMessages() {
  if (!activeConversationId) return;
  localStorage.setItem(
    "cached_messages_" + activeConversationId,
    JSON.stringify(messages)
  );
}

function loadCachedMessages() {
  const raw = localStorage.getItem("cached_messages_" + activeConversationId);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function cacheMembers(list) {
  if (!communityId) return;
  localStorage.setItem(
    "cached_members_" + communityId,
    JSON.stringify(list)
  );
}

function loadCachedMembers() {
  const raw = localStorage.getItem("cached_members_" + communityId);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/****************************************************
 * PRIVATE CHAT HEADER — FIXED FOR EVENT TITLE
 ****************************************************/
async function loadOtherUserProfile() {
  const r = await fetch(
    `${API_URL}?module=getUserByEmail&email=${encodeURIComponent(finalOtherEmail)}`
  );
  const d = await r.json();
  otherUser = d?.user || {};

  const otherFullName =
    otherUser.fullName || otherUser.FullName || finalOtherEmail;
  const otherInitials = getInitials(otherFullName);

  const otherAvatarHTML =
    otherUser.profilePic || otherUser.ProfilePic
      ? `<img class="chat-avatar" src="${otherUser.profilePic || otherUser.ProfilePic}" />`
      : `<div class="chat-avatar-fallback">${otherInitials}</div>`;

  if (chatTitle) {
    document.getElementById("headerTitle").innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;">
        <span>${chatTitle}</span>
      </div>
    `;
  } else {
    document.getElementById("headerTitle").innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;">
        ${otherAvatarHTML}
        <span>${otherFullName}</span>
      </div>
    `;
  }
}

/****************************************************
 * COMMUNITY HEADER
 ****************************************************/
async function loadCommunityInfo() {
  const r = await fetch(
    `${API_URL}?module=getCommunityById&communityId=${communityId}`
  );
  const d = await r.json();
  const name = d?.community?.name || "Community";

  document.getElementById("headerTitle").innerHTML = `
    <div style="display:flex;align-items:center;">
      <span>${name}</span>
    </div>
  `;
}

function renderCommunityMembersSkeletons(count = 8) {
  const container = document.getElementById("memberSidebar");
  if (!container) return;

  container.innerHTML = "<h3>Members</h3>";

  for (let i = 0; i < count; i++) {
    container.innerHTML += `
      <div class="member" style="margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:10px;">

          <!-- Skeleton avatar (44×44 px, blue‑tinted) -->
          <div style="
            width:44px;
            height:44px;
            border-radius:50%;
            background:#dbe4ff;
            animation:pulse 1.4s ease-in-out infinite;
          "></div>

          <!-- Skeleton name bar (60% width, blue‑tinted) -->
          <div style="
            width:60%;
            height:14px;
            border-radius:6px;
            background:#e6ecff;
            animation:pulse 1.4s ease-in-out infinite;
          "></div>

        </div>
      </div>
    `;
  }
}

// Pulse animation for skeletons
const skeletonStyle = document.createElement("style");
skeletonStyle.innerHTML = `
@keyframes pulse {
  0% { opacity: 0.55; }
  50% { opacity: 1; }
  100% { opacity: 0.55; }
}
`;
document.head.appendChild(skeletonStyle);

/****************************************************
 * COMMUNITY MEMBERS
 ****************************************************/
async function primeCommunityMembers() {
  const cached = loadCachedMembers();

  if (cached.length) {
    communityMembers = cached;
    renderCommunityMembersList(cached);
  } else {
    renderCommunityMembersSkeletons(8);
  }

  await loadCommunityMembers();
}

async function loadCommunityMembers() {
  const r = await fetch(
    `${API_URL}?module=getCommunityMembers&communityId=${communityId}`
  );
  const d = await r.json();

  const emails = (d.members || []).map((m) =>
    typeof m === "string" ? m : m.email
  );

  renderCommunityMembersSkeletons(emails.length || 8);
  hydrateMemberProfiles(emails);
}

async function hydrateMemberProfiles(emails) {
  const fullProfiles = [];

  for (const email of emails) {
    try {
      const r = await fetch(
        `${API_URL}?module=getUserByEmail&email=${encodeURIComponent(email)}`
      );
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
}

function renderCommunityMembersList(list) {
  const container = document.getElementById("memberSidebar");
  if (!container) return;

  container.innerHTML = "<h3>Members</h3>";

  list.forEach((m) => {
    const initials = getInitials(m.fullName);

    const avatarHTML = m.profilePic
      ? `<img class="chat-avatar" src="${m.profilePic}" />`
      : `<div class="chat-avatar-fallback">${initials}</div>`;

    container.innerHTML += `
      <div class="member" style="margin-bottom:16px; cursor:pointer;"
           onclick="window.location.href='public-profile.html?email=${encodeURIComponent(
             m.email
           )}'">
        <div style="display:flex;align-items:center;gap:10px;">
          ${avatarHTML}
          <div style="font-weight:600;">${m.fullName}</div>
        </div>
      </div>
    `;
  });
}

/****************************************************
 * CONVERSATION SETUP — FIXED FOR EVENT CHAT
 ****************************************************/
function startConversation() {
  fetch(
    `${API_URL}?module=startConversation&userEmail=${loggedInUser.email}&otherEmail=${finalOtherEmail}`
  )
    .then((r) => r.json())
    .then((d) => {
      activeConversationId = d.conversationId;
      primeMessages();
      startPolling();
    });
}

async function startCommunityConversation() {
  const r = await fetch(
    `${API_URL}?module=startCommunityConversation&communityId=${communityId}&userEmail=${loggedInUser.email}`
  );
  const d = await r.json();
  activeConversationId = d.conversationId;

  await primeCommunityMembers();
  primeMessages();
  startPolling();
}

/****************************************************
 * MESSAGES — CACHE-FIRST + POLLING
 ****************************************************/
function primeMessages() {
  const cached = loadCachedMessages();
  if (cached.length) {
    messages = cached;
    renderMessages(messages);
  }
}

function startPolling() {
  if (pollingInterval) clearInterval(pollingInterval);
  loadMessages();
  pollingInterval = setInterval(() => {
    if (activeConversationId) {
      loadMessages();
    }
  }, 200);
}

async function loadMessages() {
  const r = await fetch(
    `${API_URL}?module=getMessages&conversationId=${activeConversationId}`
  );
  const data = await r.json();

  let backendMessages = data.messages || [];

  // Only take the last 10 messages
  backendMessages = backendMessages.slice(-10);

  const optimistic = messages.filter((m) => m.optimistic);

  messages = [...backendMessages, ...optimistic];

  renderMessages(messages);
}

/****************************************************
 * RENDERING
 ****************************************************/
function renderMessageContent(msg) {
  if (msg.type === "image") {
    return `<img src="${msg.fileData}" class="chat-image">`;
  }

  if (msg.type === "document") {
    return `
      <a href="${msg.fileData}" download="${msg.fileName}" class="chat-doc">
        📄 ${msg.fileName}
      </a>
    `;
  }

  // Default: text message
  return msg.text || "";
}

function renderMessages(list) {
  if (mode === "community") {
    renderCommunityMessages(list);
  } else {
    renderPrivateMessages(list);
  }
}

function renderPrivateMessages(list) {
  const container = document.getElementById("messages");
  if (!container) return;
  container.innerHTML = "";

  const fullName =
    otherUser?.fullName || otherUser?.FullName || finalOtherEmail;
  const initials = getInitials(fullName);

  const avatarHTML =
    otherUser?.profilePic || otherUser?.ProfilePic
      ? `<img class="chat-avatar" src="${otherUser.profilePic || otherUser.ProfilePic}" />`
      : `<div class="chat-avatar-fallback">${initials}</div>`;

  list.forEach((msg) => {
    const isMe = msg.senderEmail === loggedInUser.email;

    const contentHTML = renderMessageContent(msg);

    if (isMe) {
      const color = getUserColor(loggedInUser.email);
      const myInitials = getInitials(loggedInUser.fullName);

      const myAvatarHTML = loggedInUser.profilePic
        ? `<img class="chat-avatar" src="${loggedInUser.profilePic}" />`
        : `<div class="chat-avatar-fallback">${myInitials}</div>`;

      container.innerHTML += `
        <div style="display:flex;justify-content:flex-end;align-items:flex-start;margin-bottom:18px;gap:10px;">
          <div style="max-width:60%;">
            <div style="background:${color.bg};color:${color.text};padding:10px 14px;border-radius:14px;">
              ${contentHTML}
            </div>
          </div>
          <div style="width:70px;text-align:center;">
            ${myAvatarHTML}
            <div style="font-size:12px;color:#666;margin-top:4px;">${loggedInUser.fullName}</div>
          </div>
        </div>
      `;
    } else {
      const color = getUserColor(finalOtherEmail);

      container.innerHTML += `
        <div style="display:flex;align-items:flex-start;margin-bottom:18px;gap:10px;">
          <div style="width:70px;text-align:center;">
            ${avatarHTML}
            <div style="font-size:12px;color:#666;margin-top:4px;">${fullName}</div>
          </div>
          <div style="max-width:60%;">
            <div style="background:${color.bg};color:${color.text};padding:10px 14px;border-radius:14px;">
              ${contentHTML}
            </div>
          </div>
        </div>
      `;
    }
  });

  container.scrollTop = container.scrollHeight;
}

function renderCommunityMessages(list) {
  const container = document.getElementById("messages");
  if (!container) return;
  container.innerHTML = "";

  list.forEach((msg) => {
    const isMe = msg.senderEmail === loggedInUser.email;

    const sender = communityMembers.find(
      (m) => m.email === msg.senderEmail
    );

    const fullName = isMe
      ? loggedInUser.fullName
      : sender?.fullName || msg.senderEmail;

    const color = getUserColor(msg.senderEmail);
    const initials = getInitials(fullName);

    const avatarHTML = sender?.profilePic
      ? `<img class="chat-avatar" src="${sender.profilePic}" />`
      : `<div class="chat-avatar-fallback">${initials}</div>`;

    const contentHTML = renderMessageContent(msg);

    if (isMe) {
      container.innerHTML += `
        <div style="display:flex;justify-content:flex-end;align-items:flex-start;margin-bottom:18px;gap:10px;">
          <div style="max-width:60%;">
            <div style="background:${color.bg};color:${color.text};padding:10px 14px;border-radius:14px;">
              ${contentHTML}
            </div>
          </div>
          <div style="width:70px;text-align:center;">
            ${avatarHTML}
            <div style="font-size:12px;color:#666;margin-top:4px;">${fullName}</div>
          </div>
        </div>
      `;
    } else {
      container.innerHTML += `
        <div style="display:flex;align-items:flex-start;margin-bottom:18px;gap:10px;">
          <div style="width:70px;text-align:center;">
            ${avatarHTML}
            <div style="font-size:12px;color:#666;margin-top:4px;">${fullName}</div>
          </div>
          <div style="max-width:60%;">
            <div style="background:${color.bg};color:${color.text};padding:10px 14px;border-radius:14px;">
              ${contentHTML}
            </div>
          </div>
        </div>
      `;
    }
  });

  container.scrollTop = container.scrollHeight;
}

/****************************************************
 * SEND — OPTIMISTIC
 ****************************************************/
/*function sendMessage(payloadOverride = null) {
  const input = document.getElementById("messageInput");
  const text = (input?.value || "").trim();

  const isTextMessage = !payloadOverride;

  if (isTextMessage && (!text || !activeConversationId)) return;

  const payload = payloadOverride || {
    type: "text",
    text: text
  };

  const optimisticMsg = {
    id: "temp_" + Date.now(),
    senderEmail: loggedInUser.email,
    type: payload.type,
    text: payload.type === "text" ? payload.text : `[${payload.type} uploaded]`,
    fileName: payload.fileName || null,
    fileData: payload.fileData || null,
    optimistic: true,
    timestamp: Date.now()
  };

  messages.push(optimisticMsg);
  renderMessages(messages);

  const url =
    `${API_URL}?module=sendMessage`
    + `&conversationId=${encodeURIComponent(activeConversationId)}`
    + `&senderEmail=${encodeURIComponent(loggedInUser.email)}`
    + `&type=${encodeURIComponent(payload.type)}`;

  const body = payload.type === "text"
    ? null
    : JSON.stringify({
        fileName: payload.fileName,
        fileData: payload.fileData
      });

  fetch(url, {
    method: payload.type === "text" ? "GET" : "POST",
    headers: payload.type === "text" ? {} : { "Content-Type": "application/json" },
    body: body
  })
    .then((r) => r.json())
    .then((data) => {
      if (data.success) {
        messages = messages.filter((m) => !m.optimistic);
        loadMessages();
      }
    })
    .catch((err) => console.error("Send failed", err));

  if (isTextMessage && input) input.value = "";
}
*/

function sendMessage(payloadOverride = null) {
  const input = document.getElementById("messageInput");
  const text = (input?.value || "").trim();

  const isTextMessage = !payloadOverride;

  if (isTextMessage && (!text || !activeConversationId)) return;

  const payload = payloadOverride || {
    module: "sendMessage",
    type: "text",
    text: text
  };

  const optimisticMsg = {
    id: "temp_" + Date.now(),
    senderEmail: loggedInUser.email,
    type: payload.type,
    text: payload.type === "text" ? payload.text : `[${payload.type} uploaded]`,
    fileName: payload.fileName || null,
    fileData: payload.fileData || null,
    optimistic: true,
    timestamp: Date.now()
  };

  messages.push(optimisticMsg);
  renderMessages(messages);

  // ⭐ TEXT MESSAGES → GET (safe)
  if (payload.type === "text") {
    const url =
      `${API_URL}?module=sendMessage`
      + `&conversationId=${encodeURIComponent(activeConversationId)}`
      + `&senderEmail=${encodeURIComponent(loggedInUser.email)}`
      + `&type=text`
      + `&text=${encodeURIComponent(payload.text)}`;

    fetch(url, { method: "GET" })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          messages = messages.filter((m) => !m.optimistic);
          loadMessages();
        }
      })
      .catch((err) => console.error("Send failed", err));

    if (input) input.value = "";
    return;
  }

  // ⭐ FILE MESSAGES → POST (NO query params, EXACTLY like profile.js)
  const body = JSON.stringify({
  module: "sendMessage",
  conversationId: activeConversationId,
  senderEmail: loggedInUser.email,
  type: payload.type,
  fileName: payload.fileName,
  fileData: payload.fileData
});

fetch(API_URL, {
  method: "POST",
  body: body   // ⭐ no headers → same behavior as profile.js
})
  .then((r) => r.json())
  .then((data) => {
    if (data.success) {
      messages = messages.filter((m) => !m.optimistic);
      loadMessages();
    }
  })
  .catch((err) => console.error("Send failed", err));
}

/****************************************************
 * DOM READY
 ****************************************************/
document.addEventListener("DOMContentLoaded", async () => {
  loadNavbar();

  if (mode === "private") {
    const toggle = document.getElementById("toggleMembers");
    const sidebar = document.getElementById("memberSidebar");
    if (toggle) toggle.style.display = "none";
    if (sidebar) sidebar.style.display = "none";
    await loadOtherUserProfile();
  }

  if (mode === "community") {
    await loadCommunityInfo();
    await primeCommunityMembers();
  }

  const sendBtn = document.getElementById("sendBtn");
  if (sendBtn) sendBtn.onclick = () => sendMessage();

  const messageInput = document.getElementById("messageInput");
  if (messageInput) {
    messageInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  const toggleMembersBtn = document.getElementById("toggleMembers");
  if (toggleMembersBtn) {
    toggleMembersBtn.onclick = () => {
      document.getElementById("memberSidebar").classList.toggle("show");
    };
  }

  const uploadDocBtn = document.getElementById("uploadDocBtn");
  const uploadImgBtn = document.getElementById("uploadImgBtn");
  const docInput = document.getElementById("docInput");
  const imgInput = document.getElementById("imgInput");

  if (uploadDocBtn && docInput) {
    uploadDocBtn.onclick = () => docInput.click();

    docInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const base64 = await fileToBase64(file);

      sendMessage({
        type: "document",
        fileName: file.name,
        fileData: base64
      });

      e.target.value = "";
    });
  }

  if (uploadImgBtn && imgInput) {
    uploadImgBtn.onclick = () => imgInput.click();

    imgInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const base64 = await fileToBase64(file);

      sendMessage({
        type: "image",
        fileName: file.name,
        fileData: base64
      });

      e.target.value = "";
    });
  }

  if (activeConversationId) {
    primeMessages();
    startPolling();
  } else if (mode === "community") {
    await startCommunityConversation();
  } else if (finalOtherEmail) {
    startConversation();
  }
});

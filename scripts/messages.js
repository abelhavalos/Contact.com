/****************************************************
 * CONTACT.COM — ULTRA FAST MESSAGES.JS
 * - Full history load (no slicing)
 * - No caching
 * - Instant optimistic send
 * - Append-only rendering (no full re-render)
 * - Modern clean UI
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
const otherEmailParam = url.searchParams.get("otherEmail");
const conversationIdParam = url.searchParams.get("conversationId");
const communityId = url.searchParams.get("communityId");
const mode = communityId ? "community" : "private";

const paramEmail = url.searchParams.get("email");
const paramTitle = url.searchParams.get("title");
const finalOtherEmail = otherEmailParam || paramEmail;
let chatTitle = paramTitle || "";

/* STATE */
let activeConversationId = conversationIdParam || null;
let messages = [];
let communityMembers = [];
let otherUser = null;

/* COLORS */
const BUBBLE_PALETTE = [
  { bg: "#4A6CFF", text: "#FFFFFF" },
  { bg: "#6F8CFF", text: "#FFFFFF" },
  { bg: "#8FA3FF", text: "#000000" },
  { bg: "#AFC0FF", text: "#000000" },
  { bg: "#D1DDFF", text: "#000000" }
];

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
 * HEADERS
 ****************************************************/
async function loadOtherUserProfile() {
  const r = await fetch(
    `${API_URL}?module=getUserByEmail&email=${encodeURIComponent(finalOtherEmail)}`
  );
  const d = await r.json();
  otherUser = d?.user || {};

  const fullName =
    otherUser.fullName || otherUser.FullName || finalOtherEmail;
  const initials = getInitials(fullName);

  const avatar =
    otherUser.profilePic || otherUser.ProfilePic
      ? `<img class="chat-avatar" src="${otherUser.profilePic || otherUser.ProfilePic}" />`
      : `<div class="chat-avatar-fallback">${initials}</div>`;

  const header = document.getElementById("headerTitle");
  if (!header) return;

  header.innerHTML = chatTitle
    ? `<div class="chat-header"><div class="chat-header-main">${chatTitle}</div></div>`
    : `<div class="chat-header">${avatar}<div class="chat-header-main">${fullName}</div></div>`;
}

async function loadCommunityInfo() {
  const r = await fetch(
    `${API_URL}?module=getCommunityById&communityId=${communityId}`
  );
  const d = await r.json();
  const name = d?.community?.name || "Community";

  const header = document.getElementById("headerTitle");
  if (!header) return;

  header.innerHTML = `
    <div class="chat-header">
      <div class="chat-header-main">${name}</div>
    </div>
  `;
}

/****************************************************
 * COMMUNITY MEMBERS
 ****************************************************/
async function loadCommunityMembers() {
  const r = await fetch(
    `${API_URL}?module=getCommunityMembers&communityId=${communityId}`
  );
  const d = await r.json();

  const emails = (d.members || []).map((m) =>
    typeof m === "string" ? m : m.email
  );

  const tasks = emails.map(async (email) => {
    try {
      const r = await fetch(
        `${API_URL}?module=getUserByEmail&email=${encodeURIComponent(email)}`
      );
      const d = await r.json();
      const u = d?.user || {};

      return {
        email,
        fullName: u.fullName || u.FullName || email,
        profilePic: u.profilePic || u.ProfilePic || null
      };
    } catch {
      return { email, fullName: email, profilePic: null };
    }
  });

  communityMembers = await Promise.all(tasks);
  renderCommunityMembersList(communityMembers);
}

function renderCommunityMembersList(list) {
  const container = document.getElementById("memberSidebar");
  if (!container) return;

  container.innerHTML = "<h3>Members</h3>";
  const fragment = document.createDocumentFragment();

  list.forEach((m) => {
    const initials = getInitials(m.fullName);
    const avatar = m.profilePic
      ? `<img class="chat-avatar" src="${m.profilePic}" />`
      : `<div class="chat-avatar-fallback">${initials}</div>`;

    const row = document.createElement("div");
    row.className = "member";
    row.style.cursor = "pointer";
    row.style.marginBottom = "12px";
    row.onclick = () =>
      (window.location.href = `public-profile.html?email=${encodeURIComponent(
        m.email
      )}`);

    row.innerHTML = `
      <div class="member-row">
        ${avatar}
        <div class="member-name">${m.fullName}</div>
      </div>
    `;

    fragment.appendChild(row);
  });

  container.appendChild(fragment);
}

/****************************************************
 * MESSAGES — ONE-SHOT FULL LOAD
 ****************************************************/
async function loadMessagesOnce() {
  if (!activeConversationId) return;

  showChatLoader(); // ⭐ show loader immediately

  const r = await fetch(
    `${API_URL}?module=getMessages&conversationId=${activeConversationId}`
  );
  const data = await r.json();

  messages = data.messages || [];
  renderAllMessages(messages);

  hideChatLoader(); // ⭐ hide loader after render
}

/****************************************************
 * RENDERING
 ****************************************************/
function renderMessageContent(msg) {
  if (msg.type === "image") {
    return `<img src="${msg.fileData}" class="chat-image">`;
  }
  if (msg.type === "document") {
    return `<a href="${msg.fileData}" download="${msg.fileName}" class="chat-doc">📄 ${msg.fileName}</a>`;
  }
  return msg.text || "";
}

function renderAllMessages(list) {
  const container = document.getElementById("messages");
  if (!container) return;

  container.innerHTML = "";
  const fragment = document.createDocumentFragment();
  list.forEach((msg) => fragment.appendChild(buildMessageRow(msg)));

  container.appendChild(fragment);
  container.scrollTop = container.scrollHeight;
}

/* ✅ FIXED: other user's avatar in private chat */
function buildMessageRow(msg) {
  const isMe = msg.senderEmail === loggedInUser.email;
  const contentHTML = renderMessageContent(msg);
  const color = getUserColor(msg.senderEmail);

  const row = document.createElement("div");
  row.className = "msg-row";
  row.style.display = "flex";
  row.style.marginBottom = "10px";
  row.style.gap = "8px";
  row.style.alignItems = "flex-end";
  row.style.justifyContent = isMe ? "flex-end" : "flex-start";

  const avatar = document.createElement("div");
  avatar.style.width = "36px";
  avatar.style.display = "flex";
  avatar.style.justifyContent = "center";

  if (isMe) {
    const myInitials = getInitials(loggedInUser.fullName);
    avatar.innerHTML = loggedInUser.profilePic
      ? `<img class="chat-avatar" src="${loggedInUser.profilePic}" />`
      : `<div class="chat-avatar-fallback">${myInitials}</div>`;
  } else {
    if (mode === "community") {
      const sender =
        communityMembers.find((m) => m.email === msg.senderEmail) || {};
      const fullName = sender.fullName || msg.senderEmail;
      const initials = getInitials(fullName);
      avatar.innerHTML = sender.profilePic
        ? `<img class="chat-avatar" src="${sender.profilePic}" />`
        : `<div class="chat-avatar-fallback">${initials}</div>`;
    } else {
      const fullName =
        (otherUser && (otherUser.fullName || otherUser.FullName)) ||
        finalOtherEmail ||
        msg.senderEmail;
      const initials = getInitials(fullName);
      const pic =
        (otherUser && (otherUser.profilePic || otherUser.ProfilePic)) || null;

      avatar.innerHTML = pic
        ? `<img class="chat-avatar" src="${pic}" />`
        : `<div class="chat-avatar-fallback">${initials}</div>`;
    }
  }

  const bubble = document.createElement("div");
  bubble.style.maxWidth = "70%";
  bubble.style.padding = "8px 12px";
  bubble.style.borderRadius = "16px";
  bubble.style.fontSize = "14px";
  bubble.style.lineHeight = "1.4";
  bubble.style.background = isMe ? color.bg : "#F3F4F6";
  bubble.style.color = isMe ? color.text : "#111827";
  bubble.innerHTML = contentHTML;

  if (isMe) {
    row.appendChild(bubble);
    row.appendChild(avatar);
  } else {
    row.appendChild(avatar);
    row.appendChild(bubble);
  }

  return row;
}

/****************************************************
 * INSTANT OPTIMISTIC APPEND
 ****************************************************/
function appendSingleMessage(msg) {
  const container = document.getElementById("messages");
  if (!container) return;

  container.appendChild(buildMessageRow(msg));
  container.scrollTop = container.scrollHeight;
}

/****************************************************
 * SEND MESSAGE
 ****************************************************/
function sendMessage(payloadOverride = null) {
  const input = document.getElementById("messageInput");
  const text = (input?.value || "").trim();

  const isText = !payloadOverride;
  if (isText && (!text || !activeConversationId)) return;

  const payload = payloadOverride || {
    module: "sendMessage",
    type: "text",
    text
  };

  const optimisticMsg = {
    id: "temp_" + Date.now(),
    senderEmail: loggedInUser.email,
    type: payload.type,
    text: payload.text,
    fileName: payload.fileName || null,
    fileData: payload.fileData || null
  };

  messages.push(optimisticMsg);
  appendSingleMessage(optimisticMsg);

  if (isText) {
    const url =
      `${API_URL}?module=sendMessage`
      + `&conversationId=${encodeURIComponent(activeConversationId)}`
      + `&senderEmail=${encodeURIComponent(loggedInUser.email)}`
      + `&type=text`
      + `&text=${encodeURIComponent(payload.text)}`;

    fetch(url)
      .then((r) => r.json())
      .then(() => loadMessagesOnce())
      .catch(console.error);

    if (input) input.value = "";
    return;
  }

  const body = JSON.stringify({
    module: "sendMessage",
    conversationId: activeConversationId,
    senderEmail: loggedInUser.email,
    type: payload.type,
    fileName: payload.fileName,
    fileData: payload.fileData
  });

  fetch(API_URL, { method: "POST", body })
    .then((r) => r.json())
    .then(() => loadMessagesOnce())
    .catch(console.error);
}

/****************************************************
 * DOM READY — OPTIMIZED FOR CONCURRENCY
 ****************************************************/
document.addEventListener("DOMContentLoaded", async () => {
  loadNavbar();
  showChatLoader();

  // 1. Setup Event Listeners immediately (No waiting)
  setupEventListeners();

  // 2. Prepare dynamic tasks (Profile, Community info, etc.)
  const backgroundTasks = [];
  
  if (mode === "private") {
    const toggle = document.getElementById("toggleMembers");
    const sidebar = document.getElementById("memberSidebar");
    if (toggle) toggle.style.display = "none";
    if (sidebar) sidebar.style.display = "none";
    backgroundTasks.push(loadOtherUserProfile());
  } else if (mode === "community") {
    backgroundTasks.push(loadCommunityInfo());
    backgroundTasks.push(loadCommunityMembers());
  }

  // 3. Get Conversation ID (Parallel to background tasks)
  const getConversationTask = (async () => {
    if (activeConversationId) return activeConversationId;

    let fetchUrl = "";
    if (mode === "community") {
      fetchUrl = `${API_URL}?module=startCommunityConversation&communityId=${communityId}&userEmail=${loggedInUser.email}`;
    } else if (finalOtherEmail) {
      fetchUrl = `${API_URL}?module=startConversation&userEmail=${loggedInUser.email}&otherEmail=${finalOtherEmail}`;
    }

    if (!fetchUrl) return null;

    const r = await fetch(fetchUrl);
    const d = await r.json();
    return d.conversationId;
  })();

  // 4. Wait for EVERYTHING to happen at once
  // We wait for both the background UI info AND the conversation ID
  const [convId] = await Promise.all([
    getConversationTask,
    ...backgroundTasks
  ]);

  // 5. Load Messages if we have an ID
  if (convId) {
    activeConversationId = convId;
    await loadMessagesOnce();
  } else {
    hideChatLoader();
  }
});

/** * Isolated listener setup to keep DOMContentLoaded clean 
 */
function setupEventListeners() {
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
      const sidebar = document.getElementById("memberSidebar");
      if (sidebar) sidebar.classList.toggle("show");
    };
  }

  // File Upload Handlers
  const handlers = [
    { btn: "uploadDocBtn", input: "docInput", type: "document" },
    { btn: "uploadImgBtn", input: "imgInput", type: "image" }
  ];

  handlers.forEach(({ btn, input, type }) => {
    const btnEl = document.getElementById(btn);
    const inputEl = document.getElementById(input);
    if (btnEl && inputEl) {
      btnEl.onclick = () => inputEl.click();
      inputEl.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const base64 = await fileToBase64(file);
        sendMessage({ type, fileName: file.name, fileData: base64 });
        e.target.value = "";
      };
    }
  });
}

/* ============================================================
   CONFIG + USER
============================================================ */
const API_URL = "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

let loggedInUser = JSON.parse(localStorage.getItem("contact_user"));
if (!loggedInUser) window.location.href = "login.html";

/* URL PARAMS */
const url = new URL(window.location.href);
const otherEmail = url.searchParams.get("otherEmail");
const conversationIdParam = url.searchParams.get("conversationId");
const communityId = url.searchParams.get("communityId");
const mode = communityId ? "community" : "private";

let activeConversationId = conversationIdParam || null;
let messages = [];
let lastTimestamp = 0;

/* COMMUNITY NAME */
let communityName = null;
if (communityId) {
  communityName = communityId.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

/* FETCH REAL COMMUNITY NAME */
async function loadRealCommunityName() {
  if (!communityId) return;

  try {
    const res = await fetch(`${API_URL}?module=getCommunity&communityId=${encodeURIComponent(communityId)}`);
    const data = await res.json();

    if (data.success && data.name) {
      communityName = data.name;
      document.getElementById("headerTitle").innerText = `Community Chat – ${communityName}`;
    }
  } catch (err) {
    console.error("Failed to load community name", err);
  }
}

/* ============================================================
   DAILY CONVERSATION SPACE HELPERS
============================================================ */

// Parse timestamp format: "2/4/2026 17:23:03"
function getMessageTimestamp(msg) {
  return new Date(msg.timestamp).getTime();
}

// Today at 00:00
function getTodayMidnight() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

// Keep only today's messages
function filterDailyMessages(list) {
  const cutoff = getTodayMidnight();
  return list.filter(m => getMessageTimestamp(m) >= cutoff);
}

/* ============================================================
   DUPLICATE PREVENTION
============================================================ */
function isDuplicateMessage(newMsg, existingList) {
  const newTime = getMessageTimestamp(newMsg);

  return existingList.some(m => {
    const timeDiff = Math.abs(getMessageTimestamp(m) - newTime);
    return (
      m.senderEmail === newMsg.senderEmail &&
      m.text === newMsg.text &&
      timeDiff < 5000 // 5 seconds window
    );
  });
}

/* ============================================================
   TIMESTAMP FORMATTER (MATCHES BACKEND EXACTLY)
============================================================ */
function getFormattedTimestamp() {
  const d = new Date();

  const month = d.getMonth() + 1;
  const day = d.getDate();
  const year = d.getFullYear();

  const hours = d.getHours().toString().padStart(2, "0");
  const minutes = d.getMinutes().toString().padStart(2, "0");
  const seconds = d.getSeconds().toString().padStart(2, "0");

  return `${month}/${day}/${year} ${hours}:${minutes}:${seconds}`;
}

/* ============================================================
   LOADER
============================================================ */
function showChatLoader() {
  const el = document.getElementById("chatLoader");
  if (el) el.style.display = "flex";
}

function hideChatLoader() {
  const el = document.getElementById("chatLoader");
  if (el) el.style.display = "none";
}

/* ============================================================
   INIT
============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  loadNavbar();
  showChatLoader();

  if (mode === "community") {
    document.getElementById("headerTitle").innerText = `Community Chat – ${communityName}`;
    loadRealCommunityName();
  } else {
    document.getElementById("headerTitle").innerText = `Private Chat`;
    document.getElementById("toggleMembersBtn").style.display = "none";
  }

  document.getElementById("toggleMembersBtn").addEventListener("click", () => {
    document.getElementById("memberSidebar").classList.toggle("show");
  });

  document.getElementById("sendBtn").onclick = sendMessage;

  loadCachedMessages();

  if (activeConversationId) {
    startPolling();
  } else if (mode === "community") {
    startCommunityConversation();
  } else if (otherEmail) {
    startConversation();
  }
});

/* ============================================================
   NAVBAR
============================================================ */
function loadNavbar() {
  const user = loggedInUser;

  const loggedInNav = `
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

  document.getElementById("navbar").innerHTML = loggedInNav;

  document.getElementById("mobileMenu").innerHTML = `
    <a href="dashboard.html">Dashboard</a>
    <a href="communities.html">Communities</a>
    <a href="events.html">Events</a>
    <a href="contacts.html">Contacts</a>
    <a href="profile.html">Profile</a>
    <a href="#" onclick="logout()">Logout</a>
  `;
}

function toggleMenu() {
  document.getElementById("mobileMenu").classList.toggle("show");
}

function logout() {
  localStorage.removeItem("contact_user");
  window.location.href = "index.html";
}

/* ============================================================
   CACHE (DAILY FILTERED)
============================================================ */
function loadCachedMessages() {
  const cacheKey = `chat_${conversationIdParam}`;
  const cached = localStorage.getItem(cacheKey);
  if (!cached) return;

  try {
    let cachedMessages = JSON.parse(cached);

    cachedMessages = filterDailyMessages(cachedMessages);

    messages = cachedMessages;
    renderMessages(messages);

    if (messages.length > 0) {
      lastTimestamp = getMessageTimestamp(messages[messages.length - 1]);
    }
  } catch (e) {
    console.error("Failed to load cached messages", e);
  }
}

/* ============================================================
   PRIVATE CHAT
============================================================ */
function startConversation() {
  fetch(`${API_URL}?module=startConversation&userEmail=${encodeURIComponent(loggedInUser.email)}&otherEmail=${encodeURIComponent(otherEmail)}`)
    .then(r => r.json())
    .then(d => {
      if (!d.success) return;
      activeConversationId = d.conversationId;
      startPolling();
    });
}

/* ============================================================
   COMMUNITY CHAT
============================================================ */
function startCommunityConversation() {
  fetch(`${API_URL}?module=startCommunityConversation&communityId=${encodeURIComponent(communityId)}&userEmail=${encodeURIComponent(loggedInUser.email)}`)
    .then(r => r.json())
    .then(d => {
      if (!d.success) return;
      activeConversationId = d.conversationId;
      loadCommunityMembers();
      startPolling();
    });
}

function loadCommunityMembers() {
  fetch(`${API_URL}?module=getCommunityMembers&communityId=${encodeURIComponent(communityId)}`)
    .then(r => r.json())
    .then(d => {
      if (d.success) renderMemberSidebar(d.members);
    });
}

function renderMemberSidebar(members) {
  const container = document.getElementById("memberSidebar");
  container.innerHTML = "<h3>Members</h3>";

  members.forEach(m => {
    const div = document.createElement("div");
    div.className = "member";

    div.innerHTML = `
      <div class="member-name">${m.fullName}</div>
      <button onclick="window.location.href='public-profile.html?email=${encodeURIComponent(m.email)}'">View</button>
      <button onclick="window.location.href='messages.html?otherEmail=${encodeURIComponent(m.email)}'">Message</button>
    `;

    container.appendChild(div);
  });
}

/* ============================================================
   POLLING (DAILY + DELTA + NO DUPLICATES)
============================================================ */
function startPolling() {
  loadNewMessages();
  setInterval(loadNewMessages, 1500);
}

function loadNewMessages() {
  if (!activeConversationId) return;

  fetch(`${API_URL}?module=getMessages&conversationId=${encodeURIComponent(activeConversationId)}`)
    .then(r => r.json())
    .then(d => {
      if (!d.success || !d.messages) return;

      const newList = filterDailyMessages(d.messages);

      if (messages.length === 0) {
        messages = newList;
        if (messages.length > 0) {
          lastTimestamp = getMessageTimestamp(messages[messages.length - 1]);
        } else {
          lastTimestamp = 0;
        }
        renderMessages(messages);
        localStorage.setItem(`chat_${activeConversationId}`, JSON.stringify(messages));
        return;
      }

      const fresh = newList.filter(m =>
        getMessageTimestamp(m) > lastTimestamp &&
        !isDuplicateMessage(m, messages)
      );

      if (fresh.length > 0) {
        appendMessages(fresh);
        messages.push(...fresh);
        lastTimestamp = getMessageTimestamp(messages[messages.length - 1]);
        localStorage.setItem(`chat_${activeConversationId}`, JSON.stringify(messages));
      }
    });
}

/* ============================================================
   RENDERING
============================================================ */
function appendMessages(newMessages) {
  const container = document.getElementById("messages");

  newMessages.forEach(msg => {
    const div = document.createElement("div");
    div.className = "msg";
    if (msg.senderEmail === loggedInUser.email) div.classList.add("me");

    div.innerHTML = `
      <div style="font-size:12px;color:#666;margin-bottom:4px;">
        ${msg.senderName || msg.senderEmail}
      </div>
      <div>${msg.text}</div>
    `;

    container.appendChild(div);
  });

  container.scrollTop = container.scrollHeight;
}

function updateHeaderNameFromMessages(list) {
  if (mode !== "private") return;

  const other = list.find(m => m.senderEmail !== loggedInUser.email);
  if (other && other.senderName) {
    document.getElementById("headerTitle").innerText =
      `Private Chat with ${other.senderName}`;
  }
}

function renderMessages(list) {
  updateHeaderNameFromMessages(list);
  const container = document.getElementById("messages");
  container.innerHTML = "";
  appendMessages(list);
  hideChatLoader();
}

/* ============================================================
   SEND MESSAGE (OPTIMISTIC + NO DUPLICATES)
============================================================ */
function sendMessage() {
  const input = document.getElementById("messageInput");
  const text = input.value.trim();
  if (!text) return;

  const optimisticMsg = {
    senderEmail: loggedInUser.email,
    senderName: loggedInUser.fullName || loggedInUser.email,
    text: text,
    timestamp: getFormattedTimestamp()
  };

  if (!isDuplicateMessage(optimisticMsg, messages)) {
    appendMessages([optimisticMsg]);
    messages.push(optimisticMsg);
    localStorage.setItem(`chat_${activeConversationId}`, JSON.stringify(messages));
  }

  input.value = "";

  fetch(`${API_URL}?module=sendMessage&conversationId=${encodeURIComponent(activeConversationId)}&senderEmail=${encodeURIComponent(loggedInUser.email)}&text=${encodeURIComponent(text)}`)
    .then(r => r.json())
    .then(d => {
      // Polling will sync the real message
    });
}
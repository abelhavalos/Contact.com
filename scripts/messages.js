/* ============================================================
   CONFIG + USER
============================================================ */
const API_URL =
  "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

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
let otherUser = null;

/* ============================================================
   INIT
============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  loadNavbar();

  if (mode === "private") {
    document.getElementById("memberSidebar").style.display = "none";
    loadOtherUserProfile();
  }

  document.getElementById("sendBtn").onclick = sendMessage;

  if (activeConversationId) {
    startPolling();
  } else if (mode === "community") {
    startCommunityConversation();
  } else if (otherEmail) {
    startConversation();
  }
});

/* ============================================================
   LOAD OTHER USER PROFILE (MATCHES CONTACTS.JS)
============================================================ */
async function loadOtherUserProfile() {
  const r = await fetch(
    `${API_URL}?module=getUserByEmail&email=${encodeURIComponent(otherEmail)}`
  );
  const d = await r.json();

  otherUser = d?.user || {};

  // EXACT SAME HYDRATION LOGIC AS CONTACTS.JS
  otherUser.fullName =
    otherUser.fullName || otherUser.FullName || "Unknown User";

  otherUser.profilePic =
    otherUser.profilePic || otherUser.ProfilePic || null;

  const fullName = otherUser.fullName;

  const initials = fullName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  const avatarHTML = otherUser.profilePic
    ? `<img class="chat-avatar" src="${otherUser.profilePic}" />`
    : `<div class="chat-avatar-fallback">${initials}</div>`;

  document.getElementById("headerTitle").innerHTML = `
    <div style="display:flex;align-items:center;">
      ${avatarHTML}
      <span>${fullName}</span>
    </div>
  `;
}

/* ============================================================
   PRIVATE CHAT
============================================================ */
function startConversation() {
  fetch(
    `${API_URL}?module=startConversation&userEmail=${encodeURIComponent(
      loggedInUser.email
    )}&otherEmail=${encodeURIComponent(otherEmail)}`
  )
    .then((r) => r.json())
    .then((d) => {
      activeConversationId = d.conversationId;
      startPolling();
    });
}

/* ============================================================
   COMMUNITY CHAT
============================================================ */
function startCommunityConversation() {
  fetch(
    `${API_URL}?module=startCommunityConversation&communityId=${encodeURIComponent(
      communityId
    )}&userEmail=${encodeURIComponent(loggedInUser.email)}`
  )
    .then((r) => r.json())
    .then((d) => {
      activeConversationId = d.conversationId;
      loadCommunityMembers();
      startPolling();
    });
}

function loadCommunityMembers() {
  fetch(
    `${API_URL}?module=getCommunityMembers&communityId=${encodeURIComponent(
      communityId
    )}`
  )
    .then((r) => r.json())
    .then((d) => {
      const container = document.getElementById("memberSidebar");
      container.innerHTML = "<h3>Members</h3>";

      d.members.forEach((m) => {
        container.innerHTML += `
          <div class="member">
            <div class="member-name">${m.fullName}</div>
          </div>
        `;
      });
    });
}

/* ============================================================
   POLLING
============================================================ */
function startPolling() {
  loadMessages();
  setInterval(loadMessages, 1500);
}

function loadMessages() {
  if (!activeConversationId) return;

  fetch(
    `${API_URL}?module=getMessages&conversationId=${encodeURIComponent(
      activeConversationId
    )}`
  )
    .then((r) => r.json())
    .then((d) => {
      messages = d?.messages || [];
      renderMessages(messages);
    });
}

/* ============================================================
   RENDER MESSAGES (AVATAR + FULL NAME)
============================================================ */
function renderMessages(list) {
  const container = document.getElementById("messages");
  container.innerHTML = "";

  const fullName = otherUser?.fullName || otherEmail;

  const initials = fullName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  const avatarHTML = otherUser?.profilePic
    ? `<img class="chat-avatar" src="${otherUser.profilePic}" />`
    : `<div class="chat-avatar-fallback">${initials}</div>`;

  list.forEach((msg) => {
    const isMe = msg.senderEmail === loggedInUser.email;

    if (isMe) {
      container.innerHTML += `
        <div class="msg me">
          <div style="font-size:12px;color:#666;margin-bottom:4px;">
            ${loggedInUser.fullName}
          </div>
          ${msg.text}
        </div>
      `;
    } else {
      container.innerHTML += `
        <div class="incoming-wrapper">
          ${avatarHTML}
          <div class="msg">
            <div style="font-size:12px;color:#666;margin-bottom:4px;">
              ${fullName}
            </div>
            ${msg.text}
          </div>
        </div>
      `;
    }
  });

  container.scrollTop = container.scrollHeight;
}

/* ============================================================
   SEND MESSAGE
============================================================ */
function sendMessage() {
  const input = document.getElementById("messageInput");
  const text = input.value.trim();
  if (!text) return;

  fetch(
    `${API_URL}?module=sendMessage&conversationId=${encodeURIComponent(
      activeConversationId
    )}&senderEmail=${encodeURIComponent(
      loggedInUser.email
    )}&text=${encodeURIComponent(text)}`
  );

  input.value = "";
}

/* ============================================================
   NAVBAR
============================================================ */
function loadNavbar() {
  const nav = document.getElementById("navbar");
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
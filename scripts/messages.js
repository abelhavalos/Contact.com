const API_URL =
  "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

let loggedInUser = JSON.parse(localStorage.getItem("contact_user"));
if (!loggedInUser) window.location.href = "login.html";
loggedInUser.fullName =
  loggedInUser.fullName || loggedInUser.FullName || loggedInUser.email;
loggedInUser.profilePic =
  loggedInUser.profilePic || loggedInUser.ProfilePic || null;
/* URL PARAMS */
const url = new URL(window.location.href);
const otherEmail = url.searchParams.get("otherEmail");
const conversationIdParam = url.searchParams.get("conversationId");
const communityId = url.searchParams.get("communityId");
const mode = communityId ? "community" : "private";
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
function getUserColor(email) {
  if (!email) return BUBBLE_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = (hash << 5) - hash + email.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % BUBBLE_PALETTE.length;
  return BUBBLE_PALETTE[index];
}
document.addEventListener("DOMContentLoaded", async () => {
  loadNavbar();
  if (mode === "private") {
    const sidebar = document.getElementById("memberSidebar");
    if (sidebar) sidebar.style.display = "none";
    await loadOtherUserProfile();
  }

  if (mode === "community") {
    await loadCommunityInfo();
  }
  const sendBtn = document.getElementById("sendBtn");
  if (sendBtn) sendBtn.onclick = sendMessage;

  if (activeConversationId) {
    if (mode === "community") {
      await loadCommunityMembers();
      startPolling();
    } else {
      startPolling();
    }
  } else if (mode === "community") {
    await startCommunityConversation();
  } else if (otherEmail) {
    startConversation();
  }
});
async function loadOtherUserProfile() {
  if (!otherEmail) return;

  const r = await fetch(
    `${API_URL}?module=getUserByEmail&email=${encodeURIComponent(otherEmail)}`
  );
  const d = await r.json();
  otherUser = d?.user || {};
  otherUser.fullName =
    otherUser.fullName || otherUser.FullName || otherEmail;
  otherUser.profilePic =
    otherUser.profilePic || otherUser.ProfilePic || null;
  const fullName = otherUser.fullName;
  const initials = getInitials(fullName);

  const avatarHTML = otherUser.profilePic
    ? `<img class="chat-avatar" src="${otherUser.profilePic}" />`
    : `<div class="chat-avatar-fallback">${initials}</div>`;
  const header = document.getElementById("headerTitle");
  if (header) {
    header.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;">
        ${avatarHTML}
        <span>${fullName}</span>
      </div>
    `;
  }
}
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
async function loadCommunityInfo() {
  const r = await fetch(
    `${API_URL}?module=getCommunityById&communityId=${encodeURIComponent(communityId)}`
  );
  const d = await r.json();

  console.log("COMMUNITY INFO RAW:", d);  // ← ADD THIS

  const name = d?.community?.name || "Community";

  const header = document.getElementById("headerTitle");
  if (header) {
    header.innerHTML = `
      <div style="display:flex;align-items:center;">
        <span>${name}</span>
      </div>
    `;
  }
}
async function startCommunityConversation() {
  const r = await fetch(
    `${API_URL}?module=startCommunityConversation&communityId=${encodeURIComponent(
      communityId
    )}&userEmail=${encodeURIComponent(loggedInUser.email)}`
  );
  const d = await r.json();
  activeConversationId = d.conversationId;
  await loadCommunityMembers();
  startPolling();
}
async function loadCommunityMembers() {
  const r = await fetch(
    `${API_URL}?module=getCommunityMembers&communityId=${encodeURIComponent(
      communityId
    )}`
  );
  const d = await r.json();

  const container = document.getElementById("memberSidebar");
  if (!container) return;

  container.innerHTML = "<h3>Members</h3>";

  communityMembers = await Promise.all(
    (d.members || []).map(async (m) => {
      const email = typeof m === "string" ? m : m.email;

      try {
        const res = await fetch(
          `${API_URL}?module=getUserByEmail&email=${encodeURIComponent(email)}`
        );
        const data = await res.json();
        const user = data?.user || {};

        return {
          email,
          fullName:
            user.FullName ||
            user.fullName ||
            user.name ||
            email,
          profilePic:
            user.ProfilePic ||
            user.profilePic ||
            user.profilePicUrl ||
            user.photo ||
            user.image ||
            user.avatar ||
            null
        };
      } catch (e) {
        return {
          email,
          fullName: email,
          profilePic: null
        };
      }
    })
  );

  communityMembers.forEach((m) => {
    const initials = getInitials(m.fullName);

    const avatarHTML = m.profilePic
      ? `<img class="chat-avatar" src="${m.profilePic}" />`
      : `<div class="chat-avatar-fallback">${initials}</div>`;

    container.innerHTML += `
      <div class="member" style="margin-bottom:16px; cursor:pointer;"
           onclick="window.location.href='public-profile.html?email=${encodeURIComponent(m.email)}'">
        <div style="display:flex;align-items:center;gap:10px;">
          ${avatarHTML}
          <div style="font-weight:600;">${m.fullName}</div>
        </div>
      </div>
    `;
  });
}

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
  const fullName = otherUser?.fullName || otherEmail;
  const initials = getInitials(fullName);
  const avatarHTML = otherUser?.profilePic
    ? `<img class="chat-avatar" src="${otherUser.profilePic}" />`
    : `<div class="chat-avatar-fallback">${initials}</div>`;

  list.forEach((msg) => {
    const isMe = msg.senderEmail === loggedInUser.email;
    if (isMe) {
      const color = getUserColor(loggedInUser.email);
      const myInitials = getInitials(loggedInUser.fullName);
      const myAvatarHTML = loggedInUser.profilePic
        ? `<img class="chat-avatar" src="${loggedInUser.profilePic}" />`
        : `<div class="chat-avatar-fallback">${myInitials}</div>`;

      // YOU: [Message][Avatar] + name under avatar (right side)
      container.innerHTML += `
        <div style="display:flex;justify-content:flex-end;align-items:flex-start;margin-bottom:18px;gap:10px;">
          <div style="max-width:60%;">
            <div style="
              background:${color.bg};
              color:${color.text};
              padding:10px 14px;
              border-radius:14px;
            ">
              ${msg.text}
            </div>
          </div>
          <div style="width:70px;text-align:center;">
            ${myAvatarHTML}
            <div style="font-size:12px;color:#666;margin-top:4px;">
              ${loggedInUser.fullName}
            </div>
          </div>
        </div>
      `;
    } else {
      const color = getUserColor(otherEmail);
      container.innerHTML += `
        <div style="display:flex;align-items:flex-start;margin-bottom:18px;gap:10px;">
          <div style="width:70px;text-align:center;">
            ${avatarHTML}
            <div style="font-size:12px;color:#666;margin-top:4px;">
              ${fullName}
            </div>
          </div>
          <div style="max-width:60%;">
            <div style="
              background:${color.bg};
              color:${color.text};
              padding:10px 14px;
              border-radius:14px;
            ">
              ${msg.text}
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
      ? (loggedInUser.fullName || loggedInUser.email)
      : (sender?.fullName || msg.senderEmail);

    const emailForColor = isMe ? loggedInUser.email : msg.senderEmail;
    const color = getUserColor(emailForColor);

    const initials = getInitials(fullName);

    const avatarHTML = isMe
      ? (loggedInUser.profilePic
          ? `<img class="chat-avatar" src="${loggedInUser.profilePic}" />`
          : `<div class="chat-avatar-fallback">${initials}</div>`)
      : (sender?.profilePic
          ? `<img class="chat-avatar" src="${sender.profilePic}" />`
          : `<div class="chat-avatar-fallback">${initials}</div>`);

    if (isMe) {
      // YOU — right side: [Message][Avatar] + name under avatar
      container.innerHTML += `
        <div style="display:flex;justify-content:flex-end;align-items:flex-start;margin-bottom:18px;gap:10px;">
          <div style="max-width:60%;">
            <div style="
              background:${color.bg};
              color:${color.text};
              padding:10px 14px;
              border-radius:14px;
            ">
              ${msg.text}
            </div>
          </div>
          <div style="width:70px;text-align:center;">
            ${avatarHTML}
            <div style="font-size:12px;color:#666;margin-top:4px;">
              ${fullName}
            </div>
          </div>
        </div>
      `;
    } else {
      // OTHERS — left side: [Avatar][Message] + name under avatar
      container.innerHTML += `
        <div style="display:flex;align-items:flex-start;margin-bottom:18px;gap:10px;">
          <div style="width:70px;text-align:center;">
            ${avatarHTML}
            <div style="font-size:12px;color:#666;margin-top:4px;">
              ${fullName}
            </div>
          </div>
          <div style="max-width:60%;">
            <div style="
              background:${color.bg};
              color:${color.text};
              padding:10px 14px;
              border-radius:14px;
            ">
              ${msg.text}
            </div>
          </div>
        </div>
      `;
    }
  });

  container.scrollTop = container.scrollHeight;
}
function sendMessage() {
  const input = document.getElementById("messageInput");
  if (!input) return;

  const text = input.value.trim();
  if (!text || !activeConversationId) return;

  fetch(
    `${API_URL}?module=sendMessage&conversationId=${encodeURIComponent(
      activeConversationId
    )}&senderEmail=${encodeURIComponent(
      loggedInUser.email
    )}&text=${encodeURIComponent(text)}`
  );

  input.value = "";
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
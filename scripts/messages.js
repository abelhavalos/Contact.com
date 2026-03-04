/**************************************************** 
 * CONTACT.COM — ULTRA-FAST MESSAGES.JS (OPTIMIZED)
 ****************************************************/

/* ==================================================
   FAST CONSTANTS + GLOBALS
================================================== */
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
const otherEmailParam = url.searchParams.get("otherEmail");
const conversationIdParam = url.searchParams.get("conversationId");
const communityId = url.searchParams.get("communityId");
const paramEmail = url.searchParams.get("email");
const paramName = url.searchParams.get("name");
const paramTitle = url.searchParams.get("title");

const mode = communityId ? "community" : "private";
const finalOtherEmail = otherEmailParam || paramEmail;

let chatTitle = paramTitle || "";
let activeConversationId = conversationIdParam || null;
let communityMembers = [];
let messages = [];

let pollingInterval = null;

/* ==================================================
   SUPER-FAST HELPERS
================================================== */
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
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.readAsDataURL(file);
  });
}

/* ==================================================
   DOM CACHE
================================================== */
const dom = {
  msgContainer: () => document.getElementById("messages"),
};

/* ==================================================
   SUPER-FAST DOM APPENDER (NO FULL RERENDER)
   — This is what makes the chat INSTANT.
================================================== */
function renderMessageIncrementally(msg) {
  const container = dom.msgContainer();
  if (!container) return;

  // prevent duplicates
  if (document.getElementById(`msg_${msg.id}`)) return;

  const isMe = msg.senderEmail === loggedInUser.email;

  const bubbleColor = getUserColor(msg.senderEmail);
  const contentHTML = msg.type === "image"
    ? `<img src="${msg.fileData}" class="chat-image">`
    : msg.type === "document"
    ? `<a href="${msg.fileData}" download="${msg.fileName}" class="chat-doc">📄 ${msg.fileName}</a>`
    : msg.text || "";

  const fullName = isMe
    ? loggedInUser.fullName
    : communityId
      ? (communityMembers.find((u) => u.email === msg.senderEmail)?.fullName || msg.senderEmail)
      : msg.senderEmail === finalOtherEmail
        ? paramName || msg.senderEmail
        : msg.senderEmail;

  const avatar = isMe
    ? (loggedInUser.profilePic
        ? `<img class="chat-avatar" src="${loggedInUser.profilePic}">`
        : `<div class="chat-avatar-fallback">${getInitials(loggedInUser.fullName)}</div>`)
    : (() => {
        let pic;
        if (communityId) {
          pic = communityMembers.find((m) => m.email === msg.senderEmail)?.profilePic;
        } else {
          pic = msg.senderPic;
        }
        return pic
          ? `<img class="chat-avatar" src="${pic}">`
          : `<div class="chat-avatar-fallback">${getInitials(fullName)}</div>`;
      })();

  const wrapper = document.createElement("div");
  wrapper.id = `msg_${msg.id}`;
  wrapper.innerHTML = isMe
    ? `
      <div style="display:flex;justify-content:flex-end;align-items:flex-start;margin-bottom:18px;gap:10px;">
        <div style="max-width:60%;">
          <div style="background:${bubbleColor.bg};color:${bubbleColor.text};padding:10px 14px;border-radius:14px;">
            ${contentHTML}
          </div>
        </div>
        <div style="width:70px;text-align:center;">
          ${avatar}
          <div style="font-size:12px;color:#666;margin-top:4px;">${fullName}</div>
        </div>
      </div>
    `
    : `
      <div style="display:flex;align-items:flex-start;margin-bottom:18px;gap:10px;">
        <div style="width:70px;text-align:center;">
          ${avatar}
          <div style="font-size:12px;color:#666;margin-top:4px;">${fullName}</div>
        </div>
        <div style="max-width:60%;">
          <div style="background:${bubbleColor.bg};color:${bubbleColor.text};padding:10px 14px;border-radius:14px;">
            ${contentHTML}
          </div>
        </div>
      </div>
    `;

  container.appendChild(wrapper);

  // scroll to bottom efficiently
  requestAnimationFrame(() => {
    container.scrollTop = container.scrollHeight;
  });
}

/****************************************************
 * SUPER-FAST RECONCILER
 * Adds only new messages (NO FULL RERENDER)
****************************************************/
function reconcileMessages(newList) {
  const existingIds = new Set(messages.map((m) => m.id));

  newList.forEach((msg) => {
    if (!existingIds.has(msg.id)) {
      messages.push(msg);
      renderMessageIncrementally(msg);
    }
  });
}

/****************************************************
 * POLLING (DEBOUNCED + FAST)
****************************************************/
async function loadMessages() {
  if (!activeConversationId) return;

  const r = await fetch(
    `${API_URL}?module=getMessages&conversationId=${activeConversationId}`
  );

  const d = await r.json();
  let backendMessages = d.messages || [];

  // keep only last 20 for speed
  backendMessages = backendMessages.slice(-20);

  reconcileMessages(backendMessages);
}

/****************************************************
 * SEND MESSAGE (Optimistic)
****************************************************/
function sendMessage(payloadOverride = null) {
  const input = document.getElementById("messageInput");
  const text = (input?.value || "").trim();

  const isText = !payloadOverride;

  if (isText && !text) return;

  const payload = payloadOverride || {
    module: "sendMessage",
    type: "text",
    text: text
  };

  const tempId = "temp_" + Date.now();

  const optimistic = {
    id: tempId,
    senderEmail: loggedInUser.email,
    type: payload.type,
    text: payload.text || "",
    fileName: payload.fileName || null,
    fileData: payload.fileData || null,
    optimistic: true
  };

  // render instantly
  renderMessageIncrementally(optimistic);
  messages.push(optimistic);

  if (isText) {
    input.value = "";
    fetch(
      `${API_URL}?module=sendMessage&conversationId=${encodeURIComponent(activeConversationId)}&senderEmail=${encodeURIComponent(loggedInUser.email)}&type=text&text=${encodeURIComponent(payload.text)}`
    )
      .then((r) => r.json())
      .then(() => loadMessages());
    return;
  }

  // files -> POST
  fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      module: "sendMessage",
      conversationId: activeConversationId,
      senderEmail: loggedInUser.email,
      type: payload.type,
      fileName: payload.fileName,
      fileData: payload.fileData
    })
  })
    .then((r) => r.json())
    .then(() => loadMessages());
}

/****************************************************
 * DOM READY
****************************************************/
document.addEventListener("DOMContentLoaded", async () => {
  const sendBtn = document.getElementById("sendBtn");
  if (sendBtn) sendBtn.onclick = () => sendMessage();

  document
    .getElementById("messageInput")
    ?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

  document.getElementById("uploadImgBtn")?.addEventListener("click", () =>
    document.getElementById("imgInput").click()
  );

  document.getElementById("uploadDocBtn")?.addEventListener("click", () =>
    document.getElementById("docInput").click()
  );

  document.getElementById("imgInput")?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    sendMessage({
      type: "image",
      fileName: file.name,
      fileData: await fileToBase64(file)
    });
    e.target.value = "";
  });

  document.getElementById("docInput")?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    sendMessage({
      type: "document",
      fileName: file.name,
      fileData: await fileToBase64(file)
    });
    e.target.value = "";
  });

  // Start conversation logic
  if (activeConversationId) {
    loadMessages();
  } else if (communityId) {
    const r = await fetch(
      `${API_URL}?module=startCommunityConversation&communityId=${communityId}&userEmail=${loggedInUser.email}`
    );
    const d = await r.json();
    activeConversationId = d.conversationId;
    loadMessages();
  } else {
    const r = await fetch(
      `${API_URL}?module=startConversation&userEmail=${loggedInUser.email}&otherEmail=${finalOtherEmail}`
    );
    const d = await r.json();
    activeConversationId = d.conversationId;
    loadMessages();
  }

  // fast polling every 500ms (safe + optimized)
  pollingInterval = setInterval(loadMessages, 500);
});

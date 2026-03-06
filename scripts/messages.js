/****************************************************
 * CONTACT.COM — HARDENED PRODUCTION MESSAGES.JS
 * FIXES: GLOBAL POLLING & CROSS-DEVICE NAVBAR
 ****************************************************/

const API_URL = "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

/* 1. STATE & PARAMS */
let loggedInUser = JSON.parse(localStorage.getItem("contact_user"));
if (!loggedInUser) window.location.href = "login.html";

loggedInUser.fullName = loggedInUser.fullName || loggedInUser.FullName || loggedInUser.email;
loggedInUser.profilePic = loggedInUser.profilePic || loggedInUser.ProfilePic || null;

const url = new URL(window.location.href);
const communityId = url.searchParams.get("communityId");
const mode = communityId ? "community" : "private";
const finalOtherEmail = url.searchParams.get("otherEmail") || url.searchParams.get("email");
let chatTitle = url.searchParams.get("title") || "";

let activeConversationId = url.searchParams.get("conversationId") || null;
let renderedMessageIds = new Set();
let communityMembers = [];
let otherUser = null;
let isFetching = false;

/****************************************************
 * 2. UI & NAVBAR (HARDENED)
 ****************************************************/
window.toggleMenu = () => {
  const menu = document.getElementById("mobileMenu");
  if (menu) menu.classList.toggle("show");
};

function loadNavbar() {
  const nav = document.getElementById("navbar");
  const mobileMenu = document.getElementById("mobileMenu");
  
  if (!nav) {
    // If navbar isn't found, wait 100ms and try again (Fixes race condition on some mobile devices)
    setTimeout(loadNavbar, 100);
    return;
  }

  const navHTML = `
    <div class="hamburger" onclick="window.toggleMenu()"><span></span><span></span><span></span></div>
    <div class="logo">Contact<span>.</span>com</div>
    <div class="nav-links">
      <a href="dashboard.html">Dashboard</a>
      <a href="communities.html">Communities</a>
      <a href="events.html">Events</a>
      <a href="contacts.html">Contacts</a>
      <a href="profile.html">Profile</a>
      <a href="#" class="logout-action">Logout</a>
    </div>`;
  
  nav.innerHTML = navHTML;
  if (mobileMenu) {
    mobileMenu.innerHTML = `
      <a href="dashboard.html">Dashboard</a>
      <a href="communities.html">Communities</a>
      <a href="events.html">Events</a>
      <a href="contacts.html">Contacts</a>
      <a href="profile.html">Profile</a>
      <a href="#" class="logout-action">Logout</a>`;
  }

  document.querySelectorAll('.logout-action').forEach(el => {
    el.onclick = (e) => {
      e.preventDefault();
      localStorage.removeItem('contact_user');
      window.location.href = 'index.html';
    };
  });
}

/****************************************************
 * 3. ULTRA-FAST SYNC ENGINE (HARDENED)
 ****************************************************/
function getMessageHTML(msg) {
  const isMe = msg.senderEmail === loggedInUser.email;
  const name = isMe ? loggedInUser.fullName : (mode === "community" ? (communityMembers.find(m => m.email === msg.senderEmail)?.fullName || msg.senderEmail) : (otherUser?.fullName || finalOtherEmail));
  const pic = isMe ? loggedInUser.profilePic : (mode === "community" ? communityMembers.find(m => m.email === msg.senderEmail)?.profilePic : (otherUser?.profilePic || otherUser?.ProfilePic));

  const avatar = pic ? `<img class="chat-avatar" src="${pic}" loading="lazy" />` : `<div class="chat-avatar-fallback">${getInitials(name)}</div>`;
  const content = msg.type === "image" ? `<img src="${msg.fileData}" class="chat-image" style="max-width:100%; border-radius:8px;">` : (msg.type === "document" ? `<a href="${msg.fileData}" download="${msg.fileName}" style="color:inherit; text-decoration:none;">📄 ${msg.fileName}</a>` : (msg.text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));
  
  const bubbleStyle = `max-width:70%; padding:8px 12px; border-radius:16px; font-size:14px; background:${isMe ? getUserColor(msg.senderEmail).bg : "#F3F4F6"}; color:${isMe ? getUserColor(msg.senderEmail).text : "#111827"}; overflow-wrap: break-word;`;
  const rowStyle = `display:flex; margin-bottom:10px; gap:8px; align-items:flex-end; justify-content:${isMe ? 'flex-end' : 'flex-start'};`;

  return `<div class="msg-row" data-id="${msg.id}" style="${rowStyle}">
    ${isMe ? `<div style="${bubbleStyle}">${content}</div><div style="width:36px;flex-shrink:0;">${avatar}</div>` : `<div style="width:36px;flex-shrink:0;">${avatar}</div><div style="${bubbleStyle}">${content}</div>`}
  </div>`;
}

async function syncMessages(showSpinner = false) {
  if (!activeConversationId || isFetching) return;
  if (showSpinner) document.getElementById("chatLoader")?.style.setProperty("display", "flex");

  isFetching = true;
  
  // Create a timeout controller so a hung request doesn't kill polling forever
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const r = await fetch(`${API_URL}?module=getMessages&conversationId=${activeConversationId}`, { signal: controller.signal });
    const data = await r.json();
    clearTimeout(timeoutId);

    const container = document.getElementById("messages");
    if (!container || !data.messages) return;

    const newMsgs = data.messages.filter(msg => !renderedMessageIds.has(msg.id));
    if (newMsgs.length > 0) {
      let html = "";
      newMsgs.forEach(m => { html += getMessageHTML(m); renderedMessageIds.add(m.id); });
      container.insertAdjacentHTML('beforeend', html);
      container.scrollTop = container.scrollHeight;
    }
  } catch (err) {
    console.warn("Poll cycle skipped/failed:", err.name === 'AbortError' ? 'Timeout' : err.message);
  } finally {
    isFetching = false;
    document.getElementById("chatLoader")?.style.setProperty("display", "none");
  }
}

/****************************************************
 * 4. ACTIONS & DATA LOADERS
 ****************************************************/
function sendMessage(payloadOverride = null) {
  const input = document.getElementById("messageInput");
  const text = (input?.value || "").trim();
  if (!payloadOverride && (!text || !activeConversationId)) return;

  const tempId = "temp_" + Date.now();
  const payload = payloadOverride || { type: "text", text };
  
  // Optimistic UI
  document.getElementById("messages")?.insertAdjacentHTML('beforeend', getMessageHTML({ id: tempId, senderEmail: loggedInUser.email, ...payload }));
  document.getElementById("messages").scrollTop = document.getElementById("messages").scrollHeight;
  renderedMessageIds.add(tempId);

  if (!payloadOverride) input.value = "";

  const fetchOptions = payloadOverride ? { method: "POST", body: JSON.stringify({ ...payload, module: "sendMessage", conversationId: activeConversationId, senderEmail: loggedInUser.email }) } : {};
  const url = payloadOverride ? API_URL : `${API_URL}?module=sendMessage&conversationId=${activeConversationId}&senderEmail=${loggedInUser.email}&type=text&text=${encodeURIComponent(text)}`;

  fetch(url, fetchOptions).then(() => syncMessages(false));
}

// ... helper functions (getInitials, getUserColor, fileToBase64) stay the same ...
function getInitials(n){return n?n.split(" ").filter(Boolean).map(p=>p[0]).join("").substring(0,2).toUpperCase():"?";}
function getUserColor(e){let h=0;for(let i=0;i<(e||"").length;i++){h=(h<<5)-h+e.charCodeAt(i);h|=0;}return BUBBLE_PALETTE[Math.abs(h)%BUBBLE_PALETTE.length];}
const fileToBase64 = (f) => new Promise((rs, rj) => { const r = new FileReader(); r.onload = () => rs(r.result); r.onerror = rj; r.readAsDataURL(f); });

/****************************************************
 * 5. INITIALIZATION
 ****************************************************/
document.addEventListener("DOMContentLoaded", async () => {
  loadNavbar();
  
  // Setup Buttons
  document.getElementById("sendBtn")?.addEventListener("click", () => sendMessage());
  document.getElementById("messageInput")?.addEventListener("keydown", e => { if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();}});
  
  // File Uploads
  ["uploadDocBtn", "uploadImgBtn"].forEach(id => {
    const btn = document.getElementById(id);
    const inp = document.getElementById(id === "uploadDocBtn" ? "docInput" : "imgInput");
    if(btn && inp) {
      btn.onclick = () => inp.click();
      inp.onchange = async (e) => {
        if(!e.target.files[0]) return;
        const b64 = await fileToBase64(e.target.files[0]);
        sendMessage({ type: id === "uploadDocBtn" ? "document" : "image", fileName: e.target.files[0].name, fileData: b64 });
        e.target.value = "";
      };
    }
  });

  // Conversation & Data
  try {
    if (!activeConversationId) {
      const mod = mode === "community" ? "startCommunityConversation" : "startConversation";
      const p = mode === "community" ? `&communityId=${communityId}` : `&otherEmail=${finalOtherEmail}`;
      const r = await fetch(`${API_URL}?module=${mod}&userEmail=${loggedInUser.email}${p}`);
      const d = await r.json();
      activeConversationId = d.conversationId;
    }

    if (mode === "private") {
      document.getElementById("toggleMembers")?.style.setProperty("display", "none");
      const r = await fetch(`${API_URL}?module=getUserByEmail&email=${encodeURIComponent(finalOtherEmail)}`);
      const d = await r.json();
      otherUser = d?.user || {};
    } else {
      // Load community data
      const [r1, r2] = await Promise.all([
        fetch(`${API_URL}?module=getCommunityById&communityId=${communityId}`),
        fetch(`${API_URL}?module=getCommunityMembers&communityId=${communityId}`)
      ]);
      const d1 = await r1.json();
      const d2 = await r2.json();
      // Fast member fetch
      const emails = (d2.members || []).map(m => typeof m === "string" ? m : m.email);
      communityMembers = await Promise.all(emails.map(async e => {
        const res = await fetch(`${API_URL}?module=getUserByEmail&email=${encodeURIComponent(e)}`);
        const data = await res.json();
        return { email: e, fullName: data?.user?.fullName || e, profilePic: data?.user?.profilePic || null };
      }));
    }

    await syncMessages(true);
    // POLL EVERY 3 SECONDS - Global Sync
    setInterval(() => syncMessages(false), 3000);

  } catch (err) {
    console.error("Init Error:", err);
  }
});

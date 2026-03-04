/****************************************************
 * CONTACT.COM — HIGH-PERFORMANCE MESSAGES.JS
 * Optimized for: 
 * - Parallel Data Fetching
 * - Document Fragment Batch Rendering
 * - Avatar String Caching (Memory Efficient)
 ****************************************************/

const API_URL = "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

/* --- USER STATE --- */
let loggedInUser = JSON.parse(localStorage.getItem("contact_user"));
if (!loggedInUser) window.location.href = "login.html";

// Normalize user keys
const getUserName = (u) => u.fullName || u.FullName || u.email || "User";
const getUserPic = (u) => u.profilePic || u.ProfilePic || null;

loggedInUser.displayName = getUserName(loggedInUser);
loggedInUser.displayPic = getUserPic(loggedInUser);

/* --- URL & MODE CONFIG --- */
const url = new URL(window.location.href);
const otherEmailParam = url.searchParams.get("otherEmail");
const conversationIdParam = url.searchParams.get("conversationId");
const communityId = url.searchParams.get("communityId");
const mode = communityId ? "community" : "private";

const paramEmail = url.searchParams.get("email");
const paramTitle = url.searchParams.get("title");
const finalOtherEmail = otherEmailParam || paramEmail;
let chatTitle = paramTitle || "";

/* --- GLOBAL STATE & CACHE --- */
let activeConversationId = conversationIdParam || null;
let messages = [];
let communityMembers = [];
let otherUser = null;
const avatarCache = new Map(); // Performance: Store HTML strings

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
    return name.split(" ").filter(Boolean).map((p) => p[0]).join("").substring(0, 2).toUpperCase();
}

function fileToBase64(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
    });
}

function fastScrollToBottom() {
    const msgArea = document.getElementById("messages");
    if (msgArea) {
        requestAnimationFrame(() => {
            msgArea.scrollTop = msgArea.scrollHeight;
        });
    }
}

/****************************************************
 * UI INJECTION (NAVBAR & LOADER)
 ****************************************************/
function loadNavbar() {
    const nav = document.getElementById("navbar");
    if (nav) {
        nav.innerHTML = `
            <div class="hamburger" onclick="toggleMenu(event)"><span></span><span></span><span></span></div>
            <div class="logo">Contact<span>.</span>com</div>
            <div class="nav-links">
                <a href="dashboard.html">Dashboard</a><a href="communities.html">Communities</a>
                <a href="events.html">Events</a><a href="contacts.html">Contacts</a>
                <a href="profile.html">Profile</a><a href="#" onclick="logout()">Logout</a>
            </div>`;
    }
}

function toggleMenu(e) {
    if (e) e.stopPropagation();
    document.getElementById("mobileMenu")?.classList.toggle("show");
}

function showChatLoader() { document.getElementById("chatLoader").style.display = "flex"; }
function hideChatLoader() { document.getElementById("chatLoader").style.display = "none"; }

function logout() {
    localStorage.removeItem("contact_user");
    window.location.href = "index.html";
}

/****************************************************
 * DATA LOADING (PARALLEL)
 ****************************************************/
async function loadOtherUserProfile() {
    try {
        const r = await fetch(`${API_URL}?module=getUserByEmail&email=${encodeURIComponent(finalOtherEmail)}`);
        const d = await r.json();
        otherUser = d?.user || {};
        const name = getUserName(otherUser);
        const pic = getUserPic(otherUser);
        
        const header = document.getElementById("headerTitle");
        if (header) {
            const avatarHTML = pic ? `<img class="chat-avatar" src="${pic}" />` : `<div class="chat-avatar-fallback">${getInitials(name)}</div>`;
            header.innerHTML = `<div class="chat-header">${avatarHTML}<div class="chat-header-main">${name}</div></div>`;
        }
    } catch (e) { console.error("Profile load failed", e); }
}

async function loadCommunityInfo() {
    try {
        const r = await fetch(`${API_URL}?module=getCommunityById&communityId=${communityId}`);
        const d = await r.json();
        const header = document.getElementById("headerTitle");
        if (header) header.innerHTML = `<div class="chat-header"><div class="chat-header-main">${d?.community?.name || "Community"}</div></div>`;
    } catch (e) { console.error("Comm load failed", e); }
}

async function loadCommunityMembers() {
    try {
        const r = await fetch(`${API_URL}?module=getCommunityMembers&communityId=${communityId}`);
        const d = await r.json();
        const emails = (d.members || []).map(m => typeof m === "string" ? m : m.email);

        const tasks = emails.map(async (email) => {
            const res = await fetch(`${API_URL}?module=getUserByEmail&email=${encodeURIComponent(email)}`);
            const userData = await res.json();
            const u = userData?.user || {};
            return { email, fullName: getUserName(u), profilePic: getUserPic(u) };
        });

        communityMembers = await Promise.all(tasks);
        renderCommunityMembersList(communityMembers);
    } catch (e) { console.error("Members load failed", e); }
}

function renderCommunityMembersList(list) {
    const container = document.getElementById("memberSidebar");
    if (!container) return;
    container.innerHTML = "<h3>Members</h3>";
    const fragment = document.createDocumentFragment();
    list.forEach(m => {
        const row = document.createElement("div");
        row.className = "member-row";
        row.onclick = () => window.location.href = `public-profile.html?email=${encodeURIComponent(m.email)}`;
        row.innerHTML = `
            ${m.profilePic ? `<img src="${m.profilePic}" class="chat-avatar">` : `<div class="chat-avatar-fallback">${getInitials(m.fullName)}</div>`}
            <div class="member-name">${m.fullName}</div>`;
        fragment.appendChild(row);
    });
    container.appendChild(fragment);
}

/****************************************************
 * RENDERING ENGINE
 ****************************************************/
function getCachedAvatar(email) {
    if (avatarCache.has(email)) return avatarCache.get(email);
    
    let name = email, pic = null;
    if (email === loggedInUser.email) {
        name = loggedInUser.displayName;
        pic = loggedInUser.displayPic;
    } else {
        const found = communityMembers.find(m => m.email === email) || (otherUser?.email === email ? otherUser : null);
        if (found) {
            name = getUserName(found);
            pic = getUserPic(found);
        }
    }

    const html = pic 
        ? `<img class="chat-avatar" src="${pic}" loading="lazy" />`
        : `<div class="chat-avatar-fallback">${getInitials(name)}</div>`;
    
    avatarCache.set(email, html);
    return html;
}

function buildMessageRow(msg) {
    const isMe = msg.senderEmail === loggedInUser.email;
    const color = getUserColor(msg.senderEmail);

    const row = document.createElement("div");
    row.className = `msg-row ${isMe ? "me" : "them"}`;
    row.style.cssText = `display:flex; margin-bottom:15px; gap:8px; align-items:flex-end; justify-content:${isMe ? "flex-end" : "flex-start"}`;

    const bubble = document.createElement("div");
    bubble.className = "msg-bubble";
    bubble.style.cssText = `max-width:70%; padding:10px 14px; font-size:14px; border-radius:${isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px"}; background:${isMe ? color.bg : "#E5E7EB"}; color:${isMe ? color.text : "#1F2937"}`;

    if (msg.type === "image") {
        bubble.innerHTML = `<img src="${msg.fileData}" style="max-width:100%; border-radius:10px; display:block;">`;
    } else if (msg.type === "document") {
        bubble.innerHTML = `<a href="${msg.fileData}" download="${msg.fileName}" style="color:inherit">📄 ${msg.fileName}</a>`;
    } else {
        bubble.textContent = msg.text || "";
    }

    const avatarDiv = document.createElement("div");
    avatarDiv.innerHTML = getCachedAvatar(msg.senderEmail);

    if (isMe) { row.append(bubble, avatarDiv); } 
    else { row.append(avatarDiv, bubble); }
    return row;
}

function renderAllMessages(list) {
    const container = document.getElementById("messageList");
    if (!container) return;
    const fragment = document.createDocumentFragment();
    list.forEach(msg => fragment.appendChild(buildMessageRow(msg)));
    container.innerHTML = "";
    container.appendChild(fragment);
    fastScrollToBottom();
}

async function loadMessagesOnce() {
    if (!activeConversationId) return;
    const input = document.getElementById("messageInput");
    const sendBtn = document.getElementById("sendBtn");
    if (input) { input.disabled = false; input.placeholder = "Type a message..."; }
    if (sendBtn) sendBtn.disabled = false;

    try {
        const r = await fetch(`${API_URL}?module=getMessages&conversationId=${activeConversationId}`);
        const data = await r.json();
        messages = data.messages || [];
        renderAllMessages(messages);
    } catch (e) { console.error("Load failed", e); }
}

function sendMessage(payloadOverride = null) {
    const input = document.getElementById("messageInput");
    const text = (input?.value || "").trim();
    if (!payloadOverride && (!text || !activeConversationId)) return;

    const payload = payloadOverride || { module: "sendMessage", type: "text", text };
    const optimisticMsg = { senderEmail: loggedInUser.email, ...payload };

    document.getElementById("messageList")?.appendChild(buildMessageRow(optimisticMsg));
    fastScrollToBottom();
    if (input) input.value = "";

    fetch(API_URL, { method: "POST", body: JSON.stringify({ ...payload, conversationId: activeConversationId, senderEmail: loggedInUser.email }) })
        .catch(console.error);
}

/****************************************************
 * DOM INITIALIZATION
 ****************************************************/
document.addEventListener("DOMContentLoaded", async () => {
    loadNavbar();
    showChatLoader();

    // Start fetching Data in parallel (Don't await them yet)
    const dataTasks = [];
    if (mode === "private") {
        dataTasks.push(loadOtherUserProfile());
    } else {
        dataTasks.push(loadCommunityInfo(), loadCommunityMembers());
    }

    // Connection Logic
    if (!activeConversationId) {
        let fetchUrl = mode === "community" 
            ? `${API_URL}?module=startCommunityConversation&communityId=${communityId}&userEmail=${loggedInUser.email}`
            : `${API_URL}?module=startConversation&userEmail=${loggedInUser.email}&otherEmail=${finalOtherEmail}`;
        
        try {
            const r = await fetch(fetchUrl);
            const d = await r.json();
            activeConversationId = d.conversationId;
        } catch (e) { console.error("Conn Error", e); }
    }

    // Wait for everything to finish
    await Promise.all(dataTasks);
    await loadMessagesOnce();
    hideChatLoader();

    // Event Bindings
    document.getElementById("sendBtn").onclick = () => sendMessage();
    document.getElementById("messageInput").onkeydown = (e) => { if(e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } };
    
    document.getElementById("uploadDocBtn").onclick = () => document.getElementById("docInput").click();
    document.getElementById("uploadImgBtn").onclick = () => document.getElementById("imgInput").click();

    document.getElementById("docInput").onchange = async (e) => {
        const file = e.target.files[0];
        if (file) sendMessage({ type: "document", fileName: file.name, fileData: await fileToBase64(file) });
    };

    document.getElementById("imgInput").onchange = async (e) => {
        const file = e.target.files[0];
        if (file) sendMessage({ type: "image", fileName: file.name, fileData: await fileToBase64(file) });
    };
});

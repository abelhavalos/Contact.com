/****************************************************
 * CONTACT.COM — HIGH-PERFORMANCE MESSAGES.JS
 ****************************************************/

const API_URL = "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

/* --- USER --- */
let loggedInUser = JSON.parse(localStorage.getItem("contact_user"));
if (!loggedInUser) window.location.href = "login.html";
loggedInUser.fullName = loggedInUser.fullName || loggedInUser.FullName || loggedInUser.email;
loggedInUser.profilePic = loggedInUser.profilePic || loggedInUser.ProfilePic || null;

/* --- URL PARAMS --- */
const url = new URL(window.location.href);
const otherEmailParam = url.searchParams.get("otherEmail");
const conversationIdParam = url.searchParams.get("conversationId");
const communityId = url.searchParams.get("communityId");
const mode = communityId ? "community" : "private";

const paramEmail = url.searchParams.get("email");
const paramTitle = url.searchParams.get("title");
const finalOtherEmail = otherEmailParam || paramEmail;
let chatTitle = paramTitle || "";

/* --- STATE --- */
let activeConversationId = conversationIdParam || null;
let communityMembers = [];
let otherUser = null;
let lastMessageCount = 0; // Performance: Only render new items

const BUBBLE_PALETTE = [
    { bg: "#4A6CFF", text: "#FFFFFF" },
    { bg: "#6F8CFF", text: "#FFFFFF" },
    { bg: "#8FA3FF", text: "#000000" },
    { bg: "#AFC0FF", text: "#000000" }
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
    return new Promise((r) => {
        const reader = new FileReader();
        reader.onload = () => r(reader.result);
        reader.readAsDataURL(file);
    });
}

function scrollToBottom() {
    const msgArea = document.getElementById("messages");
    if (msgArea) msgArea.scrollTop = msgArea.scrollHeight;
}

/****************************************************
 * NAVBAR & UI
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

function logout() {
    localStorage.removeItem("contact_user");
    window.location.href = "index.html";
}

/****************************************************
 * DATA FETCHING
 ****************************************************/
async function loadOtherUserProfile() {
    const r = await fetch(`${API_URL}?module=getUserByEmail&email=${encodeURIComponent(finalOtherEmail)}`);
    const d = await r.json();
    otherUser = d?.user || {};
    const name = otherUser.fullName || otherUser.FullName || finalOtherEmail;
    const header = document.getElementById("headerTitle");
    if (header) {
        const pic = otherUser.profilePic || otherUser.ProfilePic;
        const avatar = pic ? `<img class="chat-avatar" src="${pic}" />` : `<div class="chat-avatar-fallback">${getInitials(name)}</div>`;
        header.innerHTML = `<div class="chat-header">${avatar}<div class="chat-header-main">${name}</div></div>`;
    }
}

async function loadCommunityInfo() {
    const r = await fetch(`${API_URL}?module=getCommunityById&communityId=${communityId}`);
    const d = await r.json();
    const header = document.getElementById("headerTitle");
    if (header) header.innerHTML = `<div class="chat-header"><div class="chat-header-main">${d?.community?.name || "Community"}</div></div>`;
}

async function loadCommunityMembers() {
    const r = await fetch(`${API_URL}?module=getCommunityMembers&communityId=${communityId}`);
    const d = await r.json();
    const emails = (d.members || []).map(m => typeof m === "string" ? m : m.email);

    const tasks = emails.map(async (email) => {
        try {
            const res = await fetch(`${API_URL}?module=getUserByEmail&email=${encodeURIComponent(email)}`);
            const ud = await res.json();
            return { email, fullName: ud?.user?.fullName || ud?.user?.FullName || email, profilePic: ud?.user?.profilePic || ud?.user?.ProfilePic || null };
        } catch { return { email, fullName: email, profilePic: null }; }
    });

    communityMembers = await Promise.all(tasks);
    renderCommunityMembersList(communityMembers);
}

function renderCommunityMembersList(list) {
    const container = document.getElementById("memberSidebar");
    if (!container) return;
    container.innerHTML = "<h3>Members</h3>";
    const frag = document.createDocumentFragment();
    list.forEach(m => {
        const row = document.createElement("div");
        row.className = "member-row";
        row.style.cssText = "display:flex; align-items:center; gap:10px; margin-bottom:12px; cursor:pointer;";
        row.onclick = () => window.location.href = `public-profile.html?email=${encodeURIComponent(m.email)}`;
        row.innerHTML = m.profilePic ? `<img src="${m.profilePic}" class="chat-avatar">` : `<div class="chat-avatar-fallback">${getInitials(m.fullName)}</div>`;
        const nameDiv = document.createElement("div");
        nameDiv.style.fontWeight = "500";
        nameDiv.textContent = m.fullName;
        row.appendChild(nameDiv);
        frag.appendChild(row);
    });
    container.appendChild(frag);
}

/****************************************************
 * MESSAGE ENGINE
 ****************************************************/
async function loadMessagesOnce(isPolling = false) {
    if (!activeConversationId) return;

    if (!isPolling) showChatLoader();

    const r = await fetch(`${API_URL}?module=getMessages&conversationId=${activeConversationId}`);
    const data = await r.json();
    const incomingMessages = data.messages || [];

    // Only render if count changed
    if (incomingMessages.length !== lastMessageCount) {
        renderAllMessages(incomingMessages);
        lastMessageCount = incomingMessages.length;
    }

    if (!isPolling) {
        hideChatLoader();
        document.getElementById("messageInput").disabled = false;
        document.getElementById("sendBtn").disabled = false;
    }
}

function renderAllMessages(list) {
    const container = document.getElementById("messageList");
    if (!container) return;
    const fragment = document.createDocumentFragment();
    list.forEach(msg => fragment.appendChild(buildMessageRow(msg)));
    container.innerHTML = "";
    container.appendChild(fragment);
    scrollToBottom();
}

function buildMessageRow(msg) {
    const isMe = msg.senderEmail === loggedInUser.email;
    const color = getUserColor(msg.senderEmail);

    const row = document.createElement("div");
    row.className = `msg-row ${isMe ? "me" : "them"}`;
    row.style.cssText = `display:flex; margin-bottom:15px; gap:8px; align-items:flex-end; justify-content:${isMe ? "flex-end" : "flex-start"}`;

    let pic = isMe ? loggedInUser.profilePic : null;
    let name = isMe ? loggedInUser.fullName : msg.senderEmail;

    if (!isMe) {
        if (mode === "community") {
            const s = communityMembers.find(m => m.email === msg.senderEmail);
            if (s) { pic = s.profilePic; name = s.fullName; }
        } else if (otherUser) {
            pic = otherUser.profilePic || otherUser.ProfilePic;
            name = otherUser.fullName || otherUser.FullName || msg.senderEmail;
        }
    }

    const avatarHTML = pic 
        ? `<img class="chat-avatar" src="${pic}" style="width:32px; height:32px; border-radius:50%;" />`
        : `<div class="chat-avatar-fallback" style="width:32px; height:32px; border-radius:50%; font-size:12px; background:#eee; display:flex; align-items:center; justify-content:center;">${getInitials(name)}</div>`;

    const bubble = document.createElement("div");
    bubble.style.cssText = `max-width:70%; padding:10px 14px; font-size:14px; border-radius:${isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px"}; background:${isMe ? color.bg : "#E5E7EB"}; color:${isMe ? color.text : "#1F2937"}`;
    
    if (msg.type === "image") bubble.innerHTML = `<img src="${msg.fileData}" style="max-width:100%; border-radius:10px;">`;
    else if (msg.type === "document") bubble.innerHTML = `<a href="${msg.fileData}" download="${msg.fileName}" style="color:inherit">📄 ${msg.fileName}</a>`;
    else bubble.textContent = msg.text || "";

    const avatarDiv = document.createElement("div");
    avatarDiv.innerHTML = avatarHTML;

    if (isMe) row.append(bubble, avatarDiv);
    else row.append(avatarDiv, bubble);

    return row;
}

/****************************************************
 * SEND LOGIC (OPTIMISTIC)
 ****************************************************/
function sendMessage(payloadOverride = null) {
    const input = document.getElementById("messageInput");
    const text = (input?.value || "").trim();
    if (!payloadOverride && (!text || !activeConversationId)) return;

    const payload = payloadOverride || { module: "sendMessage", type: "text", text };
    
    // Optimistic Update: Add to UI immediately
    const optimistic = { senderEmail: loggedInUser.email, ...payload };
    document.getElementById("messageList").appendChild(buildMessageRow(optimistic));
    scrollToBottom();
    if (input) input.value = "";

    fetch(API_URL, { 
        method: "POST", 
        body: JSON.stringify({ ...payload, conversationId: activeConversationId, senderEmail: loggedInUser.email }) 
    }).then(() => loadMessagesOnce(true));
}

/****************************************************
 * DOM READY
 ****************************************************/
document.addEventListener("DOMContentLoaded", async () => {
    loadNavbar();
    showChatLoader();

    // Start data fetches in parallel for speed
    const infoTask = mode === "private" ? loadOtherUserProfile() : Promise.all([loadCommunityInfo(), loadCommunityMembers()]);

    if (!activeConversationId) {
        let fetchUrl = mode === "community" 
            ? `${API_URL}?module=startCommunityConversation&communityId=${communityId}&userEmail=${loggedInUser.email}`
            : `${API_URL}?module=startConversation&userEmail=${loggedInUser.email}&otherEmail=${finalOtherEmail}`;
        
        try {
            const r = await fetch(fetchUrl);
            const d = await r.json();
            activeConversationId = d.conversationId;
        } catch (e) { console.error(e); }
    }

    await infoTask; // Ensure profiles are ready before messages
    await loadMessagesOnce();

    // Event Listeners
    document.getElementById("sendBtn").onclick = () => sendMessage();
    document.getElementById("messageInput").onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } };
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

    // Auto-refresh every 10 seconds for new incoming messages
    setInterval(() => loadMessagesOnce(true), 10000);
});

function showChatLoader() { document.getElementById("chatLoader").style.display = "flex"; }
function hideChatLoader() { document.getElementById("chatLoader").style.display = "none"; }

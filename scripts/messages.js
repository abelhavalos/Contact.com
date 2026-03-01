/****************************************************
 * CONTACT.COM — MESSAGES.JS (BUBBLE THEME V12)
 * - RESTORED: Member Sidebar Logic
 * - THEME: Left-anchored Navbar & Bubble UI
 * - FEATURE: Dynamic Header & Private/Community Modes
 ****************************************************/

const API_URL = "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

/* 1. STATE & USER */
let loggedInUser = JSON.parse(localStorage.getItem("contact_user"));
if (!loggedInUser) window.location.href = "login.html";

loggedInUser.fullName = loggedInUser.fullName || loggedInUser.FullName || loggedInUser.email;

const url = new URL(window.location.href);
const communityId = url.searchParams.get("communityId");
const mode = communityId ? "community" : "private";
const otherEmailParam = url.searchParams.get("otherEmail") || url.searchParams.get("email");

let activeConversationId = url.searchParams.get("conversationId") || null;
let messages = [];
let communityMembers = [];
let otherUser = null;

/****************************************************
 * THEME HELPERS
 ****************************************************/
function getInitials(name) {
    if (!name) return "?";
    return name.split(" ").filter(Boolean).map(p => p[0]).join("").substring(0, 2).toUpperCase();
}

function fileToBase64(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
    });
}

/****************************************************
 * NAVIGATION (MATCHES THEME)
 ****************************************************/
function loadNavbar() {
    const nav = document.getElementById("navbar");
    if (!nav) return;

    const navItems = `
        <a href="dashboard.html">Dashboard</a>
        <a href="communities.html">Communities</a>
        <a href="events.html">Events</a>
        <a href="contacts.html">Contacts</a>
        <a href="profile.html">Profile</a>
        <a href="#" onclick="logout()" style="color:#ff4a4a !important;">Logout</a>
    `;

    nav.innerHTML = `
        <div class="hamburger" onclick="toggleMenu()">
            <span></span><span></span><span></span>
        </div>
        <div class="logo">Contact<span>.</span>com</div>
        <div class="nav-links">${navItems}</div>
    `;

    const mobileMenu = document.getElementById("mobileMenu");
    if (mobileMenu) mobileMenu.innerHTML = navItems;
}

function toggleMenu() {
    document.getElementById("mobileMenu").classList.toggle("show");
}

function logout() {
    localStorage.removeItem("contact_user");
    window.location.href = "index.html";
}

/****************************************************
 * HEADERS & MEMBERS
 ****************************************************/
async function loadChatContext() {
    const headerTitle = document.getElementById("headerTitle");
    const sidebar = document.getElementById("memberSidebar");

    if (mode === "private") {
        // Hide sidebar for private chats
        if (sidebar) sidebar.style.display = "none";
        document.getElementById("toggleMembers")?.style.setProperty("display", "none", "important");

        const r = await fetch(`${API_URL}?module=getUserByEmail&email=${encodeURIComponent(otherEmailParam)}`);
        const d = await r.json();
        otherUser = d?.user || {};
        const name = otherUser.fullName || otherUser.FullName || otherEmailParam;
        if (headerTitle) headerTitle.innerText = name;
    } 
    else {
        // Show community info
        const r = await fetch(`${API_URL}?module=getCommunityById&communityId=${communityId}`);
        const d = await r.json();
        if (headerTitle) headerTitle.innerText = d?.community?.name || "Community Chat";
        loadCommunityMembers();
    }
}

async function loadCommunityMembers() {
    const r = await fetch(`${API_URL}?module=getCommunityMembers&communityId=${communityId}`);
    const d = await r.json();
    const emails = (d.members || []).map(m => typeof m === "string" ? m : m.email);

    // Fetch details for each member to get names/pics
    const tasks = emails.map(async (email) => {
        try {
            const res = await fetch(`${API_URL}?module=getUserByEmail&email=${encodeURIComponent(email)}`);
            const data = await res.json();
            const u = data?.user || {};
            return { email, fullName: u.fullName || u.FullName || email, profilePic: u.profilePic || u.ProfilePic || null };
        } catch { return { email, fullName: email, profilePic: null }; }
    });

    communityMembers = await Promise.all(tasks);
    renderMemberSidebar();
}

function renderMemberSidebar() {
    const container = document.getElementById("memberSidebar");
    if (!container) return;

    container.innerHTML = `<h3 style="font-weight:800; font-size:12px; color:#999; text-transform:uppercase; letter-spacing:1px; margin-bottom:20px;">Participants</h3>`;
    
    communityMembers.forEach(m => {
        const initials = getInitials(m.fullName);
        const avatar = m.profilePic 
            ? `<img src="${m.profilePic}" style="width:36px; height:36px; border-radius:50%; object-fit:cover;">`
            : `<div class="chat-avatar-fallback" style="width:36px; height:36px; font-size:12px;">${initials}</div>`;

        const row = document.createElement("div");
        row.className = "member-row";
        row.style = "display:flex; align-items:center; gap:12px; margin-bottom:15px; cursor:pointer;";
        row.onclick = () => window.location.href = `public-profile.html?email=${encodeURIComponent(m.email)}`;
        row.innerHTML = `${avatar} <span style="font-weight:600; font-size:14px; color:#333;">${m.fullName}</span>`;
        container.appendChild(row);
    });
}

/****************************************************
 * MESSAGING LOGIC
 ****************************************************/
async function syncMessages() {
    if (!activeConversationId) return;
    const lastId = messages.reduce((max, m) => (m.messageId > max ? m.messageId : max), 0);
    
    try {
        const r = await fetch(`${API_URL}?module=getMessages&conversationId=${activeConversationId}&lastId=${lastId}`);
        const data = await r.json();
        const newMsgs = data.messages || [];
        
        if (newMsgs.length > 0) {
            const list = document.getElementById("messageList");
            newMsgs.forEach(msg => {
                if (!document.getElementById(`msg-${msg.messageId}`)) {
                    messages.push(msg);
                    list.appendChild(buildMessageRow(msg));
                }
            });
            const container = document.getElementById("messages");
            container.scrollTop = container.scrollHeight;
        }
    } catch (e) { console.error("Sync Error:", e); }
}

function buildMessageRow(msg) {
    const isMe = msg.senderEmail === loggedInUser.email;
    const row = document.createElement("div");
    row.id = `msg-${msg.messageId}`;
    row.style = `display:flex; flex-direction:column; align-items:${isMe ? 'flex-end' : 'flex-start'}; margin-bottom:15px;`;

    const bubble = document.createElement("div");
    bubble.className = `message-bubble ${isMe ? 'msg-sent' : 'msg-received'}`;
    bubble.style = `
        max-width: 80%;
        padding: 12px 18px;
        border-radius: 20px;
        font-size: 14px;
        font-weight: 500;
        line-height: 1.5;
        box-shadow: 0 2px 5px rgba(0,0,0,0.05);
        background: ${isMe ? '#4A6CFF' : '#ffffff'};
        color: ${isMe ? '#ffffff' : '#222222'};
        border-${isMe ? 'bottom-right' : 'bottom-left'}-radius: 4px;
    `;
    
    // Add sender name for community
    if (mode === "community" && !isMe) {
        const nameLabel = document.createElement("span");
        nameLabel.style = "font-size:10px; font-weight:700; color:#999; margin-bottom:4px; text-transform:uppercase;";
        nameLabel.innerText = msg.senderEmail.split('@')[0]; // fallback
        const sender = communityMembers.find(m => m.email === msg.senderEmail);
        if (sender) nameLabel.innerText = sender.fullName;
        row.appendChild(nameLabel);
    }

    bubble.innerHTML = renderMessageContent(msg);
    row.appendChild(bubble);
    return row;
}

function renderMessageContent(msg) {
    if (msg.type === "image") return `<img src="${msg.fileData}" style="max-width:100%; border-radius:12px;">`;
    if (msg.type === "document") return `<div style="display:flex; align-items:center; gap:8px;">📄 <a href="${msg.fileData}" download="${msg.fileName}" style="color:inherit; font-weight:700;">${msg.fileName}</a></div>`;
    return msg.text || "";
}

async function sendMessage(payloadOverride = null) {
    const input = document.getElementById("messageInput");
    const text = (input?.value || "").trim();
    if (!payloadOverride && !text) return;

    const payload = payloadOverride || { type: "text", text: text };
    
    // Optimistic UI
    const list = document.getElementById("messageList");
    const tempRow = buildMessageRow({ ...payload, senderEmail: loggedInUser.email, messageId: 'temp' });
    tempRow.style.opacity = "0.6";
    list.appendChild(tempRow);
    const chatContainer = document.getElementById("messages");
    chatContainer.scrollTop = chatContainer.scrollHeight;
    if (input) input.value = "";

    try {
        const body = JSON.stringify({
            module: "sendMessage",
            conversationId: activeConversationId,
            senderEmail: loggedInUser.email,
            ...payload
        });
        await fetch(API_URL, { method: "POST", body });
        tempRow.remove();
        syncMessages();
    } catch (e) {
        tempRow.style.background = "#ff4a4a";
    }
}

/****************************************************
 * INITIALIZATION
 ****************************************************/
document.addEventListener("DOMContentLoaded", async () => {
    loadNavbar();
    document.getElementById("chatLoader").style.display = "flex";

    await loadChatContext();

    // Start or fetch Conversation ID
    const setupUrl = mode === "community" 
        ? `${API_URL}?module=startCommunityConversation&communityId=${communityId}&userEmail=${loggedInUser.email}`
        : `${API_URL}?module=startConversation&userEmail=${loggedInUser.email}&otherEmail=${otherEmailParam}`;
    
    const res = await fetch(setupUrl);
    const data = await res.json();
    activeConversationId = data.conversationId;

    document.getElementById("chatLoader").style.display = "none";
    
    syncMessages();
    setInterval(syncMessages, 4000);

    // Event Listeners
    document.getElementById("sendBtn").onclick = () => sendMessage();
    document.getElementById("messageInput").onkeydown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    };
    
    const setupFile = (btnId, inputId, type) => {
        const btn = document.getElementById(btnId);
        const input = document.getElementById(inputId);
        if (btn && input) {
            btn.onclick = () => input.click();
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (file) {
                    const base64 = await fileToBase64(file);
                    sendMessage({ type, fileName: file.name, fileData: base64 });
                }
                e.target.value = "";
            };
        }
    };
    setupFile("uploadDocBtn", "docInput", "document");
    setupFile("uploadImgBtn", "imgInput", "image");

    // Toggle Sidebar on mobile
    document.getElementById("toggleMembers").onclick = () => {
        const sidebar = document.getElementById("memberSidebar");
        sidebar.classList.toggle("show-mobile");
    };
});

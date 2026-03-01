/****************************************************
 * CONTACT.COM — MESSAGES.JS (BUBBLE THEME V13)
 * - FIXED: Full History Load (Images/Docs)
 * - FIXED: Member List Toggle
 * - THEME: Consistent Blue Branding
 ****************************************************/

const API_URL = "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

/* 1. STATE & USER */
let loggedInUser = JSON.parse(localStorage.getItem("contact_user"));
if (!loggedInUser) window.location.href = "login.html";

const url = new URL(window.location.href);
const communityId = url.searchParams.get("communityId");
const mode = communityId ? "community" : "private";
const otherEmailParam = url.searchParams.get("otherEmail") || url.searchParams.get("email");

let activeConversationId = url.searchParams.get("conversationId") || null;
let messages = [];
let communityMembers = [];
let otherUser = null;

/****************************************************
 * UI HELPERS
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

function loadNavbar() {
    const nav = document.getElementById("navbar");
    if (!nav) return;
    const items = `<a href="dashboard.html">Dashboard</a><a href="communities.html">Communities</a><a href="events.html">Events</a><a href="contacts.html">Contacts</a><a href="profile.html">Profile</a><a href="#" onclick="logout()" style="color:#ff4a4a !important;">Logout</a>`;
    nav.innerHTML = `<div class="hamburger" onclick="toggleMenu()"><span></span><span></span><span></span></div><div class="logo">Contact<span>.</span>com</div><div class="nav-links">${items}</div>`;
    document.getElementById("mobileMenu").innerHTML = items;
}

function toggleMenu() { document.getElementById("mobileMenu").classList.toggle("show"); }
function logout() { localStorage.removeItem("contact_user"); window.location.href = "index.html"; }

/****************************************************
 * MEMBER SIDEBAR & CONTEXT
 ****************************************************/
async function loadChatContext() {
    const headerTitle = document.getElementById("headerTitle");
    const sidebar = document.getElementById("memberSidebar");

    if (mode === "private") {
        if (sidebar) sidebar.style.display = "none";
        document.getElementById("toggleMembers").style.display = "none";
        const r = await fetch(`${API_URL}?module=getUserByEmail&email=${encodeURIComponent(otherEmailParam)}`);
        const d = await r.json();
        otherUser = d?.user || {};
        headerTitle.innerText = otherUser.fullName || otherUser.FullName || otherEmailParam;
    } else {
        const r = await fetch(`${API_URL}?module=getCommunityById&communityId=${communityId}`);
        const d = await r.json();
        headerTitle.innerText = d?.community?.name || "Community Chat";
        await loadCommunityMembers();
    }
}

async function loadCommunityMembers() {
    const r = await fetch(`${API_URL}?module=getCommunityMembers&communityId=${communityId}`);
    const d = await r.json();
    const emails = (d.members || []).map(m => typeof m === "string" ? m : m.email);

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
    container.innerHTML = `<h3 style="font-weight:800; font-size:12px; color:#999; text-transform:uppercase; margin-bottom:20px;">Participants</h3>`;
    
    communityMembers.forEach(m => {
        const initials = getInitials(m.fullName);
        const pic = m.profilePic ? `<img src="${m.profilePic}" style="width:36px; height:36px; border-radius:50%; object-fit:cover;">` : `<div class="chat-avatar-fallback" style="width:36px; height:36px; font-size:12px; background:#dbe4ff; color:#4a6cff; border-radius:50%; display:flex; align-items:center; justify-content:center;">${initials}</div>`;
        const row = document.createElement("div");
        row.style = "display:flex; align-items:center; gap:12px; margin-bottom:15px; cursor:pointer;";
        row.onclick = () => window.location.href = `public-profile.html?email=${encodeURIComponent(m.email)}`;
        row.innerHTML = `${pic} <span style="font-weight:600; font-size:14px; color:#333;">${m.fullName}</span>`;
        container.appendChild(row);
    });
}

/****************************************************
 * MESSAGING ENGINE (HISTORY & RENDERING)
 ****************************************************/
async function loadHistory() {
    if (!activeConversationId) return;
    try {
        const r = await fetch(`${API_URL}?module=getMessages&conversationId=${activeConversationId}`);
        const data = await r.json();
        messages = data.messages || [];
        
        const list = document.getElementById("messageList");
        list.innerHTML = ""; // Clear loader/old messages
        
        messages.forEach(msg => {
            list.appendChild(buildMessageRow(msg));
        });
        
        const container = document.getElementById("messages");
        container.scrollTop = container.scrollHeight;
    } catch (e) { console.error("History Load Error:", e); }
}

async function syncNewMessages() {
    if (!activeConversationId) return;
    const lastId = messages.reduce((max, m) => (m.messageId > max ? m.messageId : max), 0);
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
        document.getElementById("messages").scrollTop = document.getElementById("messages").scrollHeight;
    }
}

function buildMessageRow(msg) {
    const isMe = msg.senderEmail === loggedInUser.email;
    const div = document.createElement("div");
    div.id = `msg-${msg.messageId}`;
    div.style = `display:flex; flex-direction:column; align-items:${isMe ? 'flex-end' : 'flex-start'}; margin-bottom:15px;`;

    const bubble = document.createElement("div");
    bubble.style = `max-width:80%; padding:12px 18px; border-radius:20px; font-size:14px; font-weight:500; background:${isMe ? '#4A6CFF' : '#ffffff'}; color:${isMe ? '#ffffff' : '#222'}; border-${isMe ? 'bottom-right' : 'bottom-left'}-radius:4px; box-shadow:0 2px 5px rgba(0,0,0,0.05);`;
    
    bubble.innerHTML = renderMessageContent(msg);
    div.appendChild(bubble);
    return div;
}

function renderMessageContent(msg) {
    // Note: Database keys might be lowercase 'image' or 'document'
    const type = (msg.type || "").toLowerCase();
    if (type === "image") {
        return `<img src="${msg.fileData}" style="max-width:100%; border-radius:12px; display:block; margin:5px 0;" onclick="window.open(this.src)">`;
    }
    if (type === "document") {
        return `<div style="display:flex; align-items:center; gap:8px; padding:5px 0;">📄 <a href="${msg.fileData}" download="${msg.fileName || 'file'}" style="color:inherit; font-weight:700; text-decoration:underline;">${msg.fileName || 'Download File'}</a></div>`;
    }
    return msg.text || "";
}

async function sendMessage(payloadOverride = null) {
    const input = document.getElementById("messageInput");
    const text = (input?.value || "").trim();
    if (!payloadOverride && !text) return;

    const payload = payloadOverride || { type: "text", text: text };
    if (input) input.value = "";

    try {
        const body = JSON.stringify({ module: "sendMessage", conversationId: activeConversationId, senderEmail: loggedInUser.email, ...payload });
        await fetch(API_URL, { method: "POST", body });
        syncNewMessages();
    } catch (e) { alert("Message failed to send."); }
}

/****************************************************
 * BOOTSTRAP
 ****************************************************/
document.addEventListener("DOMContentLoaded", async () => {
    loadNavbar();
    document.getElementById("chatLoader").style.display = "flex";

    // 1. Sidebar Toggle Fix (Mobile)
    const toggleBtn = document.getElementById("toggleMembers");
    const sidebar = document.getElementById("memberSidebar");
    if(toggleBtn && sidebar) {
        toggleBtn.onclick = () => {
            if (sidebar.style.display === "block") {
                sidebar.style.display = "none";
            } else {
                sidebar.style.display = "block";
                sidebar.style.position = "absolute";
                sidebar.style.right = "0";
                sidebar.style.top = "70px";
                sidebar.style.height = "calc(100% - 70px)";
                sidebar.style.zIndex = "1000";
                sidebar.style.boxShadow = "-5px 0 15px rgba(0,0,0,0.1)";
            }
        };
    }

    // 2. Load Identity & Members
    await loadChatContext();

    // 3. Setup Conversation ID
    if (!activeConversationId) {
        const setupUrl = mode === "community" 
            ? `${API_URL}?module=startCommunityConversation&communityId=${communityId}&userEmail=${loggedInUser.email}`
            : `${API_URL}?module=startConversation&userEmail=${loggedInUser.email}&otherEmail=${otherEmailParam}`;
        const res = await fetch(setupUrl);
        const data = await res.json();
        activeConversationId = data.conversationId;
    }

    // 4. Load History & Start Polling
    await loadHistory();
    document.getElementById("chatLoader").style.display = "none";
    setInterval(syncNewMessages, 4000);

    // 5. Input Listeners
    document.getElementById("sendBtn").onclick = () => sendMessage();
    document.getElementById("messageInput").onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } };
    
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
});

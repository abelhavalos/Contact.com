/****************************************************
 * CONTACT.COM — MESSAGES.JS (BUBBLE THEME V14)
 * - FIXED: Full History Rendering (Images/Docs)
 * - FIXED: File Picker Loop 
 * - FIXED: Member Toggle Logic
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

/****************************************************
 * UI HELPERS
 ****************************************************/
function getInitials(name) {
    if (!name) return "?";
    return name.split(" ").filter(Boolean).map(p => p[0]).join("").substring(0, 2).toUpperCase();
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
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
        if (document.getElementById("toggleMembers")) document.getElementById("toggleMembers").style.display = "none";
        const r = await fetch(`${API_URL}?module=getUserByEmail&email=${encodeURIComponent(otherEmailParam)}`);
        const d = await r.json();
        headerTitle.innerText = d?.user?.fullName || d?.user?.FullName || otherEmailParam;
    } else {
        const r = await fetch(`${API_URL}?module=getCommunityById&communityId=${communityId}`);
        const d = await r.json();
        headerTitle.innerText = d?.community?.name || "Community Chat";
        await loadCommunityMembers();
    }
}

async function loadCommunityMembers() {
    try {
        const r = await fetch(`${API_URL}?module=getCommunityMembers&communityId=${communityId}`);
        const d = await r.json();
        const emails = (d.members || []).map(m => typeof m === "string" ? m : m.email);

        const tasks = emails.map(async (email) => {
            const res = await fetch(`${API_URL}?module=getUserByEmail&email=${encodeURIComponent(email)}`);
            const data = await res.json();
            const u = data?.user || {};
            return { email, fullName: u.fullName || u.FullName || email, profilePic: u.profilePic || u.ProfilePic || null };
        });

        communityMembers = await Promise.all(tasks);
        renderMemberSidebar();
    } catch(e) { console.error("Members error", e); }
}

function renderMemberSidebar() {
    const container = document.getElementById("memberSidebar");
    if (!container) return;
    container.innerHTML = `<h3 style="font-weight:800; font-size:12px; color:#999; text-transform:uppercase; margin-bottom:20px;">Participants</h3>`;
    
    communityMembers.forEach(m => {
        const initials = getInitials(m.fullName);
        const pic = m.profilePic ? `<img src="${m.profilePic}" style="width:36px; height:36px; border-radius:50%; object-fit:cover;">` : `<div class="chat-avatar-fallback" style="width:36px; height:36px; font-size:12px; background:#dbe4ff; color:#4a6cff; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:700;">${initials}</div>`;
        const row = document.createElement("div");
        row.style = "display:flex; align-items:center; gap:12px; margin-bottom:15px; cursor:pointer;";
        row.onclick = () => window.location.href = `public-profile.html?email=${encodeURIComponent(m.email)}`;
        row.innerHTML = `${pic} <span style="font-weight:600; font-size:14px; color:#333;">${m.fullName}</span>`;
        container.appendChild(row);
    });
}

/****************************************************
 * MESSAGING ENGINE
 ****************************************************/
async function loadHistory() {
    if (!activeConversationId) return;
    try {
        const r = await fetch(`${API_URL}?module=getMessages&conversationId=${activeConversationId}`);
        const data = await r.json();
        messages = data.messages || [];
        
        const list = document.getElementById("messageList");
        list.innerHTML = ""; 
        
        messages.forEach(msg => {
            list.appendChild(buildMessageRow(msg));
        });
        
        const container = document.getElementById("messages");
        container.scrollTop = container.scrollHeight;
    } catch (e) { console.error("History Error:", e); }
}

async function syncNewMessages() {
    if (!activeConversationId) return;
    const lastId = messages.length > 0 ? Math.max(...messages.map(m => m.messageId || 0)) : 0;
    
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
            document.getElementById("messages").scrollTop = document.getElementById("messages").scrollHeight;
        }
    } catch(e) {}
}

function buildMessageRow(msg) {
    const isMe = msg.senderEmail === loggedInUser.email;
    const div = document.createElement("div");
    if(msg.messageId) div.id = `msg-${msg.messageId}`;
    div.style = `display:flex; flex-direction:column; align-items:${isMe ? 'flex-end' : 'flex-start'}; margin-bottom:15px; width:100%;`;

    const bubble = document.createElement("div");
    bubble.className = "msg-bubble-item";
    bubble.style = `max-width:80%; padding:12px 18px; border-radius:20px; font-size:14px; font-weight:500; background:${isMe ? '#4A6CFF' : '#ffffff'}; color:${isMe ? '#ffffff' : '#222'}; border-${isMe ? 'bottom-right' : 'bottom-left'}-radius:4px; box-shadow:0 2px 5px rgba(0,0,0,0.05); word-wrap: break-word;`;
    
    bubble.innerHTML = renderMessageContent(msg);
    div.appendChild(bubble);
    return div;
}

function renderMessageContent(msg) {
    const type = (msg.type || "").toLowerCase();
    if (type === "image" || (msg.fileData && msg.fileData.startsWith("data:image"))) {
        return `<img src="${msg.fileData}" style="max-width:100%; border-radius:12px; display:block; cursor:pointer;" onclick="window.open(this.src)">`;
    }
    if (type === "document" || msg.fileName) {
        return `<div style="display:flex; align-items:center; gap:8px;">📄 <a href="${msg.fileData}" download="${msg.fileName || 'file'}" style="color:inherit; font-weight:700; text-decoration:underline; font-size:12px;">${msg.fileName || 'View Document'}</a></div>`;
    }
    return msg.text || "";
}

async function sendMessage(payloadOverride = null) {
    if (!activeConversationId) return;
    const input = document.getElementById("messageInput");
    const text = (input?.value || "").trim();
    
    if (!payloadOverride && !text) return;
    const payload = payloadOverride || { type: "text", text: text };
    
    if (input) input.value = "";

    try {
        const options = {
            method: "POST",
            body: JSON.stringify({ 
                module: "sendMessage", 
                conversationId: activeConversationId, 
                senderEmail: loggedInUser.email, 
                ...payload 
            })
        };
        // If it's just text, we can use GET to be faster if your script supports it, 
        // but POST is safer for all types.
        await fetch(API_URL, options);
        syncNewMessages();
    } catch (e) { console.error("Send error", e); }
}

/****************************************************
 * BOOTSTRAP
 ****************************************************/
document.addEventListener("DOMContentLoaded", async () => {
    loadNavbar();
    document.getElementById("chatLoader").style.display = "flex";

    // Fix Toggle Button
    const toggleBtn = document.getElementById("toggleMembers");
    const sidebar = document.getElementById("memberSidebar");
    if(toggleBtn && sidebar) {
        toggleBtn.onclick = (e) => {
            e.preventDefault();
            const isHidden = window.getComputedStyle(sidebar).display === "none";
            sidebar.style.display = isHidden ? "block" : "none";
            if(isHidden) {
                sidebar.style.position = "absolute";
                sidebar.style.right = "10px";
                sidebar.style.top = "70px";
                sidebar.style.zIndex = "1000";
                sidebar.style.background = "white";
                sidebar.style.boxShadow = "0 4px 15px rgba(0,0,0,0.1)";
                sidebar.style.borderRadius = "15px";
                sidebar.style.padding = "20px";
            }
        };
    }

    await loadChatContext();

    if (!activeConversationId) {
        const setupUrl = mode === "community" 
            ? `${API_URL}?module=startCommunityConversation&communityId=${communityId}&userEmail=${loggedInUser.email}`
            : `${API_URL}?module=startConversation&userEmail=${loggedInUser.email}&otherEmail=${otherEmailParam}`;
        const res = await fetch(setupUrl);
        const data = await res.json();
        activeConversationId = data.conversationId;
    }

    await loadHistory();
    document.getElementById("chatLoader").style.display = "none";
    setInterval(syncNewMessages, 4000);

    document.getElementById("sendBtn").onclick = () => sendMessage();
    document.getElementById("messageInput").onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } };
    
    // FILE HANDLERS (With Fix for Loops)
    const handleFile = async (e, type) => {
        e.preventDefault();
        const file = e.target.files[0];
        if (!file) return;
        
        document.getElementById("chatLoader").style.display = "flex";
        try {
            const base64 = await fileToBase64(file);
            await sendMessage({ type, fileName: file.name, fileData: base64 });
        } catch (err) {
            alert("File too large or invalid.");
        } finally {
            e.target.value = ""; // Clear it so it can be reused
            document.getElementById("chatLoader").style.display = "none";
        }
    };

    document.getElementById("uploadDocBtn").onclick = () => document.getElementById("docInput").click();
    document.getElementById("uploadImgBtn").onclick = () => document.getElementById("imgInput").click();

    document.getElementById("docInput").onchange = (e) => handleFile(e, "document");
    document.getElementById("imgInput").onchange = (e) => handleFile(e, "image");
});

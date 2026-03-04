/****************************************************
 * CONTACT.COM — PRODUCTION READY & FIX: FILE RECORDING
 ****************************************************/

const API_URL = "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

/* --- USER --- */
let loggedInUser = JSON.parse(localStorage.getItem("contact_user"));
if (!loggedInUser) window.location.href = "login.html";
loggedInUser.fullName = loggedInUser.fullName || loggedInUser.FullName || loggedInUser.email;

/* --- STATE --- */
let activeConversationId = new URLSearchParams(window.location.search).get("conversationId") || null;
let communityMembers = [];
let otherUser = null;
let lastMessageCount = 0;

/****************************************************
 * HELPERS & SPEED
 ****************************************************/
const getInitials = (name) => (name || "?").split(" ").filter(Boolean).map(p => p[0]).join("").toUpperCase().substring(0, 2);
const scrollToBottom = () => { const a = document.getElementById("messages"); if(a) a.scrollTop = a.scrollHeight; };

async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

/****************************************************
 * SEND LOGIC (THE FIX)
 ****************************************************/
async function sendMessage(filePayload = null) {
    const input = document.getElementById("messageInput");
    const text = (input?.value || "").trim();
    
    // Guard
    if (!filePayload && (!text || !activeConversationId)) return;

    // 1. Prepare Payload
    const payload = filePayload || {
        module: "sendMessage",
        type: "text",
        text: text
    };

    // 2. Optimistic UI: Show it immediately
    const optimistic = { 
        senderEmail: loggedInUser.email, 
        ...payload,
        timestamp: new Date().toISOString() 
    };
    document.getElementById("messageList").appendChild(buildMessageRow(optimistic));
    scrollToBottom();
    if (input) input.value = "";

    // 3. SERVER SYNC
    try {
        const response = await fetch(API_URL, {
            method: "POST",
            mode: "no-cors", // Essential for Google Script doPost
            cache: "no-cache",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                ...payload,
                conversationId: activeConversationId,
                senderEmail: loggedInUser.email
            })
        });
        
        // Brief delay then refresh to confirm record exists
        setTimeout(() => loadMessagesOnce(true), 2000);
    } catch (e) {
        console.error("Transmission Error:", e);
    }
}

/****************************************************
 * RENDERING (STAYING FAST)
 ****************************************************/
function buildMessageRow(msg) {
    const isMe = msg.senderEmail === loggedInUser.email;
    const row = document.createElement("div");
    row.style.cssText = `display:flex; margin-bottom:15px; gap:10px; align-items:flex-end; justify-content:${isMe ? "flex-end" : "flex-start"}`;

    const bubble = document.createElement("div");
    bubble.style.cssText = `max-width:75%; padding:10px 14px; border-radius:${isMe ? "15px 15px 2px 15px" : "15px 15px 15px 2px"}; font-size:14px; background:${isMe ? "#4A6CFF" : "#E5E7EB"}; color:${isMe ? "#fff" : "#1F2937"}`;

    // Fix Content Rendering
    if (msg.type === "image" || (msg.fileData && msg.type === "image")) {
        bubble.innerHTML = `<img src="${msg.fileData}" style="max-width:100%; border-radius:8px; display:block;">`;
    } else if (msg.type === "document") {
        bubble.innerHTML = `<a href="${msg.fileData}" target="_blank" style="color:inherit; text-decoration:underline;">📄 ${msg.fileName || "Download Document"}</a>`;
    } else {
        bubble.textContent = msg.text || "";
    }

    if (isMe) row.appendChild(bubble);
    else {
        const avatar = document.createElement("div");
        avatar.style.cssText = "width:30px; height:30px; border-radius:50%; background:#ddd; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700;";
        avatar.textContent = getInitials(msg.senderEmail);
        row.append(avatar, bubble);
    }

    return row;
}

async function loadMessagesOnce(isPolling = false) {
    if (!activeConversationId) return;
    try {
        const r = await fetch(`${API_URL}?module=getMessages&conversationId=${activeConversationId}`);
        const d = await r.json();
        const list = d.messages || [];
        if (list.length !== lastMessageCount) {
            const container = document.getElementById("messageList");
            const frag = document.createDocumentFragment();
            list.forEach(m => frag.appendChild(buildMessageRow(m)));
            container.innerHTML = "";
            container.appendChild(frag);
            lastMessageCount = list.length;
            scrollToBottom();
        }
    } catch (e) { console.warn("Polling failed"); }
}

/****************************************************
 * CORE SETUP
 ****************************************************/
document.addEventListener("DOMContentLoaded", async () => {
    // 1. NAVBAR
    const nav = document.getElementById("navbar");
    if (nav) {
        nav.innerHTML = `<div class="logo" style="cursor:pointer" onclick="window.location.href='dashboard.html'">Contact<span>.</span>com</div><div class="nav-links"><a href="dashboard.html">Home</a><a href="#" onclick="logout()">Logout</a></div>`;
    }

    // 2. PARALLEL START
    const communityId = new URLSearchParams(window.location.search).get("communityId");
    if (communityId) await loadCommunityMembers(communityId);
    
    // 3. CONVERSATION INIT
    if (activeConversationId) {
        await loadMessagesOnce();
    } else {
        // Start conversation logic here if missing ID
    }

    // 4. EVENT BINDINGS
    document.getElementById("sendBtn").onclick = () => sendMessage();
    document.getElementById("messageInput").onkeydown = e => { if(e.key === "Enter") sendMessage(); };

    // File Handlers
    document.getElementById("docInput").onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            const b64 = await fileToBase64(file);
            sendMessage({ module: "sendMessage", type: "document", fileName: file.name, fileData: b64 });
        }
    };

    document.getElementById("imgInput").onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            const b64 = await fileToBase64(file);
            sendMessage({ module: "sendMessage", type: "image", fileName: file.name, fileData: b64 });
        }
    };

    setInterval(() => loadMessagesOnce(true), 8000); // Background refresh
});

function logout() { localStorage.clear(); window.location.href = "login.html"; }

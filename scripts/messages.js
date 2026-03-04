/****************************************************
 * CONTACT.COM — MESSAGES.JS (BUBBLE THEME V11)
 * - FIXED: Chatroom Title & Member List
 * - THEME: Signature Bubbly UI (24px radius)
 * - FEATURE: Community & Private Logic
 ****************************************************/

const API_URL = "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

/* 1. HELPERS */
const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});

const safeBtoa = (str) => btoa(unescape(encodeURIComponent(str || "")));

const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => showToast("Copied to clipboard!", "success"));
};

/* 2. STATE */
let loggedInUser = JSON.parse(localStorage.getItem("contact_user"));
if (!loggedInUser) window.location.href = "login.html";

const urlParams = new URLSearchParams(window.location.search);
const communityId = urlParams.get("communityId");
const otherEmail = urlParams.get("otherEmail") || urlParams.get("email");
let activeConversationId = urlParams.get("conversationId") || null;
let messages = [];

/****************************************************
 * UI COMPONENTS
 ****************************************************/
function showToast(msg, type = "error") {
    let toast = document.getElementById("chat-toast") || document.createElement("div");
    toast.id = "chat-toast";
    toast.style = `position:fixed; top:80px; left:50%; transform:translateX(-50%); padding:12px 24px; border-radius:24px; color:white; font-weight:600; z-index:10002; transition:0.4s; box-shadow:0 8px 20px rgba(0,0,0,0.2);`;
    toast.style.backgroundColor = type === "error" ? "#ff4a4a" : "#4A6CFF";
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function loadNavbar() {
    const nav = document.getElementById("navbar");
    if (!nav) return;
    const items = `
        <a href="dashboard.html">Dashboard</a>
        <a href="communities.html">Communities</a>
        <a href="events.html">Events</a>
        <a href="contacts.html">Contacts</a>
        <a href="profile.html">Profile</a>
        <a href="#" onclick="logout()" style="color:#ff4a4a !important;">Logout</a>
    `;
    nav.innerHTML = `
        <div class="hamburger" onclick="toggleMenu()"><span></span><span></span><span></span></div>
        <div class="logo">Contact<span>.</span>com</div>
        <div class="nav-links">${items}</div>
    `;
    document.getElementById("mobileMenu").innerHTML = items;
}

function toggleMenu() {
    document.getElementById("mobileMenu").classList.toggle("show");
}

/****************************************************
 * CORE MESSAGING & MEMBER LOGIC
 ****************************************************/
async function initChat() {
    loadNavbar();
    const loader = document.getElementById("chatLoader");
    if (loader) loader.style.display = "flex";

    try {
        // 1. Setup Conversation & Get Context (Title/Members)
        const setupUrl = communityId 
            ? `${API_URL}?module=startCommunityConversation&communityId=${communityId}&userEmail=${loggedInUser.email}`
            : `${API_URL}?module=startConversation&userEmail=${loggedInUser.email}&otherEmail=${otherEmail}`;
        
        const res = await fetch(setupUrl);
        const data = await res.json();

        if (data.success) {
            activeConversationId = data.conversationId;
            
            // 2. Fix: Set Header Title
            const titleEl = document.getElementById("headerTitle");
            if (titleEl) {
                titleEl.innerText = communityId ? (data.communityName || "Community Chat") : (data.otherUserName || "Chat");
            }

            // 3. Fix: Render Member List
            renderMembers(data.members || []);
            
            // Initial Sync
            await syncMessages();
            setInterval(syncMessages, 4000);
        } else {
            showToast(data.message || "Failed to load chat.");
        }
    } catch (e) {
        showToast("Network error occurred.");
    } finally {
        if (loader) loader.style.display = "none";
    }
}

function renderMembers(members) {
    const list = document.getElementById("memberSidebar");
    if (!list) return;

    // Use Bubble Theme styling for list
    let html = `<h3 style="font-weight:800; font-size:12px; color:#999; text-transform:uppercase; letter-spacing:1px; margin-bottom:15px;">Participants</h3>`;
    
    members.forEach(m => {
        const name = m.fullName || m.FullName || m.email;
        const pic = m.profilePic || m.ProfilePic || 'default-avatar.png';
        html += `
            <div class="member-row" style="display:flex; align-items:center; gap:10px; margin-bottom:12px;">
                <img src="${pic}" style="width:36px; height:36px; border-radius:50%; object-fit:cover; border:2px solid #f0f2f5;">
                <span style="font-size:14px; font-weight:600; color:#333;">${name}</span>
            </div>
        `;
    });
    list.innerHTML = html;
}

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
                    list.appendChild(buildMessageBubble(msg));
                }
            });
            const chatContainer = document.getElementById("messages");
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
    } catch (e) { console.error("Sync Error", e); }
}

function buildMessageBubble(msg) {
    const isMe = msg.senderEmail === loggedInUser.email;
    const div = document.createElement("div");
    div.id = `msg-${msg.messageId}`;
    div.style = `display:flex; flex-direction:column; align-items:${isMe ? 'flex-end' : 'flex-start'}; margin-bottom:15px;`;

    // Bubble styling matches theme
    const bubble = document.createElement("div");
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
    bubble.innerHTML = renderMessageContent(msg);
    bubble.oncontextmenu = (e) => { e.preventDefault(); if(msg.text) copyToClipboard(msg.text); };

    // Add sender name for community chats
    if (communityId && !isMe) {
        const nameLabel = document.createElement("span");
        nameLabel.style = "font-size:10px; font-weight:700; color:#999; margin-bottom:4px; text-transform:uppercase;";
        nameLabel.innerText = msg.senderName || msg.senderEmail.split('@')[0];
        div.appendChild(nameLabel);
    }

    div.appendChild(bubble);
    return div;
}

function renderMessageContent(msg) {
    if (msg.type === "image") {
        return `<img src="${msg.fileData}" onclick="openImageOverlay('${msg.fileData}')" style="max-width:100%; border-radius:12px; cursor:zoom-in;">`;
    }
    if (msg.type === "document") {
        return `<div style="display:flex; align-items:center; gap:8px;"><span>📄</span><a href="${msg.fileData}" download="${msg.fileName}" style="color:inherit; font-weight:700; font-size:12px;">${msg.fileName}</a></div>`;
    }
    return msg.text || "";
}

function sendMessage(payloadOverride = null) {
    const input = document.getElementById("messageInput");
    const text = (input?.value || "").trim();
    if (!payloadOverride && !text) return;

    const payload = payloadOverride || { type: "text", text: text };
    
    // Quick local UI update (Optimistic)
    const list = document.getElementById("messageList");
    const tempMsg = { ...payload, senderEmail: loggedInUser.email, messageId: 'temp' };
    const tempBubble = buildMessageBubble(tempMsg);
    tempBubble.style.opacity = "0.5";
    list.appendChild(tempBubble);
    
    const chatContainer = document.getElementById("messages");
    chatContainer.scrollTop = chatContainer.scrollHeight;
    if (input) input.value = "";

    const options = {
        method: "POST",
        body: JSON.stringify({
            module: "sendMessage",
            conversationId: activeConversationId,
            senderEmail: loggedInUser.email,
            ...payload
        })
    };

    fetch(API_URL, options).then(() => {
        tempBubble.remove();
        syncMessages();
    }).catch(() => {
        tempBubble.style.background = "#ff4a4a";
        showToast("Message failed to send.");
    });
}

/****************************************************
 * GLOBAL EVENTS
 ****************************************************/
document.addEventListener("DOMContentLoaded", () => {
    initChat();

    document.getElementById("sendBtn")?.addEventListener("click", () => sendMessage());
    document.getElementById("messageInput")?.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });

    // File Handlers
    const setupFile = (btnId, inputId, type) => {
        const btn = document.getElementById(btnId);
        const input = document.getElementById(inputId);
        if (!btn || !input) return;
        btn.onclick = () => input.click();
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                const base64 = await fileToBase64(file);
                sendMessage({ type, fileName: file.name, fileData: base64 });
            }
            e.target.value = "";
        };
    };
    setupFile("uploadDocBtn", "docInput", "document");
    setupFile("uploadImgBtn", "imgInput", "image");
});

function logout() { loc

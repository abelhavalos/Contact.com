/****************************************************
 * CONTACT.COM — MESSAGES.JS (FINAL SYNC)
 * - FIXED: Header Title & Message List Injection
 * - FIXED: Sidebar Toggle & Circular Avatars
 ****************************************************/

const API_URL = "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

/* 1. STATE */
let loggedInUser = JSON.parse(localStorage.getItem("contact_user"));
if (!loggedInUser) window.location.href = "login.html";

const urlParams = new URLSearchParams(window.location.search);
const communityId = urlParams.get("communityId");
const otherEmail = urlParams.get("otherEmail") || urlParams.get("email");
let activeConversationId = urlParams.get("conversationId") || null;
let messages = [];

/****************************************************
 * CORE LOGIC
 ****************************************************/
async function initChat() {
    loadNavbar();
    const loader = document.getElementById("chatLoader");
    const titleEl = document.getElementById("headerTitle");
    if (loader) loader.style.display = "flex";

    try {
        // Build the URL based on community or private chat
        const setupUrl = communityId 
            ? `${API_URL}?module=startCommunityConversation&communityId=${communityId}&userEmail=${loggedInUser.email}`
            : `${API_URL}?module=startConversation&userEmail=${loggedInUser.email}&otherEmail=${otherEmail}`;
        
        const res = await fetch(setupUrl);
        const data = await res.json();

        if (data.success) {
            activeConversationId = data.conversationId;
            
            // --- FIX 1: SHOW TITLE ---
            if (titleEl) {
                titleEl.innerText = communityId ? (data.communityName || "Community Chat") : (data.otherUserName || "Chat");
            }

            // --- FIX 2: SHOW MEMBERS ---
            renderMembers(data.members || []);
            
            // Start sync loop
            await syncMessages();
            setInterval(syncMessages, 4000);
        } else {
            console.error("Setup failed:", data.message);
        }
    } catch (e) {
        console.error("Init Error:", e);
    } finally {
        if (loader) loader.style.display = "none";
    }
}

async function syncMessages() {
    if (!activeConversationId) return;
    const lastId = messages.reduce((max, m) => (m.messageId > max ? m.messageId : max), 0);
    
    try {
        const r = await fetch(`${API_URL}?module=getMessages&conversationId=${activeConversationId}&lastId=${lastId}`);
        const data = await r.json();
        const newMsgs = data.messages || [];
        
        if (newMsgs.length > 0) {
            // --- FIX 3: TARGET THE CORRECT LIST ID ---
            const list = document.getElementById("messageList"); 
            if (!list) return;

            newMsgs.forEach(msg => {
                if (!document.getElementById(`msg-${msg.messageId}`)) {
                    messages.push(msg);
                    list.appendChild(buildMessageBubble(msg));
                }
            });

            // Scroll the parent container
            const chatScroller = document.getElementById("messages");
            if (chatScroller) chatScroller.scrollTop = chatScroller.scrollHeight;
        }
    } catch (e) { console.error("Sync Error", e); }
}

function buildMessageBubble(msg) {
    const isMe = msg.senderEmail === loggedInUser.email;
    const div = document.createElement("div");
    div.id = `msg-${msg.messageId}`;
    div.style = `display:flex; flex-direction:column; align-items:${isMe ? 'flex-end' : 'flex-start'}; margin-bottom:15px; width:100%;`;

    const bubble = document.createElement("div");
    bubble.style = `
        max-width: 80%;
        padding: 12px 18px;
        border-radius: 20px;
        font-size: 14px;
        background: ${isMe ? '#4A6CFF' : '#ffffff'};
        color: ${isMe ? '#ffffff' : '#222222'};
        box-shadow: 0 2px 5px rgba(0,0,0,0.05);
        border-${isMe ? 'bottom-right' : 'bottom-left'}-radius: 4px;
    `;
    
    if (msg.type === "image") {
        bubble.innerHTML = `<img src="${msg.fileData}" style="max-width:100%; border-radius:12px; display:block;">`;
    } else if (msg.type === "document") {
        bubble.innerHTML = `<a href="${msg.fileData}" download="${msg.fileName}" style="color:inherit; font-weight:700;">📄 ${msg.fileName}</a>`;
    } else {
        bubble.innerText = msg.text || "";
    }

    div.appendChild(bubble);
    return div;
}

function renderMembers(members) {
    const container = document.getElementById("memberSidebar");
    if (!container) return;

    let html = `<h3 style="font-size:12px; color:#999; text-transform:uppercase; margin-bottom:15px;">Participants</h3>`;
    members.forEach(m => {
        const name = m.fullName || m.FullName || m.email;
        const pic = m.profilePic || m.ProfilePic;
        const initials = name.charAt(0).toUpperCase();

        const avatar = pic 
            ? `<img src="${pic}" class="chat-avatar">` 
            : `<div class="chat-avatar-fallback">${initials}</div>`;

        html += `
            <div class="member-row" style="display:flex; align-items:center; gap:10px; margin-bottom:12px; cursor:pointer;" onclick="window.location.href='public-profile.html?email=${m.email}'">
                ${avatar}
                <span style="font-weight:600; font-size:14px;">${name}</span>
            </div>
        `;
    });
    container.innerHTML = html;
}

/****************************************************
 * BOOTSTRAP
 ****************************************************/
document.addEventListener("DOMContentLoaded", () => {
    initChat();

    // Toggle Sidebar
    const toggleBtn = document.getElementById("toggleMembers");
    const sidebar = document.getElementById("memberSidebar");
    if (toggleBtn && sidebar) {
        toggleBtn.onclick = (e) => {
            e.stopPropagation();
            sidebar.classList.toggle("active");
        };
    }

    // Send logic
    document.getElementById("sendBtn")?.addEventListener("click", () => sendMessage());
    document.getElementById("messageInput")?.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
});

async function sendMessage(payloadOverride = null) {
    const input = document.getElementById("messageInput");
    const text = (input?.value || "").trim();
    if (!payloadOverride && !text) return;

    const payload = payloadOverride || { type: "text", text };
    if (input) input.value = "";

    await fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({ module: "sendMessage", conversationId: activeConversationId, senderEmail: loggedInUser.email, ...payload })
    });
    syncMessages();
}

function loadNavbar() { /* your navbar code here */ }
function logout() { localStorage.removeItem("contact_user"); window.location.href = "index.html"; }

/****************************************************
 * CONTACT.COM — MESSAGES.JS (V13)
 * - FIXED: Members Toggle & Sidebar
 * - FIXED: Progress Bar for Documents/Images
 * - FIXED: Removed Loader Circle on Send
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
 * UI RENDERING
 ****************************************************/
function buildMessageBubble(msg) {
    const isMe = msg.senderEmail === loggedInUser.email;
    const isTemp = msg.messageId === 'temp';
    const div = document.createElement("div");
    div.id = isTemp ? "temp-msg" : `msg-${msg.messageId}`;
    div.style = `display:flex; flex-direction:column; align-items:${isMe ? 'flex-end' : 'flex-start'}; margin-bottom:15px; width:100%;`;

    const bubble = document.createElement("div");
    bubble.className = "bubbly-bubble";
    bubble.style = `
        max-width: 80%; padding: 12px 18px; border-radius: 20px; font-size: 14px;
        background: ${isMe ? '#4A6CFF' : '#ffffff'}; color: ${isMe ? '#ffffff' : '#222222'};
        box-shadow: 0 2px 5px rgba(0,0,0,0.05); border-${isMe ? 'bottom-right' : 'bottom-left'}-radius: 4px;
        position: relative;
    `;

    if (msg.type === "image") {
        bubble.innerHTML = `<img src="${msg.fileData}" style="max-width:100%; border-radius:12px; display:block;">`;
    } else if (msg.type === "document") {
        bubble.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:5px;">
                <span>📄 ${msg.fileName}</span>
                ${isTemp ? '<div style="width:100%; height:4px; background:rgba(255,255,255,0.3); border-radius:2px; overflow:hidden;"><div id="upload-progress" style="width:0%; height:100%; background:#fff; transition:width 0.2s;"></div></div>' : ''}
            </div>`;
    } else {
        bubble.innerText = msg.text || "";
    }

    div.appendChild(bubble);
    return div;
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
            const scroller = document.getElementById("messages");
            scroller.scrollTop = scroller.scrollHeight;
        }
    } catch (e) { console.error("Sync error", e); }
}

/****************************************************
 * SENDING LOGIC (WITH PROGRESS BAR)
 ****************************************************/
function sendMessage(payloadOverride = null) {
    const input = document.getElementById("messageInput");
    const text = (input?.value || "").trim();
    if (!payloadOverride && !text) return;

    const payload = payloadOverride || { type: "text", text };
    if (input) input.value = "";

    // Optimistic UI (Local preview)
    const list = document.getElementById("messageList");
    const tempBubble = buildMessageBubble({ ...payload, senderEmail: loggedInUser.email, messageId: 'temp' });
    list.appendChild(tempBubble);
    
    const scroller = document.getElementById("messages");
    scroller.scrollTop = scroller.scrollHeight;

    // Use XHR for upload progress tracking
    const xhr = new XMLHttpRequest();
    xhr.open("POST", API_URL);
    
    xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
            const percent = (e.loaded / e.total) * 100;
            const bar = document.getElementById("upload-progress");
            if (bar) bar.style.width = percent + "%";
        }
    };

    xhr.onload = () => {
        tempBubble.remove(); // Remove the local preview
        syncMessages();      // Pull the real message from server
    };

    xhr.send(JSON.stringify({
        module: "sendMessage",
        conversationId: activeConversationId,
        senderEmail: loggedInUser.email,
        ...payload
    }));
}

/****************************************************
 * INITIALIZATION & TOGGLE
 ****************************************************/
async function initChat() {
    // Only show loader on the very first load
    document.getElementById("chatLoader").style.display = "flex";

    try {
        const setupUrl = communityId 
            ? `${API_URL}?module=startCommunityConversation&communityId=${communityId}&userEmail=${loggedInUser.email}`
            : `${API_URL}?module=startConversation&userEmail=${loggedInUser.email}&otherEmail=${otherEmail}`;
        
        const res = await fetch(setupUrl);
        const data = await res.json();

        if (data.success) {
            activeConversationId = data.conversationId;
            document.getElementById("headerTitle").innerText = communityId ? data.communityName : data.otherUserName;
            
            await syncMessages();
            setInterval(syncMessages, 4000);
        }
    } catch (e) { console.error("Init error", e); }
    
    document.getElementById("chatLoader").style.display = "none";
}

document.addEventListener("DOMContentLoaded", () => {
    initChat();

    // FIXED MEMBERS TOGGLE
    const toggleBtn = document.getElementById("toggleMembers");
    const sidebar = document.getElementById("memberSidebar");
    
    if (toggleBtn && sidebar) {
        toggleBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            sidebar.classList.toggle("active");
            console.log("Sidebar toggled");
        };

        // Close sidebar when clicking messages area
        document.getElementById("messages").onclick = () => {
            sidebar.classList.remove("active");
        };
    }

    // Input handlers
    document.getElementById("sendBtn").onclick = () => sendMessage();
    document.getElementById("messageInput").onkeydown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    };
});

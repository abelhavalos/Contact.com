/****************************************************
 * CONTACT.COM — MESSAGES.JS (V14)
 * - FIXED: Chatroom Title, Conversation & Members
 * - FIXED: Members Toggle Logic
 * - THEME: Bubbly Progress Bar & Optimistic UI
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
 * UI COMPONENTS
 ****************************************************/
function buildMessageBubble(msg) {
    const isMe = msg.senderEmail === loggedInUser.email;
    const isTemp = msg.messageId === 'temp';
    const div = document.createElement("div");
    div.id = isTemp ? "temp-msg" : `msg-${msg.messageId}`;
    div.style = `display:flex; flex-direction:column; align-items:${isMe ? 'flex-end' : 'flex-start'}; margin-bottom:15px; width:100%;`;

    const bubble = document.createElement("div");
    bubble.style = `
        max-width: 80%; padding: 12px 18px; border-radius: 20px; font-size: 14px;
        background: ${isMe ? '#4A6CFF' : '#ffffff'}; color: ${isMe ? '#ffffff' : '#222222'};
        box-shadow: 0 2px 5px rgba(0,0,0,0.05); border-${isMe ? 'bottom-right' : 'bottom-left'}-radius: 4px;
    `;

    if (msg.type === "image") {
        bubble.innerHTML = `<img src="${msg.fileData}" style="max-width:100%; border-radius:12px; display:block;">`;
    } else if (msg.type === "document") {
        bubble.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:6px;">
                <span style="font-weight:600;">📄 ${msg.fileName}</span>
                ${isTemp ? `
                <div style="width:100%; height:4px; background:rgba(255,255,255,0.3); border-radius:2px; overflow:hidden;">
                    <div id="upload-progress" style="width:0%; height:100%; background:#fff; transition:width 0.2s;"></div>
                </div>` : ''}
            </div>`;
    } else {
        bubble.innerText = msg.text || "";
    }

    div.appendChild(bubble);
    return div;
}

/****************************************************
 * CORE SYNC & RENDER
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
            if (!list) return;
            newMsgs.forEach(msg => {
                if (!document.getElementById(`msg-${msg.messageId}`)) {
                    messages.push(msg);
                    list.appendChild(buildMessageBubble(msg));
                }
            });
            const scroller = document.getElementById("messages");
            scroller.scrollTop = scroller.scrollHeight;
        }
    } catch (e) { console.error("Sync Error:", e); }
}

function renderMembers(members) {
    const sidebar = document.getElementById("memberSidebar");
    if (!sidebar) return;

    let html = `<h3 style="font-size:12px; color:#999; text-transform:uppercase; margin-bottom:15px; padding-left:5px;">Participants</h3>`;
    members.forEach(m => {
        const name = m.fullName || m.FullName || m.email;
        const pic = m.profilePic || m.ProfilePic;
        const initials = name.charAt(0).toUpperCase();

        const avatar = pic 
            ? `<img src="${pic}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">` 
            : `<div style="width:40px; height:40px; border-radius:50%; background:#4A6CFF; color:white; display:flex; align-items:center; justify-content:center; font-weight:bold;">${initials}</div>`;

        html += `
            <div class="member-row" style="display:flex; align-items:center; gap:12px; margin-bottom:12px; cursor:pointer;" onclick="window.location.href='public-profile.html?email=${m.email}'">
                ${avatar}
                <span style="font-weight:600; font-size:14px; color:#333;">${name}</span>
            </div>
        `;
    });
    sidebar.innerHTML = html;
}

/****************************************************
 * INITIALIZATION
 ****************************************************/
async function initChat() {
    const loader = document.getElementById("chatLoader");
    const titleEl = document.getElementById("headerTitle");
    
    if (loader) loader.style.display = "flex";

    try {
        const setupUrl = communityId 
            ? `${API_URL}?module=startCommunityConversation&communityId=${communityId}&userEmail=${loggedInUser.email}`
            : `${API_URL}?module=startConversation&userEmail=${loggedInUser.email}&otherEmail=${otherEmail}`;
        
        const res = await fetch(setupUrl);
        const data = await res.json();

        if (data.success) {
            activeConversationId = data.conversationId;
            
            // Set Titles
            if (titleEl) {
                titleEl.innerText = communityId ? (data.communityName || "Community Chat") : (data.otherUserName || "Private Chat");
            }
            
            // Set Memberlist
            renderMembers(data.members || []);
            
            // Load messages
            await syncMessages();
            setInterval(syncMessages, 4000);
        }
    } catch (e) { console.error("Initialization Error:", e); }
    
    if (loader) loader.style.display = "none";
}

/****************************************************
 * EVENT HANDLERS
 ****************************************************/
document.addEventListener("DOMContentLoaded", () => {
    initChat();

    // 1. FIXED TOGGLE LOGIC
    const toggleBtn = document.getElementById("toggleMembers");
    const sidebar = document.getElementById("memberSidebar");
    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            sidebar.classList.toggle("active");
        });

        // Close when clicking outside on the chat area
        document.getElementById("chat")?.addEventListener("click", () => {
            sidebar.classList.remove("active");
        });
    }

    // 2. SENDING LOGIC
    document.getElementById("sendBtn")?.addEventListener("click", () => sendMessage());
    document.getElementById("messageInput")?.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // 3. FILE PICKER WRAPPERS
    const fileWrapper = (btnId, inputId, type) => {
        const btn = document.getElementById(btnId);
        const input = document.getElementById(inputId);
        if (btn && input) {
            btn.onclick = () => input.click();
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        sendMessage({ type, fileName: file.name, fileData: event.target.result });
                    };
                    reader.readAsDataURL(file);
                }
                e.target.value = ""; // Anti-loop
            };
        }
    };
    fileWrapper("uploadDocBtn", "docInput", "document");
    fileWrapper("uploadImgBtn", "imgInput", "image");
});

function sendMessage(payloadOverride = null) {
    const input = document.getElementById("messageInput");
    const text = (input?.value || "").trim();
    if (!payloadOverride && !text) return;

    const payload = payloadOverride || { type: "text", text };
    if (input) input.value = "";

    const list = document.getElementById("messageList");
    const tempBubble = buildMessageBubble({ ...payload, senderEmail: loggedInUser.email, messageId: 'temp' });
    list.appendChild(tempBubble);
    
    const scroller = document.getElementById("messages");
    if (scroller) scroller.scrollTop = scroller.scrollHeight;

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
        tempBubble.remove();
        syncMessages();
    };
    xhr.send(JSON.stringify({
        module: "sendMessage",
        conversationId: activeConversationId,
        senderEmail: loggedInUser.email,
        ...payload
    }));
}

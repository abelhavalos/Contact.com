/****************************************************
 * CONTACT.COM — ULTRA FAST MESSAGES.JS (V11)
 * - FIXED: API Route logic for Text vs Files
 * - FIXED: Race condition on initChat
 * - IMPROVED: UI Feedback and Error States
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
const mode = communityId ? "community" : "private";
const finalOtherEmail = urlParams.get("otherEmail") || urlParams.get("email");
let activeConversationId = urlParams.get("conversationId") || null;
let messages = [];

/****************************************************
 * UI COMPONENTS
 ****************************************************/
function showToast(msg, type = "error") {
    let toast = document.getElementById("chat-toast") || document.createElement("div");
    if (!toast.id) {
        toast.id = "chat-toast";
        toast.style = "position:fixed; top:20px; left:50%; transform:translateX(-50%); padding:12px 24px; border-radius:30px; color:white; font-size:14px; z-index:9999; transition: opacity 0.4s ease; box-shadow: 0 4px 15px rgba(0,0,0,0.1); pointer-events:none;";
        document.body.appendChild(toast);
    }
    toast.style.backgroundColor = type === "error" ? "#EF4444" : "#4A6CFF";
    toast.innerText = msg;
    toast.style.opacity = "1";
    setTimeout(() => { toast.style.opacity = "0"; }, 3000);
}

function openImageOverlay(src) {
    let overlay = document.getElementById("image-overlay") || document.createElement("div");
    if (!overlay.id) {
        overlay.id = "image-overlay";
        overlay.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:10000; display:none; align-items:center; justify-content:center; cursor:zoom-out;";
        overlay.innerHTML = `<img id="overlay-img" style="max-width:95%; max-height:95%; border-radius:8px; transition: transform 0.3s ease;">`;
        overlay.onclick = () => overlay.style.display = "none";
        document.body.appendChild(overlay);
    }
    document.getElementById("overlay-img").src = src;
    overlay.style.display = "flex";
}

/****************************************************
 * MESSAGING ENGINE
 ****************************************************/
async function syncMessages() {
    if (!activeConversationId) return;
    const lastId = messages.length > 0 ? Math.max(...messages.map(m => m.messageId || 0)) : 0;
    
    try {
        const r = await fetch(`${API_URL}?module=getMessages&conversationId=${activeConversationId}&lastId=${lastId}`);
        const data = await r.json();
        const newMsgs = data.messages || [];
        
        if (newMsgs.length > 0) {
            const container = document.getElementById("messages");
            newMsgs.forEach(msg => {
                // Check if message already exists or is a "pending" temp message
                const tempTag = safeBtoa(msg.text || msg.fileName);
                const tempElement = document.querySelector(`[data-temp-tag="${tempTag}"]`);
                
                if (tempElement) {
                    tempElement.id = `msg-${msg.messageId}`;
                    tempElement.removeAttribute('data-temp-tag');
                    tempElement.style.opacity = "1";
                    const pb = tempElement.querySelector(".progress-container");
                    if (pb) pb.remove();
                } else if (!document.getElementById(`msg-${msg.messageId}`)) {
                    container.appendChild(buildMessageRow(msg));
                }
                messages.push(msg);
            });
            container.scrollTop = container.scrollHeight;
        }
    } catch (e) { console.warn("Polling..."); }
}

async function sendMessage(payloadOverride = null) {
    const input = document.getElementById("messageInput");
    const text = (input?.value || "").trim();
    if (!payloadOverride && (!text || !activeConversationId)) return;

    const payload = payloadOverride || { type: "text", text: text };
    const tempTag = safeBtoa(payload.text || payload.fileName);
    const container = document.getElementById("messages");

    // UI Optimistic Update
    const row = buildMessageRow({ messageId: 0, senderEmail: loggedInUser.email, ...payload });
    row.setAttribute('data-temp-tag', tempTag);
    row.style.opacity = "0.6";
    
    if (payload.type !== "text") {
        const bubble = row.querySelector(".msg-bubble");
        bubble.insertAdjacentHTML('beforeend', `<div class="progress-container" style="width:100%; height:3px; background:rgba(255,255,255,0.2); border-radius:2px; margin-top:8px; overflow:hidden;"><div class="progress-bar" style="width:10%; height:100%; background:#fff; transition: width 0.5s ease;"></div></div>`);
        setTimeout(() => { if(row.querySelector(".progress-bar")) row.querySelector(".progress-bar").style.width = "90%"; }, 50);
    }

    container.appendChild(row);
    container.scrollTop = container.scrollHeight;
    if (input) input.value = "";

    // API Call
    try {
        let response;
        if (payload.type === "text") {
            // Standard Text uses GET
            response = await fetch(`${API_URL}?module=sendMessage&conversationId=${activeConversationId}&senderEmail=${encodeURIComponent(loggedInUser.email)}&type=text&text=${encodeURIComponent(payload.text)}`);
        } else {
            // Files use POST
            response = await fetch(API_URL, {
                method: "POST",
                body: JSON.stringify({ 
                    module: "sendMessage", 
                    conversationId: activeConversationId, 
                    senderEmail: loggedInUser.email, 
                    ...payload 
                })
            });
        }
        
        const resData = await response.json();
        if (resData.error) throw new Error(resData.error);
        syncMessages(); // Trigger immediate sync
    } catch (err) {
        row.remove();
        showToast("Send failed: " + err.message);
    }
}

function buildMessageRow(msg) {
    const isMe = msg.senderEmail === loggedInUser.email;
    const row = document.createElement("div");
    row.className = "msg-row";
    row.id = msg.messageId ? `msg-${msg.messageId}` : `temp-${Date.now()}`;
    row.style = `display:flex; margin-bottom:16px; gap:8px; justify-content:${isMe ? 'flex-end' : 'flex-start'};`;
    
    const bubble = document.createElement("div");
    bubble.className = "msg-bubble";
    bubble.style = `max-width:75%; padding:12px 16px; border-radius:18px; font-size:14px; line-height:1.4; background:${isMe ? "#4A6CFF" : "#F1F5F9"}; color:${isMe ? "#FFF" : "#1E293B"}; cursor:pointer; position:relative; box-shadow: 0 2px 5px rgba(0,0,0,0.05);`;
    
    bubble.innerHTML = renderMessageContent(msg);
    bubble.oncontextmenu = (e) => { 
        if (msg.type === "text") {
            e.preventDefault(); 
            copyToClipboard(msg.text); 
        }
    };
    
    row.appendChild(bubble);
    return row;
}

function renderMessageContent(msg) {
    if (msg.type === "image") return `<img src="${msg.fileData}" onclick="openImageOverlay('${msg.fileData}')" style="max-width:100%; border-radius:12px; display:block; cursor:zoom-in;">`;
    if (msg.type === "document") return `<div style="display:flex; align-items:center; gap:10px;"><span style="font-size:24px;">📄</span><div style="overflow:hidden;"><div style="font-weight:600; font-size:13px; text-overflow:ellipsis; white-space:nowrap;">${msg.fileName}</div><a href="${msg.fileData}" download="${msg.fileName}" style="color:inherit; font-size:11px; opacity:0.8;">Click to Download</a></div></div>`;
    return msg.text || "";
}

/****************************************************
 * BOOTSTRAP
 ****************************************************/
async function initChat() {
    if (typeof loadNavbar === "function") loadNavbar();
    
    if (!activeConversationId) {
        try {
            const setupUrl = mode === "community" 
                ? `${API_URL}?module=startCommunityConversation&communityId=${communityId}&userEmail=${loggedInUser.email}` 
                : `${API_URL}?module=startConversation&userEmail=${loggedInUser.email}&otherEmail=${finalOtherEmail}`;
            
            const res = await fetch(setupUrl);
            const data = await res.json();
            if (data.conversationId) {
                activeConversationId = data.conversationId;
            } else {
                showToast("Could not load conversation.");
            }
        } catch (e) {
            showToast("Connection Error.");
        }
    }
    
    if (activeConversationId) {
        await syncMessages();
        setInterval(syncMessages, 4000);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    initChat();
    
    document.getElementById("sendBtn")?.addEventListener("click", () => sendMessage());
    document.getElementById("messageInput")?.addEventListener("keydown", (e) => { 
        if (e.key === "Enter" && !e.shiftKey) { 
            e.preventDefault(); 
            sendMessage(); 
        } 
    });
    
    const setupFile = (btnId, inputId, type) => {
        const btn = document.getElementById(btnId);
        const input = document.getElementById(inputId);
        if (btn && input) {
            btn.onclick = () => input.click();
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (file) {
                    if (file.size > 10 * 1024 * 1024) return showToast("File too large (Max 10MB)");
                    const base64Data = await fileToBase64(file);
                    sendMessage({ type, fileName: file.name, fileData: base64Data });
                }
                e.target.value = "";
            };
        }
    };
    setupFile("uploadDocBtn", "docInput", "document");
    setupFile("uploadImgBtn", "imgInput", "image");
});

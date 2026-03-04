/****************************************************
 * CONTACT.COM — MESSAGES.JS (V15)
 * - FIXED: File picker infinite loop
 * - FIXED: Sidebar z-index / overlap
 * - THEME: Professional Blue
 ****************************************************/

const API_URL = "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

/* 1. STATE */
let loggedInUser = JSON.parse(localStorage.getItem("contact_user"));
if (!loggedInUser) window.location.href = "login.html";

const url = new URL(window.location.href);
const communityId = url.searchParams.get("communityId");
const mode = communityId ? "community" : "private";
const otherEmailParam = url.searchParams.get("otherEmail") || url.searchParams.get("email");

let activeConversationId = url.searchParams.get("conversationId") || null;
let messages = [];
let communityMembers = [];

/* 2. FILE PICKER FIX: Using a lock to prevent loop */
let isUploading = false;

async function handleFileSelect(e, type) {
    if (isUploading) return;
    const file = e.target.files[0];
    if (!file) return;

    isUploading = true;
    showChatLoader();

    try {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async () => {
            const base64 = reader.result;
            await sendMessage({ 
                type: type, 
                fileName: file.name, 
                fileData: base64 
            });
            
            // CRITICAL: Reset the input value so the same file can be picked again
            // and the 'change' event doesn't re-fire unexpectedly.
            e.target.value = ""; 
            isUploading = false;
            hideChatLoader();
        };
    } catch (err) {
        console.error("Upload failed", err);
        isUploading = false;
        hideChatLoader();
    }
}

/* 3. MESSAGING ENGINE */
async function loadHistory() {
    if (!activeConversationId) return;
    const r = await fetch(`${API_URL}?module=getMessages&conversationId=${activeConversationId}`);
    const data = await r.json();
    messages = data.messages || [];
    
    const list = document.getElementById("messageList");
    list.innerHTML = ""; 
    messages.forEach(msg => list.appendChild(buildMessageRow(msg)));
    scrollChat();
}

function buildMessageRow(msg) {
    const isMe = msg.senderEmail === loggedInUser.email;
    const div = document.createElement("div");
    div.style = `display:flex; flex-direction:column; align-items:${isMe ? 'flex-end' : 'flex-start'}; margin-bottom:15px; width:100%;`;

    const bubble = document.createElement("div");
    bubble.style = `max-width:80%; padding:12px 18px; border-radius:20px; font-size:14px; background:${isMe ? '#4A6CFF' : '#ffffff'}; color:${isMe ? '#ffffff' : '#222'}; border-${isMe ? 'bottom-right' : 'bottom-left'}-radius:4px; box-shadow:0 2px 5px rgba(0,0,0,0.05);`;
    
    // Content Logic
    const type = (msg.type || "").toLowerCase();
    if (type === "image" || (msg.fileData && msg.fileData.includes("image/"))) {
        bubble.innerHTML = `<img src="${msg.fileData}" style="max-width:100%; border-radius:10px; cursor:pointer;" onclick="window.open(this.src)">`;
    } else if (type === "document" || msg.fileName) {
        bubble.innerHTML = `📄 <a href="${msg.fileData}" download="${msg.fileName}" style="color:inherit; font-weight:700;">${msg.fileName}</a>`;
    } else {
        bubble.innerText = msg.text || "";
    }

    div.appendChild(bubble);
    return div;
}

async function sendMessage(payload) {
    if (!activeConversationId) return;
    try {
        await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify({ 
                module: "sendMessage", 
                conversationId: activeConversationId, 
                senderEmail: loggedInUser.email, 
                ...payload 
            })
        });
        await syncNewMessages();
    } catch (e) { console.error("Send error", e); }
}

/* 4. SIDEBAR & TOGGLE FIX */
function initSidebarToggle() {
    const btn = document.getElementById("toggleMembers");
    const sidebar = document.getElementById("memberSidebar");
    if (btn && sidebar) {
        btn.onclick = (e) => {
            e.stopPropagation();
            sidebar.classList.toggle("show-mobile");
        };
    }
    
    // Close sidebar when clicking chat area on mobile
    document.getElementById("chat").onclick = () => {
        if (sidebar) sidebar.classList.remove("show-mobile");
    };
}

/* 5. INITIALIZE */
document.addEventListener("DOMContentLoaded", async () => {
    loadNavbar(); 
    initSidebarToggle();

    // Attach File Listeners
    document.getElementById("uploadDocBtn").onclick = () => document.getElementById("docInput").click();
    document.getElementById("uploadImgBtn").onclick = () => document.getElementById("imgInput").click();
    
    document.getElementById("docInput").onchange = (e) => handleFileSelect(e, "document");
    document.getElementById("imgInput").onchange = (e) => handleFileSelect(e, "image");

    // Load Chat
    await loadChatContext(); // Same as previous version
    await loadHistory();
    setInterval(syncNewMessages, 4000);
});

function scrollChat() {
    const container = document.getElementById("messages");
    container.scrollTop = container.scrollHeight;
}

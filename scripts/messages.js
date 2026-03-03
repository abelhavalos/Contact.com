/****************************************************
 * CONTACT.COM — ULTRA-OPTIMIZED MESSAGES.JS
 ****************************************************/
const API_URL = "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";
/* USER & STATE */
let loggedInUser = JSON.parse(localStorage.getItem("contact_user"));
if (!loggedInUser) window.location.href = "login.html";
let activeConversationId = new URL(window.location.href).searchParams.get("conversationId");
const communityId = new URL(window.location.href).searchParams.get("communityId");
const finalOtherEmail = new URL(window.location.href).searchParams.get("otherEmail") || new URL(window.location.href).searchParams.get("email");
const mode = communityId ? "community" : "private";
let messages = [], communityMembers = [], otherUser = null;
/* COLORS & HELPERS */
const BUBBLE_PALETTE = [{bg:"#4A6CFF",text:"#FFFFFF"},{bg:"#6F8CFF",text:"#FFFFFF"},{bg:"#8FA3FF",text:"#000000"},{bg:"#AFC0FF",text:"#000000"},{bg:"#D1DDFF",text:"#000000"}];
const getUserColor = (email) => BUBBLE_PALETTE[Math.abs(email.split('').reduce((a,b)=>(a<<5)-a+b.charCodeAt(0),0)) % BUBBLE_PALETTE.length];
const getInitials = (n) => n ? n.split(" ").filter(Boolean).map(p=>p[0]).join("").substring(0,2).toUpperCase() : "?";
/****************************************************
 * RENDERING ENGINE
 ****************************************************/
function buildMessageRow(msg) {
    const isMe = msg.senderEmail === loggedInUser.email;
    const color = getUserColor(msg.senderEmail);
    const row = document.createElement("div");
    row.className = "msg-row";
    row.setAttribute('data-id', msg.id);
    row.style = `display:flex; margin-bottom:10px; gap:8px; align-items:flex-end; justify-content:${isMe?'flex-end':'flex-start'};`;
    const content = msg.type === "image" ? `<img src="${msg.fileData}" class="chat-image">` : 
                    msg.type === "document" ? `<a href="${msg.fileData}" download="${msg.fileName}" class="chat-doc">📄 ${msg.fileName}</a>` : (msg.text || "");
    let pic, initials;
    if (isMe) {
        pic = loggedInUser.profilePic || loggedInUser.ProfilePic;
        initials = getInitials(loggedInUser.fullName || loggedInUser.FullName || loggedInUser.email);
    } else {
        const sender = mode === "community" ? (communityMembers.find(m=>m.email === msg.senderEmail) || {}) : (otherUser || {});
        pic = sender.profilePic || sender.ProfilePic;
        initials = getInitials(sender.fullName || sender.FullName || msg.senderEmail);
    }
    const avatarHTML = pic ? `<img class="chat-avatar" src="${pic}" />` : `<div class="chat-avatar-fallback">${initials}</div>`;
    const bubbleHTML = `<div style="max-width:70%; padding:8px 12px; border-radius:16px; font-size:14px; background:${isMe?color.bg:'#F3F4F6'}; color:${isMe?color.text:'#111827'};">${content}</div>`;
    row.innerHTML = isMe ? (bubbleHTML + `<div style="width:36px;display:flex;justify-content:center;">${avatarHTML}</div>`) : 
                           (`<div style="width:36px;display:flex;justify-content:center;">${avatarHTML}</div>` + bubbleHTML);
    return row;
}
function appendSingleMessage(msg, isInitialLoad = false) {
    const container = document.getElementById("messages");
    if (!container) return;
    container.appendChild(buildMessageRow(msg));
    if (!isInitialLoad || (container.scrollHeight - container.scrollTop < 500)) container.scrollTop = container.scrollHeight;
}
/****************************************************
 * DATA & ACTIONS
 ****************************************************/
async function loadMessagesOnce() {
    if (!activeConversationId) return;
    const r = await fetch(`${API_URL}?module=getMessages&conversationId=${activeConversationId}`);
    const data = await r.json();
    const container = document.getElementById("messages");
    const newMessages = data.messages || [];
    if (messages.length === 0) {
        container.innerHTML = "";
        newMessages.forEach(m => appendSingleMessage(m, true));
    } else {
        newMessages.forEach(m => {
            if (!messages.find(existing => existing.id === m.id)) appendSingleMessage(m);
        });
    }
    messages = newMessages;
    hideChatLoader();
}
function sendMessage(payloadOverride = null) {
    const input = document.getElementById("messageInput");
    const text = (input?.value || "").trim();
    if (!payloadOverride && !text) return;
    const payload = payloadOverride || { type: "text", text: text };
    const optimisticMsg = { id: "temp_"+Date.now(), senderEmail: loggedInUser.email, type: payload.type, text: payload.text, fileName: payload.fileName||null, fileData: payload.fileData||null };
    appendSingleMessage(optimisticMsg);
    if (input) input.value = "";
    const params = new URLSearchParams({ module: "sendMessage", conversationId: activeConversationId, senderEmail: loggedInUser.email, type: payload.type, text: payload.text || "" });
    const options = payload.type === "text" ? { method: 'GET' } : { method: 'POST', body: JSON.stringify({ ...payload, module: "sendMessage", conversationId: activeConversationId, senderEmail: loggedInUser.email }) };
    fetch(payload.type === "text" ? `${API_URL}?${params.toString()}` : API_URL, options).catch(console.error);
}
/****************************************************
 * INITIALIZATION
 ****************************************************/
document.addEventListener("DOMContentLoaded", async () => {
    loadNavbar();
    showChatLoader();
    if (mode === "private") {
        loadOtherUserProfile();
        document.getElementById("toggleMembers")?.remove();
    } else {
        loadCommunityInfo();
        loadCommunityMembers();
    }
    if (!activeConversationId) {
        const endpoint = mode === "community" ? `module=startCommunityConversation&communityId=${communityId}&userEmail=${loggedInUser.email}` : `module=startConversation&userEmail=${loggedInUser.email}&otherEmail=${finalOtherEmail}`;
        const r = await fetch(`${API_URL}?${endpoint}`);
        const d = await r.json();
        activeConversationId = d.conversationId;
    }
    loadMessagesOnce();
    document.getElementById("sendBtn").onclick = () => sendMessage();
    document.getElementById("messageInput").onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } };
    setInterval(loadMessagesOnce, 5000);
});
/* HELPERS */
function showChatLoader() { const el=document.getElementById("chatLoader"); if(el) el.style.display="flex"; }
function hideChatLoader() { const el=document.getElementById("chatLoader"); if(el) el.style.display="none"; }
async function fileToBase64(file) { return new Promise(r => { const reader = new FileReader(); reader.onload = () => r(reader.result); reader.readAsDataURL(file); }); }

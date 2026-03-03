/****************************************************
 * CONTACT.COM — FIXED MESSAGES.JS (V11)
 * - FIXED: setInterval Syntax & Reference Errors
 * - FIXED: Member List & Chat Title Injection
 * - FIXED: Hamburger Menu & Mobile Layout
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

/* 2. STATE & USER */
let loggedInUser = JSON.parse(localStorage.getItem("contact_user"));
if (!loggedInUser) window.location.href = "login.html";

const url = new URL(window.location.href);
const communityId = url.searchParams.get("communityId");
const mode = communityId ? "community" : "private";
const finalOtherEmail = url.searchParams.get("otherEmail") || url.searchParams.get("email");
let activeConversationId = url.searchParams.get("conversationId") || null;
let messages = [];

/****************************************************
 * UI COMPONENTS
 ****************************************************/
function loadNavbar() {
    const nav = document.getElementById("navbar");
    if (!nav) return;
    nav.innerHTML = `
        <div class="nav-container" style="display:flex; align-items:center; width:100%; height:60px; padding: 0 15px; background:#fff; border-bottom:1px solid #eee;">
            <div class="hamburger" onclick="toggleMenu()" style="cursor:pointer; display:none; flex-direction:column; gap:4px; margin-right:15px;">
                <div style="width:22px; height:3px; background:#4A6CFF; border-radius:2px;"></div>
                <div style="width:22px; height:3px; background:#4A6CFF; border-radius:2px;"></div>
                <div style="width:22px; height:3px; background:#4A6CFF; border-radius:2px;"></div>
            </div>
            <div class="logo" style="font-weight:bold; font-size:1.2rem;">Contact<span style="color:#4A6CFF;">.</span>com</div>
            <div class="nav-links desktop-nav" style="display:flex; gap:20px; margin-left:auto;">
                <a href="dashboard.html" style="text-decoration:none; color:#333; font-size:14px;">Dashboard</a>
                <a href="communities.html" style="text-decoration:none; color:#333; font-size:14px;">Communities</a>
                <a href="#" onclick="logout()" style="text-decoration:none; color:#4A6CFF; font-weight:bold; font-size:14px;">Logout</a>
            </div>
        </div>
        <div id="mobileMenu" style="display:none; flex-direction:column; background:white; width:100%; position:absolute; top:60px; left:0; border-bottom:1px solid #ddd; z-index:1000; box-shadow:0 4px 10px rgba(0,0,0,0.1);">
            <a href="dashboard.html" style="padding:15px; border-bottom:1px solid #f9f9f9; text-decoration:none; color:#333;">Dashboard</a>
            <a href="communities.html" style="padding:15px; border-bottom:1px solid #f9f9f9; text-decoration:none; color:#333;">Communities</a>
            <a href="#" onclick="logout()" style="padding:15px; color:#4A6CFF; text-decoration:none; font-weight:bold;">Logout</a>
        </div>
    `;
}

function toggleMenu() {
    const menu = document.getElementById("mobileMenu");
    if (menu) menu.style.display = (menu.style.display === "none" || menu.style.display === "") ? "flex" : "none";
}

/****************************************************
 * MESSAGING & MEMBER LOGIC
 ****************************************************/
async function syncMessages() {
    if (!activeConversationId) return;
    const lastId = messages.reduce((max, m) => (m.messageId > max ? m.messageId : max), 0);
    try {
        const r = await fetch(`${API_URL}?module=getMessages&conversationId=${activeConversationId}&lastId=${lastId}`);
        const data = await r.json();
        const newMsgs = data.messages || [];
        if (newMsgs.length > 0) {
            const container = document.getElementById("messages");
            newMsgs.forEach(msg => {
                if (!document.getElementById(`msg-${msg.messageId}`)) {
                    messages.push(msg);
                    container.appendChild(buildMessageRow(msg));
                }
            });
            container.scrollTop = container.scrollHeight;
        }
    } catch (e) { console.error("Sync Error:", e); }
}

function renderMembers(members) {
    const list = document.getElementById("memberSidebar");
    if (!list) return;
    let html = `<h3 style="font-size:12px; color:#999; text-transform:uppercase; margin-bottom:15px;">Members</h3>`;
    members.forEach(m => {
        const name = m.fullName || m.FullName || m.email;
        const pic = m.profilePic || m.ProfilePic || 'default-avatar.png';
        html += `
            <div class="member-row" style="display:flex; align-items:center; gap:10px; margin-bottom:12px;">
                <img src="${pic}" style="width:36px; height:36px; border-radius:50%; object-fit:cover;">
                <span style="font-size:14px; font-weight:600;">${name}</span>
            </div>
        `;
    });
    list.innerHTML = html;
}

function buildMessageRow(msg) {
    const isMe = msg.senderEmail === loggedInUser.email;
    const row = document.createElement("div");
    row.id = `msg-${msg.messageId}`;
    row.style = `display:flex; margin-bottom:12px; justify-content:${isMe ? 'flex-end' : 'flex-start'};`;
    
    const bubble = document.createElement("div");
    bubble.style = `max-width:75%; padding:10px 15px; border-radius:18px; font-size:14px; background:${isMe ? "#4A6CFF" : "#F1F1F1"}; color:${isMe ? "#FFF" : "#111"};`;
    
    if (msg.type === "image") {
        bubble.innerHTML = `<img src="${msg.fileData}" style="max-width:100%; border-radius:10px;">`;
    } else if (msg.type === "document") {
        bubble.innerHTML = `📄 <a href="${msg.fileData}" download="${msg.fileName}" style="color:inherit;">${msg.fileName}</a>`;
    } else {
        bubble.innerText = msg.text || "";
    }
    
    row.appendChild(bubble);
    return row;
}

/****************************************************
 * BOOTSTRAP
 ****************************************************/
async function initChat() {
    loadNavbar();
    const titleEl = document.getElementById("headerTitle");
    
    try {
        const setupUrl = mode === "community" 
            ? `${API_URL}?module=startCommunityConversation&communityId=${communityId}&userEmail=${loggedInUser.email}` 
            : `${API_URL}?module=startConversation&userEmail=${loggedInUser.email}&otherEmail=${finalOtherEmail}`;
        
        const res = await fetch(setupUrl);
        const data = await res.json();

        if (data.success) {
            activeConversationId = data.conversationId;
            
            // Set Title
            if (titleEl) {
                titleEl.innerText = mode === "community" ? (data.communityName || "Community") : (data.otherUserName || "Chat");
            }

            // Set Members
            renderMembers(data.members || []);

            await syncMessages();
            // FIXED: Added missing parentheses for function call
            setInterval(() => syncMessages(), 4000);
        }
    } catch (e) { console.error("Init Error:", e); }
}

document.addEventListener("DOMContentLoaded", () => {
    initChat();
    
    // Toggle Sidebar
    const toggleBtn = document.getElementById("toggleMembers");
    const sidebar = document.getElementById("memberSidebar");
    if (toggleBtn && sidebar) {
        toggleBtn.onclick = () => sidebar.classList.toggle("active");
    }

    document.getElementById("sendBtn")?.addEventListener("click", () => sendMessage());
});

function logout() { localStorage.removeItem("contact_user"); window.location.href = "login.html"; }

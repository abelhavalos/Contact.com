/****************************************************
 * CONTACT.COM — FULL MESSAGES.JS (FORCE ENABLED UI)
 ****************************************************/

const API_URL = "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

/* 1. USER & PARAMS */
let loggedInUser = JSON.parse(localStorage.getItem("contact_user"));
if (!loggedInUser) window.location.href = "login.html";

const url = new URL(window.location.href);
const communityId = url.searchParams.get("communityId");
const mode = communityId ? "community" : "private";
const finalOtherEmail = url.searchParams.get("otherEmail") || url.searchParams.get("email");
const chatTitle = url.searchParams.get("title") || "";

let activeConversationId = url.searchParams.get("conversationId") || null;
let messages = [];
let communityMembers = [];
let pollingInterval = null;

/* 2. NAVBAR & UTILS */
function loadNavbar() {
    const nav = document.getElementById("navbar");
    if (nav) {
        nav.innerHTML = `
            <div class="hamburger" onclick="toggleMenu()"><span></span><span></span><span></span></div>
            <div class="logo">Contact<span>.</span>com</div>
            <div class="nav-links">
                <a href="dashboard.html">Dashboard</a><a href="communities.html">Communities</a>
                <a href="events.html">Events</a><a href="contacts.html">Contacts</a>
                <a href="profile.html">Profile</a><a href="#" onclick="logout()">Logout</a>
            </div>`;
    }
}
function toggleMenu() { document.getElementById("mobileMenu")?.classList.toggle("show"); }
function logout() { localStorage.removeItem("contact_user"); window.location.href = "index.html"; }

/* 3. MESSAGING CORE */
async function loadMessages() {
    if (!activeConversationId) return;
    try {
        const r = await fetch(`${API_URL}?module=getMessages&conversationId=${activeConversationId}`);
        const data = await r.json();
        const backendMessages = (data.messages || []).slice(-20);
        const optimistic = messages.filter(m => m.optimistic);
        messages = [...backendMessages, ...optimistic];
        renderMessages();
    } catch (e) { console.error("Polling error:", e); }
}

function renderMessages() {
    const container = document.getElementById("messages");
    if (!container) return;
    container.innerHTML = messages.map(msg => {
        const isMe = msg.senderEmail === loggedInUser.email;
        const bg = isMe ? "#4A6CFF" : "#F0F0F0";
        const textCol = isMe ? "#fff" : "#333";
        return `
            <div style="display:flex; justify-content:${isMe ? 'flex-end' : 'flex-start'}; margin-bottom:12px; gap:8px;">
                <div style="background:${bg}; color:${textCol}; padding:10px 14px; border-radius:14px; max-width:75%; word-wrap:break-word;">
                    ${msg.text || ""}
                </div>
            </div>`;
    }).join("");
    container.scrollTop = container.scrollHeight;
}

async function sendMessage() {
    const input = document.getElementById("messageInput");
    const text = input.value.trim();
    
    // If we don't have an ID yet, we can't send, but we don't disable the button.
    if (!text) return;
    if (!activeConversationId) {
        alert("Still connecting to chat... please wait a moment.");
        return;
    }

    // Optimistic UI
    messages.push({ senderEmail: loggedInUser.email, text: text, optimistic: true });
    renderMessages();
    input.value = "";

    try {
        const res = await fetch(`${API_URL}?module=sendMessage&conversationId=${activeConversationId}&senderEmail=${loggedInUser.email}&type=text&text=${encodeURIComponent(text)}`);
        const data = await res.json();
        if (data.success) loadMessages();
    } catch (e) { console.error("Send error:", e); }
}

/* 4. INITIALIZATION (THE FIX) */
document.addEventListener("DOMContentLoaded", () => {
    // A. Load Static UI Immediately
    loadNavbar();
    const header = document.getElementById("headerTitle");
    if (header) header.innerText = chatTitle || (mode === "community" ? "Community Chat" : "Private Chat");

    // B. FORCE ENABLE UI (Ensure no HTML attributes are blocking you)
    const input = document.getElementById("messageInput");
    const btn = document.getElementById("sendBtn");
    if (input) { input.disabled = false; input.placeholder = "Type a message..."; }
    if (btn) { btn.disabled = false; btn.style.opacity = "1"; btn.style.cursor = "pointer"; }

    // C. ATTACH LISTENERS IMMEDIATELY
    if (btn) btn.onclick = sendMessage;
    if (input) {
        input.onkeydown = (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        };
    }

    // D. Fetch Conversation ID in background
    initializeConversation();
});

async function initializeConversation() {
    try {
        if (!activeConversationId) {
            let startUrl = (mode === "community") 
                ? `${API_URL}?module=startCommunityConversation&communityId=${communityId}&userEmail=${loggedInUser.email}`
                : `${API_URL}?module=startConversation&userEmail=${loggedInUser.email}&otherEmail=${finalOtherEmail}`;
            
            const r = await fetch(startUrl);
            const d = await r.json();
            activeConversationId = d.conversationId;
        }

        if (activeConversationId) {
            loadMessages();
            if (pollingInterval) clearInterval(pollingInterval);
            pollingInterval = setInterval(loadMessages, 2000);
        }
    } catch (e) {
        console.error("Initialization error:", e);
    }
}

/****************************************************
 * CONTACT.COM — FULL MESSAGES.JS (UI ACTIVATION FIX)
 ****************************************************/

const API_URL = "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

/* --- 1. USER & PARAMS --- */
let loggedInUser = JSON.parse(localStorage.getItem("contact_user"));
if (!loggedInUser) window.location.href = "login.html";

const url = new URL(window.location.href);
const communityId = url.searchParams.get("communityId");
const mode = communityId ? "community" : "private";
const finalOtherEmail = url.searchParams.get("otherEmail") || url.searchParams.get("email");
const chatTitle = url.searchParams.get("title") || "";

let activeConversationId = url.searchParams.get("conversationId");
let messages = [];
let communityMembers = [];
let pollingInterval = null;

/* --- 2. UI UTILITIES --- */
function setChatEnabled(enabled) {
    const input = document.getElementById("messageInput");
    const btn = document.getElementById("sendBtn");
    if (input) input.disabled = !enabled;
    if (btn) {
        btn.disabled = !enabled;
        btn.style.opacity = enabled ? "1" : "0.5";
        btn.style.cursor = enabled ? "pointer" : "not-allowed";
    }
}

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

/* --- 3. CORE MESSAGING --- */
async function loadMessages() {
    if (!activeConversationId) return;
    try {
        const r = await fetch(`${API_URL}?module=getMessages&conversationId=${activeConversationId}`);
        const data = await r.json();
        const backendMessages = (data.messages || []).slice(-20);
        // Keep optimistic messages that haven't synced yet
        const optimistic = messages.filter(m => m.optimistic);
        messages = [...backendMessages, ...optimistic];
        renderMessages();
    } catch (e) { console.error("Load error:", e); }
}

function renderMessages() {
    const container = document.getElementById("messages");
    if (!container) return;
    container.innerHTML = messages.map(msg => {
        const isMe = msg.senderEmail === loggedInUser.email;
        const color = isMe ? "#4A6CFF" : "#F0F0F0";
        const textColor = isMe ? "#fff" : "#333";
        return `
            <div style="display:flex; justify-content:${isMe ? 'flex-end' : 'flex-start'}; margin-bottom:12px;">
                <div style="background:${color}; color:${textColor}; padding:10px 14px; border-radius:15px; max-width:70%; word-break:break-word;">
                    ${msg.text || ""}
                </div>
            </div>`;
    }).join("");
    container.scrollTop = container.scrollHeight;
}

async function sendMessage() {
    const input = document.getElementById("messageInput");
    const text = input.value.trim();
    if (!text || !activeConversationId) return;

    // Optimistic UI update
    const tempMsg = { senderEmail: loggedInUser.email, text: text, optimistic: true };
    messages.push(tempMsg);
    renderMessages();
    input.value = "";

    try {
        await fetch(`${API_URL}?module=sendMessage&conversationId=${activeConversationId}&senderEmail=${loggedInUser.email}&type=text&text=${encodeURIComponent(text)}`);
        loadMessages();
    } catch (e) { console.error("Send error:", e); }
}

/* --- 4. INITIALIZATION --- */
document.addEventListener("DOMContentLoaded", async () => {
    loadNavbar();
    setChatEnabled(false); // Disable until ID is confirmed

    try {
        // Step 1: Get Conversation ID if missing
        if (!activeConversationId) {
            let startUrl = (mode === "community") 
                ? `${API_URL}?module=startCommunityConversation&communityId=${communityId}&userEmail=${loggedInUser.email}`
                : `${API_URL}?module=startConversation&userEmail=${loggedInUser.email}&otherEmail=${finalOtherEmail}`;
            
            const r = await fetch(startUrl);
            const d = await r.json();
            activeConversationId = d.conversationId;
        }

        if (activeConversationId) {
            setChatEnabled(true); // ACTIVATE UI
            loadMessages();
            pollingInterval = setInterval(loadMessages, 2000);
        } else {
            alert("Could not initialize chat. Please try again.");
        }

        // Step 2: Set Header
        const header = document.getElementById("headerTitle");
        if (header) header.innerText = chatTitle || (mode === "community" ? "Community Chat" : finalOtherEmail);

    } catch (e) {
        console.error("Init error:", e);
    }

    // Step 3: Attach Event Listeners
    const sendBtn = document.getElementById("sendBtn");
    const msgInput = document.getElementById("messageInput");

    if (sendBtn) sendBtn.onclick = sendMessage;
    if (msgInput) {
        msgInput.onkeydown = (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        };
    }
});

// Helper for mobile menu
function toggleMenu() { document.getElementById("mobileMenu")?.classList.toggle("show"); }
function logout() { localStorage.removeItem("contact_user"); window.location.href = "index.html"; }

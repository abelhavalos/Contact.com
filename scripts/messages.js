/****************************************************
 * CONTACT.COM — FIXED MEMBER LIST & AVATAR MAPPING
 ****************************************************/

const API_URL = "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

/* --- STATE --- */
let communityMembers = []; // Global store for all members in this community
let messages = [];
let activeConversationId = new URLSearchParams(window.location.search).get("conversationId");
let lastMessageJson = "";

/* --- 1. THE MEMBER ENGINE (Sidebar + Avatar Lookup) --- */

async function loadCommunityMembers() {
    const cid = new URLSearchParams(window.location.search).get("communityId");
    if (!cid) return;

    try {
        const r = await fetch(`${API_URL}?module=getCommunityMembers&communityId=${cid}`);
        const d = await r.json();
        
        // Google Sheets usually returns an array of emails or objects
        const emails = (d.members || []).map(m => typeof m === 'string' ? m : m.email);
        
        // Fetch full profiles for each member to get Names and Avatars
        const profilePromises = emails.map(email => 
            fetch(`${API_URL}?module=getUserByEmail&email=${encodeURIComponent(email)}`).then(res => res.json())
        );

        const profiles = await Promise.all(profilePromises);
        communityMembers = profiles.map(p => ({
            email: p.user?.email || p.user?.Email,
            fullName: p.user?.fullName || p.user?.FullName || p.user?.email,
            profilePic: p.user?.profilePic || p.user?.ProfilePic || null
        }));

        renderMemberSidebar(); // Fill the right-side list
        renderMessages(messages); // Re-render chat now that we have names/pics
    } catch (e) {
        console.error("Failed to load members:", e);
    }
}

function renderMemberSidebar() {
    const container = document.getElementById("memberSidebar");
    if (!container) return;

    container.innerHTML = "<h3>Members</h3>";
    communityMembers.forEach(m => {
        const initials = getInitials(m.fullName);
        const avatar = m.profilePic 
            ? `<img src="${m.profilePic}" class="chat-avatar" style="width:30px;height:30px;border-radius:50%">` 
            : `<div class="chat-avatar-fallback" style="width:30px;height:30px;border-radius:50%;background:#ddd;display:flex;align-items:center;justify-content:center;font-size:10px;">${initials}</div>`;

        container.innerHTML += `
            <div class="member-item" style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
                ${avatar}
                <div style="font-size:14px; font-weight:500;">${m.fullName}</div>
            </div>
        `;
    });
}

/* --- 2. THE CHAT RENDERER (Uses the Member Engine) --- */

function renderMessages(list) {
    const container = document.getElementById("messages");
    if (!container || list.length === 0) return;

    const fragment = document.createDocumentFragment();

    list.forEach((msg) => {
        const isMe = msg.senderEmail === loggedInUser.email;
        
        // CRITICAL FIX: Find member info from our global list
        const senderInfo = communityMembers.find(m => m.email === msg.senderEmail) || {
            fullName: msg.senderEmail,
            profilePic: null
        };

        const row = document.createElement("div");
        row.style.cssText = `display:flex; justify-content:${isMe ? 'flex-end' : 'flex-start'}; align-items:flex-end; margin-bottom:15px; gap:8px;`;

        const initials = getInitials(senderInfo.fullName);
        const avatarHTML = senderInfo.profilePic 
            ? `<img src="${senderInfo.profilePic}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;">`
            : `<div style="width:32px;height:32px;border-radius:50%;background:#e0e0e0;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;">${initials}</div>`;

        row.innerHTML = `
            ${!isMe ? avatarHTML : ''}
            <div style="max-width:70%;">
                <div style="font-size:11px; color:#777; margin-bottom:2px; ${isMe ? 'text-align:right' : ''}">${senderInfo.fullName}</div>
                <div style="background:${isMe ? '#4A6CFF' : '#F0F0F0'}; color:${isMe ? '#fff' : '#333'}; padding:10px 14px; border-radius:12px;">
                    ${renderMessageContent(msg)}
                </div>
            </div>
            ${isMe ? avatarHTML : ''}
        `;
        fragment.appendChild(row);
    });

    container.innerHTML = "";
    container.appendChild(fragment);
    container.scrollTop = container.scrollHeight;
}

/* --- 3. UPDATED DOM INITIALIZATION --- */

document.addEventListener("DOMContentLoaded", async () => {
    loadNavbar();
    
    // 1. Start loading members immediately (Don't wait to render messages)
    if (mode === "community") {
        loadCommunityMembers(); 
    }

    // 2. Resolve the Conversation ID
    if (!activeConversationId) {
        if (mode === "community") {
            const r = await fetch(`${API_URL}?module=startCommunityConversation&communityId=${communityId}&userEmail=${loggedInUser.email}`);
            const d = await r.json();
            activeConversationId = d.conversationId;
        } else {
            // Private chat logic...
        }
    }

    // 3. Start Polling
    if (activeConversationId) startPolling();
});

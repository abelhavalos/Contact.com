/****************************************************
 * CONTACT.COM — MESSAGES.JS (V16)
 * - FIXED: Recursive File Picker Loop
 * - FIXED: Desktop/Mobile Sidebar Logic
 ****************************************************/

/* ... (Keep your API_URL and State variables at the top) ... */

function setupFilePickers() {
    const uploadImgBtn = document.getElementById("uploadImgBtn");
    const imgInput = document.getElementById("imgInput");
    const uploadDocBtn = document.getElementById("uploadDocBtn");
    const docInput = document.getElementById("docInput");

    // 1. Image Picker Logic
    if (uploadImgBtn && imgInput) {
        // Clear old listeners by cloning (Prevents the loop)
        const newBtn = uploadImgBtn.cloneNode(true);
        uploadImgBtn.parentNode.replaceChild(newBtn, uploadImgBtn);

        newBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            imgInput.click(); // Only click the hidden input once
        });

        imgInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            showChatLoader();
            const base64 = await fileToBase64(file);
            await sendMessage({ type: "image", fileName: file.name, fileData: base64 });
            
            e.target.value = ""; // Clear value so it doesn't loop
            hideChatLoader();
        };
    }

    // 2. Document Picker Logic
    if (uploadDocBtn && docInput) {
        const newDocBtn = uploadDocBtn.cloneNode(true);
        uploadDocBtn.parentNode.replaceChild(newDocBtn, uploadDocBtn);

        newDocBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            docInput.click();
        });

        docInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            showChatLoader();
            const base64 = await fileToBase64(file);
            await sendMessage({ type: "document", fileName: file.name, fileData: base64 });
            
            e.target.value = "";
            hideChatLoader();
        };
    }
}

async function loadHistory() {
    if (!activeConversationId) return;
    try {
        const r = await fetch(`${API_URL}?module=getMessages&conversationId=${activeConversationId}`);
        const data = await r.json();
        const list = document.getElementById("messageList");
        
        if (data.messages) {
            messages = data.messages;
            list.innerHTML = ""; // Wipe "loading" text
            messages.forEach(msg => {
                list.appendChild(buildMessageRow(msg));
            });
            const container = document.getElementById("messages");
            container.scrollTop = container.scrollHeight;
        }
    } catch (e) { console.error("Load History Error:", e); }
}

/* 3. INITIALIZE EVERYTHING */
document.addEventListener("DOMContentLoaded", async () => {
    loadNavbar();
    setupFilePickers(); // Initialize the fixed pickers
    
    // Sidebar Toggle (Mobile only)
    const toggleBtn = document.getElementById("toggleMembers");
    const sidebar = document.getElementById("memberSidebar");
    if (toggleBtn && sidebar) {
        toggleBtn.onclick = (e) => {
            e.stopPropagation();
            sidebar.classList.toggle("show-mobile");
        };
    }

    // Load Chat Data
    await loadChatContext();
    
    // Get Conversation
    if (!activeConversationId) {
        const setupUrl = mode === "community" 
            ? `${API_URL}?module=startCommunityConversation&communityId=${communityId}&userEmail=${loggedInUser.email}`
            : `${API_URL}?module=startConversation&userEmail=${loggedInUser.email}&otherEmail=${otherEmailParam}`;
        const res = await fetch(setupUrl);
        const data = await res.json();
        activeConversationId = data.conversationId;
    }

    await loadHistory();
    setInterval(syncNewMessages, 4000);
});

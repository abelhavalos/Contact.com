const API_URL = "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

let loggedInUser = JSON.parse(localStorage.getItem("contact_user"));
if (!loggedInUser) window.location.href = "login.html";

let allContacts = [];

/* INIT */
document.addEventListener("DOMContentLoaded", () => {
    loadNavbar();
    showLoader(true);
    loadFromCache();
    fetchContacts();
    setupSearch();
});

/* NAVBAR & MOBILE MENU LOGIC */
function loadNavbar() {
    const navLinksHTML = `
      <a href="dashboard.html">Dashboard</a>
      <a href="communities.html">Communities</a>
      <a href="events.html">Events</a>
      <a href="contacts.html">Contacts</a>
      <a href="profile.html">Profile</a>
      <a href="#" onclick="logout()" style="color:#ff4a4a !important;">Logout</a>
    `;

    document.getElementById("navbar").innerHTML = `
        <div class="hamburger" onclick="toggleMenu()">
            <span></span><span></span><span></span>
        </div>
        <div class="logo">Contact<span>.</span>com</div>
        <div class="nav-links">${navLinksHTML}</div>
    `;

    document.getElementById("mobileMenu").innerHTML = navLinksHTML;
}

function toggleMenu() {
    document.getElementById("mobileMenu").classList.toggle("show");
}

// Close menu when clicking outside
document.addEventListener("click", (e) => {
    const menu = document.getElementById("mobileMenu");
    const hamburger = document.querySelector(".hamburger");
    if (menu && menu.classList.contains("show") && !menu.contains(e.target) && !hamburger.contains(e.target)) {
        menu.classList.remove("show");
    }
});

function logout() {
    localStorage.removeItem("contact_user");
    window.location.href = "index.html";
}

/* RENDER CONTACTS (MOBILE-OPTIMIZED STRUCTURE) */
function renderContacts(list) {
    const container = document.getElementById("contactsContainer");
    container.innerHTML = "";

    if (!list.length) {
        updateEmptyState(true);
        return;
    }
    updateEmptyState(false);

    const groups = {};
    list.forEach(c => {
        const letter = (c.fullName || "U")[0].toUpperCase();
        if (!groups[letter]) groups[letter] = [];
        groups[letter].push(c);
    });

    Object.keys(groups).sort().forEach(letter => {
        const groupDiv = document.createElement("div");
        groupDiv.className = "contact-group";
        groupDiv.innerHTML = `<div class="group-title">${letter}</div>`;

        groups[letter].forEach(c => {
            const initials = (c.fullName || "U")
                .split(" ")
                .map(p => p[0])
                .join("")
                .substring(0, 2)
                .toUpperCase();

            const avatarHTML = c.profilePic
                ? `<img class="contact-avatar" src="${c.profilePic}" alt="avatar" style="object-fit: cover;">`
                : `<div class="contact-avatar">${initials}</div>`;

            const card = document.createElement("div");
            card.className = "contact-card";

            // STRUCTURE UPDATED FOR MOBILE STACKING
            card.innerHTML = `
                <div class="contact-main">
                    ${avatarHTML}
                    <div class="contact-info">
                        <div class="contact-name">${c.fullName}</div>
                        <div class="contact-email">${c.email}</div>
                    </div>
                </div>
                <div class="contact-actions">
                    <button class="contact-btn" onclick="messageUser('${c.email}')">Message</button>
                    <button class="contact-btn secondary" onclick="viewProfile('${c.email}')">Profile</button>
                </div>
            `;

            groupDiv.appendChild(card);
        });
        container.appendChild(groupDiv);
    });
}

/* UTILITIES (Cache, Loader, Fetch, Search) */
function showLoader(show) {
    document.getElementById("contactsLoader").style.display = show ? "flex" : "none";
}

function updateEmptyState(show) {
    document.getElementById("emptyState").style.display = show ? "block" : "none";
}

function loadFromCache() {
    const cached = localStorage.getItem("contact_cache_contacts");
    if (cached) {
        try {
            allContacts = JSON.parse(cached);
            renderContacts(allContacts);
            showLoader(false);
        } catch (e) { console.error("Cache error", e); }
    }
}

function saveCache(list) {
    localStorage.setItem("contact_cache_contacts", JSON.stringify(list));
}

async function fetchContacts() {
    try {
        const r = await fetch(`${API_URL}?module=getUserContacts&email=${encodeURIComponent(loggedInUser.email)}`);
        const d = await r.json();

        if (!d.success || !Array.isArray(d.contacts)) {
            showLoader(false);
            if (!allContacts.length) updateEmptyState(true);
            return;
        }

        const hydrated = await Promise.all(
            d.contacts.map(email =>
                fetch(`${API_URL}?module=getUserByEmail&email=${encodeURIComponent(email)}`)
                    .then(r => r.json())
                    .then(data => ({
                        email,
                        fullName: data?.user?.fullName || data?.user?.FullName || "Unknown",
                        profilePic: data?.user?.profilePic || data?.user?.ProfilePic || null
                    }))
                    .catch(() => ({ email, fullName: "Unknown", profilePic: null }))
            )
        );

        allContacts = hydrated;
        renderContacts(allContacts);
        saveCache(allContacts);
        showLoader(false);
    } catch (e) {
        showLoader(false);
        console.error("Fetch error", e);
    }
}

function setupSearch() {
    const input = document.getElementById("searchInput");
    input.addEventListener("input", () => {
        const q = input.value.toLowerCase();
        const filtered = allContacts.filter(c => 
            (c.fullName || "").toLowerCase().includes(q) || 
            (c.email || "").toLowerCase().includes(q)
        );
        renderContacts(filtered);
    });
}

function messageUser(email) {
    window.location.href = `messages.html?otherEmail=${encodeURIComponent(email)}`;
}

function viewProfile(email) {
    window.location.href = `public-profile.html?email=${encodeURIComponent(email)}`;
}

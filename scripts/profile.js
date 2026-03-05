const API_URL = "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

/* 1. INITIALIZE */
document.addEventListener("DOMContentLoaded", () => {
    loadNavbar();
    loadProfile();
    initProfilePictureHandler();
});

/* 2. NAVBAR (MATCHES INDEX.HTML) */
function loadNavbar() {
    const nav = document.getElementById("navbar");
    const mob = document.getElementById("mobileMenu");
    
    if (nav) {
        nav.innerHTML = `
            <div class="hamburger" onclick="toggleMenu()"><span></span><span></span><span></span></div>
            <div class="logo">Contact<span>.</span>com</div>
            <div class="nav-links">
                <a href="dashboard.html">Dashboard</a>
                <a href="communities.html">Communities</a>
                <a href="events.html">Events</a>
                <a href="profile.html">Profile</a>
                <button style="padding: 8px 15px; background:#4A6CFF; color:#fff; border:none; border-radius:8px; cursor:pointer; font-weight:700;" onclick="logout()">Logout</button>
            </div>`;
    }
    if (mob) {
        mob.innerHTML = `
            <a href="dashboard.html">Dashboard</a>
            <a href="communities.html">Communities</a>
            <a href="events.html">Events</a>
            <a href="profile.html">Profile</a>
            <a href="#" onclick="logout()">Logout</a>`;
    }
}

function toggleMenu() { document.getElementById("mobileMenu").classList.toggle("show"); }
function logout() { localStorage.removeItem("contact_user"); window.location.href = "index.html"; }

/* 3. LOAD PROFILE (WITH NULL CHECKS) */
async function loadProfile() {
    const user = JSON.parse(localStorage.getItem("contact_user"));
    if (!user) return (window.location.href = "login.html");

    // Helper to safely set values and avoid "Cannot set properties of null"
    const safeSet = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val || "";
    };
    const safeText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.innerText = val || "";
    };

    safeSet("username_hidden", user.email);
    safeText("fullNameDisplay", user.fullName || user.FullName);
    safeText("professionDisplay", user.profession || "Profession");
    safeSet("fullName", user.fullName || user.FullName);
    safeSet("profession", user.profession);
    safeSet("about", user.about);

    if (user.profilePic) document.getElementById("profilePicPreview").src = user.profilePic;
}

/* 4. ACTIONS */
function enableEditing() {
    document.querySelectorAll(".section input, .section textarea").forEach(el => {
        if (el.type !== "password") el.disabled = false;
    });
    document.getElementById("saveBtn").style.display = "block";
    document.getElementById("editBtn").style.display = "none";
}

async function saveProfile() {
    const user = JSON.parse(localStorage.getItem("contact_user"));
    const updated = {
        ...user,
        fullName: document.getElementById("fullName").value,
        profession: document.getElementById("profession").value,
        about: document.getElementById("about").value
    };

    showLoader("Saving...");
    try {
        const q = new URLSearchParams({ module: "saveProfile", email: user.email, ...updated });
        const res = await fetch(`${API_URL}?${q.toString()}`);
        const data = await res.json();
        if (data.success) {
            localStorage.setItem("contact_user", JSON.stringify(updated));
            location.reload();
        }
    } catch (e) { alert("Error saving profile"); }
    finally { hideLoader(); }
}

function initProfilePictureHandler() {
    const input = document.getElementById("profilePicFileInput");
    input.addEventListener("change", () => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result;
            document.getElementById("profilePicPreview").src = base64;
            // Add your uploadPhoto logic here if needed
        };
        reader.readAsDataURL(input.files[0]);
    });
}

function showLoader(t) { document.getElementById("profileLoader").style.display = "flex"; }
function hideLoader() { document.getElementById("profileLoader").style.display = "none"; }

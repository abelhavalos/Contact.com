const API_URL = "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

// 1. RUN ON LOAD
document.addEventListener("DOMContentLoaded", () => {
    loadNavbar();
    loadProfile();
});

// 2. NAVBAR & SIDEBAR LOGIC
function loadNavbar() {
    const nav = document.getElementById("navbar");
    const mob = document.getElementById("mobileMenu");
    
    // Desktop & Logo
    if(nav) {
        nav.innerHTML = `
            <div class="hamburger" onclick="toggleMenu()">
                <span></span><span></span><span></span>
            </div>
            <div class="logo">Contact<span>.</span>com</div>
            <div class="nav-links">
                <a href="dashboard.html">Dashboard</a>
                <a href="communities.html">Communities</a>
                <a href="events.html">Events</a>
                <a href="profile.html">Profile</a>
                <button onclick="logout()" style="background:#4A6CFF; color:white; border:none; padding:8px 15px; border-radius:8px; font-weight:700; cursor:pointer;">Logout</button>
            </div>`;
    }
    
    // The Short Sidebar
    if(mob) {
        mob.innerHTML = `
            <a href="dashboard.html">Dashboard</a>
            <a href="communities.html">Communities</a>
            <a href="events.html">Events</a>
            <a href="profile.html">Profile</a>
            <a href="#" onclick="logout()" style="border-bottom:none;">Logout</a>`;
    }
}

function toggleMenu() {
    const menu = document.getElementById("mobileMenu");
    if(menu) menu.classList.toggle("show");
}

// 3. DATA LOADING
async function loadProfile() {
    const user = JSON.parse(localStorage.getItem("contact_user"));
    if (!user) return window.location.href = "login.html";

    // Set hidden field value to stop the Chrome Password error
    const hiddenUser = document.getElementById("username_hidden");
    if(hiddenUser) {
        hiddenUser.value = user.email || "";
    }

    // Update Header
    document.getElementById("fullNameDisplay").innerText = user.fullName || "User Name";
    document.getElementById("professionDisplay").innerText = user.profession || "Profession";
    
    // Update Inputs
    document.getElementById("fullName").value = user.fullName || "";
    document.getElementById("profession").value = user.profession || "";
    document.getElementById("about").value = user.about || "";
    
    // Profile Picture
    if (user.profilePic) {
        document.getElementById("profilePicPreview").src = user.profilePic;
    }
}

// 4. CORE ACTIONS
function enableEditing() {
    document.querySelectorAll("input, textarea").forEach(el => {
        // Don't enable the hidden field or password fields automatically
        if(el.type !== "password" && el.id !== "username_hidden") {
            el.disabled = false;
        }
    });
    document.getElementById("saveBtn").style.display = "inline-block";
    document.getElementById("editBtn").style.display = "none";
}

function logout() {
    localStorage.removeItem("contact_user");
    window.location.href = "index.html";
}

// Note: Add your existing saveProfile(), changePassword(), and changeEmail() 
// functions below this line, they will work perfectly with this structure.

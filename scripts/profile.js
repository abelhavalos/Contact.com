const API_URL = "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

document.addEventListener("DOMContentLoaded", () => {
    loadNavbar();
    loadProfile();
});

function loadNavbar() {
    const nav = document.getElementById("navbar");
    const mob = document.getElementById("mobileMenu");
    
    const navContent = `
        <div class="hamburger" onclick="toggleMenu()"><span></span><span></span><span></span></div>
        <div class="logo">Contact<span>.</span>com</div>
        <div class="nav-links">
            <a href="dashboard.html">Dashboard</a>
            <a href="communities.html">Communities</a>
            <a href="events.html">Events</a>
            <a href="profile.html">Profile</a>
            <button onclick="logout()" style="background:#4A6CFF; color:white; border:none; padding:8px 15px; border-radius:8px; font-weight:700; cursor:pointer;">Logout</button>
        </div>`;
    
    if(nav) nav.innerHTML = navContent;
    if(mob) mob.innerHTML = `
        <a href="dashboard.html">Dashboard</a>
        <a href="communities.html">Communities</a>
        <a href="events.html">Events</a>
        <a href="profile.html">Profile</a>
        <a href="#" onclick="logout()">Logout</a>`;
}

function toggleMenu() { document.getElementById("mobileMenu").classList.toggle("show"); }

async function loadProfile() {
    const user = JSON.parse(localStorage.getItem("contact_user"));
    if (!user) return window.location.href = "login.html";

    // Set hidden field to prevent "null" error and satisfy browser
    const hiddenUser = document.getElementById("username_hidden");
    if(hiddenUser) hiddenUser.value = user.email;

    document.getElementById("fullNameDisplay").innerText = user.fullName || "User";
    document.getElementById("fullName").value = user.fullName || "";
    document.getElementById("profession").value = user.profession || "";
    document.getElementById("about").value = user.about || "";
    
    if (user.profilePic) document.getElementById("profilePicPreview").src = user.profilePic;
}

function enableEditing() {
    document.querySelectorAll("input, textarea").forEach(el => {
        if(el.type !== "password") el.disabled = false;
    });
    document.getElementById("saveBtn").style.display = "inline-block";
    document.getElementById("editBtn").style.display = "none";
}

function logout() { localStorage.removeItem("contact_user"); window.location.href = "index.html"; }
// ... Rest of your functions (saveProfile, changePassword, etc.) remain the same

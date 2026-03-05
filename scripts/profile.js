const API_URL = "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

document.addEventListener("DOMContentLoaded", () => {
    loadNavbar();
    loadProfile();
});

// NAVBAR & SIDEBAR
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
        <a href="#" onclick="logout()" style="border-bottom:none;">Logout</a>`;
}

function toggleMenu() { document.getElementById("mobileMenu").classList.toggle("show"); }

// LOAD PROFILE DATA
async function loadProfile() {
    const user = JSON.parse(localStorage.getItem("contact_user"));
    if (!user) return window.location.href = "login.html";

    const hiddenUser = document.getElementById("username_hidden");
    if(hiddenUser) hiddenUser.value = user.email;

    const userProfession = user.profession || user.Profession || "";
    const userFullName = user.fullName || user.FullName || "User Name";

    document.getElementById("fullNameDisplay").innerText = userFullName;
    document.getElementById("professionDisplay").innerText = userProfession;
    
    document.getElementById("fullName").value = userFullName;
    document.getElementById("profession").value = userProfession;
    document.getElementById("about").value = user.about || "";
    
    if (user.profilePic) document.getElementById("profilePicPreview").src = user.profilePic;
}

// 1. UPDATE EMAIL FUNCTION
async function changeEmail() {
    const user = JSON.parse(localStorage.getItem("contact_user"));
    const newEmail = document.getElementById("newEmail").value;

    if(!newEmail) return;
    showLoader("Updating Email...");

    try {
        const res = await fetch(`${API_URL}?module=changeEmail&oldEmail=${user.email}&newEmail=${newEmail}`);
        const data = await res.json();
        if(data.success) {
            user.email = newEmail;
            localStorage.setItem("contact_user", JSON.stringify(user));
            showPopup("Success", "Email updated successfully!");
        } else {
            showPopup("Error", data.message || "Failed to update email.");
        }
    } catch (e) { showPopup("Error", "Network error."); }
    finally { hideLoader(); }
}

// 2. UPDATE PASSWORD FUNCTION
async function changePassword() {
    const user = JSON.parse(localStorage.getItem("contact_user"));
    const newPass = document.getElementById("newPassword").value;
    const confirmPass = document.getElementById("confirmPassword").value;

    if (newPass !== confirmPass) {
        showPopup("Error", "Passwords do not match!");
        return;
    }

    showLoader("Updating Password...");
    try {
        const res = await fetch(`${API_URL}?module=changePassword&email=${user.email}&newPassword=${encodeURIComponent(newPass)}`);
        const data = await res.json();
        if(data.success) {
            showPopup("Success", "Password updated successfully!");
            document.getElementById("passwordForm").reset();
        } else {
            showPopup("Error", data.message || "Failed to update password.");
        }
    } catch (e) { showPopup("Error", "Network error."); }
    finally { hideLoader(); }
}

// UI HELPERS
function enableEditing() {
    document.querySelectorAll(".section input, .section textarea").forEach(el => {
        if(el.type !== "password" && el.id !== "username_hidden") el.disabled = false;
    });
    document.getElementById("saveBtn").style.display = "inline-block";
    document.getElementById("editBtn").style.display = "none";
}

function logout() { localStorage.removeItem("contact_user"); window.location.href = "index.html"; }
function showLoader() { document.getElementById("profileLoader").style.display = "flex"; }
function hideLoader() { document.getElementById("profileLoader").style.display = "none"; }

function showPopup(title, msg) {
    document.getElementById("popupTitle").innerText = title;
    document.getElementById("popupMessage").innerText = msg;
    document.getElementById("popupBackdrop").style.display = "flex";
    document.getElementById("mainPopup").style.display = "block";
}
function hidePopup() { document.getElementById("popupBackdrop").style.display = "none"; }

const API_URL = "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

/* 1. INITIALIZE & NAVBAR */
document.addEventListener("DOMContentLoaded", () => {
    loadNavbar();
    loadProfile();
    initProfilePictureHandler();
});

function loadNavbar() {
    const navHTML = `
        <div class="hamburger" onclick="toggleMenu()">
            <span></span><span></span><span></span>
        </div>
        <div class="logo">Contact<span>.</span>com</div>
        <div class="nav-links">
            <a href="dashboard.html">Dashboard</a>
            <a href="communities.html">Communities</a>
            <a href="events.html">Events</a>
            <a href="contacts.html">Contacts</a>
            <a href="profile.html">Profile</a>
            <button class="btn-primary" style="padding: 8px 15px; font-size:13px;" onclick="logout()">Logout</button>
        </div>`;
    
    const mobileHTML = `
        <a href="dashboard.html">Dashboard</a>
        <a href="communities.html">Communities</a>
        <a href="events.html">Events</a>
        <a href="contacts.html">Contacts</a>
        <a href="profile.html">Profile</a>
        <a href="#" onclick="logout()">Logout</a>`;

    document.getElementById("navbar").innerHTML = navHTML;
    document.getElementById("mobileMenu").innerHTML = mobileHTML;
}

function toggleMenu() {
    document.getElementById("mobileMenu").classList.toggle("show");
}

function logout() {
    localStorage.removeItem("contact_user");
    window.location.href = "index.html";
}

/* 2. PROFILE LOADING */
async function loadProfile() {
    const user = JSON.parse(localStorage.getItem("contact_user"));
    if (!user) return (window.location.href = "login.html");

    // FIX FOR CONSOLE ERROR: Bind the hidden username field to the current user email
    const hiddenUserField = document.getElementById("username_hidden");
    if (hiddenUserField) hiddenUserField.value = user.email;

    document.getElementById("fullNameDisplay").innerText = user.fullName || "User";
    document.getElementById("professionDisplay").innerText = user.profession || "Profession Not Set";

    document.getElementById("fullName").value = user.fullName || "";
    document.getElementById("profession").value = user.profession || "";
    document.getElementById("about").value = user.about || "";
    document.getElementById("skills").value = user.skills || "";

    if (user.profilePic) {
        document.getElementById("profilePicPreview").src = user.profilePic;
    }
}

/* 3. EDITING & SAVING */
function enableEditing() {
    document.querySelectorAll("input, textarea").forEach(el => {
        if(el.type !== "password") el.disabled = false;
    });
    document.getElementById("saveBtn").style.display = "block";
    document.getElementById("editBtn").style.display = "none";
}

async function saveProfile() {
    const user = JSON.parse(localStorage.getItem("contact_user"));
    const updatedUser = {
        ...user,
        fullName: document.getElementById("fullName").value,
        profession: document.getElementById("profession").value,
        about: document.getElementById("about").value,
        skills: document.getElementById("skills").value
    };

    showLoader("Saving Profile...");
    const url = `${API_URL}?module=saveProfile&email=${encodeURIComponent(user.email)}` +
                `&fullName=${encodeURIComponent(updatedUser.fullName)}` +
                `&profession=${encodeURIComponent(updatedUser.profession)}` +
                `&about=${encodeURIComponent(updatedUser.about)}` +
                `&skills=${encodeURIComponent(updatedUser.skills)}`;

    try {
        const res = await fetch(url);
        const result = await res.json();
        if (result.success) {
            localStorage.setItem("contact_user", JSON.stringify(updatedUser));
            location.reload();
        }
    } catch (e) { showPopup("Error", "Network connection failed."); }
    finally { hideLoader(); }
}

/* 4. PHOTO HANDLING (BASE64) */
function initProfilePictureHandler() {
    const input = document.getElementById("profilePicFileInput");
    const preview = document.getElementById("profilePicPreview");
    
    input.addEventListener("change", () => {
        const file = input.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64 = reader.result;
            preview.src = base64;
            uploadPhoto(base64);
        };
        reader.readAsDataURL(file);
    });
}

async function uploadPhoto(base64) {
    const user = JSON.parse(localStorage.getItem("contact_user"));
    showLoader("Uploading Photo...");
    try {
        const res = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify({ module: "updateProfilePic", email: user.email, profilePic: base64 })
        });
        const data = await res.json();
        if (data.success) {
            user.profilePic = base64;
            localStorage.setItem("contact_user", JSON.stringify(user));
            showLoader("Success!");
            setTimeout(hideLoader, 1000);
        }
    } catch (e) { hideLoader(); showPopup("Error", "Photo upload failed."); }
}

/* 5. UI HELPERS */
function showLoader(txt) {
    const l = document.getElementById("profileLoader");
    l.querySelector(".loading-text").innerText = txt;
    l.style.display = "flex";
}
function hideLoader() { document.getElementById("profileLoader").style.display = "none"; }

function showPopup(title, msg) {
    document.getElementById("popupTitle").innerText = title;
    document.getElementById("popupMessage").innerText = msg;
    document.getElementById("popupBackdrop").style.display = "flex";
}
function hidePopup() { document.getElementById("popupBackdrop").style.display = "none"; }

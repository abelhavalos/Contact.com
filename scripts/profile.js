const API_URL = "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

/* 1. INITIALIZE */
document.addEventListener("DOMContentLoaded", () => {
    loadNavbar();
    loadProfile();
    initProfilePictureHandler();
});

/* 2. NAVBAR (Synchronized with Messages.js) */
function loadNavbar() {
    const navHTML = `
        <div class="hamburger" onclick="toggleMenu()"><span></span><span></span><span></span></div>
        <div class="logo">Contact<span>.</span>com</div>
        <div class="nav-links">
            <a href="dashboard.html">Dashboard</a>
            <a href="communities.html">Communities</a>
            <a href="events.html">Events</a>
            <a href="contacts.html">Contacts</a>
            <a href="profile.html">Profile</a>
            <a href="#" onclick="logout()">Logout</a>
        </div>`;
    document.getElementById("navbar").innerHTML = navHTML;
    document.getElementById("mobileMenu").innerHTML = `
        <a href="dashboard.html">Dashboard</a>
        <a href="communities.html">Communities</a>
        <a href="events.html">Events</a>
        <a href="contacts.html">Contacts</a>
        <a href="profile.html">Profile</a>
        <a href="#" onclick="logout()">Logout</a>`;
}

function toggleMenu() { document.getElementById("mobileMenu").classList.toggle("show"); }

function logout() {
    localStorage.removeItem("contact_user");
    window.location.href = "index.html";
}

/* 3. PROFILE DATA HANDLING */
async function loadProfile() {
    const user = JSON.parse(localStorage.getItem("contact_user"));
    if (!user) return (window.location.href = "login.html");

    // Populate hidden field for Browser Password Managers
    if(document.getElementById("username_hidden")) {
        document.getElementById("username_hidden").value = user.email;
    }

    document.getElementById("fullNameDisplay").innerText = user.fullName || user.FullName || "New User";
    document.getElementById("professionDisplay").innerText = user.profession || "Set your profession";

    document.getElementById("fullName").value = user.fullName || user.FullName || "";
    document.getElementById("profession").value = user.profession || "";
    document.getElementById("about").value = user.about || "";
    document.getElementById("skills").value = user.skills || "";
    document.getElementById("workLife").value = user.workLife || "";

    if (user.profilePic || user.ProfilePic) {
        document.getElementById("profilePicPreview").src = user.profilePic || user.ProfilePic;
    }
}

function enableEditing() {
    document.querySelectorAll("#fullName, #profession, #about, #skills, #workLife").forEach(el => el.disabled = false);
    document.getElementById("saveBtn").style.display = "block";
    document.getElementById("editBtn").style.display = "none";
}

async function saveProfile() {
    const user = JSON.parse(localStorage.getItem("contact_user"));
    const updated = {
        ...user,
        fullName: document.getElementById("fullName").value,
        profession: document.getElementById("profession").value,
        about: document.getElementById("about").value,
        skills: document.getElementById("skills").value,
        workLife: document.getElementById("workLife").value
    };

    showLoader("Saving...");
    const params = new URLSearchParams({
        module: "saveProfile",
        email: user.email,
        ...updated
    });

    try {
        const res = await fetch(`${API_URL}?${params.toString()}`);
        const data = await res.json();
        if (data.success) {
            localStorage.setItem("contact_user", JSON.stringify(updated));
            location.reload(); // Re-locks the fields
        } else {
            showPopup("Error", data.message || "Save failed");
        }
    } catch (e) { showPopup("Error", "Network connection failed"); }
    finally { hideLoader(); }
}

/* 4. PERMANENT PICTURE UPLOAD (Base64) */
function initProfilePictureHandler() {
    const input = document.getElementById("profilePicFileInput");
    const preview = document.getElementById("profilePicPreview");

    preview.onclick = () => input.click();
    input.onchange = () => {
        const file = input.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64 = reader.result;
            preview.src = base64;
            uploadPhotoToServer(base64);
        };
        reader.readAsDataURL(file);
    };
}

async function uploadPhotoToServer(base64) {
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
            setTimeout(hideLoader, 800);
        }
    } catch (e) { hideLoader(); showPopup("Error", "Upload failed"); }
}

/* 5. UI HELPERS */
function showLoader(txt) { 
    const l = document.getElementById("profileLoader");
    l.querySelector(".loading-text").innerText = txt;
    l.style.display = "flex"; 
}
function hideLoader() { document.getElementById("profileLoader").style.display = "none"; }

function showPopup(t, m) {
    document.getElementById("popupTitle").innerText = t;
    document.getElementById("popupMessage").innerText = m;
    document.getElementById("popupBackdrop").style.display = "flex";
    document.getElementById("mainPopup").style.display = "block";
}
function hidePopup() { document.getElementById("popupBackdrop").style.display = "none"; }

function showDeleteConfirm() {
    document.getElementById("popupBackdrop").style.display = "flex";
    document.getElementById("deleteConfirmPopup").style.display = "block";
}
function hideDeleteConfirm() { document.getElementById("popupBackdrop").style.display = "none"; }

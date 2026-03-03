const API_URL = "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

/* ============================
   POPUP SYSTEM
============================ */
function showPopup(title, message) {
    document.getElementById("popupTitle").innerText = title;
    document.getElementById("popupMessage").innerText = message;

    document.getElementById("deleteConfirmPopup").style.display = "none";
    document.getElementById("mainPopup").style.display = "block";
    document.getElementById("popupBackdrop").style.display = "flex";
}

function hidePopup() {
    document.getElementById("mainPopup").style.display = "none";
    document.getElementById("popupBackdrop").style.display = "none";
}

function showDeleteConfirm() {
    document.getElementById("mainPopup").style.display = "none";
    document.getElementById("deleteConfirmPopup").style.display = "block";
    document.getElementById("popupBackdrop").style.display = "flex";
}

function hideDeleteConfirm() {
    document.getElementById("deleteConfirmPopup").style.display = "none";
    document.getElementById("popupBackdrop").style.display = "none";
}

/* ============================
   NAVBAR & MOBILE MENU
============================ */
function toggleMenu() {
    document.getElementById("mobileMenu").classList.toggle("show");
}

function loadNavbar() {
    const user = JSON.parse(localStorage.getItem("contact_user"));
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

    // MOBILE FIX: Close menu when clicking any link
    document.querySelectorAll("#mobileMenu a").forEach(link => {
        link.addEventListener("click", () => {
            document.getElementById("mobileMenu").classList.remove("show");
        });
    });
}

// MOBILE FIX: Close menu when clicking outside
document.addEventListener("click", (e) => {
    const menu = document.getElementById("mobileMenu");
    const hamburger = document.querySelector(".hamburger");
    if (menu.classList.contains("show") && !menu.contains(e.target) && !hamburger.contains(e.target)) {
        menu.classList.remove("show");
    }
});

/* ============================
   LOADER
============================ */
function showLoader(text) {
    const loader = document.getElementById("profileLoader");
    // Updated selector to match your HTML structure
    const textEl = loader.querySelector("p"); 
    if (textEl) textEl.innerText = text;
    loader.style.display = "flex";
}

function hideLoader() {
    document.getElementById("profileLoader").style.display = "none";
}

/* ============================
   LOAD PROFILE
============================ */
document.addEventListener("DOMContentLoaded", () => {
    loadNavbar();
    loadProfile();
    initProfilePictureHandler();
});

async function loadProfile() {
    const user = JSON.parse(localStorage.getItem("contact_user"));
    if (!user) return (window.location.href = "login.html");

    hideLoader();

    setText("fullNameDisplay", user.fullName);
    setText("professionDisplay", user.profession || "Your profession");

    setInput("fullName", user.fullName);
    setInput("profession", user.profession);
    setInput("about", user.about);
    setInput("skills", user.skills);
    setInput("workLife", user.workLife);

    if (user.profilePic) {
        const pic = document.getElementById("profilePicPreview");
        if (pic) pic.src = user.profilePic;
    }
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerText = value || "";
}

function setInput(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value || "";
}

function getVal(id) {
    const el = document.getElementById(id);
    return el ? el.value : "";
}

/* ============================
   ENABLE EDITING
============================ */
function enableEditing() {
    document
        .querySelectorAll("#fullName, #profession, #about, #skills, #workLife")
        .forEach((el) => (el.disabled = false));

    document.getElementById("saveBtn").style.display = "block"; // Changed to block for mobile full-width
    document.getElementById("editBtn").style.display = "none";
}

/* ============================
   SAVE PROFILE
============================ */
async function saveProfile() {
    const user = JSON.parse(localStorage.getItem("contact_user"));
    if (!user) return (window.location.href = "login.html");

    const updatedUser = {
        ...user,
        fullName: getVal("fullName"),
        profession: getVal("profession"),
        about: getVal("about"),
        skills: getVal("skills"),
        workLife: getVal("workLife"),
    };

    localStorage.setItem("contact_user", JSON.stringify(updatedUser));
    loadProfile();

    showLoader("Saving changes...");

    const url = `${API_URL}?module=saveProfile` +
                `&email=${encodeURIComponent(user.email)}` +
                `&fullName=${encodeURIComponent(updatedUser.fullName)}` +
                `&profession=${encodeURIComponent(updatedUser.profession)}` +
                `&about=${encodeURIComponent(updatedUser.about)}` +
                `&skills=${encodeURIComponent(updatedUser.skills)}` +
                `&workLife=${encodeURIComponent(updatedUser.workLife)}`;

    try {
        const res = await fetch(url);
        const result = await res.json();

        if (result.success) {
            showLoader("Profile updated!");
            setTimeout(hideLoader, 1000);
            // Disable inputs again
            document.querySelectorAll("#fullName, #profession, #about, #skills, #workLife")
                    .forEach((el) => (el.disabled = true));
            document.getElementById("saveBtn").style.display = "none";
            document.getElementById("editBtn").style.display = "block";
        } else {
            hideLoader();
            showPopup("Update Failed", result.message || "Failed to update profile.");
        }
    } catch (e) {
        hideLoader();
        showPopup("Network Error", "Could not reach the server.");
    }
}

/* ============================
   CHANGE EMAIL / PASSWORD / DELETE (Omitted for brevity, logic remains same)
   ... copy the rest of your original logic here ...
============================ */

function logout() {
    localStorage.removeItem("contact_user");
    window.location.href = "index.html";
}

/* ============================
   PROFILE PICTURE HANDLING
============================ */
function initProfilePictureHandler() {
    const profilePicPreview = document.getElementById("profilePicPreview");
    const profilePicFileInput = document.getElementById("profilePicFileInput");

    if (!profilePicPreview || !profilePicFileInput) return;

    profilePicFileInput.addEventListener("change", () => {
        const file = profilePicFileInput.files[0];
        if (!file) return;

        const img = new Image();
        const reader = new FileReader();

        reader.onload = (e) => img.src = e.target.result;
        img.onload = () => compressAndUpload(img);
        reader.readAsDataURL(file);
    });
}

function compressAndUpload(img) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    const MAX_WIDTH = 300;
    const scale = MAX_WIDTH / img.width;

    canvas.width = MAX_WIDTH;
    canvas.height = img.height * scale;

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    let quality = 0.25;
    let base64 = canvas.toDataURL("image/jpeg", quality);

    // Iterative compression to stay under ~120KB
    while (base64.length > 120000 && quality > 0.1) {
        quality -= 0.05;
        base64 = canvas.toDataURL("image/jpeg", quality);
    }

    document.getElementById("profilePicPreview").src = base64;
    saveProfilePic(base64);
}

async function saveProfilePic(base64) {
    const user = JSON.parse(localStorage.getItem("contact_user"));
    if (!user) return;

    showLoader("Updating picture...");

    try {
        const res = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify({
                module: "updateProfilePicURL",
                email: user.email,
                profilePic: base64
            })
        });

        const data = await res.json();

        if (data.success) {
            user.profilePic = base64;
            localStorage.setItem("contact_user", JSON.stringify(user));
            showLoader("Picture updated!");
            setTimeout(hideLoader, 1000);
        } else {
            hideLoader();
            showPopup("Update Failed", data.message || "Could not update picture.");
        }
    } catch (err) {
        hideLoader();
        showPopup("Network Error", "Could not reach the server.");
    }
}

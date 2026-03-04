const API_URL = "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

/* ============================
   POPUP SYSTEM
============================ */
function showPopup(title, message) {
    const titleEl = document.getElementById("popupTitle");
    const msgEl = document.getElementById("popupMessage");
    if (titleEl) titleEl.innerText = title;
    if (msgEl) msgEl.innerText = message;

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
    const navLinksHTML = `
        <a href="dashboard.html">Dashboard</a>
        <a href="communities.html">Communities</a>
        <a href="events.html">Events</a>
        <a href="contacts.html">Contacts</a>
        <a href="profile.html">Profile</a>
        <a href="#" onclick="logout()" style="color:#ff4a4a !important;">Logout</a>
    `;

    const navbar = document.getElementById("navbar");
    if (navbar) {
        navbar.innerHTML = `
            <div class="hamburger" onclick="toggleMenu()">
                <span></span><span></span><span></span>
            </div>
            <div class="logo">Contact<span>.</span>com</div>
            <div class="nav-links">${navLinksHTML}</div>
        `;
    }

    const mobileMenu = document.getElementById("mobileMenu");
    if (mobileMenu) {
        mobileMenu.innerHTML = navLinksHTML;
        mobileMenu.querySelectorAll("a").forEach(link => {
            link.addEventListener("click", () => {
                mobileMenu.classList.remove("show");
            });
        });
    }
}

// Close menu when clicking outside
document.addEventListener("click", (e) => {
    const menu = document.getElementById("mobileMenu");
    const hamburger = document.querySelector(".hamburger");
    if (menu && menu.classList.contains("show") && !menu.contains(e.target) && !hamburger.contains(e.target)) {
        menu.classList.remove("show");
    }
});

/* ============================
   LOADER
============================ */
function showLoader(text) {
    const loader = document.getElementById("profileLoader");
    if (!loader) return;
    const textEl = loader.querySelector("p"); 
    if (textEl) textEl.innerText = text;
    loader.style.display = "flex";
}

function hideLoader() {
    const loader = document.getElementById("profileLoader");
    if (loader) loader.style.display = "none";
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

    // FIXED: The user object often uses 'name' from Google Sheets on first login.
    // We check both keys so the name appears immediately.
    const nameToDisplay = user.fullName || user.name || "";

    setText("fullNameDisplay", nameToDisplay);
    setText("professionDisplay", user.profession || "Your profession");

    setInput("fullName", nameToDisplay);
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
    return el ? el.value.trim() : "";
}

/* ============================
   EDITING LOGIC
============================ */
function enableEditing() {
    document.querySelectorAll("#fullName, #profession, #about, #skills, #workLife")
            .forEach((el) => (el.disabled = false));

    document.getElementById("saveBtn").style.display = "block";
    document.getElementById("editBtn").style.display = "none";
}

function disableEditing() {
    document.querySelectorAll("#fullName, #profession, #about, #skills, #workLife")
            .forEach((el) => (el.disabled = true));

    document.getElementById("saveBtn").style.display = "none";
    document.getElementById("editBtn").style.display = "block";
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

    // Update Local Storage immediately for instant UI feedback
    localStorage.setItem("contact_user", JSON.stringify(updatedUser));
    loadProfile();
    disableEditing();

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
        } else {
            hideLoader();
            showPopup("Update Failed", result.message || "Could not sync with database.");
        }
    } catch (e) {
        hideLoader();
        showPopup("Network Error", "Saved locally, but server connection failed.");
    }
}

/* ============================
   ACCOUNT SETTINGS
============================ */
async function changePassword() {
    const user = JSON.parse(localStorage.getItem("contact_user"));
    const newPass = getVal("newPassword");
    const confirmPass = getVal("confirmPassword");

    if (!newPass || newPass !== confirmPass) {
        return showPopup("Error", "Passwords do not match.");
    }

    showLoader("Updating password...");
    try {
        const res = await fetch(`${API_URL}?module=changePassword&email=${encodeURIComponent(user.email)}&newPassword=${encodeURIComponent(newPass)}`);
        const result = await res.json();
        if (result.success) {
            showLoader("Password Updated!");
            setTimeout(hideLoader, 1000);
        } else {
            hideLoader();
            showPopup("Error", result.message);
        }
    } catch (e) {
        hideLoader();
        showPopup("Error", "Server unreachable.");
    }
}

async function confirmDeleteAccount() {
    const user = JSON.parse(localStorage.getItem("contact_user"));
    hideDeleteConfirm();
    showLoader("Deleting account...");

    try {
        const res = await fetch(`${API_URL}?module=deleteAccount&email=${encodeURIComponent(user.email)}`);
        const result = await res.json();
        if (result.success) {
            logout();
        } else {
            hideLoader();
            showPopup("Error", result.message);
        }
    } catch (e) {
        hideLoader();
        showPopup("Error", "Network error.");
    }
}

function logout() {
    localStorage.removeItem("contact_user");
    window.location.href = "index.html";
}

/* ============================
   PROFILE PICTURE
============================ */
function initProfilePictureHandler() {
    const preview = document.getElementById("profilePicPreview");
    const input = document.getElementById("profilePicFileInput");

    if (!preview || !input) return;

    preview.addEventListener("click", () => input.click());

    input.addEventListener("change", () => {
        const file = input.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => compressAndUpload(img);
            img.src = e.target.result;
        };
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

    while (base64.length > 110000 && quality > 0.1) {
        quality -= 0.05;
        base64 = canvas.toDataURL("image/jpeg", quality);
    }

    document.getElementById("profilePicPreview").src = base64;
    saveProfilePic(base64);
}

async function saveProfilePic(base64) {
    const user = JSON.parse(localStorage.getItem("contact_user"));
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
            showLoader("Picture Updated!");
            setTimeout(hideLoader, 1000);
        }
    } catch (err) {
        hideLoader();
        showPopup("Error", "Upload failed.");
    }
}

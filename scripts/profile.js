const API_URL = "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

document.addEventListener("DOMContentLoaded", () => {
    loadNavbar();
    loadProfile();
    initPhotoListener();
});

/* --- NAVBAR & SIDEBAR --- */
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
    if(mob) mob.innerHTML = `<a href="dashboard.html">Dashboard</a><a href="communities.html">Communities</a><a href="events.html">Events</a><a href="profile.html">Profile</a><a href="#" onclick="logout()" style="border-bottom:none;">Logout</a>`;
}

function toggleMenu() { document.getElementById("mobileMenu").classList.toggle("show"); }

/* --- PROFILE LOADING --- */
async function loadProfile() {
    const user = JSON.parse(localStorage.getItem("contact_user"));
    if (!user) return window.location.href = "login.html";

    const hiddenUser = document.getElementById("username_hidden");
    if(hiddenUser) hiddenUser.value = user.email;

    // Support both casings from database
    const name = user.fullName || user.FullName || "User Name";
    const prof = user.profession || user.Profession || "";
    
    document.getElementById("fullNameDisplay").innerText = name;
    document.getElementById("professionDisplay").innerText = prof;
    
    document.getElementById("fullName").value = name;
    document.getElementById("profession").value = prof;
    document.getElementById("about").value = user.about || "";
    
    // Load skills and worklife if you have those IDs in your HTML
    if(document.getElementById("skills")) document.getElementById("skills").value = user.skills || "";
    if(document.getElementById("workLife")) document.getElementById("workLife").value = user.workLife || "";

    if (user.profilePic) {
        document.getElementById("profilePicPreview").src = user.profilePic;
    }
}

/* --- PHOTO UPLOAD (RECORDS TO COLUMN 9) --- */
function initPhotoListener() {
    const fileInput = document.getElementById("profilePicFileInput");
    if (!fileInput) return;

    fileInput.addEventListener("change", function() {
        const file = this.files[0];
        if (!file) return;

        // Keep it under 1MB for Google Apps Script stability
        if (file.size > 1024 * 1024) {
            showPopup("Error", "Image too large. Use a file under 1MB.");
            return;
        }

        const reader = new FileReader();
        reader.onloadend = async function() {
            const base64String = reader.result;
            document.getElementById("profilePicPreview").src = base64String;
            await uploadPhoto(base64String);
        };
        reader.readAsDataURL(file);
    });
}

async function uploadPhoto(base64Data) {
    const user = JSON.parse(localStorage.getItem("contact_user"));
    showLoader("Recording Photo...");

    try {
        // MUST use POST for long Base64 strings to avoid 414 errors
        await fetch(API_URL, {
            method: "POST",
            mode: "no-cors", 
            cache: "no-cache",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                module: "uploadProfilePic",
                email: user.email,
                imageData: base64Data
            })
        });

        // Update locally since no-cors won't return a readable success body
        user.profilePic = base64Data;
        localStorage.setItem("contact_user", JSON.stringify(user));
        showPopup("Success", "Profile picture recorded! Refresh to see changes.");
    } catch (e) {
        showPopup("Error", "Connection error during upload.");
    } finally {
        hideLoader();
    }
}

/* --- SAVE DETAILS (COLUMNS 2, 5, 6, 7, 8) --- */
async function saveProfile() {
    const user = JSON.parse(localStorage.getItem("contact_user"));
    const updated = {
        ...user,
        fullName: document.getElementById("fullName").value,
        profession: document.getElementById("profession").value,
        about: document.getElementById("about").value,
        skills: document.getElementById("skills") ? document.getElementById("skills").value : "",
        workLife: document.getElementById("workLife") ? document.getElementById("workLife").value : ""
    };

    showLoader("Saving Details...");
    try {
        const q = new URLSearchParams({ 
            module: "saveProfile", 
            email: user.email, 
            fullName: updated.fullName, 
            profession: updated.profession, 
            about: updated.about,
            skills: updated.skills,
            workLife: updated.workLife
        });
        const res = await fetch(`${API_URL}?${q.toString()}`);
        const data = await res.json();
        if (data.success) {
            localStorage.setItem("contact_user", JSON.stringify(updated));
            showPopup("Success", "Details saved!");
            setTimeout(() => location.reload(), 1500);
        }
    } catch (e) { showPopup("Error", "Save failed."); }
    finally { hideLoader(); }
}

/* --- SECURITY & POPUPS --- */
function enableEditing() {
    document.querySelectorAll(".section input, .section textarea").forEach(el => {
        if(el.type !== "password" && el.id !== "username_hidden") el.disabled = false;
    });
    document.getElementById("saveBtn").style.display = "inline-block";
    document.getElementById("editBtn").style.display = "none";
}

function logout() { localStorage.removeItem("contact_user"); window.location.href = "index.html"; }

function showLoader(t) { 
    const l = document.getElementById("profileLoader");
    if(l) { l.querySelector(".loading-text").innerText = t; l.style.display = "flex"; }
}
function hideLoader() { const l = document.getElementById("profileLoader"); if(l) l.style.display = "none"; }

function showPopup(title, msg) {
    const t = document.getElementById("popupTitle");
    const m = document.getElementById("popupMessage");
    const b = document.getElementById("popupBackdrop");
    const p = document.getElementById("mainPopup");
    if(t && m && b && p) {
        t.innerText = title; m.innerText = msg;
        b.style.display = "flex"; p.style.display = "block";
    }
}
function hidePopup() { 
    document.getElementById("popupBackdrop").style.display = "none";
    document.getElementById("mainPopup").style.display = "none";
}

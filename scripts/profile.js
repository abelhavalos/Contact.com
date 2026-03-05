const API_URL = "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

document.addEventListener("DOMContentLoaded", () => {
    loadNavbar();
    loadProfile();
    initPhotoListener(); // Initialize the listener for the file input
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

    const prof = user.profession || user.Profession || "";
    const name = user.fullName || user.FullName || "User Name";

    document.getElementById("fullNameDisplay").innerText = name;
    document.getElementById("professionDisplay").innerText = prof;
    document.getElementById("fullName").value = name;
    document.getElementById("profession").value = prof;
    document.getElementById("about").value = user.about || "";
    
    if (user.profilePic) {
        document.getElementById("profilePicPreview").src = user.profilePic;
    }
}

/* --- PHOTO UPLOAD LOGIC --- */
function initPhotoListener() {
    const fileInput = document.getElementById("profilePicFileInput");
    if (!fileInput) return;

    fileInput.addEventListener("change", function() {
        const file = this.files[0];
        if (!file) return;

        // Limit size to 1MB to avoid Google Script URL/Payload limits
        if (file.size > 1024 * 1024) {
            showPopup("Error", "Image is too large. Please use a file under 1MB.");
            return;
        }

        const reader = new FileReader();
        reader.onloadend = async function() {
            const base64String = reader.result;
            // Update preview immediately
            document.getElementById("profilePicPreview").src = base64String;
            // Send to database
            await uploadPhoto(base64String);
        };
        reader.readAsDataURL(file);
    });
}

async function uploadPhoto(base64Data) {
    const user = JSON.parse(localStorage.getItem("contact_user"));
    showLoader("Saving photo...");

    try {
        // Using URLSearchParams for a GET request, or switch to POST if your script supports it
        const params = new URLSearchParams({
            module: "uploadProfilePic",
            email: user.email,
            imageData: base64Data
        });

        const res = await fetch(`${API_URL}?${params.toString()}`);
        const data = await res.json();

        if (data.success) {
            user.profilePic = base64Data;
            localStorage.setItem("contact_user", JSON.stringify(user));
            showPopup("Success", "Profile picture saved!");
        } else {
            showPopup("Error", "Failed to save photo to server.");
        }
    } catch (e) {
        showPopup("Error", "Connection error during upload.");
    } finally {
        hideLoader();
    }
}

/* --- PROFILE DETAILS SAVE --- */
async function saveProfile() {
    const user = JSON.parse(localStorage.getItem("contact_user"));
    const updated = {
        ...user,
        fullName: document.getElementById("fullName").value,
        profession: document.getElementById("profession").value,
        about: document.getElementById("about").value
    };

    showLoader("Saving Changes...");
    try {
        const q = new URLSearchParams({ 
            module: "saveProfile", 
            email: user.email, 
            fullName: updated.fullName, 
            profession: updated.profession, 
            about: updated.about 
        });
        const res = await fetch(`${API_URL}?${q.toString()}`);
        const data = await res.json();
        if (data.success) {
            localStorage.setItem("contact_user", JSON.stringify(updated));
            showPopup("Success", "Profile updated successfully!");
            location.reload(); 
        }
    } catch (e) { showPopup("Error", "Could not save profile."); }
    finally { hideLoader(); }
}

/* --- SECURITY FUNCTIONS --- */
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
            showPopup("Success", "Email updated!");
        }
    } catch (e) { showPopup("Error", "Network error."); }
    finally { hideLoader(); }
}

async function changePassword() {
    const user = JSON.parse(localStorage.getItem("contact_user"));
    const newPass = document.getElementById("newPassword").value;
    if (newPass !== document.getElementById("confirmPassword").value) return showPopup("Error", "Passwords mismatch!");
    showLoader("Updating Password...");
    try {
        const res = await fetch(`${API_URL}?module=changePassword&email=${user.email}&newPassword=${encodeURIComponent(newPass)}`);
        const data = await res.json();
        if(data.success) showPopup("Success", "Password changed!");
    } catch (e) { showPopup("Error", "Network error."); }
    finally { hideLoader(); }
}

/* --- UI HELPERS --- */
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
        t.innerText = title;
        m.innerText = msg;
        b.style.display = "flex";
        p.style.display = "block";
    }
}
function hidePopup() { 
    document.getElementById("popupBackdrop").style.display = "none";
}

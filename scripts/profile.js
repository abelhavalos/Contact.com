const API_URL = "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

document.addEventListener("DOMContentLoaded", () => {
    loadNavbar();
    loadProfile();
    initPhotoListener();
});

/* --- PHOTO UPLOAD LOGIC (FIXED FOR CONNECTION ERRORS) --- */
function initPhotoListener() {
    const fileInput = document.getElementById("profilePicFileInput");
    if (!fileInput) return;

    fileInput.addEventListener("change", function() {
        const file = this.files[0];
        if (!file) return;

        // Limit to 1MB to stay within Google Apps Script limits
        if (file.size > 1024 * 1024) {
            showPopup("Error", "Image is too large. Please use a file under 1MB.");
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
    showLoader("Saving photo...");

    try {
        // CHANGED TO POST: Sends data in the body to avoid URL length errors
        const response = await fetch(API_URL, {
            redirect: "follow",
            method: "POST",
            body: JSON.stringify({
                module: "uploadProfilePic",
                email: user.email,
                imageData: base64Data
            }),
            headers: { "Content-Type": "text/plain;charset=utf-8" }
        });

        const data = await response.json();

        if (data.success) {
            user.profilePic = base64Data;
            localStorage.setItem("contact_user", JSON.stringify(user));
            showPopup("Success", "Profile picture saved!");
        } else {
            showPopup("Error", data.message || "Failed to save photo.");
        }
    } catch (e) {
        console.error(e);
        showPopup("Error", "Connection error. Image might be too large for the server.");
    } finally {
        hideLoader();
    }
}

/* --- POPUP LOGIC (FIXED TO CLOSE PROPERLY) --- */
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
    // This now hides both the backdrop and the popup box
    document.getElementById("popupBackdrop").style.display = "none";
    document.getElementById("mainPopup").style.display = "none";
    document.getElementById("deleteConfirmPopup").style.display = "none";
}

/* --- REMAINDER OF SCRIPT (loadProfile, saveProfile, etc.) --- */
// ... (Keep your existing loadNavbar, loadProfile, and saveProfile functions here)

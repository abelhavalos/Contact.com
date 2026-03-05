const API_URL = "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

/* ============================
   INIT & AUTH
============================ */
document.addEventListener("DOMContentLoaded", () => {
  const user = JSON.parse(localStorage.getItem("contact_user"));
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  
  loadNavbar();
  loadProfile();
  initProfilePictureHandler();
});

/* ============================
   NAVBAR (Synchronized)
============================ */
function toggleMenu() {
  const menu = document.getElementById("mobileMenu");
  if (menu) menu.classList.toggle("show");
}

function loadNavbar() {
  const nav = `
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
            <a href="#" onclick="logout()">Logout</a>
        </div>
    `;
  document.getElementById("navbar").innerHTML = nav;

  document.getElementById("mobileMenu").innerHTML = `
        <a href="dashboard.html">Dashboard</a>
        <a href="communities.html">Communities</a>
        <a href="events.html">Events</a>
        <a href="contacts.html">Contacts</a>
        <a href="profile.html">Profile</a>
        <a href="#" onclick="logout()">Logout</a>
    `;
}

function logout() {
  localStorage.removeItem("contact_user");
  window.location.href = "index.html";
}

/* ============================
   LOAD PROFILE
============================ */
async function loadProfile() {
  const user = JSON.parse(localStorage.getItem("contact_user"));
  if (!user) return;

  hideLoader();

  setText("fullNameDisplay", user.fullName || user.FullName);
  setText("professionDisplay", user.profession || "Your profession");

  setInput("fullName", user.fullName || user.FullName);
  setInput("profession", user.profession);
  setInput("about", user.about);
  setInput("skills", user.skills);
  setInput("workLife", user.workLife);

  if (user.profilePic || user.ProfilePic) {
    const pic = document.getElementById("profilePicPreview");
    if (pic) pic.src = user.profilePic || user.ProfilePic;
  }
}

/* ============================
   SAVE PROFILE
============================ */
function enableEditing() {
  document
    .querySelectorAll("#fullName, #profession, #about, #skills, #workLife")
    .forEach((el) => (el.disabled = false));

  document.getElementById("saveBtn").style.display = "inline-block";
  document.getElementById("editBtn").style.display = "none";
}

async function saveProfile() {
  const user = JSON.parse(localStorage.getItem("contact_user"));
  if (!user) return;

  const updatedFields = {
    fullName: getVal("fullName"),
    profession: getVal("profession"),
    about: getVal("about"),
    skills: getVal("skills"),
    workLife: getVal("workLife"),
  };

  const updatedUser = { ...user, ...updatedFields };
  localStorage.setItem("contact_user", JSON.stringify(updatedUser));
  loadProfile();

  showLoader("Saving changes...");

  const url = `${API_URL}?module=saveProfile` +
    `&email=${encodeURIComponent(user.email)}` +
    `&fullName=${encodeURIComponent(updatedFields.fullName)}` +
    `&profession=${encodeURIComponent(updatedFields.profession)}` +
    `&about=${encodeURIComponent(updatedFields.about)}` +
    `&skills=${encodeURIComponent(updatedFields.skills)}` +
    `&workLife=${encodeURIComponent(updatedFields.workLife)}`;

  try {
    const res = await fetch(url);
    const result = await res.json();

    if (result.success) {
      showLoader("Profile updated!");
      setTimeout(() => {
        hideLoader();
        location.reload(); // Lock inputs again
      }, 800);
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
   PICTURE HANDLING (Base64 Fix)
============================ */
function initProfilePictureHandler() {
  const preview = document.getElementById("profilePicPreview");
  const input = document.getElementById("profilePicFileInput");

  if (!preview || !input) return;

  preview.addEventListener("click", () => input.click());

  input.addEventListener("change", async () => {
    const file = input.files[0];
    if (!file) return;

    // Convert to Base64 so it can be stored in the database
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result;
      preview.src = base64String;
      await uploadProfilePic(base64String);
    };
    reader.readAsDataURL(file);
  });
}

async function uploadProfilePic(base64Data) {
  const user = JSON.parse(localStorage.getItem("contact_user"));
  showLoader("Uploading photo...");

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        module: "updateProfilePic",
        email: user.email,
        profilePic: base64Data
      })
    });
    const data = await res.json();

    if (data.success) {
      user.profilePic = base64Data;
      localStorage.setItem("contact_user", JSON.stringify(user));
      showLoader("Photo updated!");
      setTimeout(hideLoader, 800);
    } else {
      hideLoader();
      showPopup("Upload Failed", "Server could not save image.");
    }
  } catch (err) {
    hideLoader();
    showPopup("Error", "Network error during upload.");
  }
}

/* ============================
   HELPERS & POPUPS
============================ */
function showLoader(text) {
  const loader = document.getElementById("profileLoader");
  if (loader) {
    loader.querySelector(".loading-text").innerText = text;
    loader.style.display = "flex";
  }
}

function hideLoader() {
  const loader = document.getElementById("profileLoader");
  if (loader) loader.style.display = "none";
}

function showPopup(title, message) {
  document.getElementById("popupTitle").innerText = title;
  document.getElementById("popupMessage").innerText = message;
  document.getElementById("deleteConfirmPopup").style.display = "none";
  document.getElementById("mainPopup").style.display = "block";
  document.getElementById("popupBackdrop").style.display = "flex";
}

function hidePopup() {
  document.getElementById("popupBackdrop").style.display = "none";
}

function showDeleteConfirm() {
  document.getElementById("mainPopup").style.display = "none";
  document.getElementById("deleteConfirmPopup").style.display = "block";
  document.getElementById("popupBackdrop").style.display = "flex";
}

function hideDeleteConfirm() {
  document.getElementById("popupBackdrop").style.display = "none";
}

function setText(id, val) { const el = document.getElementById(id); if (el) el.innerText = val || ""; }
function setInput(id, val) { const el = document.getElementById(id); if (el) el.value = val || ""; }
function getVal(id) { const el = document.getElementById(id); return el ? el.value : ""; }

// Include your existing changeEmail, changePassword, and confirmDeleteAccount below...

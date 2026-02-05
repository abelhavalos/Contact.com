const API_URL =
  "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

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
   NAVBAR
============================ */
function toggleMenu() {
  document.getElementById("mobileMenu").classList.toggle("show");
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

/* ============================
   LOADER
============================ */
function showLoader(text) {
  const loader = document.getElementById("profileLoader");
  loader.querySelector(".loading-text").innerText = text;
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

  // Load profile picture (correct field name)
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

  document.getElementById("saveBtn").style.display = "inline-block";
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

  showLoader("Saving changes…");

  const url =
    `${API_URL}?module=saveProfile` +
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
      setTimeout(hideLoader, 600);
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
   CHANGE EMAIL
============================ */
async function changeEmail() {
  const user = JSON.parse(localStorage.getItem("contact_user"));
  if (!user) return (window.location.href = "login.html");

  const newEmail = getVal("newEmail").trim();
  if (!newEmail) {
    showPopup("Missing Email", "Please enter a new email.");
    return;
  }

  const updatedUser = { ...user, email: newEmail };
  localStorage.setItem("contact_user", JSON.stringify(updatedUser));

  showLoader("Updating email…");

  const url =
    `${API_URL}?module=changeEmail` +
    `&oldEmail=${encodeURIComponent(user.email)}` +
    `&newEmail=${encodeURIComponent(newEmail)}`;

  try {
    const res = await fetch(url);
    const result = await res.json();

    if (result.success) {
      showLoader("Email updated!");
      setTimeout(hideLoader, 600);
    } else {
      localStorage.setItem("contact_user", JSON.stringify(user));
      hideLoader();
      showPopup("Update Failed", result.message || "Failed to update email.");
    }
  } catch (e) {
    localStorage.setItem("contact_user", JSON.stringify(user));
    hideLoader();
    showPopup("Network Error", "Could not reach the server.");
  }
}

/* ============================
   CHANGE PASSWORD
============================ */
async function changePassword() {
  const user = JSON.parse(localStorage.getItem("contact_user"));
  if (!user) return (window.location.href = "login.html");

  const newPass = getVal("newPassword");
  const confirmPass = getVal("confirmPassword");

  if (!newPass) {
    showPopup("Missing Password", "Please enter a new password.");
    return;
  }

  if (newPass !== confirmPass) {
    showPopup("Mismatch", "Passwords do not match.");
    return;
  }

  showLoader("Updating password…");

  const url =
    `${API_URL}?module=changePassword` +
    `&email=${encodeURIComponent(user.email)}` +
    `&newPassword=${encodeURIComponent(newPass)}`;

  try {
    const res = await fetch(url);
    const result = await res.json();

    if (result.success) {
      showLoader("Password updated!");
      setTimeout(hideLoader, 600);
    } else {
      hideLoader();
      showPopup("Update Failed", result.message || "Failed to update password.");
    }
  } catch (e) {
    hideLoader();
    showPopup("Network Error", "Could not reach the server.");
  }
}

/* ============================
   DELETE ACCOUNT
============================ */
async function confirmDeleteAccount() {
  const user = JSON.parse(localStorage.getItem("contact_user"));
  hideDeleteConfirm();

  if (!user || !user.email) {
    showPopup("Error", "User not found. Please log in again.");
    return;
  }

  showLoader("Deleting account…");

  const url = `${API_URL}?module=deleteAccount&email=${encodeURIComponent(
    user.email
  )}`;

  try {
    const res = await fetch(url);
    const result = await res.json();

    if (result.success) {
      localStorage.removeItem("contact_user");
      showLoader("Account deleted");
      setTimeout(() => (window.location.href = "signup.html"), 700);
    } else {
      hideLoader();
      showPopup("Delete Failed", result.message || "Could not delete account.");
    }
  } catch (err) {
    hideLoader();
    showPopup("Network Error", "Could not reach the server.");
  }
}

/* ============================
   LOGOUT
============================ */
function logout() {
  localStorage.removeItem("contact_user");
  window.location.href = "index.html";
}

/* ============================
   PROFILE PICTURE HANDLING
============================ */
/* ============================
   PROFILE PICTURE HANDLING (FINAL VERSION)
============================ */
function initProfilePictureHandler() {
  const profilePicPreview = document.getElementById("profilePicPreview");
  const profilePicFileInput = document.getElementById("profilePicFileInput");

  if (!profilePicPreview || !profilePicFileInput) return;

  profilePicPreview.addEventListener("click", () => {
    profilePicFileInput.click();
  });

  profilePicFileInput.addEventListener("change", () => {
    const file = profilePicFileInput.files[0];
    if (!file) return;

    const img = new Image();
    const reader = new FileReader();

    reader.onload = function(e) {
      img.src = e.target.result;
    };

    img.onload = function() {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      // ⭐ Resize large phone images
      const MAX_WIDTH = 600;
      const scale = MAX_WIDTH / img.width;

      canvas.width = MAX_WIDTH;
      canvas.height = img.height * scale;

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // ⭐ Compress to JPEG at 70% quality
      const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7);

      // Instant preview
      profilePicPreview.src = compressedBase64;

      // Save to backend
      saveProfilePic(compressedBase64);
    };

    reader.readAsDataURL(file);
  });
}

async function saveProfilePic(base64) {
  const user = JSON.parse(localStorage.getItem("contact_user"));
  if (!user) return;

  showLoader("Updating picture…");

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
      setTimeout(hideLoader, 600);
    } else {
      hideLoader();
      showPopup("Update Failed", data.message || "Could not update picture.");
    }
  } catch (err) {
    hideLoader();
    showPopup("Network Error", "Could not reach the server.");
  }
}
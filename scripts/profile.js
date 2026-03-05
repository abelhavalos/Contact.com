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
   NAVBAR (UPDATED FOR SHORT SIDEBAR)
============================ */
function toggleMenu() {
  document.getElementById("mobileMenu").classList.toggle("show");
}

function loadNavbar() {
  // Desktop Navbar
  document.getElementById("navbar").innerHTML = `
        <div class="hamburger" onclick="toggleMenu()">
            <span></span><span></span><span></span>
        </div>
        <div class="logo">Contact<span>.</span>com</div>
        <div class="nav-links">
            <a href="dashboard.html">Dashboard</a>
            <a href="communities.html">Communities</a>
            <a href="events.html">Events</a>
            <a href="profile.html">Profile</a>
            <button onclick="logout()" style="background:#4A6CFF; color:white; border:none; padding:8px 15px; border-radius:8px; font-weight:700; cursor:pointer;">Logout</button>
        </div>`;

  // Mobile Menu (Short version)
  document.getElementById("mobileMenu").innerHTML = `
        <a href="dashboard.html">Dashboard</a>
        <a href="communities.html">Communities</a>
        <a href="events.html">Events</a>
        <a href="profile.html">Profile</a>
        <a href="#" onclick="logout()" style="border-bottom:none;">Logout</a>`;
}

/* ============================
   LOADER
============================ */
function showLoader(text) {
  const loader = document.getElementById("profileLoader");
  if(loader) {
    loader.querySelector(".loading-text").innerText = text;
    loader.style.display = "flex";
  }
}

function hideLoader() {
  const loader = document.getElementById("profileLoader");
  if(loader) loader.style.display = "none";
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

  // Fix Password Console Warning context
  const hiddenUser = document.getElementById("username_hidden");
  if(hiddenUser) hiddenUser.value = user.email;

  hideLoader();

  setText("fullNameDisplay", user.fullName || user.FullName);
  setText("professionDisplay", user.profession || user.Profession || "Your profession");

  setInput("fullName", user.fullName || user.FullName);
  setInput("profession", user.profession || user.Profession);
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

  showLoader("Saving changes...");

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
      localStorage.setItem("contact_user", JSON.stringify(updatedUser));
      loadProfile();
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
   CHANGE EMAIL & PASSWORD
============================ */
async function changeEmail() {
  const user = JSON.parse(localStorage.getItem("contact_user"));
  const newEmail = getVal("newEmail").trim();
  if (!newEmail) return showPopup("Missing Email", "Please enter a new email.");

  showLoader("Updating email...");
  const url = `${API_URL}?module=changeEmail&oldEmail=${encodeURIComponent(user.email)}&newEmail=${encodeURIComponent(newEmail)}`;

  try {
    const res = await fetch(url);
    const result = await res.json();
    if (result.success) {
      user.email = newEmail;
      localStorage.setItem("contact_user", JSON.stringify(user));
      showLoader("Email updated!");
      setTimeout(hideLoader, 600);
    } else {
      hideLoader();
      showPopup("Error", result.message);
    }
  } catch (e) { hideLoader(); showPopup("Error", "Server error"); }
}

async function changePassword() {
  const user = JSON.parse(localStorage.getItem("contact_user"));
  const newPass = getVal("newPassword");
  const confirmPass = getVal("confirmPassword");

  if (newPass !== confirmPass) return showPopup("Mismatch", "Passwords do not match.");

  showLoader("Updating password...");
  const url = `${API_URL}?module=changePassword&email=${encodeURIComponent(user.email)}&newPassword=${encodeURIComponent(newPass)}`;

  try {
    const res = await fetch(url);
    const result = await res.json();
    if (result.success) {
      showLoader("Password updated!");
      setTimeout(hideLoader, 600);
    } else {
      hideLoader();
      showPopup("Error", result.message);
    }
  } catch (e) { hideLoader(); showPopup("Error", "Server error"); }
}

/* ============================
   PROFILE PICTURE (PERMANENT FIX)
============================ */
function initProfilePictureHandler() {
  const profilePicPreview = document.getElementById("profilePicPreview");
  const profilePicFileInput = document.getElementById("profilePicFileInput");

  if (!profilePicPreview || !profilePicFileInput) return;

  profilePicPreview.addEventListener("click", () => profilePicFileInput.click());

  profilePicFileInput.addEventListener("change", () => {
    const file = profilePicFileInput.files[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
        showPopup("File Too Large", "Please choose an image under 1MB.");
        return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result; // This is the actual image data
      profilePicPreview.src = base64String; // Preview it
      saveProfilePic(base64String); // Save the actual data to Google
    };
    reader.readAsDataURL(file);
  });
}

async function saveProfilePic(base64Data) {
  const user = JSON.parse(localStorage.getItem("contact_user"));
  showLoader("Uploading photo...");

  try {
    // We use POST because image data is too long for a URL (GET)
    await fetch(API_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({
        module: "uploadProfilePic",
        email: user.email,
        imageData: base64Data
      })
    });

    // Since no-cors doesn't return data, we update local storage manually
    user.profilePic = base64Data;
    localStorage.setItem("contact_user", JSON.stringify(user));
    showLoader("Picture updated!");
    setTimeout(hideLoader, 1000);
    
  } catch (err) {
    hideLoader();
    showPopup("Error", "Could not upload image.");
  }
}

function logout() { localStorage.removeItem("contact_user"); window.location.href = "index.html"; }

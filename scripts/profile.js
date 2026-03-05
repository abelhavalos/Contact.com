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
   NAVBAR (SHORT SIDEBAR VERSION)
============================ */
function toggleMenu() {
  document.getElementById("mobileMenu").classList.toggle("show");
}

function loadNavbar() {
  const navLinks = `
        <a href="dashboard.html">Dashboard</a>
        <a href="communities.html">Communities</a>
        <a href="events.html">Events</a>
        <a href="contacts.html">Contacts</a>
        <a href="profile.html">Profile</a>
        <a href="#" onclick="logout()">Logout</a>
    `;
  
  document.getElementById("navbar").innerHTML = `
        <div class="hamburger" onclick="toggleMenu()">
            <span></span><span></span><span></span>
        </div>
        <div class="logo">Contact<span>.</span>com</div>
        <div class="nav-links">${navLinks}</div>
    `;

  document.getElementById("mobileMenu").innerHTML = navLinks;
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

  // Providing context for browser password managers
  const hiddenUser = document.getElementById("username_hidden");
  if(hiddenUser) hiddenUser.value = user.email;

  hideLoader();

  const name = user.fullName || user.FullName;
  const prof = user.profession || user.Profession;

  setText("fullNameDisplay", name);
  setText("professionDisplay", prof || "Your profession");

  setInput("fullName", name);
  setInput("profession", prof);
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
   LOGOUT / DELETE / CHANGE EMAIL & PASS (Same as your original)
============================ */
function logout() {
  localStorage.removeItem("contact_user");
  window.location.href = "index.html";
}

async function changeEmail() {
  const user = JSON.parse(localStorage.getItem("contact_user"));
  const newEmail = getVal("newEmail").trim();
  if (!newEmail) return showPopup("Error", "Enter new email");
  showLoader("Updating...");
  const url = `${API_URL}?module=changeEmail&oldEmail=${encodeURIComponent(user.email)}&newEmail=${encodeURIComponent(newEmail)}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if(data.success) {
      user.email = newEmail;
      localStorage.setItem("contact_user", JSON.stringify(user));
      showLoader("Updated!");
      setTimeout(hideLoader, 600);
    }
  } catch (e) { hideLoader(); }
}

async function changePassword() {
  const user = JSON.parse(localStorage.getItem("contact_user"));
  const newPass = getVal("newPassword");
  if (newPass !== getVal("confirmPassword")) return showPopup("Error", "Passwords mismatch");
  showLoader("Updating...");
  const url = `${API_URL}?module=changePassword&email=${encodeURIComponent(user.email)}&newPassword=${encodeURIComponent(newPass)}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if(data.success) { showLoader("Updated!"); setTimeout(hideLoader, 600); }
  } catch (e) { hideLoader(); }
}

async function confirmDeleteAccount() {
  const user = JSON.parse(localStorage.getItem("contact_user"));
  hideDeleteConfirm();
  showLoader("Deleting...");
  const url = `${API_URL}?module=deleteAccount&email=${encodeURIComponent(user.email)}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.success) {
      localStorage.removeItem("contact_user");
      window.location.href = "signup.html";
    }
  } catch (e) { hideLoader(); }
}

/* ============================
   PROFILE PICTURE (FIXED FOR PERMANENT SAVING)
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

    // Convert image to Base64 string
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result;
      profilePicPreview.src = base64String; // Preview
      saveProfilePic(base64String); // Save data
    };
    reader.readAsDataURL(file);
  });
}

async function saveProfilePic(base64Data) {
  const user = JSON.parse(localStorage.getItem("contact_user"));
  if (!user) return;

  showLoader("Recording picture...");

  try {
    // Images must use POST because they are too large for the URL
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

    // Update locally
    user.profilePic = base64Data;
    localStorage.setItem("contact_user", JSON.stringify(user));
    showLoader("Picture updated!");
    setTimeout(hideLoader, 800);
    
  } catch (err) {
    hideLoader();
    showPopup("Network Error", "Could not save photo.");
  }
}

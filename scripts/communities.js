const API_URL =
  "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

/* ============================
   POPUP HELPERS
============================ */
function showMessagePopup(title, message) {
  const t = document.getElementById("messageTitle");
  const m = document.getElementById("messageText");
  const b = document.getElementById("messageBackdrop");
  if (!t || !m || !b) return;
  t.innerText = title;
  m.innerText = message;
  b.style.display = "flex";
}

function hideMessagePopup() {
  const b = document.getElementById("messageBackdrop");
  if (b) b.style.display = "none";
}

/* ============================
   NAVBAR
============================ */
function toggleMenu() {
  const menu = document.getElementById("mobileMenu");
  if (menu) menu.classList.toggle("show");
}

function loadNavbar() {
  const user = JSON.parse(localStorage.getItem("contact_user"));
  const navbar = document.getElementById("navbar");
  const mobileMenu = document.getElementById("mobileMenu");
  if (!navbar || !mobileMenu) return;

  const loggedInNav = `
    <div class="hamburger" onclick="toggleMenu()">
      <span></span><span></span><span></span>
    </div>
    <div class="logo">Contact<span>.</span>com</div>
    <div class="nav-links">
      <a href="dashboard.html">Dashboard</a>
      <a href="communities.html">Communities</a>
      <a href="contacts.html">Contacts</a>
      <a href="profile.html">Profile</a>
      <a href="#" onclick="logout()">Logout</a>
    </div>
  `;

  const publicNav = `
    <div class="hamburger" onclick="toggleMenu()">
      <span></span><span></span><span></span>
    </div>
    <div class="logo">Contact<span>.</span>com</div>
    <div class="nav-links">
      <a href="index.html">Home</a>
      <a href="communities.html">Communities</a>
      <a href="login.html">Login</a>
      <button class="btn-primary" onclick="window.location.href='signup.html'">Sign Up</button>
    </div>
  `;

  navbar.innerHTML = user ? loggedInNav : publicNav;

  mobileMenu.innerHTML = user
    ? `
      <a href="dashboard.html">Dashboard</a>
      <a href="communities.html">Communities</a>
      <a href="contacts.html">Contacts</a>
      <a href="profile.html">Profile</a>
      <a href="#" onclick="logout()">Logout</a>
    `
    : `
      <a href="index.html">Home</a>
      <a href="communities.html">Communities</a>
      <a href="login.html">Login</a>
      <button class="btn-primary" onclick="window.location.href='signup.html'">Sign Up</button>
    `;
}

function loadCreateCommunityButton() {
  const user = JSON.parse(localStorage.getItem("contact_user"));
  const wrapper = document.getElementById("createCommunityWrapper");
  if (!wrapper) return;

  if (user) {
    wrapper.innerHTML = `
      <button class="btn-primary" onclick="openCreateCommunityPopup()">
        Create Community
      </button>
    `;
  } else {
    wrapper.innerHTML = "";
  }
}

/* ============================
   CREATE COMMUNITY POPUP
============================ */
function openCreateCommunityPopup() {
  const b = document.getElementById("createCommunityBackdrop");
  if (b) b.style.display = "flex";
}

function closeCreateCommunityPopup() {
  const b = document.getElementById("createCommunityBackdrop");
  if (b) b.style.display = "none";
}

/* ============================
   COMMUNITY IMAGE HANDLING
   (mirrors profile.js compression)
============================ */
function initCommunityImageHandler() {
  const picker = document.getElementById("communityImagePicker");
  const preview = document.getElementById("communityImagePreview");
  const input = document.getElementById("communityImageInput");

  if (!picker || !preview || !input) return;

  picker.addEventListener("click", () => {
    input.click();
  });

  input.addEventListener("change", () => {
    const file = input.files[0];
    if (!file) return;

    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target.result;
    };

    img.onload = () => {
      compressCommunityImage(img);
    };

    reader.readAsDataURL(file);
  });
}

function compressCommunityImage(img) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  const MAX_WIDTH = 300;
  const scale = MAX_WIDTH / img.width;

  canvas.width = MAX_WIDTH;
  canvas.height = img.height * scale;

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  let base64 = canvas.toDataURL("image/jpeg", 0.25);

  if (base64.length > 120000) {
    base64 = canvas.toDataURL("image/jpeg", 0.20);
  }
  if (base64.length > 120000) {
    base64 = canvas.toDataURL("image/jpeg", 0.18);
  }
  if (base64.length > 120000) {
    base64 = canvas.toDataURL("image/jpeg", 0.15);
  }

  const preview = document.getElementById("communityImagePreview");
  if (preview) preview.src = base64;

  window.communityImageBase64 = base64;
}

/* ============================
   CREATE COMMUNITY (OPTIMISTIC + IMAGE)
============================ */
async function submitCommunity() {
  const nameEl = document.getElementById("communityTitle");
  const descEl = document.getElementById("communityDescription");
  if (!nameEl || !descEl) return;

  const name = nameEl.value.trim();
  const description = descEl.value.trim();
  const user = JSON.parse(localStorage.getItem("contact_user"));

  if (!user) {
    window.location.href = "login.html";
    return;
  }

  if (!name || !description) {
    showMessagePopup("Missing Fields", "Please fill out all fields.");
    return;
  }

  const imageBase64 = window.communityImageBase64 || "";

  closeCreateCommunityPopup();

  const tempId = "temp-" + Date.now();
  const grid = document.getElementById("communityGrid");
  if (!grid) return;

  const tempImgHtml = imageBase64
    ? `<img src="${imageBase64}" class="community-card-image">`
    : "";

  grid.insertAdjacentHTML(
    "afterbegin",
    `
    <div class="card" data-community="${tempId}">
      <h3>${name}</h3>
      ${tempImgHtml}
      <p>${description}</p>
      <button class="btn-primary" disabled>Saving...</button>
    </div>
  `
  );

  showMessagePopup("Success", "Community created!");

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        module: "createCommunity",
        name,
        description,
        email: user.email,
        imageBase64
      })
    });

    const data = await res.json();

    if (!data.success) {
      document.querySelector(`[data-community="${tempId}"]`)?.remove();
      showMessagePopup("Error", data.message || "Failed to save community.");
      return;
    }

    const tempCard = document.querySelector(
      `[data-community="${tempId}"]`
    );

    const finalImgHtml = data.imageUrl
      ? `<img src="${data.imageUrl}" class="community-card-image">`
      : tempImgHtml;

    if (tempCard) {
      tempCard.outerHTML = `
        <div class="card" data-community="${data.id}">
          <h3>${data.name || name}</h3>
          ${finalImgHtml}
          <p>${data.description || description}</p>
          <button class="btn-primary" onclick="joinCommunity('${data.id}')">Join</button>
          <button class="delete-btn" onclick="deleteCommunity('${data.id}')">Delete</button>
        </div>
      `;
    }
  } catch (err) {
    document.querySelector(`[data-community="${tempId}"]`)?.remove();
    showMessagePopup("Network Error", "Please try again.");
  }
}

/* ============================
   FAST COMMUNITIES LOADING
============================ */
let allCommunities = [];
let index = 0;
const BATCH = 20;

function loadCachedCommunities() {
  const cached = localStorage.getItem("cached_communities");
  if (!cached) return;

  try {
    allCommunities = JSON.parse(cached);
  } catch {
    allCommunities = [];
    return;
  }

  index = 0;
  const grid = document.getElementById("communityGrid");
  if (!grid) return;

  grid.innerHTML = "";
  grid.style.opacity = "0";
  setTimeout(() => (grid.style.opacity = "1"), 50);

  renderNextBatch();
}

async function fetchCommunities(force = false) {
  try {
    const res = await fetch(`${API_URL}?module=getAllCommunities`);
    const data = await res.json();
    if (!data.success || !Array.isArray(data.communities)) return;

    const hadCache = !!localStorage.getItem("cached_communities");
    localStorage.setItem(
      "cached_communities",
      JSON.stringify(data.communities)
    );

    if (!force && hadCache) return;

    allCommunities = data.communities;
    index = 0;

    const grid = document.getElementById("communityGrid");
    if (!grid) return;
    grid.innerHTML = "";
    renderNextBatch();
  } catch {
    // silent background failure
  }
}

function renderNextBatch() {
  if (!allCommunities.length) return;
  const slice = allCommunities.slice(index, index + BATCH);
  appendCommunities(slice);
  index += BATCH;
}

function appendCommunities(list) {
  const grid = document.getElementById("communityGrid");
  if (!grid) return;

  const user = JSON.parse(localStorage.getItem("contact_user"));

  list.forEach((c) => {
    const isCreator = user && user.email === c.creator;

    const imgHtml = c.imageUrl
      ? `<img src="${c.imageUrl}" class="community-card-image">`
      : "";

    grid.innerHTML += `
      <div class="card" data-community="${c.id}">
        <h3>${c.name}</h3>
        ${imgHtml}
        <p>${c.description}</p>
        ${
          isCreator
            ? `
          <button class="delete-btn" onclick="deleteCommunity('${c.id}')">Delete</button>
          <button class="btn-primary" onclick="joinCommunity('${c.id}')">Join</button>
        `
            : `
          <button class="btn-primary" onclick="joinCommunity('${c.id}')">Join</button>
        `
        }
      </div>
    `;
  });
}

window.addEventListener("scroll", () => {
  if (
    window.innerHeight + window.scrollY >=
    document.body.offsetHeight - 200
  ) {
    renderNextBatch();
  }
});

/* ============================
   JOIN / DELETE COMMUNITY
============================ */
async function joinCommunity(id) {
  const user = JSON.parse(localStorage.getItem("contact_user"));
  if (!user) {
    window.location.href = "signup.html";
    return;
  }

  fetch(
    `${API_URL}?module=joinCommunity&communityId=${encodeURIComponent(
      id
    )}&email=${encodeURIComponent(user.email)}`
  ).catch(() => {});

  window.location.href = `messages.html?mode=community&communityId=${encodeURIComponent(
    id
  )}`;
}

async function deleteCommunity(id) {
  const user = JSON.parse(localStorage.getItem("contact_user"));
  if (!user) return;

  const card = document.querySelector(`[data-community="${id}"]`);
  if (card) card.remove();

  let cached = [];
  try {
    cached = JSON.parse(
      localStorage.getItem("cached_communities") || "[]"
    );
  } catch {
    cached = [];
  }

  cached = cached.filter((c) => c.id !== id);
  localStorage.setItem("cached_communities", JSON.stringify(cached));

  allCommunities = allCommunities.filter((c) => c.id !== id);

  showMessagePopup("Deleted", "Community removed.");

  try {
    const res = await fetch(
      `${API_URL}?module=deleteCommunity&communityId=${encodeURIComponent(
        id
      )}&email=${encodeURIComponent(user.email)}`
    );
    const data = await res.json();

    if (!data.success) {
      const grid = document.getElementById("communityGrid");
      if (!grid) return;

      const imgHtml = data.imageUrl
        ? `<img src="${data.imageUrl}" class="community-card-image">`
        : "";

      grid.insertAdjacentHTML(
        "afterbegin",
        `
        <div class="card" data-community="${id}">
          <h3>${data.name || "Community"}</h3>
          ${imgHtml}
          <p>${data.description || ""}</p>
          <button class="delete-btn" onclick="deleteCommunity('${id}')">Delete</button>
          <button class="btn-primary" onclick="joinCommunity('${id}')">Join</button>
        </div>
      `
      );

      cached.push({
        id,
        name: data.name,
        description: data.description,
        imageUrl: data.imageUrl || "",
        creator: user.email
      });
      localStorage.setItem("cached_communities", JSON.stringify(cached));

      showMessagePopup("Error", data.message || "Failed to delete community.");
    }
  } catch {
    showMessagePopup("Network Error", "Could not reach the server.");
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
   INIT
============================ */
document.addEventListener("DOMContentLoaded", () => {
  loadNavbar();
  loadCreateCommunityButton();
  initCommunityImageHandler();
  loadCachedCommunities();
  fetchCommunities();
});

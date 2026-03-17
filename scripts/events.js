const API_URL = "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

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

  const navLinksHTML = user ? `
      <a href="dashboard.html">Dashboard</a>
      <a href="communities.html">Communities</a>
      <a href="events.html">Events</a>
      <a href="contacts.html">Contacts</a>
      <a href="profile.html">Profile</a>
      <a href="#" onclick="logout()" style="color:#ff3b3b !important;">Logout</a>
  ` : `
      <a href="index.html">Home</a>
      <a href="communities.html">Communities</a>
      <a href="events.html">Events</a>
      <a href="login.html">Login</a>
      <button class="btn-primary" onclick="window.location.href='signup.html'">Sign Up</button>
  `;

  navbar.innerHTML = `
    <div class="hamburger" onclick="toggleMenu()"><span></span><span></span><span></span></div>
    <div class="logo">Contact<span>.</span>com</div>
    <div class="nav-links">${navLinksHTML}</div>
  `;

  mobileMenu.innerHTML = navLinksHTML;
}

function loadCreateEventButton() {
  const user = JSON.parse(localStorage.getItem("contact_user"));
  const wrapper = document.getElementById("createEventWrapper");
  if (!wrapper) return;

  if (user) {
    wrapper.innerHTML = `<button class="btn-primary" onclick="openCreateEventPopup()">+ Create Event</button>`;
  } else {
    wrapper.innerHTML = "";
  }
}

/* ============================
   CREATE EVENT POPUP
============================ */
function openCreateEventPopup() {
  const b = document.getElementById("createEventBackdrop");
  if (b) b.style.display = "flex";
}

function closeCreateEventPopup() {
  const b = document.getElementById("createEventBackdrop");
  if (b) b.style.display = "none";
}

/* ============================
   EVENT IMAGE HANDLING
============================ */
function initEventImageHandler() {
  const picker = document.getElementById("eventImagePicker");
  const preview = document.getElementById("eventImagePreview");
  const input = document.getElementById("eventImageInput");

  if (!picker || !preview || !input) return;

  picker.addEventListener("click", () => { input.click(); });

  input.addEventListener("change", () => {
    const file = input.files[0];
    if (!file) return;
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => { img.src = e.target.result; };
    img.onload = () => { compressEventImage(img); };
    reader.readAsDataURL(file);
  });
}

function compressEventImage(img) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const MAX_WIDTH = 300;
  const scale = MAX_WIDTH / img.width;
  canvas.width = MAX_WIDTH;
  canvas.height = img.height * scale;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  let base64 = canvas.toDataURL("image/jpeg", 0.25);
  const preview = document.getElementById("eventImagePreview");
  if (preview) preview.src = base64;
  window.eventImageBase64 = base64;
}

/* ============================
   SUBMIT EVENT
============================ */
async function submitEvent() {
  const nameEl = document.getElementById("eventTitle");
  const descEl = document.getElementById("eventDescription");
  if (!nameEl || !descEl) return;

  const name = nameEl.value.trim();
  const description = descEl.value.trim();
  const user = JSON.parse(localStorage.getItem("contact_user"));

  if (!user) { window.location.href = "login.html"; return; }
  if (!name || !description) { showMessagePopup("Missing Fields", "Please fill out all fields."); return; }

  const imageBase64 = window.eventImageBase64 || "";
  closeCreateEventPopup();

  const tempId = "temp-" + Date.now();
  const grid = document.getElementById("eventGrid");
  if (!grid) return;

  grid.insertAdjacentHTML("afterbegin", `
    <div class="card" data-event="${tempId}">
      <h3>${name}</h3>
      ${imageBase64 ? `<img src="${imageBase64}" class="event-card-image">` : ""}
      <p>${description}</p>
      <button class="btn-primary" disabled>Saving...</button>
    </div>
  `);

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        module: "createCommunity", // Using community module as discussed
        name,
        description,
        email: user.email,
        imageBase64,
        category: "event" // Helper for your backend to distinguish if needed
      })
    });

    const data = await res.json();
    if (!data.success) {
      document.querySelector(`[data-event="${tempId}"]`)?.remove();
      showMessagePopup("Error", data.message || "Failed to save event.");
      return;
    }

    const tempCard = document.querySelector(`[data-event="${tempId}"]`);
    if (tempCard) {
      tempCard.outerHTML = `
        <div class="card" data-event="${data.id}">
          <h3>${data.name || name}</h3>
          ${data.imageUrl ? `<img src="${data.imageUrl}" class="event-card-image">` : ""}
          <p>${data.description || description}</p>
          <button class="btn-primary" onclick="joinEvent('${data.id}')">Join</button>
          <button class="delete-btn" onclick="deleteEvent('${data.id}')">Delete</button>
        </div>
      `;
    }
    showMessagePopup("Success", "Event created!");
  } catch (err) {
    document.querySelector(`[data-event="${tempId}"]`)?.remove();
    showMessagePopup("Network Error", "Please try again.");
  }
}

/* ============================
   LOADING EVENTS (CACHED)
============================ */
let allEvents = [];
let eventIndex = 0;
const BATCH = 20;

function loadCachedEvents() {
  const cached = localStorage.getItem("cached_events");
  if (!cached) return;
  try { allEvents = JSON.parse(cached); } catch { allEvents = []; return; }

  eventIndex = 0;
  const grid = document.getElementById("eventGrid");
  if (!grid) return;
  grid.innerHTML = "";
  renderNextBatch();
}

async function fetchEvents(force = false) {
  try {
    const res = await fetch(`${API_URL}?module=getAllCommunities`); // Fetching all, filtering logic can be added
    const data = await res.json();
    if (!data.success || !Array.isArray(data.communities)) return;

    localStorage.setItem("cached_events", JSON.stringify(data.communities));
    if (!force && localStorage.getItem("cached_events")) return;

    allEvents = data.communities;
    eventIndex = 0;
    const grid = document.getElementById("eventGrid");
    if (grid) { grid.innerHTML = ""; renderNextBatch(); }
  } catch (err) { console.error("Fetch failed", err); }
}

function renderNextBatch() {
  const grid = document.getElementById("eventGrid");
  if (!grid || !allEvents.length) return;
  const slice = allEvents.slice(eventIndex, eventIndex + BATCH);
  
  const user = JSON.parse(localStorage.getItem("contact_user"));
  slice.forEach(e => {
    const isCreator = user && user.email === e.creator;
    grid.innerHTML += `
      <div class="card" data-event="${e.id}">
        <h3>${e.name}</h3>
        ${e.imageUrl ? `<img src="${e.imageUrl}" class="event-card-image">` : ""}
        <p>${e.description}</p>
        <div style="display:flex; gap:10px; justify-content:center;">
          <button class="btn-primary" onclick="joinEvent('${e.id}')">Join</button>
          ${isCreator ? `<button class="delete-btn" onclick="deleteEvent('${e.id}')">Delete</button>` : ""}
        </div>
      </div>`;
  });
  eventIndex += BATCH;
}

/* ============================
   JOIN / DELETE EVENT
============================ */
async function joinEvent(id) {
  const user = JSON.parse(localStorage.getItem("contact_user"));
  if (!user) { window.location.href = "signup.html"; return; }

  // Silent join
  fetch(`${API_URL}?module=joinCommunity&communityId=${encodeURIComponent(id)}&email=${encodeURIComponent(user.email)}`).catch(()=>{});

  // Redirect with the type=event flag for your original messages.js
  window.location.href = `messages.html?communityId=${encodeURIComponent(id)}&type=event`;
}

async function deleteEvent(id) {
  if (!confirm("Are you sure you want to delete this event?")) return;
  const user = JSON.parse(localStorage.getItem("contact_user"));
  if (!user) return;

  document.querySelector(`[data-event="${id}"]`)?.remove();
  
  try {
    await fetch(`${API_URL}?module=deleteCommunity&communityId=${encodeURIComponent(id)}&email=${encodeURIComponent(user.email)}`);
    showMessagePopup("Deleted", "Event removed.");
  } catch (err) {
    showMessagePopup("Error", "Could not delete event from server.");
  }
}

/* ============================
   INIT
============================ */
document.addEventListener("DOMContentLoaded", () => {
  loadNavbar();
  loadCreateEventButton();
  initEventImageHandler();
  loadCachedEvents();
  fetchEvents();
});

window.addEventListener("scroll", () => {
  if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 200) {
    renderNextBatch();
  }
});

function logout() {
  localStorage.removeItem("contact_user");
  window.location.href = "index.html";
}

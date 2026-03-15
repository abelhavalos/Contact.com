/* ============================
   API CONFIGURATION
============================ */
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
   NAVBAR & UI
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

  const navHTML = user 
    ? `
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
    </div>`
    : `
    <div class="hamburger" onclick="toggleMenu()">
      <span></span><span></span><span></span>
    </div>
    <div class="logo">Contact<span>.</span>com</div>
    <div class="nav-links">
      <a href="index.html">Home</a>
      <a href="communities.html">Communities</a>
      <a href="events.html">Events</a>
      <a href="login.html">Login</a>
      <button class="btn-primary" onclick="window.location.href='signup.html'">Sign Up</button>
    </div>`;

  navbar.innerHTML = navHTML;
  mobileMenu.innerHTML = navHTML;
}

function loadCreateEventButton() {
  const user = JSON.parse(localStorage.getItem("contact_user"));
  const wrapper = document.getElementById("createEventWrapper");
  if (!wrapper) return;
  wrapper.innerHTML = user ? `<button class="btn-primary" onclick="openCreateEventPopup()">Create Event</button>` : "";
}

/* ============================
   EVENT IMAGE HANDLING
============================ */
function openCreateEventPopup() {
  const b = document.getElementById("createEventBackdrop");
  if (b) b.style.display = "flex";
}

function closeCreateEventPopup() {
  const b = document.getElementById("createEventBackdrop");
  if (b) b.style.display = "none";
}

function initEventImageHandler() {
  const picker = document.getElementById("eventImagePicker");
  const input = document.getElementById("eventImageInput");
  if (!picker || !input) return;

  picker.onclick = () => input.click();
  input.onchange = () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => compressEventImage(img);
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };
}

function compressEventImage(img) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const MAX_WIDTH = 300;
  const scale = MAX_WIDTH / img.width;
  canvas.width = MAX_WIDTH;
  canvas.height = img.height * scale;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  let base64 = canvas.toDataURL("image/jpeg", 0.2);
  const preview = document.getElementById("eventImagePreview");
  if (preview) preview.src = base64;
  window.eventImageBase64 = base64;
}

/* ============================
   EVENT CORE LOGIC (OPTIMISTIC)
============================ */
async function submitEvent() {
  const titleEl = document.getElementById("eventTitle");
  const descEl = document.getElementById("eventDescription");
  const user = JSON.parse(localStorage.getItem("contact_user"));

  if (!user) { window.location.href = "login.html"; return; }
  if (!titleEl.value.trim() || !descEl.value.trim()) {
    showMessagePopup("Missing Fields", "Please fill out all fields.");
    return;
  }

  const title = titleEl.value.trim();
  const description = descEl.value.trim();
  const imageBase64 = window.eventImageBase64 || "";

  closeCreateEventPopup();

  const tempId = "temp-" + Date.now();
  const grid = document.getElementById("eventsGrid");
  if (!grid) return;

  // Optimistic UI
  grid.insertAdjacentHTML("afterbegin", `
    <div class="card" data-event="${tempId}">
      <h3>${title}</h3>
      ${imageBase64 ? `<img src="${imageBase64}" class="event-card-image">` : ""}
      <p>${description}</p>
      <button class="btn-primary" disabled>Saving...</button>
    </div>
  `);

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        module: "createEvent",
        title,
        description,
        email: user.email,
        imageBase64
      })
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.message);

    // Refresh to sync correctly with database IDs
    fetchEvents(true);
    showMessagePopup("Success", "Event created!");
  } catch (err) {
    document.querySelector(`[data-event="${tempId}"]`)?.remove();
    showMessagePopup("Error", err.message || "Failed to save event.");
  }
}

let allEvents = [];
let index = 0;
const BATCH = 20;

function loadCachedEvents() {
  const cached = localStorage.getItem("cached_events");
  if (!cached) return;
  try {
    allEvents = JSON.parse(cached);
    renderNextBatch(true);
  } catch { allEvents = []; }
}

async function fetchEvents(force = false) {
  try {
    const res = await fetch(`${API_URL}?module=getAllEvents`);
    const data = await res.json();
    if (!data.success) return;

    localStorage.setItem("cached_events", JSON.stringify(data.events));
    allEvents = data.events;
    renderNextBatch(true);
  } catch (err) { console.error("Sync error:", err); }
}

function renderNextBatch(clear = false) {
  const grid = document.getElementById("eventsGrid");
  if (!grid) return;
  if (clear) { grid.innerHTML = ""; index = 0; }

  const user = JSON.parse(localStorage.getItem("contact_user"));
  const slice = allEvents.slice(index, index + BATCH);

  slice.forEach(e => {
    const isCreator = user && user.email === e.creator;
    const escapedTitle = e.title.replace(/'/g, "\\'");
    
    grid.innerHTML += `
      <div class="card" data-event="${e.id}">
        <h3>${e.title}</h3>
        ${e.imageUrl ? `<img src="${e.imageUrl}" class="event-card-image">` : ""}
        <p>${e.description}</p>
        <div class="card-actions">
           <button class="btn-primary" onclick="joinEvent('${e.id}', '${escapedTitle}')">Join Chat</button>
           ${isCreator ? `<button class="delete-btn" onclick="deleteEvent('${e.id}')">Delete</button>` : ""}
        </div>
      </div>`;
  });
  index += BATCH;
}

/* ============================
   JOIN & DELETE (GROUP SYNC)
============================ */
async function joinEvent(id, title) {
  const user = JSON.parse(localStorage.getItem("contact_user"));
  if (!user) { window.location.href = "signup.html"; return; }

  // Register join status on backend
  fetch(`${API_URL}?module=joinEvent&eventId=${id}&email=${user.email}`).catch(() => {});

  // Redirect to message.html in GROUP MODE (mode=event)
  // This ensures members list and shared conversation render correctly
  window.location.href = `messages.html?mode=event&eventId=${encodeURIComponent(id)}&title=${encodeURIComponent(title)}`;
}

async function deleteEvent(id) {
  if (!confirm("Are you sure you want to delete this event?")) return;
  const user = JSON.parse(localStorage.getItem("contact_user"));

  document.querySelector(`[data-event="${id}"]`)?.remove();
  allEvents = allEvents.filter(e => e.id !== id);
  localStorage.setItem("cached_events", JSON.stringify(allEvents));

  try {
    await fetch(`${API_URL}?module=deleteEvent&eventId=${id}&email=${user.email}`);
  } catch {
    showMessagePopup("Error", "Network error while deleting.");
  }
}

/* ============================
   INITIALIZATION
============================ */
function logout() {
  localStorage.removeItem("contact_user");
  window.location.href = "index.html";
}

document.addEventListener("DOMContentLoaded", () => {
  loadNavbar();
  loadCreateEventButton();
  initEventImageHandler();
  loadCachedEvents();
  fetchEvents();
});

window.onscroll = () => {
  if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 300) {
    renderNextBatch();
  }
};

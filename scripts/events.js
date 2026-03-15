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

  const navContent = user 
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

  navbar.innerHTML = navContent;
  mobileMenu.innerHTML = user
    ? `
      <a href="dashboard.html">Dashboard</a>
      <a href="communities.html">Communities</a>
      <a href="events.html">Events</a>
      <a href="contacts.html">Contacts</a>
      <a href="profile.html">Profile</a>
      <a href="#" onclick="logout()">Logout</a>`
    : `
      <a href="index.html">Home</a>
      <a href="communities.html">Communities</a>
      <a href="events.html">Events</a>
      <a href="login.html">Login</a>
      <button class="btn-primary" onclick="window.location.href='signup.html'">Sign Up</button>`;
}

function loadCreateEventButton() {
  const user = JSON.parse(localStorage.getItem("contact_user"));
  const wrapper = document.getElementById("createEventWrapper");
  if (!wrapper) return;

  if (user) {
    wrapper.innerHTML = `<button class="btn-primary" onclick="openCreateEventPopup()">Create Event</button>`;
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
  const input = document.getElementById("eventImageInput");
  if (!picker || !input) return;

  picker.addEventListener("click", () => input.click());
  input.addEventListener("change", () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => compressEventImage(img);
      img.src = e.target.result;
    };
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
   CREATE EVENT (OPTIMISTIC)
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

  const tempImgHtml = imageBase64 ? `<img src="${imageBase64}" class="event-card-image">` : "";
  grid.insertAdjacentHTML("afterbegin", `
    <div class="card" data-event="${tempId}">
      <h3>${title}</h3>
      ${tempImgHtml}
      <p>${description}</p>
      <button class="btn-primary" disabled>Saving...</button>
    </div>
  `);

  showMessagePopup("Success", "Event created!");

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
    if (!data.success) {
      document.querySelector(`[data-event="${tempId}"]`)?.remove();
      showMessagePopup("Error", data.message || "Failed to save event.");
      return;
    }

    const tempCard = document.querySelector(`[data-event="${tempId}"]`);
    if (tempCard) {
      const finalImg = data.imageUrl || imageBase64;
      tempCard.outerHTML = `
        <div class="card" data-event="${data.id}">
          <h3>${data.title || title}</h3>
          ${finalImg ? `<img src="${finalImg}" class="event-card-image">` : ""}
          <p>${data.description || description}</p>
          <button class="btn-primary" onclick="joinEvent('${data.id}', '${data.creator}', '${(data.creatorName || 'Organizer').replace(/'/g, "\\'")}', '${(data.title || title).replace(/'/g, "\\'")}')">Join</button>
          <button class="delete-btn" onclick="deleteEvent('${data.id}')">Delete</button>
        </div>`;
    }
  } catch (err) {
    document.querySelector(`[data-event="${tempId}"]`)?.remove();
    showMessagePopup("Network Error", "Please try again.");
  }
}

/* ============================
   FAST LOADING LOGIC
============================ */
let allEvents = [];
let index = 0;
const BATCH = 20;

function loadCachedEvents() {
  const cached = localStorage.getItem("cached_events");
  if (!cached) return;
  try { allEvents = JSON.parse(cached); } catch { allEvents = []; return; }
  index = 0;
  const grid = document.getElementById("eventsGrid");
  if (grid) { grid.innerHTML = ""; renderNextBatch(); }
}

async function fetchEvents(force = false) {
  try {
    const res = await fetch(`${API_URL}?module=getAllEvents`);
    const data = await res.json();
    if (!data.success || !Array.isArray(data.events)) return;

    const hadCache = !!localStorage.getItem("cached_events");
    localStorage.setItem("cached_events", JSON.stringify(data.events));

    if (!force && hadCache) return;
    allEvents = data.events;
    index = 0;
    const grid = document.getElementById("eventsGrid");
    if (grid) { grid.innerHTML = ""; renderNextBatch(); }
  } catch {}
}

function renderNextBatch() {
  const slice = allEvents.slice(index, index + BATCH);
  appendEvents(slice);
  index += BATCH;
}

function appendEvents(list) {
  const grid = document.getElementById("eventsGrid");
  if (!grid) return;
  const user = JSON.parse(localStorage.getItem("contact_user"));

  list.forEach((e) => {
    const isCreator = user && user.email === e.creator;
    const imgHtml = e.imageUrl ? `<img src="${e.imageUrl}" class="event-card-image">` : "";
    const escapedTitle = e.title.replace(/'/g, "\\'");
    const escapedName = (e.creatorName || "Organizer").replace(/'/g, "\\'");

    grid.innerHTML += `
      <div class="card" data-event="${e.id}">
        <h3>${e.title}</h3>
        ${imgHtml}
        <p>${e.description}</p>
        <button class="btn-primary" onclick="joinEvent('${e.id}', '${e.creator}', '${escapedName}', '${escapedTitle}')">Join</button>
        ${isCreator ? `<button class="delete-btn" onclick="deleteEvent('${e.id}')">Delete</button>` : ""}
      </div>`;
  });
}

window.addEventListener("scroll", () => {
  if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 200) {
    renderNextBatch();
  }
});

/* ============================
   JOIN / DELETE EVENT
============================ */
async function joinEvent(id, creatorEmail, creatorName, eventTitle) {
  const user = JSON.parse(localStorage.getItem("contact_user"));
  if (!user) { window.location.href = "signup.html"; return; }

  // 1. Mark as joined in DB
  fetch(`${API_URL}?module=joinEvent&eventId=${encodeURIComponent(id)}&email=${encodeURIComponent(user.email)}`).catch(() => {});

  // 2. Add creator to contacts (Matches your events logic)
  fetch(`${API_URL}?module=addContact&email=${encodeURIComponent(user.email)}&contact=${encodeURIComponent(creatorEmail)}`).catch(() => {});

  // 3. Redirect to messages with mode=private (as events usually link to the creator)
  window.location.href = `messages.html?mode=private&email=${encodeURIComponent(creatorEmail)}&name=${encodeURIComponent(creatorName)}&title=${encodeURIComponent(eventTitle)}`;
}

async function deleteEvent(id) {
  const user = JSON.parse(localStorage.getItem("contact_user"));
  if (!user) return;

  document.querySelector(`[data-event="${id}"]`)?.remove();
  allEvents = allEvents.filter((e) => e.id !== id);
  localStorage.setItem("cached_events", JSON.stringify(allEvents));
  showMessagePopup("Deleted", "Event removed.");

  try {
    await fetch(`${API_URL}?module=deleteEvent&eventId=${encodeURIComponent(id)}&email=${encodeURIComponent(user.email)}`);
  } catch {
    showMessagePopup("Network Error", "Could not reach the server.");
  }
}

/* ============================
   LOGOUT & INIT
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

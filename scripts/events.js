/* ============================
   API URL
============================ */
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
      <a href="dashboard.html">Dashboard</a>
      <a href="communities.html">Communities</a>
      <a href="events.html">Events</a>
      <a href="contacts.html">Contacts</a>
      <a href="profile.html">Profile</a>
      <a href="#" onclick="logout()">Logout</a>
    `
    : `
      <a href="index.html">Home</a>
      <a href="communities.html">Communities</a>
      <a href="events.html">Events</a>
      <a href="login.html">Login</a>
      <button class="btn-primary" onclick="window.location.href='signup.html'">Sign Up</button>
    `;

  navbar.innerHTML = `
    <div class="hamburger" onclick="toggleMenu()">
      <span></span><span></span><span></span>
    </div>
    <div class="logo">Contact<span>.</span>com</div>
    <div class="nav-links">${navContent}</div>
  `;
  mobileMenu.innerHTML = navContent;
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
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => { img.src = e.target.result; };
    img.onload = () => compressEventImage(img);
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
  // Iterative down-sizing to ensure it hits the GAS limit
  if (base64.length > 120000) base64 = canvas.toDataURL("image/jpeg", 0.15);

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
  const tempImgHtml = imageBase64 ? `<img src="${imageBase64}" class="event-card-image">` : "";

  grid.insertAdjacentHTML("afterbegin", `
    <div class="card" data-event="${tempId}">
      <h3>${title}</h3>
      ${tempImgHtml}
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
        eventPicture: imageBase64
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
      const finalImg = data.eventPicture || imageBase64;
      tempCard.outerHTML = renderEventCard({
        id: data.id,
        title: data.title || title,
        description: data.description || description,
        eventPicture: finalImg,
        creator: user.email
      }, user);
    }
    showMessagePopup("Success", "Event created!");
  } catch {
    document.querySelector(`[data-event="${tempId}"]`)?.remove();
    showMessagePopup("Network Error", "Please try again.");
  }
}

/* ============================
   LOADING & RENDERING
============================ */
let allEvents = [];
let currentIndex = 0;
const BATCH = 20;

function renderEventCard(e, user) {
  const isCreator = user && user.email === e.creator;
  const imgHtml = e.eventPicture ? `<img src="${e.eventPicture}" class="event-card-image">` : "";
  
  return `
    <div class="card" data-event="${e.id}">
      <h3>${e.title}</h3>
      ${imgHtml}
      <p>${e.description}</p>
      <div class="card-buttons">
        <button class="btn-primary" onclick="joinEvent('${e.id}')">Join Chat</button>
        ${isCreator ? `<button class="delete-btn" onclick="deleteEvent('${e.id}')">Delete</button>` : ""}
      </div>
    </div>
  `;
}

function loadCachedEvents() {
  const cached = localStorage.getItem("cached_events");
  if (!cached) return;
  allEvents = JSON.parse(cached);
  currentIndex = 0;
  const grid = document.getElementById("eventsGrid");
  if (grid) {
    grid.innerHTML = "";
    renderNextBatch();
  }
}

async function fetchEvents(force = false) {
  try {
    const res = await fetch(`${API_URL}?module=getAllEvents`);
    const data = await res.json();
    if (!data.success) return;

    localStorage.setItem("cached_events", JSON.stringify(data.events));
    if (force || !localStorage.getItem("cached_events")) {
      allEvents = data.events;
      currentIndex = 0;
      const grid = document.getElementById("eventsGrid");
      if (grid) grid.innerHTML = "";
      renderNextBatch();
    }
  } catch {}
}

function renderNextBatch() {
  const grid = document.getElementById("eventsGrid");
  if (!grid || currentIndex >= allEvents.length) return;

  const user = JSON.parse(localStorage.getItem("contact_user"));
  const slice = allEvents.slice(currentIndex, currentIndex + BATCH);
  
  slice.forEach(e => {
    grid.innerHTML += renderEventCard(e, user);
  });
  
  currentIndex += BATCH;
}

/* ============================
   JOIN / DELETE LOGIC (Identical to Communities)
============================ */
async function joinEvent(id) {
  const user = JSON.parse(localStorage.getItem("contact_user"));
  if (!user) { window.location.href = "signup.html"; return; }

  // Optimistic Background Join
  fetch(`${API_URL}?module=joinEvent&eventId=${encodeURIComponent(id)}&email=${encodeURIComponent(user.email)}`).catch(() => {});

  // Redirect to Chatroom Mode
  window.location.href = `messages.html?mode=event&eventId=${encodeURIComponent(id)}`;
}

async function deleteEvent(id) {
  const user = JSON.parse(localStorage.getItem("contact_user"));
  if (!user) return;

  const card = document.querySelector(`[data-event="${id}"]`);
  if (card) card.remove();

  allEvents = allEvents.filter(e => e.id !== id);
  localStorage.setItem("cached_events", JSON.stringify(allEvents));

  try {
    const res = await fetch(`${API_URL}?module=deleteEvent&eventId=${encodeURIComponent(id)}&email=${encodeURIComponent(user.email)}`);
    const data = await res.json();
    if (!data.success) {
        showMessagePopup("Error", "Could not delete from server.");
        fetchEvents(true); // Refresh to restore
    }
  } catch {
    showMessagePopup("Network Error", "Check your connection.");
  }
}

/* ============================
   INIT
============================ */
window.addEventListener("scroll", () => {
  if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 200) {
    renderNextBatch();
  }
});

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

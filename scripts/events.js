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
    NAVBAR & UI INITIALIZATION
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
  wrapper.innerHTML = user ? `<button class="btn-primary" onclick="openCreateEventPopup()">+ Create Event</button>` : "";
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
  const MAX_WIDTH = 400; 
  const scale = MAX_WIDTH / img.width;
  canvas.width = MAX_WIDTH;
  canvas.height = img.height * scale;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  let base64 = canvas.toDataURL("image/jpeg", 0.3);
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
  const user = JSON.parse(localStorage.getItem("contact_user"));

  if (!user) { window.location.href = "login.html"; return; }
  const name = nameEl.value.trim();
  const description = descEl.value.trim();

  if (!name || !description) { 
    showMessagePopup("Missing Fields", "Please provide a name and description."); 
    return; 
  }

  const imageBase64 = window.eventImageBase64 || "";
  closeCreateEventPopup();

  // Optimistic UI Update (Shows for creator immediately)
  const tempId = "temp-" + Date.now();
  const grid = document.getElementById("eventGrid");
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
        module: "createEvent",
        name,
        description,
        email: user.email,
        imageBase64
      })
    });

    const data = await res.json();
    const tempCard = document.querySelector(`[data-event="${tempId}"]`);

    if (data.success && tempCard) {
      // Update the "Fake" card with the real ID and Data
      tempCard.outerHTML = `
        <div class="card" data-event="${data.id}">
          <h3>${data.name}</h3>
          ${data.imageUrl ? `<img src="${data.imageUrl}" class="event-card-image">` : ""}
          <p>${data.description}</p>
          <div class="card-actions" style="display:flex; gap:10px; justify-content:center; margin-top:10px;">
            <button class="btn-primary" onclick="joinEvent('${data.id}')">Join</button>
            <button class="delete-btn" onclick="deleteEvent('${data.id}')">Delete</button>
          </div>
        </div>
      `;
      showMessagePopup("Success", "Event is live!");
    } else {
      if (tempCard) tempCard.remove();
      showMessagePopup("Error", data.message || "Could not save event.");
    }
  } catch (err) {
    console.error(err);
    showMessagePopup("Error", "Server connection failed.");
  }
}

/* ============================
    DATA FETCHING & RENDERING
============================ */
let allEvents = [];
let eventIndex = 0;
const BATCH = 20;

async function fetchEvents() {
  const grid = document.getElementById("eventGrid");
  if (!grid) return;

  try {
    // 1. Force fetch from backend (getAllEvents.gs)
    const res = await fetch(`${API_URL}?module=getAllEvents`);
    const data = await res.json();

    if (data.success && Array.isArray(data.events)) {
      // 2. Clear old cached mixed data and UI
      localStorage.setItem("cached_events", JSON.stringify(data.events));
      allEvents = data.events;
      eventIndex = 0;
      grid.innerHTML = "";
      
      if (allEvents.length === 0) {
        grid.innerHTML = "<p style='color:white; text-align:center;'>No events yet. Be the first to create one!</p>";
      } else {
        renderNextBatch();
      }
    }
  } catch (err) {
    console.error("Fetch failed:", err);
    // 3. Fallback to cache ONLY if network fails
    const cached = localStorage.getItem("cached_events");
    if (cached) {
      allEvents = JSON.parse(cached);
      grid.innerHTML = "";
      renderNextBatch();
    }
  }
}

function renderNextBatch() {
  const grid = document.getElementById("eventGrid");
  if (!grid || !allEvents.length) return;
  
  const slice = allEvents.slice(eventIndex, eventIndex + BATCH);
  const user = JSON.parse(localStorage.getItem("contact_user"));

  slice.forEach(e => {
    // Check both potential creator fields from backend
    const isCreator = user && (user.email === e.creator || user.email === e.creatorEmail);
    
    grid.innerHTML += `
      <div class="card" data-event="${e.id}">
        <h3>${e.name}</h3>
        ${e.imageUrl ? `<img src="${e.imageUrl}" class="event-card-image" onerror="this.style.display='none'">` : ""}
        <p>${e.description}</p>
        <div class="card-actions" style="display:flex; gap:10px; justify-content:center; margin-top:10px;">
          <button class="btn-primary" onclick="joinEvent('${e.id}')">Join</button>
          ${isCreator ? `<button class="delete-btn" onclick="deleteEvent('${e.id}')">Delete</button>` : ""}
        </div>
      </div>`;
  });
  eventIndex += BATCH;
}

/* ============================
    JOIN & DELETE ACTIONS
============================ */
async function joinEvent(id) {
  const user = JSON.parse(localStorage.getItem("contact_user"));
  if (!user) { window.location.href = "signup.html"; return; }

  // Record join in Events_Members sheet
  fetch(`${API_URL}?module=joinEvent&eventId=${encodeURIComponent(id)}&email=${encodeURIComponent(user.email)}`).catch(()=>{});
  
  // Navigate to chat with the event flag
  window.location.href = `messages.html?communityId=${encodeURIComponent(id)}&type=event`;
}

async function deleteEvent(id) {
  if (!confirm("Delete this event permanently?")) return;
  const user = JSON.parse(localStorage.getItem("contact_user"));
  if (!user) return;

  document.querySelector(`[data-event="${id}"]`)?.remove();

  try {
    await fetch(`${API_URL}?module=deleteEvent&eventId=${encodeURIComponent(id)}&email=${encodeURIComponent(user.email)}`);
    showMessagePopup("Removed", "Event has been deleted.");
  } catch (err) {
    console.error("Delete failed", err);
  }
}

/* ============================
    INITIALIZATION
============================ */
document.addEventListener("DOMContentLoaded", () => {
  loadNavbar();
  loadCreateEventButton();
  initEventImageHandler();
  fetchEvents(); // Always try fresh fetch on load
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

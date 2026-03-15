/* ============================
   API URL
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

  const loggedInNav = `
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

  const publicNav = `
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
    </div>
  `;

  navbar.innerHTML = user ? loggedInNav : publicNav;
  mobileMenu.innerHTML = user ? loggedInNav : publicNav; // Sync mobile menu
}

function loadCreateEventButton() {
  const user = JSON.parse(localStorage.getItem("contact_user"));
  const wrapper = document.getElementById("createEventWrapper");
  if (!wrapper) return;
  wrapper.innerHTML = user ? `<button class="btn-primary" onclick="openCreateEventPopup()">Create Event</button>` : "";
}

/* ============================
   CREATE EVENT POPUP
============================ */
function openCreateEventPopup() {
  document.getElementById("createEventBackdrop").style.display = "flex";
}

function closeCreateEventPopup() {
  document.getElementById("createEventBackdrop").style.display = "none";
}

/* ============================
   IMAGE HANDLING
============================ */
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
  const MAX_WIDTH = 300;
  const scale = MAX_WIDTH / img.width;
  canvas.width = MAX_WIDTH;
  canvas.height = img.height * scale;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  
  window.eventImageBase64 = canvas.toDataURL("image/jpeg", 0.3);
  const preview = document.getElementById("eventImagePreview");
  if (preview) preview.src = window.eventImageBase64;
}

/* ============================
   CORE EVENT LOGIC
============================ */
async function submitEvent() {
  const title = document.getElementById("eventTitle").value.trim();
  const description = document.getElementById("eventDescription").value.trim();
  const user = JSON.parse(localStorage.getItem("contact_user"));

  if (!title || !description) return showMessagePopup("Error", "Fill all fields");
  
  closeCreateEventPopup();
  const tempId = "temp-" + Date.now();
  const grid = document.getElementById("eventsGrid");

  // Optimistic UI update
  grid.insertAdjacentHTML("afterbegin", `
    <div class="card" data-event="${tempId}">
      <h3>${title}</h3>
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
        eventPicture: window.eventImageBase64 || ""
      })
    });
    const data = await res.json();
    if (data.success) {
      location.reload(); // Refresh to get valid IDs and sync
    } else {
      throw new Error();
    }
  } catch {
    document.querySelector(`[data-event="${tempId}"]`)?.remove();
    showMessagePopup("Error", "Failed to create event.");
  }
}

let allEvents = [];
let index = 0;
const BATCH = 15;

async function fetchEvents() {
  try {
    const res = await fetch(`${API_URL}?module=getAllEvents`);
    const data = await res.json();
    if (data.success) {
      allEvents = data.events;
      localStorage.setItem("cached_events", JSON.stringify(allEvents));
      renderNextBatch(true);
    }
  } catch (err) {
    console.error("Fetch failed", err);
  }
}

function renderNextBatch(clear = false) {
  const grid = document.getElementById("eventsGrid");
  if (clear) { grid.innerHTML = ""; index = 0; }
  
  const user = JSON.parse(localStorage.getItem("contact_user"));
  const slice = allEvents.slice(index, index + BATCH);
  
  slice.forEach(e => {
    const isCreator = user && user.email === e.creator;
    const imgHtml = e.eventPicture ? `<img src="${e.eventPicture}" class="event-card-image">` : "";
    const escapedTitle = e.title.replace(/'/g, "\\'");

    grid.innerHTML += `
      <div class="card" data-event="${e.id}">
        <h3>${e.title}</h3>
        ${imgHtml}
        <p>${e.description}</p>
        <div class="card-footer">
          ${isCreator ? `<button class="delete-btn" onclick="deleteEvent('${e.id}')">Delete</button>` : ""}
          <button class="btn-primary" onclick="contactEventCreator('${e.creator}', '${(e.creatorName || 'Organizer').replace(/'/g, "\\'")}', '${escapedTitle}')">
            Join & Message
          </button>
        </div>
      </div>
    `;
  });
  index += BATCH;
}

/* ============================
   JOIN / CONTACT LOGIC
============================ */
async function contactEventCreator(creatorEmail, creatorName, eventTitle) {
  const user = JSON.parse(localStorage.getItem("contact_user"));
  if (!user) { window.location.href = "login.html"; return; }
  
  if (user.email === creatorEmail) {
    showMessagePopup("Note", "You are the organizer of this event.");
    return;
  }

  // Ensure contact is added BEFORE navigating to ensure the chat is initialized
  try {
    await fetch(`${API_URL}?module=addContact&email=${encodeURIComponent(user.email)}&contact=${encodeURIComponent(creatorEmail)}`);
  } catch (e) { console.warn("Contact already exists or error adding."); }

  window.location.href = `messages.html?contactEmail=${encodeURIComponent(creatorEmail)}&contactName=${encodeURIComponent(creatorName)}&context=${encodeURIComponent(eventTitle)}`;
}

async function deleteEvent(id) {
  if (!confirm("Delete this event?")) return;
  const user = JSON.parse(localStorage.getItem("contact_user"));
  
  document.querySelector(`[data-event="${id}"]`)?.remove();
  
  try {
    await fetch(`${API_URL}?module=deleteEvent&eventId=${id}&email=${user.email}`);
  } catch (e) {
    showMessagePopup("Error", "Could not delete from server.");
  }
}

/* ============================
   INIT
============================ */
function logout() {
  localStorage.removeItem("contact_user");
  window.location.href = "index.html";
}

document.addEventListener("DOMContentLoaded", () => {
  loadNavbar();
  loadCreateEventButton();
  initEventImageHandler();
  
  const cached = localStorage.getItem("cached_events");
  if (cached) {
    allEvents = JSON.parse(cached);
    renderNextBatch(true);
  }
  fetchEvents();
});

window.onscroll = () => {
  if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) {
    renderNextBatch();
  }
};

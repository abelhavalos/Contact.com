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

  mobileMenu.innerHTML = user
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
}

function loadCreateEventButton() {
  const user = JSON.parse(localStorage.getItem("contact_user"));
  const wrapper = document.getElementById("createEventWrapper");
  if (!wrapper) return;

  if (user) {
    wrapper.innerHTML = `
      <button class="btn-primary" onclick="openCreateEventPopup()">
        Create Event
      </button>
    `;
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
      compressEventImage(img);
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

  if (base64.length > 120000) base64 = canvas.toDataURL("image/jpeg", 0.2);
  if (base64.length > 120000) base64 = canvas.toDataURL("image/jpeg", 0.18);
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
  if (!titleEl || !descEl) return;

  const title = titleEl.value.trim();
  const description = descEl.value.trim();
  const user = JSON.parse(localStorage.getItem("contact_user"));

  if (!user) {
    window.location.href = "login.html";
    return;
  }

  if (!title || !description) {
    showMessagePopup("Missing Fields", "Please fill out all fields.");
    return;
  }

  const imageBase64 = window.eventImageBase64 || "";

  closeCreateEventPopup();

  const tempId = "temp-" + Date.now();
  const grid = document.getElementById("eventsGrid");
  if (!grid) return;

  const tempImgHtml = imageBase64
    ? `<img src="${imageBase64}" class="event-card-image">`
    : "";

  grid.insertAdjacentHTML(
    "afterbegin",
    `
    <div class="card" data-event="${tempId}">
      <h3>${title}</h3>
      ${tempImgHtml}
      <p>${description}</p>
      <button class="btn-primary" disabled>Saving...</button>
    </div>
  `
  );

  showMessagePopup("Success", "Event created!");

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

    const finalImgHtml = data.eventPicture
      ? `<img src="${data.eventPicture}" class="event-card-image">`
      : tempImgHtml;

    if (tempCard) {
      tempCard.outerHTML = `
        <div class="card" data-event="${data.id}">
          <h3>${data.title || title}</h3>
          ${finalImgHtml}
          <p>${data.description || description}</p>
          <button class="btn-primary" onclick="contactEventCreator('${data.creator}', '${data.creatorName}', '${data.title}')">Join</button>
          <button class="delete-btn" onclick="deleteEvent('${data.id}')">Delete</button>
        </div>
      `;
    }
  } catch {
    document.querySelector(`[data-event="${tempId}"]`)?.remove();
    showMessagePopup("Network Error", "Please try again.");
  }
}

/* ============================
   FAST EVENTS LOADING
============================ */
let allEvents = [];
let index = 0;
const BATCH = 20;

function loadCachedEvents() {
  const cached = localStorage.getItem("cached_events");
  if (!cached) return;

  try {
    allEvents = JSON.parse(cached);
  } catch {
    allEvents = [];
    return;
  }

  index = 0;
  const grid = document.getElementById("eventsGrid");
  if (!grid) return;

  grid.innerHTML = "";
  grid.style.opacity = "0";
  setTimeout(() => (grid.style.opacity = "1"), 50);

  renderNextBatch();
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
    if (!grid) return;
    grid.innerHTML = "";
    renderNextBatch();
  } catch {}
}

function renderNextBatch() {
  if (!allEvents.length) return;
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

    const imgHtml = e.eventPicture
      ? `<img src="${e.eventPicture}" class="event-card-image">`
      : "";

    grid.innerHTML += `
      <div class="card" data-event="${e.id}">
        <h3>${e.title}</h3>
        ${imgHtml}
        <p>${e.description}</p>
        ${
          isCreator
            ? `
          <button class="delete-btn" onclick="deleteEvent('${e.id}')">Delete</button>
          <button class="btn-primary" onclick="contactEventCreator('${e.creator}', '${e.creatorName}', '${e.title}')">Join</button>
        `
            : `
          <button class="btn-primary" onclick="contactEventCreator('${e.creator}', '${e.creatorName}', '${e.title}')">Join</button>
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
   JOIN / DELETE EVENT
============================ */
async function joinEvent(id) {
  const user = JSON.parse(localStorage.getItem("contact_user"));
  if (!user) {
    window.location.href = "signup.html";
    return;
  }

  fetch(
    `${API_URL}?module=joinEvent&eventId=${encodeURIComponent(
      id
    )}&email=${encodeURIComponent(user.email)}`
  ).catch(() => {});

  window.location.href = `messages.html?mode=event&eventId=${encodeURIComponent(
    id
  )}`;
}

async function deleteEvent(id) {
  const user = JSON.parse(localStorage.getItem("contact_user"));
  if (!user) return;

  const card = document.querySelector(`[data-event="${id}"]`);
  if (card) card.remove();

  let cached = [];
  try {
    cached = JSON.parse(localStorage.getItem("cached_events") || "[]");
  } catch {
    cached = [];
  }

  cached = cached.filter((e) => e.id !== id);
  localStorage.setItem("cached_events", JSON.stringify(cached));

  allEvents = allEvents.filter((e) => e.id !== id);

  showMessagePopup("Deleted", "Event removed.");

  try {
    const res = await fetch(
      `${API_URL}?module=deleteEvent&eventId=${encodeURIComponent(
        id
      )}&email=${encodeURIComponent(user.email)}`
    );
    const data = await res.json();

    if (!data.success) {
      const grid = document.getElementById("eventsGrid");
      if (!grid) return;

      const imgHtml = data.eventPicture
        ? `<img src="${data.eventPicture}" class="event-card-image">`
        : "";

      grid.insertAdjacentHTML(
        "afterbegin",
        `
        <div class="card" data-event="${id}">
          <h3>${data.title || "Event"}</h3>
          ${imgHtml}
          <p>${data.description || ""}</p>
          <button class="delete-btn" onclick="deleteEvent('${id}')">Delete</button>
          <button class="btn-primary" onclick="contactEventCreator('${e.creator}', '${e.creatorName}', '${e.title}')">Join</button>
        </div>
      `
      );

      cached.push({
        id,
        title: data.title,
        description: data.description,
        eventPicture: data.eventPicture || "",
        creator: user.email
      });
      localStorage.setItem("cached_events", JSON.stringify(cached));

      showMessagePopup("Error", data.message || "Failed to delete event.");
    }
  } catch {
    showMessagePopup("Network Error", "Could not reach the server.");
  }
}

/* ============================
   CONTACT EVENT CREATOR
============================ */
function contactEventCreator(creatorEmail, creatorName, eventTitle) {
  const user = JSON.parse(localStorage.getItem("contact_user"));
  if (!user) {
    window.location.href = "signup.html";
    return;
  }

  fetch(
    `${API_URL}?module=addContact&email=${encodeURIComponent(
      user.email
    )}&contact=${encodeURIComponent(creatorEmail)}`
  ).catch(() => {});

  window.location.href =
    `messages.html?mode=private&email=${encodeURIComponent(
      creatorEmail
    )}&name=${encodeURIComponent(
      creatorName
    )}&title=${encodeURIComponent(eventTitle)}`;
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
  loadCreateEventButton();
  initEventImageHandler();
  loadCachedEvents();
  fetchEvents();
});

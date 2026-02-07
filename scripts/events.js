/* ============================
   CONFIG
============================ */
const EVENTS_API = "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

let allEvents = [];
let selectedEventImage = ""; // base64 event picture


/* ============================
   UNIVERSAL POPUP
============================ */
function showMessagePopup(title, message) {
    document.getElementById("messageTitle").innerText = title;
    document.getElementById("messageText").innerText = message;
    document.getElementById("messageBackdrop").style.display = "flex";
}

function hideMessagePopup() {
    document.getElementById("messageBackdrop").style.display = "none";
}


/* ============================
   NAVBAR
============================ */
function toggleMenu() {
    document.getElementById("mobileMenu").classList.toggle("show");
}

function loadNavbar() {
    const user = JSON.parse(localStorage.getItem("contact_user"));

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

    document.getElementById("navbar").innerHTML = user ? loggedInNav : publicNav;

    document.getElementById("mobileMenu").innerHTML = user
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


/* ============================
   CREATE EVENT BUTTON
============================ */
function showCreateEventButton() {
    const user = JSON.parse(localStorage.getItem("contact_user"));
    if (!user) return;

    document.getElementById("createEventContainer").innerHTML = `
        <button class="btn-primary" onclick="openCreateEventPopup()">Create Event</button>
    `;
}


/* ============================
   EVENT IMAGE HANDLER (copied from communities.js)
============================ */
function initEventImageHandler() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.style.display = "none";
    input.id = "eventImageInput";
    document.body.appendChild(input);

    input.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (event) {
            const img = new Image();
            img.onload = function () {
                const canvas = document.createElement("canvas");
                const MAX_WIDTH = 300;
                const scale = MAX_WIDTH / img.width;

                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scale;

                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                selectedEventImage = canvas.toDataURL("image/jpeg", 0.8);

                document.getElementById("eventImagePreview").src = selectedEventImage;
                document.getElementById("eventImagePreview").style.display = "block";
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });
}

function openEventImagePicker() {
    document.getElementById("eventImageInput").click();
}


/* ============================
   POPUPS
============================ */
function openCreateEventPopup() {
    document.getElementById("createEventBackdrop").style.display = "flex";
}

function closeCreateEventPopup() {
    document.getElementById("createEventBackdrop").style.display = "none";
}


/* ============================
   CREATE EVENT (with image)
============================ */
async function submitEvent() {
    const title = document.getElementById("eventTitle").value.trim();
    const description = document.getElementById("eventDescription").value.trim();
    const user = JSON.parse(localStorage.getItem("contact_user"));

    if (!user) {
        window.location.href = "login.html";
        return;
    }

    if (!title || !description) {
        showMessagePopup("Missing Fields", "Please fill out all fields.");
        return;
    }

    closeCreateEventPopup();

    const tempId = "temp-" + Date.now();
    const grid = document.getElementById("eventsGrid");

    const imgHtml = selectedEventImage
        ? `<img src="${selectedEventImage}" class="community-card-image">`
        : "";

    grid.insertAdjacentHTML("afterbegin", `
        <div class="card" data-event="${tempId}">
            <h3>${title}</h3>
            ${imgHtml}
            <p>${description}</p>
            <p style="font-size:0.85rem; color:#ccc;">Saving...</p>
            <button disabled>Saving...</button>
        </div>
    `);

    allEvents.unshift({
        id: tempId,
        title,
        description,
        creator: user.email,
        creatorName: user.name || user.email,
        eventPicture: selectedEventImage
    });

    showMessagePopup("Success", "Your event has been created!");

    const url = `${EVENTS_API}?module=createEvent`;
    const body = new FormData();
    body.append("email", user.email);
    body.append("title", title);
    body.append("description", description);
    body.append("eventPicture", selectedEventImage);

    try {
        const res = await fetch(url, { method: "POST", body });
        const data = await res.json();

        if (!data.success) {
            document.querySelector(`[data-event="${tempId}"]`)?.remove();
            showMessagePopup("Error", "Failed to save event.");
            return;
        }

        const tempCard = document.querySelector(`[data-event="${tempId}"]`);
        if (tempCard) {
            tempCard.outerHTML = `
                <div class="card" data-event="${data.id}">
                    <h3>${title}</h3>
                    ${imgHtml}
                    <p>${description}</p>
                    <p style="font-size:0.85rem; color:#ccc;">Created by: ${data.creatorName}</p>
                    <button style="background:#ff4a4a;" onclick="deleteEvent('${data.id}')">Delete Event</button>
                </div>
            `;
        }

        allEvents = allEvents.map(ev =>
            ev.id === tempId ? { ...ev, id: data.id } : ev
        );

    } catch {
        document.querySelector(`[data-event="${tempId}"]`)?.remove();
        showMessagePopup("Network Error", "Please try again.");
    }
}


/* ============================
   DELETE EVENT
============================ */
async function deleteEvent(id) {
    const user = JSON.parse(localStorage.getItem("contact_user"));
    if (!user) return;

    const card = document.querySelector(`[data-event="${id}"]`);
    if (card) card.remove();

    allEvents = allEvents.filter(ev => ev.id !== id);

    showMessagePopup("Deleted", "Your event has been removed.");

    const url = `${EVENTS_API}?module=deleteEvent&id=${id}&email=${encodeURIComponent(user.email)}`;

    try {
        const res = await fetch(url);
        const data = await res.json();

        if (!data.success) {
            const grid = document.getElementById("eventsGrid");

            const imgHtml = data.eventPicture
                ? `<img src="${data.eventPicture}" class="community-card-image">`
                : "";

            grid.insertAdjacentHTML("afterbegin", `
                <div class="card" data-event="${id}">
                    <h3>${data.title || "Event"}</h3>
                    ${imgHtml}
                    <p>${data.description || ""}</p>
                    <p style="font-size:0.85rem; color:#ccc;">Created by: ${data.creatorName || user.email}</p>
                    <button style="background:#ff4a4a;" onclick="deleteEvent('${id}')">Delete Event</button>
                </div>
            `);

            allEvents.unshift({
                id,
                title: data.title,
                description: data.description,
                creator: user.email,
                creatorName: data.creatorName,
                eventPicture: data.eventPicture
            });

            showMessagePopup("Error", data.message || "Failed to delete event.");
        }

    } catch {
        showMessagePopup("Network Error", "Please try again.");
    }
}


/* ============================
   LOAD EVENTS
============================ */
async function loadEvents() {
    const grid = document.getElementById("eventsGrid");

    const cached = localStorage.getItem("cached_events");
    if (cached) {
        allEvents = JSON.parse(cached);
        renderEvents(allEvents);
    }

    const url = `${EVENTS_API}?module=getEvents`;

    try {
        const res = await fetch(url);
        const data = await res.json();

        if (!data.success) return;

        allEvents = data.events;

        localStorage.setItem("cached_events", JSON.stringify(allEvents));

        renderEvents(allEvents);

    } catch {
        console.error("Network error loading events");
    }
}


/* ============================
   RENDER EVENTS
============================ */
function renderEvents(events) {
    const grid = document.getElementById("eventsGrid");
    grid.innerHTML = "";

    if (!events || events.length === 0) {
        grid.innerHTML = `<p style="color:white; text-align:center;">No events yet. Be the first to create one!</p>`;
        return;
    }

    const currentUser = JSON.parse(localStorage.getItem("contact_user"));

    events.forEach(ev => {
        const isMine = currentUser && ev.creator === currentUser.email;

        const imgHtml = ev.eventPicture
            ? `<img src="${ev.eventPicture}" class="community-card-image">`
            : "";

        grid.innerHTML += `
            <div class="card" data-event="${ev.id}">
                <h3>${ev.title}</h3>
                ${imgHtml}
                <p>${ev.description}</p>
                <p style="font-size:0.85rem; color:#ccc;">Created by: ${ev.creatorName}</p>

                ${isMine
                    ? `<button style="background:#ff4a4a;" onclick="deleteEvent('${ev.id}')">Delete Event</button>`
                    : `<button class="btn-primary" onclick="startPrivateMessage('${ev.creator}')">Contact Me</button>`
                }
            </div>
        `;
    });
}


/* ============================
   CONTACT CREATOR
============================ */
function startPrivateMessage(email) {
    const user = JSON.parse(localStorage.getItem("contact_user"));
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    window.location.href = `messages.html?otherEmail=${encodeURIComponent(email)}`;
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
    showCreateEventButton();
    initEventImageHandler();
    loadEvents();
});

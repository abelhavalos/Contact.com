const API_URL = "https://script.google.com/macros/s/AKfycbyFafzkgdxhvXuNaPyzNZw0ZKu1qZsoH7A34OuSAtMBhm3TIZrOBJsvH3AGQT9YSmjx/exec";

function toggleMenu() {
    document.getElementById("mobileMenu").classList.toggle("show");
}

function loadNavbar() {
    const nav = `
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

    document.getElementById("navbar").innerHTML = nav;

    document.getElementById("mobileMenu").innerHTML = `
        <a href="dashboard.html">Dashboard</a>
        <a href="communities.html">Communities</a>
        <a href="events.html">Events</a>
        <a href="contacts.html">Contacts</a>
        <a href="profile.html">Profile</a>
        <a href="#" onclick="logout()">Logout</a>
    `;
}

function showPopup(title, message) {
    document.getElementById("popupTitle").innerText = title;
    document.getElementById("popupMessage").innerText = message;
    document.getElementById("popupBackdrop").style.display = "flex";
}

function hidePopup() {
    document.getElementById("popupBackdrop").style.display = "none";
}

function logout() {
    localStorage.removeItem("contact_user");
    window.location.href = "index.html";
}

const params = new URLSearchParams(window.location.search);
const profileEmail = params.get("email");

async function loadPublicProfile() {
    if (!profileEmail) {
        showPopup("Error", "No profile specified.");
        return;
    }

    const cached = localStorage.getItem("cached_public_profile_" + profileEmail);
    if (cached) {
        fillProfile(JSON.parse(cached));
    }

    try {
        const url = `${API_URL}?module=getPublicProfile&email=${encodeURIComponent(profileEmail)}`;
        const res = await fetch(url);
        const data = await res.json();

        if (!data.success) {
            if (!cached) showPopup("Not Found", "This profile does not exist.");
            return;
        }

        const u = data.user;

        fillProfile(u);

        localStorage.setItem("cached_public_profile_" + profileEmail, JSON.stringify(u));

    } catch (err) {
        if (!cached) showPopup("Network Error", "Unable to load profile.");
    }
}

function fillProfile(u) {
    document.getElementById("name").innerText = u.fullName || "";
    document.getElementById("profession").innerText = u.profession || "";
    document.getElementById("about").innerText = u.about || "";
    document.getElementById("skills").innerText = u.skills || "";
    document.getElementById("workLife").innerText = u.workLife || "";

    const pic = u.profilePic || u.ProfilePic || null;
    const imgEl = document.getElementById("publicProfilePic");

    if (pic) {
        imgEl.src = pic;
        imgEl.style.display = "block";
    } else {
        imgEl.style.display = "none";
    }
}

function openChat() {
    window.location.href = `messages.html?otherEmail=${encodeURIComponent(profileEmail)}`;
}

async function addToContacts() {
    const me = JSON.parse(localStorage.getItem("contact_user"));
    if (!me) return window.location.href = "login.html";

    showPopup("Adding...", "Adding this contact...");

    try {
        const url =
            `${API_URL}?module=addContact`
            + `&userEmail=${encodeURIComponent(me.email)}`
            + `&contactEmail=${encodeURIComponent(profileEmail)}`;

        const res = await fetch(url);
        const result = await res.json();

        if (result.success) {
            showPopup("Contact Added", "This person is now in your contacts.");
        } else {
            showPopup("Error", result.message || "Failed to add contact.");
        }

    } catch (err) {
        showPopup("Network Error", "Unable to add contact.");
    }
}

document.addEventListener("DOMContentLoaded", () => {
    loadNavbar();
    loadPublicProfile();
});

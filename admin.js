import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-lite.js";
import {
  getStorage,
  ref,
  deleteObject,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDhB0oSGJFZnqF90ocp-WiSP1mm323b7z8",
  authDomain: "mama-memorial-c042f.firebaseapp.com",
  projectId: "mama-memorial-c042f",
  storageBucket: "mama-memorial-c042f.firebasestorage.app",
  messagingSenderId: "797464580205",
  appId: "1:797464580205:web:22f3b497f75c40ce496f64",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "default");
const storage = getStorage(app);

const tributesRef = collection(db, "tributes");
const imagesRef = collection(db, "images");

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeDateString(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sortNewestFirst(items) {
  return items.sort((a, b) => {
    const aTime = a.createdAt || a.approvedAt || "";
    const bTime = b.createdAt || b.approvedAt || "";
    return bTime.localeCompare(aTime);
  });
}

function renderEmpty(container, text) {
  container.innerHTML = `<div class="muted">${text}</div>`;
}

function renderTributes(containerId, items, isPending) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!items.length) {
    renderEmpty(container, "Nothing here.");
    return;
  }

  container.innerHTML = items.map((item) => `
    <div class="card">
      <div class="meta">
        <strong>${escapeHtml(item.name || "Unknown")}</strong><br>
        ${escapeHtml(item.relation || "")}<br>
        ${safeDateString(item.createdAt || item.approvedAt)}
      </div>
      <div class="text">${escapeHtml(item.message || "")}</div>
      <div class="actions">
        ${
          isPending
            ? `<button onclick="approveTribute('${item.id}')">Approve</button>`
            : ""
        }
        <button class="danger" onclick="deleteTributeItem('${item.id}')">Delete</button>
      </div>
    </div>
  `).join("");
}

function renderMedia(containerId, items, isPending) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!items.length) {
    renderEmpty(container, "Nothing here.");
    return;
  }

  container.innerHTML = items.map((item) => {
    const isVideo =
      item.type === "video" || /\.(mp4|webm|mov|ogg)$/i.test(item.url || "");

    return `
      <div class="card">
        <div class="pill">${isVideo ? "Video" : "Image"}</div>
        ${
          isVideo
            ? `<video class="thumb" src="${item.url}" controls preload="metadata"></video>`
            : `<img class="thumb" src="${item.url}" alt="${escapeHtml(item.caption || "media")}">`
        }
        <div class="meta">
          ${safeDateString(item.createdAt || item.approvedAt)}
          ${item.caption ? `<br>${escapeHtml(item.caption)}` : ""}
        </div>
        <div class="actions">
          ${
            isPending
              ? `<button onclick="approveMedia('${item.id}')">Approve</button>`
              : ""
          }
          <button class="danger" onclick="deleteMediaItem('${item.id}', '${encodeURIComponent(item.url || "")}')">Delete</button>
        </div>
      </div>
    `;
  }).join("");
}

async function fetchAll(colRef) {
  const snap = await getDocs(colRef);
  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));
}

async function loadAdmin() {
  try {
    const [allTributes, allMedia] = await Promise.all([
      fetchAll(tributesRef),
      fetchAll(imagesRef),
    ]);

    const pendingTributes = allTributes.filter((x) => x.approved !== true);
    const approvedTributes = allTributes.filter((x) => x.approved === true);
    const pendingMedia = allMedia.filter((x) => x.approved !== true);
    const approvedMedia = allMedia.filter((x) => x.approved === true);

    renderTributes("pending-tributes", sortNewestFirst(pendingTributes), true);
    renderTributes("approved-tributes", sortNewestFirst(approvedTributes), false);
    renderMedia("pending-media", sortNewestFirst(pendingMedia), true);
    renderMedia("approved-media", sortNewestFirst(approvedMedia), false);
  } catch (err) {
    console.error("Admin load error:", err);
    ["pending-tributes", "approved-tributes", "pending-media", "approved-media"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = `<div class="muted">Could not load data.</div>`;
    });
  }
}

window.refreshAdmin = async function () {
  await loadAdmin();
};

window.approveTribute = async function (id) {
  try {
    await updateDoc(doc(db, "tributes", id), {
      approved: true,
      approvedAt: new Date().toISOString(),
    });
    await loadAdmin();
  } catch (err) {
    console.error("approveTribute error:", err);
    alert("Could not approve tribute.");
  }
};

window.deleteTributeItem = async function (id) {
  const ok = confirm("Delete this tribute?");
  if (!ok) return;

  try {
    await deleteDoc(doc(db, "tributes", id));
    await loadAdmin();
  } catch (err) {
    console.error("deleteTributeItem error:", err);
    alert("Could not delete tribute.");
  }
};

window.approveMedia = async function (id) {
  try {
    await updateDoc(doc(db, "images", id), {
      approved: true,
      approvedAt: new Date().toISOString(),
    });
    await loadAdmin();
  } catch (err) {
    console.error("approveMedia error:", err);
    alert("Could not approve media.");
  }
};

function getStoragePathFromUrl(url) {
  try {
    const decoded = decodeURIComponent(url);
    const match = decoded.match(/\/o\/(.+?)\?/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

window.deleteMediaItem = async function (id, encodedUrl) {
  const ok = confirm("Delete this media item?");
  if (!ok) return;

  try {
    const url = decodeURIComponent(encodedUrl);

    await deleteDoc(doc(db, "images", id));

    const storagePath = getStoragePathFromUrl(url);
    if (storagePath) {
      try {
        await deleteObject(ref(storage, storagePath));
      } catch (storageErr) {
        console.warn("Storage file could not be deleted:", storageErr);
      }
    }

    await loadAdmin();
  } catch (err) {
    console.error("deleteMediaItem error:", err);
    alert("Could not delete media item.");
  }
};

window.addEventListener("DOMContentLoaded", loadAdmin);
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-lite.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

/* ─── CONFIG ─── */
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

let galleryItems = [];
let currentGalleryPage = 1;
const GALLERY_ITEMS_PER_PAGE = 8;

let lightboxItems = [];
let currentLightboxIndex = 0;

let tributeItems = [];
let currentTributePage = 1;
const TRIBUTES_PER_PAGE = 6;

let touchStartX = 0;
let touchEndX = 0;
const SWIPE_THRESHOLD = 50;

/* ════════════════════════════════════════
   TOAST
════════════════════════════════════════ */

function showToast(message, type = "success", duration = 3800) {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.textContent = message;
  toast.className = `toast show ${type}`;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.className = "toast";
  }, duration);
}

/* ════════════════════════════════════════
   UTILITY
════════════════════════════════════════ */

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
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/* ════════════════════════════════════════
   TRIBUTES — LOAD & RENDER
════════════════════════════════════════ */

async function loadTributes() {
  const list = document.getElementById("tributes-list");
  const pagination = document.getElementById("tributes-pagination");
  if (!list) return;

  list.innerHTML = '<div class="loading-tributes">Loading tributes…</div>';
  if (pagination) pagination.innerHTML = "";

  try {
    const q = query(tributesRef, where("approved", "==", true));
    const snapshot = await getDocs(q);

    tributeItems = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    tributeItems.sort((a, b) => {
      const aTime = a.approvedAt || a.createdAt || "";
      const bTime = b.approvedAt || b.createdAt || "";
      return bTime.localeCompare(aTime);
    });

    if (!tributeItems.length) {
      list.innerHTML =
        '<div class="empty-tributes">No tributes have been approved yet.</div>';
      return;
    }

    currentTributePage = 1;
    renderTributePage();
    renderTributePagination();
  } catch (err) {
    console.error("loadTributes error:", err);
    list.innerHTML =
      '<div class="empty-tributes">Could not load tributes. Please refresh the page.</div>';
  }
}

function renderTributePage() {
  const list = document.getElementById("tributes-list");
  if (!list) return;

  list.innerHTML = "";

  const start = (currentTributePage - 1) * TRIBUTES_PER_PAGE;
  const end = start + TRIBUTES_PER_PAGE;
  const pageItems = tributeItems.slice(start, end);

  pageItems.forEach((t) => {
    const date = safeDateString(t.approvedAt || t.createdAt);

    const el = document.createElement("div");
    el.className = "tribute-card";
    el.innerHTML = `
      <div class="tribute-meta">
        <div>
          <div class="tribute-name">${escapeHtml(t.name)}</div>
          <div class="tribute-relation">${escapeHtml(t.relation)}</div>
        </div>
        ${date ? `<div class="tribute-date">${date}</div>` : ""}
      </div>
      <div class="tribute-text">${escapeHtml(t.message)}</div>
    `;
    list.appendChild(el);
  });
}

function renderTributePagination() {
  const wrap = document.getElementById("tributes-pagination");
  if (!wrap) return;

  wrap.innerHTML = "";

  const totalPages = Math.ceil(tributeItems.length / TRIBUTES_PER_PAGE);
  if (totalPages <= 1) return;

  const prevBtn = document.createElement("button");
  prevBtn.className = "gallery-page-btn";
  prevBtn.textContent = "Prev";
  prevBtn.disabled = currentTributePage === 1;
  prevBtn.onclick = () => {
    currentTributePage--;
    renderTributePage();
    renderTributePagination();
  };
  wrap.appendChild(prevBtn);

  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement("button");
    btn.className = "gallery-page-btn" + (i === currentTributePage ? " active" : "");
    btn.textContent = i;
    btn.onclick = () => {
      currentTributePage = i;
      renderTributePage();
      renderTributePagination();
    };
    wrap.appendChild(btn);
  }

  const nextBtn = document.createElement("button");
  nextBtn.className = "gallery-page-btn";
  nextBtn.textContent = "Next";
  nextBtn.disabled = currentTributePage === totalPages;
  nextBtn.onclick = () => {
    currentTributePage++;
    renderTributePage();
    renderTributePagination();
  };
  wrap.appendChild(nextBtn);
}

/* ════════════════════════════════════════
   TRIBUTES — SUBMIT
════════════════════════════════════════ */

window.submitTribute = async function () {
  const nameEl = document.getElementById("t-name");
  const relationEl = document.getElementById("t-relation");
  const messageEl = document.getElementById("t-message");
  const btn = document.getElementById("submit-btn");
  const errorEl = document.getElementById("t-error");
  const successEl = document.getElementById("t-success");

  if (!nameEl || !relationEl || !messageEl || !btn || !errorEl || !successEl) {
    console.error("Tribute form elements not found.");
    return;
  }

  const name = nameEl.value.trim();
  const relation = relationEl.value.trim();
  const message = messageEl.value.trim();

  errorEl.style.display = "none";
  successEl.style.display = "none";

  if (!name || !relation || !message) {
    errorEl.textContent = "Please fill in all fields before submitting.";
    errorEl.style.display = "block";
    return;
  }

  btn.disabled = true;
  btn.textContent = "Submitting…";

  try {
    await addDoc(tributesRef, {
      name,
      relation,
      message,
      approved: false,
      createdAt: new Date().toISOString(),
      approvedAt: "",
    });

    nameEl.value = "";
    relationEl.value = "";
    messageEl.value = "";

    successEl.textContent =
      "Thank you — your tribute has been submitted and is awaiting approval.";
    successEl.style.display = "block";

    showToast("Tribute submitted successfully 🕯", "success");
  } catch (err) {
    console.error("submitTribute error:", err);
    errorEl.textContent = "Something went wrong. Please try again.";
    errorEl.style.display = "block";
    showToast("Tribute submission failed.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Submit Tribute";
  }
};

/* ════════════════════════════════════════
   GALLERY — LOAD & RENDER
════════════════════════════════════════ */

async function loadImages() {
  try {
    const q = query(imagesRef, where("approved", "==", true));
    const snapshot = await getDocs(q);

    galleryItems = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    galleryItems = galleryItems.filter((img) => !!img.url);

    galleryItems.sort((a, b) => {
      const aTime = a.approvedAt || a.createdAt || "";
      const bTime = b.approvedAt || b.createdAt || "";
      return aTime.localeCompare(bTime);
    });

    currentGalleryPage = 1;
    renderGalleryPage();
    renderGalleryPagination();
  } catch (err) {
    console.error("loadImages error:", err);
  }
}

function renderGalleryPage() {
  const grid = document.getElementById("gallery-grid");
  const btn = document.getElementById("add-photo-btn");
  if (!grid || !btn) return;

  grid.querySelectorAll(".gallery-item").forEach((el) => el.remove());

  if (!galleryItems.length) return;

  const start = (currentGalleryPage - 1) * GALLERY_ITEMS_PER_PAGE;
  const end = start + GALLERY_ITEMS_PER_PAGE;
  const pageItems = galleryItems.slice(start, end);

  pageItems.forEach((img) => {
    const el = document.createElement("div");
    el.className = "gallery-item";

    const isVideo =
      img.type === "video" || /\.(mp4|webm|mov|ogg)$/i.test(img.url);

    el.innerHTML = isVideo
      ? `
        <video class="gallery-img" src="${img.url}" muted playsinline preload="metadata"></video>
        ${img.caption ? `<div class="gallery-img-caption">${escapeHtml(img.caption)}</div>` : ""}
      `
      : `
        <img class="gallery-img" src="${img.url}" alt="${escapeHtml(img.caption || "A memory")}" loading="lazy">
        ${img.caption ? `<div class="gallery-img-caption">${escapeHtml(img.caption)}</div>` : ""}
      `;

    el.addEventListener("click", () => openLightboxById(img.id));

    grid.insertBefore(el, btn);
  });
}

function renderGalleryPagination() {
  const wrap = document.getElementById("gallery-pagination");
  if (!wrap) return;

  wrap.innerHTML = "";

  const totalPages = Math.ceil(galleryItems.length / GALLERY_ITEMS_PER_PAGE);
  if (totalPages <= 1) return;

  const prevBtn = document.createElement("button");
  prevBtn.className = "gallery-page-btn";
  prevBtn.textContent = "Prev";
  prevBtn.disabled = currentGalleryPage === 1;
  prevBtn.onclick = () => {
    currentGalleryPage--;
    renderGalleryPage();
    renderGalleryPagination();
  };
  wrap.appendChild(prevBtn);

  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement("button");
    btn.className = "gallery-page-btn" + (i === currentGalleryPage ? " active" : "");
    btn.textContent = i;
    btn.onclick = () => {
      currentGalleryPage = i;
      renderGalleryPage();
      renderGalleryPagination();
    };
    wrap.appendChild(btn);
  }

  const nextBtn = document.createElement("button");
  nextBtn.className = "gallery-page-btn";
  nextBtn.textContent = "Next";
  nextBtn.disabled = currentGalleryPage === totalPages;
  nextBtn.onclick = () => {
    currentGalleryPage++;
    renderGalleryPage();
    renderGalleryPagination();
  };
  wrap.appendChild(nextBtn);
}

/* ════════════════════════════════════════
   MODAL — MULTI-FILE UPLOAD
════════════════════════════════════════ */

let selectedFiles = [];

window.openModal = () => {
  document.getElementById("modal")?.classList.add("open");
};

window.closeModal = () => {
  document.getElementById("modal")?.classList.remove("open");
};

window.closeModalOutside = (e) => {
  if (e.target.id === "modal") {
    closeModal();
  }
};

window.onFilesSelected = function (e) {
  addFiles(Array.from(e.target.files || []));
  e.target.value = "";
};

function addFiles(files) {
  files.forEach((file) => {
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      return;
    }

    selectedFiles.push({
      file,
      objectUrl: URL.createObjectURL(file),
    });
  });

  renderFilePreviews();
}

window.removeFile = function (index) {
  if (!selectedFiles[index]) return;
  URL.revokeObjectURL(selectedFiles[index].objectUrl);
  selectedFiles.splice(index, 1);
  renderFilePreviews();
};

function renderFilePreviews() {
  const list = document.getElementById("file-preview-list");
  if (!list) return;

  list.innerHTML = "";

  selectedFiles.forEach(({ file, objectUrl }, i) => {
    const isVideo = file.type.startsWith("video/");
    const item = document.createElement("div");
    item.className = "file-preview-item";
    item.innerHTML = `
      ${
        isVideo
          ? `<div class="file-preview-thumb" style="display:flex;align-items:center;justify-content:center;font-size:1.3rem">🎬</div>`
          : `<img class="file-preview-thumb" src="${objectUrl}" alt="">`
      }
      <span class="file-preview-name">${escapeHtml(file.name)}</span>
      <span class="file-preview-status" id="file-status-${i}"></span>
      <button class="file-preview-remove" onclick="removeFile(${i})" title="Remove">×</button>
    `;
    list.appendChild(item);
  });
}

window.uploadFiles = async function () {
  if (selectedFiles.length === 0) {
    showToast("Please select at least one file.", "error");
    return;
  }

  const caption = document.getElementById("modal-caption")?.value.trim() || "";
  const uploadBtn = document.getElementById("modal-upload-btn");
  const statusEl = document.getElementById("modal-status");

  if (uploadBtn) uploadBtn.disabled = true;
  if (statusEl) statusEl.textContent = `Uploading 1 of ${selectedFiles.length}…`;

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < selectedFiles.length; i++) {
    const { file } = selectedFiles[i];
    const statusItemEl = document.getElementById(`file-status-${i}`);

    try {
      if (statusItemEl) statusItemEl.textContent = "Uploading…";

      const folder = file.type.startsWith("video/") ? "videos" : "images";
      const fileName = `${Date.now()}_${file.name}`;
      const fileRef = ref(storage, `${folder}/${fileName}`);

      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);

      await addDoc(imagesRef, {
        url,
        caption,
        type: file.type.startsWith("video/") ? "video" : "image",
        approved: false,
        createdAt: new Date().toISOString(),
        approvedAt: "",
      });

      successCount++;

      if (statusEl) {
        statusEl.textContent = `Uploaded ${successCount} of ${selectedFiles.length}…`;
      }

      if (statusItemEl) {
        statusItemEl.textContent = "✓";
        statusItemEl.className = "file-preview-status done";
      }
    } catch (err) {
      console.error(`Upload error for ${file.name}:`, err);
      failCount++;

      if (statusItemEl) {
        statusItemEl.textContent = "✗";
        statusItemEl.className = "file-preview-status error";
      }
    }
  }

  if (uploadBtn) uploadBtn.disabled = false;

  if (failCount === 0) {
    if (statusEl) statusEl.textContent = "Upload complete. Awaiting approval.";
    showToast(
      successCount === 1
        ? "File submitted for approval 🕯"
        : `${successCount} files submitted for approval 🕯`,
      "success"
    );
    clearModal();
    closeModal();
  } else if (successCount > 0) {
    if (statusEl) statusEl.textContent = `${successCount} uploaded, ${failCount} failed.`;
    showToast(`${successCount} uploaded, ${failCount} failed.`, "error");
  } else {
    if (statusEl) statusEl.textContent = "Upload failed. Please try again.";
    showToast("Upload failed. Please try again.", "error");
  }
};

function clearModal() {
  selectedFiles.forEach(({ objectUrl }) => URL.revokeObjectURL(objectUrl));
  selectedFiles = [];

  const previewList = document.getElementById("file-preview-list");
  const captionInput = document.getElementById("modal-caption");
  const statusEl = document.getElementById("modal-status");

  if (previewList) previewList.innerHTML = "";
  if (captionInput) captionInput.value = "";
  if (statusEl) statusEl.textContent = "";
}

/* ════════════════════════════════════════
   DRAG AND DROP
════════════════════════════════════════ */

function initDropZone() {
  const dropZone = document.getElementById("drop-zone");
  if (!dropZone) return;

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    addFiles(Array.from(e.dataTransfer.files || []));
  });
}

/* ════════════════════════════════════════
   INIT
════════════════════════════════════════ */


window.addEventListener("DOMContentLoaded", async () => {
  initDropZone();
  initMusic();
  initLightboxSwipe();
  await Promise.all([loadTributes(), loadImages()]);
});

/* ════════════════════════════════════════
   MUSIC
════════════════════════════════════════ */

let audio = null;
let playBtn = null;
let volumeInput = null;
let playing = false;

function initMusic() {
  audio = document.getElementById("bg-music");
  playBtn = document.getElementById("play-btn") || document.getElementById("music-play-btn");
  volumeInput = document.querySelector(".music-vol input[type='range']");

  if (!audio || !playBtn) return;

  audio.volume = volumeInput ? parseFloat(volumeInput.value) : 0.4;

  playBtn.addEventListener("click", toggleMusic);

  if (volumeInput) {
    volumeInput.addEventListener("input", (e) => {
      setVol(e.target.value);
    });
  }

  audio.addEventListener("play", () => {
    playing = true;
    playBtn.textContent = "⏸";
  });

  audio.addEventListener("pause", () => {
    playing = false;
    playBtn.textContent = "▶";
  });

  audio.addEventListener("ended", () => {
    playing = false;
    playBtn.textContent = "▶";
  });
}

window.toggleMusic = async function () {
  if (!audio) return;

  try {
    if (playing) {
      audio.pause();
    } else {
      await audio.play();
    }
  } catch (err) {
    console.error("Music playback failed:", err);
    showToast("Tap play again to start the music.", "error");
  }
};

window.setVol = function (value) {
  if (!audio) return;
  audio.volume = parseFloat(value);
};

function openLightboxById(id) {
  lightboxItems = galleryItems;
  currentLightboxIndex = lightboxItems.findIndex((item) => item.id === id);

  if (currentLightboxIndex < 0) return;

  renderLightboxItem();
  document.getElementById("lightbox")?.classList.add("open");
  document.body.style.overflow = "hidden";
}

function renderLightboxItem() {
  const mediaWrap = document.getElementById("lightbox-media-wrap");
  const captionEl = document.getElementById("lightbox-caption");
  const counterEl = document.getElementById("lightbox-counter");

  if (!mediaWrap || !captionEl || !counterEl) return;

  const item = lightboxItems[currentLightboxIndex];
  if (!item) return;

  const isVideo =
    item.type === "video" || /\.(mp4|webm|mov|ogg)$/i.test(item.url || "");

  mediaWrap.innerHTML = isVideo
    ? `<video src="${item.url}" controls autoplay playsinline style="width:100%;max-height:75vh;"></video>`
    : `<img src="${item.url}" alt="${escapeHtml(item.caption || "Memory")}">`;

  counterEl.textContent = `${currentLightboxIndex + 1} of ${lightboxItems.length}`;
  captionEl.textContent = item.caption || "";
}


window.closeLightbox = function () {
  const lightbox = document.getElementById("lightbox");
  const mediaWrap = document.getElementById("lightbox-media-wrap");

  if (mediaWrap) {
    const video = mediaWrap.querySelector("video");
    if (video) {
      video.pause();
      video.currentTime = 0;
    }
  }

  lightbox?.classList.remove("open");
  document.body.style.overflow = "";
};

window.closeLightboxOutside = function (e) {
  if (e.target.id === "lightbox") {
    closeLightbox();
  }
};

window.showPrevLightboxItem = function () {
  if (!lightboxItems.length) return;
  currentLightboxIndex =
    (currentLightboxIndex - 1 + lightboxItems.length) % lightboxItems.length;
  renderLightboxItem();
};

window.showNextLightboxItem = function () {
  if (!lightboxItems.length) return;
  currentLightboxIndex =
    (currentLightboxIndex + 1) % lightboxItems.length;
  renderLightboxItem();
};

document.addEventListener("keydown", (e) => {
  const lightboxOpen = document.getElementById("lightbox")?.classList.contains("open");
  if (!lightboxOpen) return;

  if (e.key === "Escape") closeLightbox();
  if (e.key === "ArrowLeft") showPrevLightboxItem();
  if (e.key === "ArrowRight") showNextLightboxItem();
});

function handleLightboxSwipe() {
  const deltaX = touchEndX - touchStartX;

  if (Math.abs(deltaX) < SWIPE_THRESHOLD) return;

  if (deltaX < 0) {
    showNextLightboxItem();
  } else {
    showPrevLightboxItem();
  }
}

function initLightboxSwipe() {
  const mediaWrap = document.getElementById("lightbox-media-wrap");
  if (!mediaWrap) return;

  mediaWrap.addEventListener("touchstart", (e) => {
    touchStartX = e.changedTouches[0].clientX;
  }, { passive: true });

  mediaWrap.addEventListener("touchend", (e) => {
    touchEndX = e.changedTouches[0].clientX;
    handleLightboxSwipe();
  }, { passive: true });
}
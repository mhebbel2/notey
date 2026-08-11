"use strict";

/* ---------- Storage ---------- */
const STORAGE_KEY = "notey.notes";

function loadNotes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const notes = raw ? JSON.parse(raw) : [];
    return Array.isArray(notes) ? notes : [];
  } catch {
    return [];
  }
}

function saveNotes(notes) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

/* ---------- State ---------- */
let notes = loadNotes();
let activeId = null;

/* ---------- DOM ---------- */
const listEl = document.getElementById("note-list");
const emptyListEl = document.getElementById("empty-list");
const editorEmptyEl = document.getElementById("editor-empty");
const editorPaneEl = document.getElementById("editor-pane");
const contentEl = document.getElementById("note-content");
const metaEl = document.getElementById("note-meta");
const importFileEl = document.getElementById("import-file");

/* ---------- Helpers ---------- */
function getActiveNote() {
  return notes.find((n) => n.id === activeId) || null;
}

function noteTitle(note) {
  const firstLine = (note.content.split("\n").find((l) => l.trim() !== "") || "")
    .trim()
    .replace(/^#+\s*/, "");
  return firstLine.slice(0, 60) || "Untitled";
}

function formatDate(ts) {
  return new Date(ts).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/* ---------- Rendering ---------- */
function renderList() {
  listEl.innerHTML = "";
  const sorted = [...notes].sort((a, b) => b.updatedAt - a.updatedAt);
  emptyListEl.style.display = sorted.length ? "none" : "block";

  for (const note of sorted) {
    const li = document.createElement("li");
    if (note.id === activeId) li.classList.add("active");
    li.addEventListener("click", () => selectNote(note.id));

    const text = document.createElement("div");
    text.className = "note-item-text";

    const title = document.createElement("span");
    title.className = "note-item-title";
    title.textContent = noteTitle(note);

    const date = document.createElement("span");
    date.className = "note-item-date";
    date.textContent = formatDate(note.updatedAt);

    const del = document.createElement("button");
    del.className = "note-item-delete";
    del.title = "Delete note";
    del.textContent = "✕";
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteNote(note.id);
    });

    text.append(title, date);
    li.append(text, del);
    listEl.appendChild(li);
  }
}

function renderEditor() {
  const note = getActiveNote();
  editorEmptyEl.style.display = note ? "none" : "flex";
  editorPaneEl.hidden = !note;
  if (note) {
    contentEl.value = note.content;
    metaEl.textContent = `Updated ${formatDate(note.updatedAt)}`;
  }
}

function render() {
  renderList();
  renderEditor();
}

/* ---------- CRUD ---------- */
function createNote() {
  const note = {
    id: crypto.randomUUID(),
    content: "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  notes.push(note);
  saveNotes(notes);
  selectNote(note.id);
  contentEl.focus();
}

function selectNote(id) {
  activeId = id;
  render();
}

function updateActiveContent(content) {
  const note = getActiveNote();
  if (!note) return;
  note.content = content;
  note.updatedAt = Date.now();
  saveNotes(notes);
  metaEl.textContent = `Updated ${formatDate(note.updatedAt)}`;
  renderList();
}

function deleteNote(id) {
  const note = notes.find((n) => n.id === id);
  if (!note) return;
  if (!confirm(`Delete “${noteTitle(note)}”?`)) return;
  notes = notes.filter((n) => n.id !== id);
  if (activeId === id) activeId = null;
  saveNotes(notes);
  render();
}

/* ---------- Backup: export / import ---------- */
function exportNotes() {
  const payload = {
    app: "notey",
    version: 1,
    exportedAt: new Date().toISOString(),
    notes,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `notey-backup-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importNotes(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      const imported = Array.isArray(data) ? data : data.notes;
      if (!Array.isArray(imported)) throw new Error("bad format");

      const valid = imported.filter(
        (n) => n && typeof n.id === "string" && typeof n.content === "string"
      );
      if (valid.length === 0) throw new Error("no valid notes");

      if (
        notes.length > 0 &&
        !confirm(`Import ${valid.length} note(s) and replace all current notes?`)
      ) {
        return;
      }
      notes = valid.map((n) => ({
        id: n.id,
        content: n.content,
        createdAt: Number(n.createdAt) || Date.now(),
        updatedAt: Number(n.updatedAt) || Date.now(),
      }));
      activeId = null;
      saveNotes(notes);
      render();
      alert(`Imported ${notes.length} note(s).`);
    } catch {
      alert("Import failed: not a valid Notey backup file.");
    }
  };
  reader.readAsText(file);
}

/* ---------- Burger menu ---------- */
const btnMenuEl = document.getElementById("btn-menu");
const menuEl = document.getElementById("menu");

function closeMenu() {
  menuEl.hidden = true;
  btnMenuEl.setAttribute("aria-expanded", "false");
}

btnMenuEl.addEventListener("click", (e) => {
  e.stopPropagation();
  const opening = menuEl.hidden;
  menuEl.hidden = !opening;
  btnMenuEl.setAttribute("aria-expanded", String(opening));
});

document.addEventListener("click", (e) => {
  if (!menuEl.hidden && !e.target.closest(".menu-wrap")) closeMenu();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeMenu();
});

/* ---------- Events ---------- */
document.getElementById("btn-new").addEventListener("click", createNote);
document.getElementById("btn-export").addEventListener("click", () => {
  closeMenu();
  exportNotes();
});
document.getElementById("btn-import").addEventListener("click", () => {
  closeMenu();
  importFileEl.click();
});
document.getElementById("btn-delete").addEventListener("click", () => {
  if (activeId) deleteNote(activeId);
});

importFileEl.addEventListener("change", () => {
  const file = importFileEl.files[0];
  if (file) importNotes(file);
  importFileEl.value = "";
});

let saveTimer = null;
contentEl.addEventListener("input", () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => updateActiveContent(contentEl.value), 300);
});

/* ---------- PWA ---------- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

/* ---------- Init ---------- */
render();

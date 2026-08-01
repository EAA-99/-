// ===== 공통 상수 =====
const GITHUB_CFG_KEY = "songbook_github_cfg";
const DEFAULT_GITHUB_CFG = { owner: "eaa-99", repo: "-", branch: "main" };
const TAG_OPTIONS = ["한식", "일식", "양식"];
const VIEW_MODE_KEY = "songbook_view_mode";

const isMobile = window.matchMedia("(max-width: 640px)").matches;

let songs = [];
let viewMode = !isMobile && localStorage.getItem(VIEW_MODE_KEY) === "grid" ? "grid" : "list";

// ===== 보기 모드 DOM =====
const listEl = document.getElementById("song-list");
const searchEl = document.getElementById("search");

function createSortSelector(container, options, initialValue, onChange) {
  let value = initialValue;

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "sort-select-trigger";
  container.appendChild(trigger);

  const dropdown = document.createElement("div");
  dropdown.className = "sort-dropdown";
  dropdown.hidden = true;
  container.appendChild(dropdown);

  function updateTrigger() {
    const opt = options.find((o) => o.value === value);
    trigger.innerHTML = `<span>${opt ? opt.label : ""}</span><span class="chevron">▾</span>`;
  }

  function updateActive() {
    dropdown.querySelectorAll(".sort-option").forEach((btn, i) => {
      btn.classList.toggle("active", options[i].value === value);
    });
  }

  for (const opt of options) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "sort-option";
    btn.textContent = opt.label;
    btn.addEventListener("click", () => {
      value = opt.value;
      updateTrigger();
      updateActive();
      dropdown.hidden = true;
      if (onChange) onChange();
    });
    dropdown.appendChild(btn);
  }

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.hidden = !dropdown.hidden;
  });

  document.addEventListener("click", (e) => {
    if (!container.contains(e.target)) dropdown.hidden = true;
  });

  updateTrigger();
  updateActive();

  return { getValue: () => value };
}

const sortWidget = createSortSelector(
  document.getElementById("sort-select"),
  [
    { value: "artist", label: "가수이름순" },
    { value: "difficulty", label: "숙련도순" },
    { value: "title", label: "가나다순" },
    { value: "recent", label: "최근 등록순" },
  ],
  "artist",
  () => applyFilters()
);

// ===== 관리자 도구 DOM =====
const statusEl = document.getElementById("status");
const cfgStatusEl = document.getElementById("cfg-status");
const adminToolsEl = document.getElementById("admin-tools");
document.getElementById("admin-tools-btn").addEventListener("click", () => {
  adminToolsEl.hidden = false;
});
document.getElementById("admin-tools-close-btn").addEventListener("click", () => {
  adminToolsEl.hidden = true;
});
adminToolsEl.addEventListener("click", (e) => {
  if (e.target === adminToolsEl) adminToolsEl.hidden = true;
});

// ===== 곡 추가 팝업 DOM =====
const quickAddBtn = document.getElementById("quick-add-btn");
const quickAddModal = document.getElementById("quick-add-modal");
const qaStatusEl = document.getElementById("qa-status");
const qaTitleEl = document.getElementById("qa-title");
const qaArtistEl = document.getElementById("qa-artist");
const qaNotesEl = document.getElementById("qa-notes");
const qaMrEl = document.getElementById("qa-mr");

// ===== 삭제 확인 팝업 DOM =====
const confirmModal = document.getElementById("confirm-modal");
const confirmMessageEl = document.getElementById("confirm-message");
const confirmOkBtn = document.getElementById("confirm-ok-btn");
const confirmCancelBtn = document.getElementById("confirm-cancel-btn");

function confirmDialog(message) {
  confirmMessageEl.textContent = message;
  confirmModal.hidden = false;
  return new Promise((resolve) => {
    function cleanup(result) {
      confirmModal.hidden = true;
      confirmOkBtn.removeEventListener("click", onOk);
      confirmCancelBtn.removeEventListener("click", onCancel);
      confirmModal.removeEventListener("click", onOverlay);
      resolve(result);
    }
    function onOk() { cleanup(true); }
    function onCancel() { cleanup(false); }
    function onOverlay(e) { if (e.target === confirmModal) cleanup(false); }
    confirmOkBtn.addEventListener("click", onOk);
    confirmCancelBtn.addEventListener("click", onCancel);
    confirmModal.addEventListener("click", onOverlay);
  });
}

// ===== 공통 헬퍼 =====
function getTags(song) {
  return song.tags || (song.tag ? [song.tag] : []);
}

function getCategoryTag(song) {
  return getTags(song).find((t) => TAG_OPTIONS.includes(t)) || "";
}

function getNoteTags(song) {
  return getTags(song).filter((t) => !TAG_OPTIONS.includes(t));
}

function normalizeSong(song) {
  if (!song.tags) {
    song.tags = song.tag ? [song.tag] : [];
  }
  delete song.tag;
  return song;
}

function parseNotes(text) {
  return text
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function getGithubConfig() {
  let saved;
  try {
    saved = JSON.parse(localStorage.getItem(GITHUB_CFG_KEY)) || {};
  } catch {
    saved = {};
  }
  return {
    owner: saved.owner || DEFAULT_GITHUB_CFG.owner,
    repo: saved.repo || DEFAULT_GITHUB_CFG.repo,
    branch: saved.branch || DEFAULT_GITHUB_CFG.branch,
    token: saved.token || "",
  };
}

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function base64ToUtf8(base64) {
  const binary = atob(base64.replace(/\n/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

// GitHub에서 최신 songs.json + sha를 가져옵니다 (즉시 반영용 추가/삭제와 관리자 도구 새로고침이 공용으로 씁니다).
async function fetchLatestFromGithub(cfg) {
  const branch = cfg.branch || "main";
  const apiUrl = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/songs.json`;
  const headers = { Authorization: `Bearer ${cfg.token}`, Accept: "application/vnd.github+json" };
  const res = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, { headers, cache: "no-store" });
  if (!res.ok) throw new Error(`파일 조회 실패 (${res.status})`);
  const data = await res.json();
  return {
    songs: JSON.parse(base64ToUtf8(data.content)).map(normalizeSong),
    sha: data.sha,
    apiUrl,
    headers,
    branch,
  };
}

async function putSongsToGithub(ctx, newSongs, message) {
  const res = await fetch(ctx.apiUrl, {
    method: "PUT",
    headers: { ...ctx.headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      content: utf8ToBase64(JSON.stringify(newSongs, null, 2)),
      branch: ctx.branch,
      sha: ctx.sha,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `저장 실패 (${res.status})`);
  }
}

// GitHub에 커밋을 연달아 하면 방금 만든 sha가 아직 조회 API에 안 나타날 때가 있어서(전파 지연),
// 실패하면 최신 sha를 다시 가져와 짧게 재시도합니다.
async function updateSongsOnGithub(mutate, message, attempts = 3) {
  const cfg = getGithubConfig();
  if (!cfg.owner || !cfg.repo || !cfg.token) {
    throw new Error("GitHub 연동이 설정되어 있지 않습니다. 관리자 도구에서 먼저 설정해주세요.");
  }
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      const ctx = await fetchLatestFromGithub(cfg);
      const newSongs = mutate(ctx.songs);
      await putSongsToGithub(ctx, newSongs, message);
      return newSongs;
    } catch (e) {
      lastError = e;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw lastError;
}

// ===== 장르 선택기 / 별점 위젯 (팝업, 관리자 도구 공용) =====
function createGenreSelector(container, options, initialValue, placeholder, onChange) {
  let value = (initialValue || []).find((t) => options.includes(t)) || "";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "sort-select-trigger";
  container.appendChild(trigger);

  const dropdown = document.createElement("div");
  dropdown.className = "sort-dropdown";
  dropdown.hidden = true;
  container.appendChild(dropdown);

  function updateTrigger() {
    trigger.innerHTML = `<span>${value || placeholder}</span><span class="chevron">▾</span>`;
  }

  function updateActive() {
    dropdown.querySelectorAll(".sort-option").forEach((btn, i) => {
      btn.classList.toggle("active", options[i] === value);
    });
  }

  for (const opt of options) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "sort-option";
    btn.textContent = opt;
    btn.addEventListener("click", () => {
      value = value === opt ? "" : opt;
      updateTrigger();
      updateActive();
      dropdown.hidden = true;
      if (onChange) onChange(value);
    });
    dropdown.appendChild(btn);
  }

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.hidden = !dropdown.hidden;
  });

  document.addEventListener("click", (e) => {
    if (!container.contains(e.target)) dropdown.hidden = true;
  });

  updateTrigger();
  updateActive();

  return {
    getValue: () => (value ? [value] : []),
    setValue: (tags) => {
      value = (tags || []).find((t) => options.includes(t)) || "";
      updateTrigger();
      updateActive();
    },
  };
}

function createStarSelector(container, initialValue, onChange) {
  let value = Math.max(0, Math.min(5, Math.round(Number.isFinite(initialValue) ? initialValue : 0)));

  function starsLabel(n) {
    return "★".repeat(n) + "☆".repeat(5 - n);
  }

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "sort-select-trigger";
  container.appendChild(trigger);

  const dropdown = document.createElement("div");
  dropdown.className = "sort-dropdown";
  dropdown.hidden = true;
  container.appendChild(dropdown);

  function updateTrigger() {
    trigger.innerHTML = `<span>${starsLabel(value)}</span><span class="chevron">▾</span>`;
  }

  function updateActive() {
    dropdown.querySelectorAll(".sort-option").forEach((btn, i) => {
      btn.classList.toggle("active", i === value);
    });
  }

  for (let n = 0; n <= 5; n++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "sort-option";
    btn.textContent = starsLabel(n);
    btn.addEventListener("click", () => {
      value = n;
      updateTrigger();
      updateActive();
      dropdown.hidden = true;
      if (onChange) onChange(value);
    });
    dropdown.appendChild(btn);
  }

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.hidden = !dropdown.hidden;
  });

  document.addEventListener("click", (e) => {
    if (!container.contains(e.target)) dropdown.hidden = true;
  });

  updateTrigger();
  updateActive();

  return {
    getValue: () => value,
    setValue: (v) => {
      value = Math.max(0, Math.min(5, Math.round(Number.isFinite(v) ? v : 0)));
      updateTrigger();
      updateActive();
    },
  };
}

// ===== 보기 모드 =====

function starsHtml(value) {
  const pct = Math.max(0, Math.min(5, value)) / 5 * 100;
  return `<span class="stars"><span class="stars-bg">★★★★★</span><span class="stars-fill" style="width:${pct}%">★★★★★</span></span>`;
}

function openMrVideo(url) {
  window.open(url, "_blank", "noopener");
}

function renderView(items) {
  listEl.innerHTML = "";

  if (items.length === 0) {
    listEl.innerHTML = '<li class="empty">검색 결과가 없습니다</li>';
    return;
  }

  const grouped = sortWidget.getValue() === "artist";
  const artistCounts = grouped
    ? items.reduce((acc, s) => ((acc[s.artist] = (acc[s.artist] || 0) + 1), acc), {})
    : null;
  let lastArtist = null;

  for (const song of items) {
    if (grouped && song.artist !== lastArtist) {
      lastArtist = song.artist;
      const header = document.createElement("li");
      header.className = "artist-group";
      header.innerHTML = `<span class="artist-group-name"></span><span class="artist-group-count"></span>`;
      header.querySelector(".artist-group-name").textContent = song.artist;
      header.querySelector(".artist-group-count").textContent = `${artistCounts[song.artist]}곡`;
      listEl.appendChild(header);
    }

    const category = getCategoryTag(song);
    const notes = getNoteTags(song);
    const li = document.createElement("li");
    li.className = "song-item";
    const metaRowHtml = `
      <div class="song-meta-row">
        ${song.difficulty ? starsHtml(song.difficulty) : ""}
        ${song.mr ? `<button class="icon-btn mr-play-btn" title="MR 재생">▶️</button>` : ""}
      </div>
    `;
    const artistHtml = grouped ? "" : `<div class="song-artist"></div>`;
    if (viewMode === "grid") {
      li.innerHTML = `
        <div class="song-main">
          <div class="song-title-row">
            <input type="checkbox" class="song-select">
            <span class="song-title"></span>
          </div>
          ${artistHtml}
        </div>
        <div class="song-side">
          ${metaRowHtml}
          <div class="song-tags">
            ${category ? `<span class="song-badge"></span>` : ""}
          </div>
        </div>
      `;
    } else {
      li.innerHTML = `
        <input type="checkbox" class="song-select">
        <div class="song-main">
          <div class="song-title-row">
            <span class="song-title"></span>
          </div>
          ${artistHtml}
          ${category ? `<span class="song-badge"></span>` : ""}
        </div>
        <div class="song-side">
          ${metaRowHtml}
          <div class="song-tags"></div>
        </div>
      `;
    }
    if (category) li.querySelector(".song-badge").textContent = category;
    li.querySelector(".song-title").textContent = song.title;
    if (!grouped) li.querySelector(".song-artist").textContent = song.artist;
    const tagsEl = li.querySelector(".song-tags");
    for (const tag of notes) {
      const span = document.createElement("span");
      span.className = "song-tag";
      span.textContent = tag;
      tagsEl.appendChild(span);
    }
    const selectInput = li.querySelector(".song-select");
    selectInput.checked = viewSelectedIds.has(song.id);
    selectInput.addEventListener("click", (e) => e.stopPropagation());
    selectInput.addEventListener("change", () => {
      if (selectInput.checked) viewSelectedIds.add(song.id);
      else viewSelectedIds.delete(song.id);
    });
    const mrPlayBtn = li.querySelector(".mr-play-btn");
    if (mrPlayBtn) {
      mrPlayBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openMrVideo(song.mr);
      });
    }
    li.addEventListener("click", () => openEditModal(song));
    listEl.appendChild(li);
  }
}

let activeTag = "";
let viewSelectedIds = new Set();

function filterSongs() {
  const q = searchEl.value.trim().toLowerCase();
  return songs.filter((s) => {
    const matchesQuery = !q || s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q);
    const matchesTag = !activeTag || getTags(s).includes(activeTag);
    return matchesQuery && matchesTag;
  });
}

function sortSongs(items) {
  const sorted = [...items];
  const sortValue = sortWidget.getValue();
  if (sortValue === "difficulty") {
    sorted.sort((a, b) => (b.difficulty || 0) - (a.difficulty || 0));
  } else if (sortValue === "title") {
    sorted.sort((a, b) => a.title.localeCompare(b.title, "ko"));
  } else if (sortValue === "recent") {
    sorted.sort((a, b) => b.id - a.id);
  } else {
    sorted.sort((a, b) => a.artist.localeCompare(b.artist, "ko"));
  }
  return sorted;
}

function updateTagCounts() {
  document.querySelectorAll("#tag-tabs .tag-tab").forEach((btn) => {
    const tag = btn.dataset.tag;
    const count = tag === "" ? songs.length : songs.filter((s) => getTags(s).includes(tag)).length;
    const countEl = btn.querySelector(".tag-count");
    if (countEl) countEl.textContent = count;
  });
}

function applyFilters() {
  renderView(sortSongs(filterSongs()));
  updateTagCounts();
}

searchEl.addEventListener("input", applyFilters);

document.querySelectorAll("#tag-tabs .tag-tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    activeTag = btn.dataset.tag;
    document.querySelectorAll("#tag-tabs .tag-tab").forEach((b) => b.classList.toggle("active", b === btn));
    applyFilters();
  });
});

function applyViewMode() {
  listEl.classList.toggle("grid-view", viewMode === "grid");
  document.querySelectorAll(".view-toggle-btn").forEach((b) => b.classList.toggle("active", b.dataset.view === viewMode));
}

document.querySelectorAll(".view-toggle-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    viewMode = btn.dataset.view;
    localStorage.setItem(VIEW_MODE_KEY, viewMode);
    applyViewMode();
    applyFilters();
  });
});

applyViewMode();

document.getElementById("view-select-all-btn").addEventListener("click", () => {
  const visible = sortSongs(filterSongs());
  const allSelected = visible.length > 0 && visible.every((s) => viewSelectedIds.has(s.id));
  if (allSelected) {
    for (const s of visible) viewSelectedIds.delete(s.id);
  } else {
    for (const s of visible) viewSelectedIds.add(s.id);
  }
  applyFilters();
});

document.getElementById("view-delete-selected-btn").addEventListener("click", async () => {
  if (viewSelectedIds.size === 0) {
    alert("선택된 곡이 없습니다.");
    return;
  }
  if (!(await confirmDialog(`선택한 ${viewSelectedIds.size}곡을 삭제할까요?`))) return;
  try {
    songs = await updateSongsOnGithub(
      (current) => current.filter((s) => !viewSelectedIds.has(s.id)),
      "노래책 곡 일괄 삭제"
    );
    viewSelectedIds.clear();
    applyFilters();
  } catch (e) {
    alert(`삭제 실패: ${e.message}`);
  }
});

// ===== 대기열 (이 브라우저에만 저장, GitHub에는 안 올라감) =====
const QUEUE_KEY = "songbook_queue";
let queue = loadQueue();

function loadQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveQueue() {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

const queueListEl = document.getElementById("queue-list");
const queueCountEl = document.getElementById("queue-count");
const queueDrawerEl = document.getElementById("queue-drawer");
const queueDrawerOverlayEl = document.getElementById("queue-drawer-overlay");

function makeQueueItemDraggable(li) {
  let startY = null;
  let dragging = false;

  li.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button")) return;
    startY = e.clientY;
    li.setPointerCapture(e.pointerId);
  });

  li.addEventListener("pointermove", (e) => {
    if (startY === null) return;
    if (!dragging) {
      if (Math.abs(e.clientY - startY) < 6) return;
      dragging = true;
      li.classList.add("dragging");
    }
    const siblings = [...queueListEl.children];
    const liIndex = siblings.indexOf(li);
    for (let i = 0; i < siblings.length; i++) {
      const other = siblings[i];
      if (other === li) continue;
      const rect = other.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if (e.clientY < midY && i < liIndex) {
        queueListEl.insertBefore(li, other);
        break;
      }
      if (e.clientY > midY && i > liIndex) {
        queueListEl.insertBefore(li, other.nextSibling);
        break;
      }
    }
  });

  function endDrag() {
    if (dragging) {
      li.classList.remove("dragging");
      queue = [...queueListEl.children].map((el) => Number(el.dataset.songId));
      saveQueue();
    }
    startY = null;
    dragging = false;
  }

  li.addEventListener("pointerup", endDrag);
  li.addEventListener("pointercancel", endDrag);
}

function renderQueue() {
  const items = queue.map((id) => songs.find((s) => s.id === id)).filter(Boolean);
  queueCountEl.textContent = items.length;
  queueListEl.innerHTML = "";
  if (items.length === 0) {
    queueListEl.innerHTML = '<li class="empty">대기열이 비어있습니다</li>';
    return;
  }
  for (const song of items) {
    const li = document.createElement("li");
    li.className = "queue-item";
    li.dataset.songId = song.id;
    li.innerHTML = `
      ${song.mr ? `<button class="icon-btn mr-play-btn" title="MR 재생">▶️</button>` : `<span class="queue-play-spacer"></span>`}
      <div class="queue-item-info">
        <span class="queue-item-title"></span>
        <span class="queue-item-artist"></span>
      </div>
      <button class="icon-btn danger queue-remove-btn" title="대기열에서 제거">✕</button>
    `;
    li.querySelector(".queue-item-title").textContent = song.title;
    li.querySelector(".queue-item-artist").textContent = song.artist;
    const mrPlayBtn = li.querySelector(".mr-play-btn");
    if (mrPlayBtn) {
      mrPlayBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openMrVideo(song.mr);
      });
    }
    li.querySelector(".queue-remove-btn").addEventListener("click", () => {
      queue = queue.filter((id) => id !== song.id);
      saveQueue();
      renderQueue();
    });
    makeQueueItemDraggable(li);
    queueListEl.appendChild(li);
  }
}

function openQueueDrawer() {
  queueDrawerEl.classList.add("open");
  queueDrawerOverlayEl.classList.add("open");
}

function closeQueueDrawer() {
  queueDrawerEl.classList.remove("open");
  queueDrawerOverlayEl.classList.remove("open");
}

document.getElementById("queue-add-btn").addEventListener("click", () => {
  for (const id of viewSelectedIds) {
    if (!queue.includes(id)) queue.push(id);
  }
  saveQueue();
  renderQueue();
  openQueueDrawer();
});

document.getElementById("queue-clear-btn").addEventListener("click", () => {
  queue = [];
  saveQueue();
  renderQueue();
});

document.getElementById("queue-close-btn").addEventListener("click", closeQueueDrawer);
queueDrawerOverlayEl.addEventListener("click", closeQueueDrawer);

// GitHub Pages로 서빙되는 songs.json은 CDN에 전파되는 데 시간이 걸려서, 방금 저장한
// 내용이 새로고침 직후엔 옛날 값으로 보일 수 있습니다. 연동 설정이 돼있으면 GitHub
// Contents API로 직접 최신 내용을 가져와 이 문제를 피합니다.
async function loadInitialSongs() {
  const cfg = getGithubConfig();
  if (cfg.owner && cfg.repo && cfg.token) {
    try {
      const ctx = await fetchLatestFromGithub(cfg);
      songs = ctx.songs;
      applyFilters();
      renderQueue();
      return;
    } catch {
      // 연동 설정이 잘못됐거나 조회 실패 시 정적 파일로 폴백
    }
  }
  try {
    const res = await fetch(`songs.json?t=${Date.now()}`, { cache: "no-store" });
    songs = (await res.json()).map(normalizeSong);
    applyFilters();
    renderQueue();
  } catch {
    listEl.innerHTML = '<li class="empty">노래 목록을 불러오지 못했습니다</li>';
  }
}

loadInitialSongs();

// ===== 곡 추가/수정 팝업 =====

const qaDiffWidget = createStarSelector(document.getElementById("qa-diff"), 3, null);

const qaTagsWidget = createGenreSelector(document.getElementById("qa-tags"), TAG_OPTIONS, [], "장르 선택", null);

const qaModalTitleEl = document.getElementById("qa-modal-title");
let editingSongId = null;

function setQaStatus(text, type = "") {
  qaStatusEl.textContent = text;
  qaStatusEl.className = type ? `status ${type}` : "status";
}

function closeQuickAddModal() {
  quickAddModal.hidden = true;
}

function openAddModal() {
  editingSongId = null;
  qaModalTitleEl.textContent = "곡 추가";
  qaTitleEl.value = "";
  qaArtistEl.value = "";
  qaNotesEl.value = "";
  qaMrEl.value = "";
  qaDiffWidget.setValue(3);
  qaTagsWidget.setValue([]);
  setQaStatus("");
  quickAddModal.hidden = false;
}

function openEditModal(song) {
  editingSongId = song.id;
  qaModalTitleEl.textContent = "곡 수정";
  qaTitleEl.value = song.title;
  qaArtistEl.value = song.artist;
  qaNotesEl.value = getNoteTags(song).join(", ");
  qaMrEl.value = song.mr || "";
  qaDiffWidget.setValue(song.difficulty || 0);
  qaTagsWidget.setValue(song.tags);
  setQaStatus("");
  quickAddModal.hidden = false;
}

quickAddBtn.addEventListener("click", openAddModal);

document.getElementById("qa-cancel-btn").addEventListener("click", closeQuickAddModal);

quickAddModal.addEventListener("click", (e) => {
  if (e.target === quickAddModal) closeQuickAddModal();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !quickAddModal.hidden) closeQuickAddModal();
  if (e.key === "Escape" && !confirmModal.hidden) confirmCancelBtn.click();
  if (e.key === "Escape" && !adminToolsEl.hidden) adminToolsEl.hidden = true;
  if (e.key === "Escape" && queueDrawerEl.classList.contains("open")) closeQueueDrawer();
});

document.getElementById("qa-submit-btn").addEventListener("click", async () => {
  const title = qaTitleEl.value.trim();
  const artist = qaArtistEl.value.trim();
  if (!title || !artist) {
    setQaStatus("제목과 가수를 입력해주세요.", "error");
    return;
  }

  setQaStatus("저장하는 중...");
  const tags = [...qaTagsWidget.getValue(), ...parseNotes(qaNotesEl.value)];
  const difficulty = qaDiffWidget.getValue();
  const mr = qaMrEl.value.trim();

  try {
    songs = await updateSongsOnGithub((current) => {
      if (editingSongId) {
        const idx = current.findIndex((s) => s.id === editingSongId);
        if (idx === -1) throw new Error("곡을 찾을 수 없습니다. 이미 삭제되었을 수 있어요.");
        const updated = [...current];
        updated[idx] = { ...updated[idx], title, artist, tags, difficulty, mr };
        return updated;
      }
      return [
        ...current,
        { id: current.reduce((max, s) => Math.max(max, s.id), 0) + 1, title, artist, tags, difficulty, mr },
      ];
    }, editingSongId ? "노래책 곡 수정" : "노래책 곡 추가");

    applyFilters();
    closeQuickAddModal();
  } catch (e) {
    setQaStatus(`저장 실패: ${e.message}`, "error");
  }
});

// ===== 관리자 도구 =====

function setStatus(text, type = "") {
  statusEl.textContent = text;
  statusEl.className = type ? `status ${type}` : "status";
}

function nextId() {
  return songs.reduce((max, s) => Math.max(max, s.id), 0) + 1;
}

function save() {
  setStatus(`수정됨 (${songs.length}곡) — "GitHub에 저장"을 눌러야 실제 사이트에 반영됩니다.`);
}

function loadFromFile() {
  fetch(`songs.json?t=${Date.now()}`, { cache: "no-store" })
    .then((res) => res.json())
    .then((data) => {
      songs = data.map(normalizeSong);
      save();
      applyFilters();
    })
    .catch(() => {
      songs = [];
      applyFilters();
      setStatus("songs.json을 불러오지 못했습니다. 빈 목록으로 시작합니다.", "error");
    });
}

document.getElementById("export-btn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(songs, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "songs.json";
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("reset-btn").addEventListener("click", () => {
  if (confirm("현재 편집 중인 내용을 버리고 songs.json 원본을 다시 불러올까요?")) {
    loadFromFile();
  }
});

const importFileEl = document.getElementById("import-file");
document.getElementById("import-btn").addEventListener("click", () => {
  importFileEl.click();
});
importFileEl.addEventListener("change", () => {
  const file = importFileEl.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data)) throw new Error("not an array");
      songs = data.map(normalizeSong);
      save();
      applyFilters();
    } catch {
      setStatus("올바른 JSON 파일이 아닙니다.", "error");
    }
  };
  reader.readAsText(file);
  importFileEl.value = "";
});

const excelFileEl = document.getElementById("excel-import-file");
document.getElementById("excel-import-btn").addEventListener("click", () => {
  excelFileEl.click();
});
excelFileEl.addEventListener("change", async () => {
  const file = excelFileEl.files[0];
  if (!file) return;
  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    let added = 0;

    for (const sheetName of workbook.SheetNames) {
      if (sheetName === "시트4") continue;
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
      const shifted = sheetName === "한식" || sheetName === "일식";
      const artistCol = shifted ? 1 : 2;
      const titleCol = shifted ? 2 : 3;
      const noteCol = shifted ? 3 : 4;
      for (let i = 1; i < rows.length; i++) {
        const artist = String(rows[i][artistCol] || "").trim();
        const title = String(rows[i][titleCol] || "").trim();
        const note = String(rows[i][noteCol] || "").trim();
        if (!artist || !title) continue;
        const tags = note ? [sheetName, note] : [sheetName];
        songs.push({ id: nextId(), title, artist, tags, difficulty: 0 });
        added++;
      }
    }

    save();
    applyFilters();
    setStatus(`엑셀에서 ${added}곡을 추가했습니다.`, "success");
  } catch (err) {
    setStatus(`엑셀 파일을 읽지 못했습니다: ${err.message}`, "error");
  }
  excelFileEl.value = "";
});

// --- GitHub 연동 ---

function loadGithubConfigIntoForm() {
  const cfg = getGithubConfig();
  document.getElementById("cfg-owner").value = cfg.owner || "";
  document.getElementById("cfg-repo").value = cfg.repo || "";
  document.getElementById("cfg-branch").value = cfg.branch || "";
  document.getElementById("cfg-token").value = cfg.token || "";
  if (cfg.owner && cfg.repo && cfg.token) {
    document.getElementById("settings-box").open = false;
  } else {
    document.getElementById("settings-box").open = true;
  }
}

document.getElementById("save-cfg-btn").addEventListener("click", () => {
  const cfg = {
    owner: document.getElementById("cfg-owner").value.trim(),
    repo: document.getElementById("cfg-repo").value.trim(),
    branch: document.getElementById("cfg-branch").value.trim() || "main",
    token: document.getElementById("cfg-token").value.trim(),
  };
  localStorage.setItem(GITHUB_CFG_KEY, JSON.stringify(cfg));
  cfgStatusEl.textContent = "설정 저장됨";
  cfgStatusEl.className = "status success";
});

async function saveToGithub() {
  const cfg = getGithubConfig();
  if (!cfg.owner || !cfg.repo || !cfg.token) {
    setStatus("먼저 위 'GitHub 연동 설정'을 채워주세요.", "error");
    adminToolsEl.hidden = false;
    document.getElementById("settings-box").open = true;
    return;
  }

  setStatus("GitHub에 저장하는 중...");
  const branch = cfg.branch || "main";
  const apiUrl = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/songs.json`;
  const headers = {
    Authorization: `Bearer ${cfg.token}`,
    Accept: "application/vnd.github+json",
  };

  try {
    let sha;
    const getRes = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, { headers, cache: "no-store" });
    if (getRes.ok) {
      sha = (await getRes.json()).sha;
    } else if (getRes.status !== 404) {
      throw new Error(`파일 조회 실패 (${getRes.status})`);
    }

    const putRes = await fetch(apiUrl, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "노래책 업데이트",
        content: utf8ToBase64(JSON.stringify(songs, null, 2)),
        branch,
        ...(sha ? { sha } : {}),
      }),
    });

    if (!putRes.ok) {
      const err = await putRes.json().catch(() => ({}));
      throw new Error(err.message || `저장 실패 (${putRes.status})`);
    }

    setStatus("GitHub에 저장 완료! 잠시 후 사이트에 반영됩니다.", "success");
    applyFilters();
  } catch (e) {
    setStatus(`GitHub 저장 실패: ${e.message}`, "error");
  }
}

document.getElementById("github-save-btn").addEventListener("click", saveToGithub);

loadGithubConfigIntoForm();

// --- 새 저장소로 내 사이트 만들기 ---
// 지금 이 사이트를 서빙 중인 origin에서 그대로 복사해서, 사용자의 새 GitHub 저장소에
// 파일을 올리고 GitHub Pages까지 켜는 흐름입니다. 저장소 생성/Pages 활성화는
// fine-grained PAT로는 안 되는 경우가 많아서 classic PAT(repo 권한)을 안내합니다.
const NEW_SITE_TEXT_FILES = ["index.html", "script.js", "style.css", "view.html", "view.js", "manifest.json", "sw.js"];
const NEW_SITE_BINARY_FILES = ["icon-192.png", "icon-512.png"];

function arrayBufferToBase64(buffer) {
  let binary = "";
  new Uint8Array(buffer).forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

// GitHub API는 대표 메시지("Repository creation failed." 등)만 던지고 진짜 원인은
// errors 배열 안에 따로 담아 보내는 경우가 많아서, 같이 합쳐서 보여줍니다.
async function githubErrorMessage(res) {
  const err = await res.json().catch(() => ({}));
  const detail = (err.errors || [])
    .map((e) => e.message || e.code)
    .filter(Boolean)
    .join(", ");
  return [err.message, detail].filter(Boolean).join(" — ") || `요청 실패 (${res.status})`;
}

async function putNewRepoFile(owner, repo, token, branch, path, base64Content, message) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message, content: base64Content, branch }),
  });
  if (!res.ok) {
    throw new Error(`${path} 업로드 실패: ${await githubErrorMessage(res)}`);
  }
}

const newSiteStatusEl = document.getElementById("new-site-status");

document.getElementById("new-site-create-btn").addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  const token = document.getElementById("new-site-token").value.trim();
  const repoName = document.getElementById("new-site-repo-name").value.trim();
  if (!token || !repoName) {
    newSiteStatusEl.textContent = "토큰과 저장소 이름을 입력해주세요.";
    newSiteStatusEl.className = "status error";
    return;
  }

  btn.disabled = true;
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" };

  function setNewSiteStatus(text) {
    newSiteStatusEl.textContent = text;
    newSiteStatusEl.className = "status";
  }

  try {
    setNewSiteStatus("계정 확인하는 중...");
    const userRes = await fetch("https://api.github.com/user", { headers });
    if (!userRes.ok) throw new Error("토큰이 유효하지 않습니다.");
    const owner = (await userRes.json()).login;

    setNewSiteStatus("저장소 만드는 중...");
    const createRes = await fetch("https://api.github.com/user/repos", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ name: repoName, private: false, auto_init: true }),
    });
    if (!createRes.ok) {
      throw new Error(`저장소 생성 실패: ${await githubErrorMessage(createRes)}`);
    }
    // auto_init으로 만든 저장소의 기본 브랜치는 계정 설정에 따라 main이 아니라 master일 수도
    // 있어서, 실제로 생성된 브랜치 이름을 응답에서 그대로 가져다 써야 합니다.
    const defaultBranch = (await createRes.json()).default_branch || "main";

    const totalFiles = NEW_SITE_TEXT_FILES.length + NEW_SITE_BINARY_FILES.length + 2;
    let done = 0;

    for (const path of NEW_SITE_TEXT_FILES) {
      const text = await fetch(path, { cache: "no-store" }).then((r) => r.text());
      await putNewRepoFile(owner, repoName, token, defaultBranch, path, utf8ToBase64(text), "초기 사이트 파일");
      done++;
      setNewSiteStatus(`파일 올리는 중... (${done}/${totalFiles})`);
    }
    for (const path of NEW_SITE_BINARY_FILES) {
      const buf = await fetch(path, { cache: "no-store" }).then((r) => r.arrayBuffer());
      await putNewRepoFile(owner, repoName, token, defaultBranch, path, arrayBufferToBase64(buf), "초기 사이트 파일");
      done++;
      setNewSiteStatus(`파일 올리는 중... (${done}/${totalFiles})`);
    }
    await putNewRepoFile(owner, repoName, token, defaultBranch, "songs.json", utf8ToBase64("[]\n"), "빈 곡 목록으로 시작");
    done++;
    setNewSiteStatus(`파일 올리는 중... (${done}/${totalFiles})`);
    await putNewRepoFile(
      owner,
      repoName,
      token,
      defaultBranch,
      "settings.json",
      utf8ToBase64(JSON.stringify({ bgColor: DEFAULT_BG_COLOR, songBgColor: DEFAULT_SONG_BG_COLOR }, null, 2) + "\n"),
      "기본 설정으로 시작"
    );
    done++;
    setNewSiteStatus(`파일 올리는 중... (${done}/${totalFiles})`);

    setNewSiteStatus("GitHub Pages 활성화하는 중...");
    const pagesRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/pages`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ build_type: "legacy", source: { branch: defaultBranch, path: "/" } }),
    });
    if (!pagesRes.ok && pagesRes.status !== 409) {
      throw new Error(
        `파일은 다 올라갔지만 Pages 자동 활성화는 실패했어요 (${await githubErrorMessage(pagesRes)}). ` +
          `새 저장소의 Settings → Pages에서 branch를 main으로 두고 수동으로 켜주세요.`
      );
    }

    localStorage.setItem(GITHUB_CFG_KEY, JSON.stringify({ owner, repo: repoName, branch: defaultBranch, token }));
    loadGithubConfigIntoForm();

    // 연동 설정만 바꾸면 화면에 이미 떠 있는 예전 목록은 그대로 남아있으니,
    // 새로 연결된 저장소의 실제 곡 목록(빈 목록)으로 화면을 갱신합니다.
    try {
      songs = (await fetchLatestFromGithub(getGithubConfig())).songs;
      applyFilters();
    } catch {}

    const siteUrl = `https://${owner.toLowerCase()}.github.io/${repoName}/`;
    newSiteStatusEl.innerHTML = `완료! 이 화면의 GitHub 연동 설정이 방금 만든 사이트로 자동 연결됐어요 — 지금부터 여기서 곡을 추가/수정하면 그 사이트에 반영됩니다. 몇 분 후 <a href="${siteUrl}" target="_blank" rel="noopener">${siteUrl}</a> 에서 확인할 수 있어요.`;
    newSiteStatusEl.className = "status success";
  } catch (e) {
    newSiteStatusEl.textContent = `실패: ${e.message}`;
    newSiteStatusEl.className = "status error";
  } finally {
    btn.disabled = false;
  }
});

// --- 배경색 설정 ---

const DEFAULT_BG_COLOR = "#14151a";
const DEFAULT_SONG_BG_COLOR = "#1e2027";
const bgColorInput = document.getElementById("bg-color-input");
const bgColorStatusEl = document.getElementById("bg-color-status");
const songBgColorInput = document.getElementById("song-bg-color-input");
const songBgColorStatusEl = document.getElementById("song-bg-color-status");

function applyBgColor(color) {
  document.documentElement.style.setProperty("--bg", color);
}

function applySongBgColor(color) {
  document.documentElement.style.setProperty("--song-bg", color);
}

// settings.json은 배경색/노래 칸 배경색을 함께 담고 있어서, 저장할 때 현재 값을 먼저
// 읽어와 바뀐 값만 덮어써야 다른 색상 설정이 지워지지 않습니다.
async function saveSettingToGithub(patch, statusEl) {
  const cfg = getGithubConfig();
  if (!cfg.owner || !cfg.repo || !cfg.token) {
    statusEl.textContent = "먼저 위 'GitHub 연동 설정'을 채워주세요.";
    statusEl.className = "status error";
    adminToolsEl.hidden = false;
    document.getElementById("settings-box").open = true;
    return;
  }

  statusEl.textContent = "저장하는 중...";
  statusEl.className = "status";
  const branch = cfg.branch || "main";
  const apiUrl = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/settings.json`;
  const headers = {
    Authorization: `Bearer ${cfg.token}`,
    Accept: "application/vnd.github+json",
  };

  try {
    let sha;
    let current = {};
    const getRes = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, { headers, cache: "no-store" });
    if (getRes.ok) {
      const data = await getRes.json();
      sha = data.sha;
      current = JSON.parse(base64ToUtf8(data.content));
    } else if (getRes.status !== 404) {
      throw new Error(`파일 조회 실패 (${getRes.status})`);
    }

    const putRes = await fetch(apiUrl, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "노래책 설정 변경",
        content: utf8ToBase64(JSON.stringify({ ...current, ...patch }, null, 2)),
        branch,
        ...(sha ? { sha } : {}),
      }),
    });

    if (!putRes.ok) {
      const err = await putRes.json().catch(() => ({}));
      throw new Error(err.message || `저장 실패 (${putRes.status})`);
    }

    statusEl.textContent = "저장 완료! 잠시 후 노래책에도 반영됩니다.";
    statusEl.className = "status success";
  } catch (e) {
    statusEl.textContent = `저장 실패: ${e.message}`;
    statusEl.className = "status error";
  }
}

bgColorInput.addEventListener("input", () => applyBgColor(bgColorInput.value));
bgColorInput.addEventListener("change", () => saveSettingToGithub({ bgColor: bgColorInput.value }, bgColorStatusEl));

songBgColorInput.addEventListener("input", () => applySongBgColor(songBgColorInput.value));
songBgColorInput.addEventListener("change", () =>
  saveSettingToGithub({ songBgColor: songBgColorInput.value }, songBgColorStatusEl)
);

fetch(`settings.json?t=${Date.now()}`, { cache: "no-store" })
  .then((res) => res.json())
  .then((data) => {
    const bgColor = data.bgColor || DEFAULT_BG_COLOR;
    const songBgColor = data.songBgColor || DEFAULT_SONG_BG_COLOR;
    applyBgColor(bgColor);
    applySongBgColor(songBgColor);
    bgColorInput.value = bgColor;
    songBgColorInput.value = songBgColor;
  })
  .catch(() => {
    bgColorInput.value = DEFAULT_BG_COLOR;
    songBgColorInput.value = DEFAULT_SONG_BG_COLOR;
  });

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

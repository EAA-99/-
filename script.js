// ===== 공통 상수 =====
const ADMIN_PASSWORD = "DDARIN"; // 배포 전에 꼭 바꾸세요. 브라우저 코드로 노출되므로 강한 보안은 아닙니다.
const STORAGE_KEY = "songbook_draft";
const UNLOCK_KEY = "songbook_unlocked";
const GITHUB_CFG_KEY = "songbook_github_cfg";
const TAG_OPTIONS = ["한식", "일식", "양식"];

let songs = [];

// ===== 보기 모드 DOM =====
const viewModeEl = document.getElementById("view-mode");
const listEl = document.getElementById("song-list");
const searchEl = document.getElementById("search");
const sortEl = document.getElementById("sort-select");
const countEl = document.getElementById("count");

// ===== 관리자 모드 DOM =====
const adminGateEl = document.getElementById("admin-gate");
const adminModeEl = document.getElementById("admin-mode");
const passwordEl = document.getElementById("password");
const gateErrorEl = document.getElementById("gate-error");
const adminListEl = document.getElementById("admin-list");
const statusEl = document.getElementById("status");
const adminSearchEl = document.getElementById("admin-search");
const adminSortEl = document.getElementById("admin-sort-select");
const cfgStatusEl = document.getElementById("cfg-status");

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

function getGithubConfig() {
  try {
    return JSON.parse(localStorage.getItem(GITHUB_CFG_KEY)) || {};
  } catch {
    return {};
  }
}

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

// ===== 태그 선택기 / 별점 위젯 (보기 배지, 관리자 편집 공용) =====
function closeAllTagDropdowns(except) {
  document.querySelectorAll(".tag-dropdown").forEach((d) => {
    if (d !== except) d.hidden = true;
  });
}

document.addEventListener("click", (e) => {
  if (!e.target.closest(".tag-select")) closeAllTagDropdowns();
});

function createTagSelector(options, placeholder, initialTags, onChange) {
  let selected = new Set((initialTags || []).filter((t) => options.includes(t)));
  const wrap = document.createElement("div");
  wrap.className = "tag-select";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "tag-select-trigger";
  wrap.appendChild(trigger);

  const dropdown = document.createElement("div");
  dropdown.className = "tag-dropdown";
  dropdown.hidden = true;
  wrap.appendChild(dropdown);

  function updateTrigger() {
    const list = Array.from(selected);
    trigger.textContent = list.length ? list.join(", ") : placeholder;
    trigger.classList.toggle("has-tags", list.length > 0);
  }

  for (const tag of options) {
    const option = document.createElement("label");
    option.className = "tag-option";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = selected.has(tag);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) selected.add(tag);
      else selected.delete(tag);
      updateTrigger();
      if (onChange) onChange(Array.from(selected));
    });
    const label = document.createElement("span");
    label.textContent = tag;
    option.appendChild(checkbox);
    option.appendChild(label);
    dropdown.appendChild(option);
  }

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    const willOpen = dropdown.hidden;
    closeAllTagDropdowns();
    dropdown.hidden = !willOpen;
  });

  updateTrigger();

  return {
    el: wrap,
    getValue: () => Array.from(selected),
    setValue: (tags) => {
      selected = new Set((tags || []).filter((t) => options.includes(t)));
      dropdown.querySelectorAll("input[type=checkbox]").forEach((checkbox, i) => {
        checkbox.checked = selected.has(options[i]);
      });
      updateTrigger();
    },
  };
}

function createStarInput(initialValue, onChange) {
  let value = initialValue;
  const el = document.createElement("div");
  el.className = "star-input stars";
  el.innerHTML = `<span class="stars-bg">★★★★★</span><span class="stars-fill">★★★★★</span>`;
  const fill = el.querySelector(".stars-fill");

  function paint() {
    fill.style.width = `${(value / 5) * 100}%`;
  }
  paint();

  el.addEventListener("click", (e) => {
    const rect = el.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    value = Math.round(fraction * 10) / 2;
    paint();
    if (onChange) onChange(value);
  });

  return {
    el,
    getValue: () => value,
    setValue: (v) => {
      value = v;
      paint();
    },
  };
}

// ===== 보기 모드 =====

function starsHtml(value) {
  const pct = Math.max(0, Math.min(5, value)) / 5 * 100;
  return `<span class="stars"><span class="stars-bg">★★★★★</span><span class="stars-fill" style="width:${pct}%">★★★★★</span></span>`;
}

function renderView(items) {
  listEl.innerHTML = "";

  if (items.length === 0) {
    listEl.innerHTML = '<li class="empty">검색 결과가 없습니다</li>';
  } else {
    for (const song of items) {
      const category = getCategoryTag(song);
      const notes = getNoteTags(song);
      const li = document.createElement("li");
      li.className = "song-item";
      li.innerHTML = `
        <div class="song-main">
          <div class="song-title-row">
            ${category ? `<span class="song-badge"></span>` : ""}
            <span class="song-title"></span>
          </div>
          <div class="song-artist"></div>
        </div>
        <div class="song-side">
          ${song.difficulty ? starsHtml(song.difficulty) : ""}
          <div class="song-tags"></div>
        </div>
      `;
      if (category) li.querySelector(".song-badge").textContent = category;
      li.querySelector(".song-title").textContent = song.title;
      li.querySelector(".song-artist").textContent = song.artist;
      const tagsEl = li.querySelector(".song-tags");
      for (const tag of notes) {
        const span = document.createElement("span");
        span.className = "song-tag";
        span.textContent = tag;
        tagsEl.appendChild(span);
      }
      listEl.appendChild(li);
    }
  }

  countEl.textContent = `총 ${items.length}곡`;
}

let activeTag = "";

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
  if (sortEl.value === "difficulty") {
    sorted.sort((a, b) => (b.difficulty || 0) - (a.difficulty || 0));
  } else if (sortEl.value === "title") {
    sorted.sort((a, b) => a.title.localeCompare(b.title, "ko"));
  } else {
    sorted.sort((a, b) => a.artist.localeCompare(b.artist, "ko"));
  }
  return sorted;
}

function applyFilters() {
  renderView(sortSongs(filterSongs()));
}

searchEl.addEventListener("input", applyFilters);
sortEl.addEventListener("change", applyFilters);

document.querySelectorAll("#tag-tabs .tag-tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    activeTag = btn.dataset.tag;
    document.querySelectorAll("#tag-tabs .tag-tab").forEach((b) => b.classList.toggle("active", b === btn));
    applyFilters();
  });
});

fetch(`songs.json?t=${Date.now()}`, { cache: "no-store" })
  .then((res) => res.json())
  .then((data) => {
    songs = data;
    applyFilters();
  })
  .catch(() => {
    listEl.innerHTML = '<li class="empty">노래 목록을 불러오지 못했습니다</li>';
  });

// ===== 관리자 모드 =====

let selectedIds = new Set();
let activeAdminTag = "";

function setStatus(text, type = "") {
  statusEl.textContent = text;
  statusEl.className = type ? `status ${type}` : "status";
}

function nextId() {
  return songs.reduce((max, s) => Math.max(max, s.id), 0) + 1;
}

function parseNotes(text) {
  return text
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(songs));
  setStatus(`저장됨 (${songs.length}곡) — 아직 이 브라우저에만 있어요. "GitHub에 저장"을 눌러야 실제 사이트에 반영됩니다.`);
}

function loadAdminInitial() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      songs = JSON.parse(saved).map(normalizeSong);
      renderAdmin();
      return;
    } catch (e) {
      console.error("저장된 편집 내용을 읽지 못해 songs.json에서 다시 불러옵니다:", e);
    }
  }
  loadFromFile();
}

function loadFromFile() {
  fetch(`songs.json?t=${Date.now()}`, { cache: "no-store" })
    .then((res) => res.json())
    .then((data) => {
      songs = data.map(normalizeSong);
      save();
      renderAdmin();
    })
    .catch(() => {
      songs = [];
      renderAdmin();
      setStatus("songs.json을 불러오지 못했습니다. 빈 목록으로 시작합니다.", "error");
    });
}

const newDiffWidget = createStarInput(3, null);
document.getElementById("new-diff").appendChild(newDiffWidget.el);

const newTagsWidget = createTagSelector(TAG_OPTIONS, "태그 선택", [], null);
document.getElementById("new-tags").appendChild(newTagsWidget.el);

const newNotesEl = document.getElementById("new-notes");

function getVisibleAdminSongs() {
  const query = adminSearchEl.value.trim().toLowerCase();
  const filtered = songs.filter((s) => {
    const matchesQuery = !query || s.title.toLowerCase().includes(query) || s.artist.toLowerCase().includes(query);
    const matchesTag = !activeAdminTag || s.tags.includes(activeAdminTag);
    return matchesQuery && matchesTag;
  });

  const sorted = [...filtered];
  if (adminSortEl.value === "difficulty") {
    sorted.sort((a, b) => (b.difficulty || 0) - (a.difficulty || 0));
  } else if (adminSortEl.value === "title") {
    sorted.sort((a, b) => a.title.localeCompare(b.title, "ko"));
  } else {
    sorted.sort((a, b) => a.artist.localeCompare(b.artist, "ko"));
  }
  return sorted;
}

document.querySelectorAll("#admin-tag-tabs .tag-tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    activeAdminTag = btn.dataset.tag;
    document.querySelectorAll("#admin-tag-tabs .tag-tab").forEach((b) => b.classList.toggle("active", b === btn));
    renderAdmin();
  });
});

adminSortEl.addEventListener("change", renderAdmin);

function renderAdmin() {
  const visible = getVisibleAdminSongs();

  adminListEl.innerHTML = "";
  for (const song of visible) {
    const row = document.createElement("div");
    row.className = "admin-row";
    row.innerHTML = `
      <input type="checkbox" class="f-select">
      <div class="f-title-wrap">
        <span class="song-badge f-badge"></span>
        <input type="text" class="f-title" value="">
      </div>
      <input type="text" class="f-artist" value="">
      <div class="f-diff"></div>
      <div class="f-tags"></div>
      <input type="text" class="f-notes" placeholder="비고 (쉼표로 여러개)">
      <button class="danger icon-btn" title="삭제">🗑️</button>
    `;
    const selectInput = row.querySelector(".f-select");
    const titleInput = row.querySelector(".f-title");
    const artistInput = row.querySelector(".f-artist");
    const notesInput = row.querySelector(".f-notes");
    const badgeEl = row.querySelector(".f-badge");
    selectInput.checked = selectedIds.has(song.id);
    selectInput.addEventListener("change", () => {
      if (selectInput.checked) selectedIds.add(song.id);
      else selectedIds.delete(song.id);
    });
    titleInput.value = song.title;
    artistInput.value = song.artist;
    notesInput.value = getNoteTags(song).join(", ");

    function updateBadge() {
      const category = getCategoryTag(song);
      badgeEl.textContent = category;
      badgeEl.style.display = category ? "" : "none";
    }
    updateBadge();

    const diffWidget = createStarInput(song.difficulty || 0, (v) => {
      song.difficulty = v;
      save();
    });
    row.querySelector(".f-diff").appendChild(diffWidget.el);

    const tagWidget = createTagSelector(TAG_OPTIONS, "태그 선택", song.tags, (catTags) => {
      song.tags = [...song.tags.filter((t) => !TAG_OPTIONS.includes(t)), ...catTags];
      updateBadge();
      save();
    });
    row.querySelector(".f-tags").appendChild(tagWidget.el);

    notesInput.addEventListener("input", () => {
      song.tags = [...song.tags.filter((t) => TAG_OPTIONS.includes(t)), ...parseNotes(notesInput.value)];
      save();
    });

    titleInput.addEventListener("input", () => {
      song.title = titleInput.value;
      save();
    });
    artistInput.addEventListener("input", () => {
      song.artist = artistInput.value;
      save();
    });
    row.querySelector(".danger").addEventListener("click", () => {
      if (!confirm(`"${song.title}" (${song.artist})을(를) 삭제할까요?`)) return;
      songs = songs.filter((s) => s.id !== song.id);
      selectedIds.delete(song.id);
      save();
      renderAdmin();
    });

    adminListEl.appendChild(row);
  }
}

adminSearchEl.addEventListener("input", renderAdmin);

document.getElementById("select-all-btn").addEventListener("click", () => {
  const visible = getVisibleAdminSongs();
  const allSelected = visible.length > 0 && visible.every((s) => selectedIds.has(s.id));
  if (allSelected) {
    for (const s of visible) selectedIds.delete(s.id);
  } else {
    for (const s of visible) selectedIds.add(s.id);
  }
  renderAdmin();
});

document.getElementById("delete-selected-btn").addEventListener("click", () => {
  if (selectedIds.size === 0) {
    setStatus("선택된 곡이 없습니다.", "error");
    return;
  }
  if (!confirm(`선택한 ${selectedIds.size}곡을 삭제할까요?`)) return;
  songs = songs.filter((s) => !selectedIds.has(s.id));
  selectedIds.clear();
  save();
  renderAdmin();
});

function addSong() {
  const titleEl = document.getElementById("new-title");
  const artistEl = document.getElementById("new-artist");

  const title = titleEl.value.trim();
  const artist = artistEl.value.trim();
  if (!title || !artist) {
    setStatus("제목과 가수를 모두 입력해주세요.", "error");
    return;
  }

  songs.push({
    id: nextId(),
    title,
    artist,
    tags: [...newTagsWidget.getValue(), ...parseNotes(newNotesEl.value)],
    difficulty: newDiffWidget.getValue(),
  });
  save();
  renderAdmin();

  titleEl.value = "";
  artistEl.value = "";
  newNotesEl.value = "";
  newDiffWidget.setValue(3);
  newTagsWidget.setValue([]);
  titleEl.focus();
}

document.getElementById("add-btn").addEventListener("click", addSong);
for (const id of ["new-title", "new-artist", "new-notes"]) {
  document.getElementById(id).addEventListener("keydown", (e) => {
    if (e.key === "Enter") addSong();
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
      renderAdmin();
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
    renderAdmin();
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
    const getRes = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, { headers });
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
  } catch (e) {
    setStatus(`GitHub 저장 실패: ${e.message}`, "error");
  }
}

document.getElementById("github-save-btn").addEventListener("click", saveToGithub);

// ===== 보기 모드 <-> 관리자 모드 전환 =====

function enterAdminMode() {
  adminGateEl.style.display = "none";
  viewModeEl.style.display = "none";
  adminModeEl.style.display = "block";
  loadAdminInitial();
  loadGithubConfigIntoForm();
}

document.getElementById("open-admin-link").addEventListener("click", (e) => {
  e.preventDefault();
  if (localStorage.getItem(UNLOCK_KEY) === "1") {
    enterAdminMode();
  } else {
    viewModeEl.style.display = "none";
    adminGateEl.style.display = "block";
  }
});

document.getElementById("cancel-gate-btn").addEventListener("click", () => {
  adminGateEl.style.display = "none";
  viewModeEl.style.display = "block";
  passwordEl.value = "";
  gateErrorEl.textContent = "";
});

document.getElementById("unlock-btn").addEventListener("click", () => {
  if (passwordEl.value === ADMIN_PASSWORD) {
    localStorage.setItem(UNLOCK_KEY, "1");
    enterAdminMode();
  } else {
    gateErrorEl.textContent = "비밀번호가 틀렸습니다.";
  }
});

passwordEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("unlock-btn").click();
});

document.getElementById("back-to-view-link").addEventListener("click", (e) => {
  e.preventDefault();
  adminModeEl.style.display = "none";
  viewModeEl.style.display = "block";
  applyFilters();
});

const listEl = document.getElementById("song-list");
const searchEl = document.getElementById("search");
const sortEl = document.getElementById("sort-select");
const countEl = document.getElementById("count");

const CATEGORY_TAGS = ["한식", "일식", "양식"];

let songs = [];

function starsHtml(value) {
  const pct = Math.max(0, Math.min(5, value)) / 5 * 100;
  return `<span class="stars"><span class="stars-bg">★★★★★</span><span class="stars-fill" style="width:${pct}%">★★★★★</span></span>`;
}

function getTags(song) {
  return song.tags || (song.tag ? [song.tag] : []);
}

function getCategoryTag(song) {
  return getTags(song).find((t) => CATEGORY_TAGS.includes(t)) || "";
}

function getNoteTags(song) {
  return getTags(song).filter((t) => !CATEGORY_TAGS.includes(t));
}

function render(items) {
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
  render(sortSongs(filterSongs()));
}

searchEl.addEventListener("input", applyFilters);
sortEl.addEventListener("change", applyFilters);

document.querySelectorAll(".tag-tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    activeTag = btn.dataset.tag;
    document.querySelectorAll(".tag-tab").forEach((b) => b.classList.toggle("active", b === btn));
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

// --- 곡 빠른 추가 (방송인 전용, 비밀번호 필요) ---

const ADMIN_PASSWORD = "DDARIN"; // admin.js의 ADMIN_PASSWORD와 항상 같은 값으로 유지해주세요.
const GITHUB_CFG_KEY = "songbook_github_cfg";

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

function base64ToUtf8(base64) {
  const binary = atob(base64.replace(/\n/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

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

const quickAddBtn = document.getElementById("quick-add-btn");
const quickAddModal = document.getElementById("quick-add-modal");
const qaStatusEl = document.getElementById("qa-status");
const qaTitleEl = document.getElementById("qa-title");
const qaArtistEl = document.getElementById("qa-artist");
const qaNotesEl = document.getElementById("qa-notes");

const qaDiffWidget = createStarInput(3, null);
document.getElementById("qa-diff").appendChild(qaDiffWidget.el);

const qaTagsWidget = createTagSelector(CATEGORY_TAGS, "태그 선택", [], null);
document.getElementById("qa-tags").appendChild(qaTagsWidget.el);

function setQaStatus(text, type = "") {
  qaStatusEl.textContent = text;
  qaStatusEl.className = type ? `status ${type}` : "status";
}

function parseQaNotes(text) {
  return text
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function closeQuickAddModal() {
  quickAddModal.hidden = true;
}

quickAddBtn.addEventListener("click", () => {
  const pw = prompt("비밀번호를 입력하세요");
  if (pw === null) return;
  if (pw !== ADMIN_PASSWORD) {
    alert("비밀번호가 틀렸습니다.");
    return;
  }
  setQaStatus("");
  quickAddModal.hidden = false;
});

quickAddModal.addEventListener("click", (e) => {
  if (e.target === quickAddModal) closeQuickAddModal();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !quickAddModal.hidden) closeQuickAddModal();
});

document.getElementById("qa-submit-btn").addEventListener("click", async () => {
  const title = qaTitleEl.value.trim();
  const artist = qaArtistEl.value.trim();
  if (!title || !artist) {
    setQaStatus("제목과 가수를 입력해주세요.", "error");
    return;
  }

  const cfg = getGithubConfig();
  if (!cfg.owner || !cfg.repo || !cfg.token) {
    setQaStatus("GitHub 연동이 설정되어 있지 않습니다. admin.html에서 먼저 설정해주세요.", "error");
    return;
  }

  setQaStatus("저장하는 중...");
  const branch = cfg.branch || "main";
  const apiUrl = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/songs.json`;
  const headers = {
    Authorization: `Bearer ${cfg.token}`,
    Accept: "application/vnd.github+json",
  };

  try {
    const getRes = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, { headers });
    if (!getRes.ok) throw new Error(`파일 조회 실패 (${getRes.status})`);
    const fileData = await getRes.json();
    const currentSongs = JSON.parse(base64ToUtf8(fileData.content));

    const newSong = {
      id: currentSongs.reduce((max, s) => Math.max(max, s.id), 0) + 1,
      title,
      artist,
      tags: [...qaTagsWidget.getValue(), ...parseQaNotes(qaNotesEl.value)],
      difficulty: qaDiffWidget.getValue(),
    };
    currentSongs.push(newSong);

    const putRes = await fetch(apiUrl, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "노래책 곡 추가",
        content: utf8ToBase64(JSON.stringify(currentSongs, null, 2)),
        branch,
        sha: fileData.sha,
      }),
    });
    if (!putRes.ok) {
      const err = await putRes.json().catch(() => ({}));
      throw new Error(err.message || `저장 실패 (${putRes.status})`);
    }

    songs = currentSongs;
    applyFilters();
    setQaStatus("추가 완료!", "success");
    qaTitleEl.value = "";
    qaArtistEl.value = "";
    qaNotesEl.value = "";
    qaDiffWidget.setValue(3);
    qaTagsWidget.setValue([]);
  } catch (e) {
    setQaStatus(`저장 실패: ${e.message}`, "error");
  }
});

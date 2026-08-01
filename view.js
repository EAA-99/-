// 시청자 전용 읽기 화면입니다. 편집/삭제 기능은 이 파일에 아예 없습니다.

const TAG_OPTIONS = ["한식", "일식", "양식"];
const LIKES_KEY = "songbook_likes";
const VIEW_MODE_KEY = "songbook_view_mode";

let songs = [];
let likedIds = loadLikes();
let viewMode = localStorage.getItem(VIEW_MODE_KEY) === "grid" ? "grid" : "list";

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

function loadLikes() {
  try {
    return new Set(JSON.parse(localStorage.getItem(LIKES_KEY)) || []);
  } catch {
    return new Set();
  }
}

function saveLikes() {
  localStorage.setItem(LIKES_KEY, JSON.stringify(Array.from(likedIds)));
}

function getTags(song) {
  return song.tags || (song.tag ? [song.tag] : []);
}

function getCategoryTag(song) {
  return getTags(song).find((t) => TAG_OPTIONS.includes(t)) || "";
}

function getNoteTags(song) {
  return getTags(song).filter((t) => !TAG_OPTIONS.includes(t));
}

function starsHtml(value) {
  const pct = Math.max(0, Math.min(5, value)) / 5 * 100;
  return `<span class="stars"><span class="stars-bg">★★★★★</span><span class="stars-fill" style="width:${pct}%">★★★★★</span></span>`;
}

function render(items) {
  listEl.innerHTML = "";

  if (items.length === 0) {
    listEl.innerHTML = '<li class="empty">검색 결과가 없습니다</li>';
  } else {
    for (const song of items) {
      const category = getCategoryTag(song);
      const notes = getNoteTags(song);
      const liked = likedIds.has(song.id);
      const li = document.createElement("li");
      li.className = "song-item";
      li.innerHTML = `
        <div class="song-main">
          <div class="song-title-row">
            <span class="song-title"></span>
          </div>
          <div class="song-artist"></div>
        </div>
        <div class="song-side">
          <div class="song-meta-row">
            ${song.difficulty ? starsHtml(song.difficulty) : ""}
            <button class="icon-btn like-btn" title="즐겨찾기">${liked ? "❤️" : "🤍"}</button>
          </div>
          <div class="song-tags">
            ${category ? `<span class="song-badge"></span>` : ""}
          </div>
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
      li.querySelector(".like-btn").addEventListener("click", () => {
        if (likedIds.has(song.id)) likedIds.delete(song.id);
        else likedIds.add(song.id);
        saveLikes();
        applyFilters();
      });
      listEl.appendChild(li);
    }
  }
}

let activeTag = "";

function filterSongs() {
  const q = searchEl.value.trim().toLowerCase();
  return songs.filter((s) => {
    const matchesQuery = !q || s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q);
    const matchesTag = activeTag === "__favorites__" ? likedIds.has(s.id) : !activeTag || getTags(s).includes(activeTag);
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
    let count;
    if (tag === "__favorites__") {
      count = songs.filter((s) => likedIds.has(s.id)).length;
    } else if (tag === "") {
      count = songs.length;
    } else {
      count = songs.filter((s) => getTags(s).includes(tag)).length;
    }
    const countEl = btn.querySelector(".tag-count");
    if (countEl) countEl.textContent = count;
  });
}

function applyFilters() {
  render(sortSongs(filterSongs()));
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
  });
});

applyViewMode();

fetch(`songs.json?t=${Date.now()}`, { cache: "no-store" })
  .then((res) => res.json())
  .then((data) => {
    songs = data;
    applyFilters();
  })
  .catch(() => {
    listEl.innerHTML = '<li class="empty">노래 목록을 불러오지 못했습니다</li>';
  });

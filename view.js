// 시청자 전용 읽기 화면입니다. 편집/삭제 기능은 이 파일에 아예 없습니다.

const TAG_OPTIONS = ["한식", "일식", "양식"];

let songs = [];

const listEl = document.getElementById("song-list");
const searchEl = document.getElementById("search");
const sortEl = document.getElementById("sort-select");
const countEl = document.getElementById("count");

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
  } else if (sortEl.value === "recent") {
    sorted.sort((a, b) => b.id - a.id);
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

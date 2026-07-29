const listEl = document.getElementById("song-list");
const searchEl = document.getElementById("search");
const countEl = document.getElementById("count");

let songs = [];

function starsHtml(value) {
  const pct = Math.max(0, Math.min(5, value)) / 5 * 100;
  return `<span class="stars"><span class="stars-bg">★★★★★</span><span class="stars-fill" style="width:${pct}%">★★★★★</span></span>`;
}

function getTags(song) {
  return song.tags || (song.tag ? [song.tag] : []);
}

function render(items) {
  listEl.innerHTML = "";

  if (items.length === 0) {
    listEl.innerHTML = '<li class="empty">검색 결과가 없습니다</li>';
  } else {
    for (const song of items) {
      const tags = getTags(song);
      const li = document.createElement("li");
      li.className = "song-item";
      li.innerHTML = `
        <div class="song-main">
          <div class="song-title"></div>
          <div class="song-artist"></div>
        </div>
        <div class="song-side">
          ${song.difficulty ? starsHtml(song.difficulty) : ""}
          <div class="song-tags"></div>
        </div>
      `;
      li.querySelector(".song-title").textContent = song.title;
      li.querySelector(".song-artist").textContent = song.artist;
      const tagsEl = li.querySelector(".song-tags");
      for (const tag of tags) {
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

function applyFilters() {
  render(filterSongs());
}

searchEl.addEventListener("input", applyFilters);

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

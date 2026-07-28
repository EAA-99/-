const listEl = document.getElementById("song-list");
const searchEl = document.getElementById("search");
const countEl = document.getElementById("count");

let songs = [];

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
      const li = document.createElement("li");
      li.className = "song-item";
      li.innerHTML = `
        <div class="song-main">
          <div class="song-title"></div>
          <div class="song-artist"></div>
        </div>
        <div class="song-side">
          ${song.difficulty ? starsHtml(song.difficulty) : ""}
          ${song.tag ? `<span class="song-tag"></span>` : ""}
        </div>
      `;
      li.querySelector(".song-title").textContent = song.title;
      li.querySelector(".song-artist").textContent = song.artist;
      if (song.tag) li.querySelector(".song-tag").textContent = song.tag;
      listEl.appendChild(li);
    }
  }

  countEl.textContent = `총 ${items.length}곡`;
}

function filterSongs(query) {
  const q = query.trim().toLowerCase();
  if (!q) return songs;
  return songs.filter(
    (s) => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q)
  );
}

searchEl.addEventListener("input", () => {
  render(filterSongs(searchEl.value));
});

fetch("songs.json")
  .then((res) => res.json())
  .then((data) => {
    songs = data;
    render(songs);
  })
  .catch(() => {
    listEl.innerHTML = '<li class="empty">노래 목록을 불러오지 못했습니다</li>';
  });

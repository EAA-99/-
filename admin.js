const ADMIN_PASSWORD = "DDARIN"; // 배포 전에 꼭 바꾸세요. 브라우저 코드로 노출되므로 강한 보안은 아닙니다.
const STORAGE_KEY = "songbook_draft";
const UNLOCK_KEY = "songbook_unlocked";
const GITHUB_CFG_KEY = "songbook_github_cfg";

const gateView = document.getElementById("gate-view");
const adminView = document.getElementById("admin-view");
const passwordEl = document.getElementById("password");
const gateErrorEl = document.getElementById("gate-error");
const listEl = document.getElementById("admin-list");
const statusEl = document.getElementById("status");
const searchEl = document.getElementById("admin-search");
const cfgStatusEl = document.getElementById("cfg-status");

let songs = [];

function unlock() {
  gateView.style.display = "none";
  adminView.style.display = "block";
  loadInitial();
  loadGithubConfigIntoForm();
}

document.getElementById("unlock-btn").addEventListener("click", () => {
  if (passwordEl.value === ADMIN_PASSWORD) {
    localStorage.setItem(UNLOCK_KEY, "1");
    unlock();
  } else {
    gateErrorEl.textContent = "비밀번호가 틀렸습니다.";
  }
});

passwordEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("unlock-btn").click();
});

if (localStorage.getItem(UNLOCK_KEY) === "1") {
  unlock();
}

function loadInitial() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    songs = JSON.parse(saved);
    render();
  } else {
    loadFromFile();
  }
}

function loadFromFile() {
  fetch("songs.json")
    .then((res) => res.json())
    .then((data) => {
      songs = data;
      save();
      render();
    })
    .catch(() => {
      songs = [];
      render();
      setStatus("songs.json을 불러오지 못했습니다. 빈 목록으로 시작합니다.", "error");
    });
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(songs));
  setStatus(`저장됨 (${songs.length}곡) — 아직 이 브라우저에만 있어요. "GitHub에 저장"을 눌러야 실제 사이트에 반영됩니다.`);
}

function setStatus(text, type = "") {
  statusEl.textContent = text;
  statusEl.className = type ? `status ${type}` : "status";
}

function nextId() {
  return songs.reduce((max, s) => Math.max(max, s.id), 0) + 1;
}

function render() {
  const query = searchEl.value.trim().toLowerCase();
  const visible = query
    ? songs.filter(
        (s) => s.title.toLowerCase().includes(query) || s.artist.toLowerCase().includes(query)
      )
    : songs;

  listEl.innerHTML = "";
  for (const song of visible) {
    const row = document.createElement("div");
    row.className = "admin-row";
    row.innerHTML = `
      <input type="text" class="f-title" value="">
      <input type="text" class="f-artist" value="">
      <input type="text" class="f-tag" value="" placeholder="태그">
      <button class="danger">삭제</button>
    `;
    const titleInput = row.querySelector(".f-title");
    const artistInput = row.querySelector(".f-artist");
    const tagInput = row.querySelector(".f-tag");
    titleInput.value = song.title;
    artistInput.value = song.artist;
    tagInput.value = song.tag || "";

    titleInput.addEventListener("input", () => {
      song.title = titleInput.value;
      save();
    });
    artistInput.addEventListener("input", () => {
      song.artist = artistInput.value;
      save();
    });
    tagInput.addEventListener("input", () => {
      song.tag = tagInput.value;
      save();
    });
    row.querySelector(".danger").addEventListener("click", () => {
      if (!confirm(`"${song.title}" (${song.artist})을(를) 삭제할까요?`)) return;
      songs = songs.filter((s) => s.id !== song.id);
      save();
      render();
    });

    listEl.appendChild(row);
  }
}

searchEl.addEventListener("input", render);

function addSong() {
  const titleEl = document.getElementById("new-title");
  const artistEl = document.getElementById("new-artist");
  const tagEl = document.getElementById("new-tag");

  const title = titleEl.value.trim();
  const artist = artistEl.value.trim();
  if (!title || !artist) {
    setStatus("제목과 가수를 모두 입력해주세요.", "error");
    return;
  }

  songs.push({ id: nextId(), title, artist, tag: tagEl.value.trim() });
  save();
  render();

  titleEl.value = "";
  artistEl.value = "";
  tagEl.value = "";
  titleEl.focus();
}

document.getElementById("add-btn").addEventListener("click", addSong);
for (const id of ["new-title", "new-artist", "new-tag"]) {
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
      songs = data;
      save();
      render();
    } catch {
      setStatus("올바른 JSON 파일이 아닙니다.", "error");
    }
  };
  reader.readAsText(file);
  importFileEl.value = "";
});

// --- GitHub 연동 ---

function getGithubConfig() {
  try {
    return JSON.parse(localStorage.getItem(GITHUB_CFG_KEY)) || {};
  } catch {
    return {};
  }
}

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

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

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

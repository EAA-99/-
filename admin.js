const ADMIN_PASSWORD = "DDARIN"; // 배포 전에 꼭 바꾸세요. 브라우저 코드로 노출되므로 강한 보안은 아닙니다.
const STORAGE_KEY = "songbook_draft";
const UNLOCK_KEY = "songbook_unlocked";
const GITHUB_CFG_KEY = "songbook_github_cfg";
const TAG_OPTIONS = ["한식", "일식", "양식", "완숙", "반숙", "관상용", "연습대기중", "잠금", "친구필요"];

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

try {
  if (localStorage.getItem(UNLOCK_KEY) === "1") {
    unlock();
  }
} catch (e) {
  console.error("자동 로그인 중 오류:", e);
}

function loadInitial() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      songs = JSON.parse(saved).map(normalizeSong);
      render();
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

function normalizeSong(song) {
  if (!song.tags) {
    song.tags = song.tag ? [song.tag] : [];
  }
  delete song.tag;
  return song;
}

function closeAllTagDropdowns(except) {
  document.querySelectorAll(".tag-dropdown").forEach((d) => {
    if (d !== except) d.hidden = true;
  });
}

document.addEventListener("click", (e) => {
  if (!e.target.closest(".tag-select")) closeAllTagDropdowns();
});

function createTagSelector(initialTags, onChange) {
  let selected = new Set(initialTags || []);
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
    trigger.textContent = list.length ? list.join(", ") : "태그 선택";
    trigger.classList.toggle("has-tags", list.length > 0);
  }

  for (const tag of TAG_OPTIONS) {
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
      selected = new Set(tags || []);
      dropdown.querySelectorAll("input[type=checkbox]").forEach((checkbox, i) => {
        checkbox.checked = selected.has(TAG_OPTIONS[i]);
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

const newDiffWidget = createStarInput(3, null);
document.getElementById("new-diff").appendChild(newDiffWidget.el);

const newTagsWidget = createTagSelector([], null);
document.getElementById("new-tags").appendChild(newTagsWidget.el);

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
      <div class="f-diff"></div>
      <div class="f-tags"></div>
      <button class="danger">삭제</button>
    `;
    const titleInput = row.querySelector(".f-title");
    const artistInput = row.querySelector(".f-artist");
    titleInput.value = song.title;
    artistInput.value = song.artist;

    const diffWidget = createStarInput(song.difficulty || 0, (v) => {
      song.difficulty = v;
      save();
    });
    row.querySelector(".f-diff").appendChild(diffWidget.el);

    const tagWidget = createTagSelector(song.tags, (tags) => {
      song.tags = tags;
      save();
    });
    row.querySelector(".f-tags").appendChild(tagWidget.el);

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
    tags: newTagsWidget.getValue(),
    difficulty: newDiffWidget.getValue(),
  });
  save();
  render();

  titleEl.value = "";
  artistEl.value = "";
  newDiffWidget.setValue(3);
  newTagsWidget.setValue([]);
  titleEl.focus();
}

document.getElementById("add-btn").addEventListener("click", addSong);
for (const id of ["new-title", "new-artist"]) {
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
      render();
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
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
      for (let i = 1; i < rows.length; i++) {
        const artist = String(rows[i][2] || "").trim();
        const title = String(rows[i][3] || "").trim();
        if (!artist || !title) continue;
        songs.push({ id: nextId(), title, artist, tags: [sheetName], difficulty: 0 });
        added++;
      }
    }

    save();
    render();
    setStatus(`엑셀에서 ${added}곡을 추가했습니다.`, "success");
  } catch (err) {
    setStatus(`엑셀 파일을 읽지 못했습니다: ${err.message}`, "error");
  }
  excelFileEl.value = "";
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

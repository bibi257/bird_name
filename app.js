(() => {
  "use strict";

  // ===== ローカルストレージ(失敗しても動くようtry/catchで包む) =====
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} },
    remove(k) { try { localStorage.removeItem(k); } catch (_) {} },
  };

  const VOICE_TYPE_LABEL = {
    "単音": "単音「ジッ、ジッ」など",
    "連続音": "連続音「ポポポポ…」など",
    "フレーズ": "フレーズ「ホーホケキョ」など",
    "複雑なメロディ": "複雑なメロディ",
    "その他": "その他",
  };

  const state = {
    birds: [],
    byId: new Map(),
    byName: new Map(),
    activeTab: "feature",
    freeword: "",
    feature: { size: null, colors: [], seasons: [], habitats: [] },
    voice: { voice_type: [], seasons: [], habitats: [] },
    kanaRow: null,
  };

  const g = (id) => document.getElementById(id);
  const grid = g("grid");
  const statusEl = g("status");
  const emptyEl = g("empty");

  // ===================================================================
  // データ読み込み
  // ===================================================================
  async function loadBirds() {
    const res = await fetch("birds.json", { cache: "no-cache" });
    const data = await res.json();
    state.birds = data;
    data.forEach((b) => {
      state.byId.set(b.id, b);
      state.byName.set(b.name, b);
      const short = b.name.replace(/[（(].*$/, "");
      if (!state.byName.has(short)) state.byName.set(short, b);
    });
  }

  // ===================================================================
  // タブ切り替え
  // ===================================================================
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => {
        t.classList.remove("active");
        t.setAttribute("aria-selected", "false");
      });
      tab.classList.add("active");
      tab.setAttribute("aria-selected", "true");
      state.activeTab = tab.dataset.tab;
      document.querySelectorAll(".panel").forEach((p) => (p.hidden = true));
      g("panel-" + state.activeTab).hidden = false;
      render();
    });
  });

  // ===================================================================
  // フィルターチップ
  // ===================================================================
  document.querySelectorAll(".chip-group").forEach((group) => {
    const key = group.dataset.filter;
    const mode = group.dataset.mode;
    const scope = group.dataset.scope === "voice" ? "voice" : "feature";
    group.querySelectorAll(".chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const val = chip.dataset.value;
        const bucket = state[scope];
        if (mode === "single") {
          bucket[key] = bucket[key] === val ? null : val;
          group.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c.dataset.value === bucket[key]));
        } else {
          const arr = bucket[key];
          const i = arr.indexOf(val);
          if (i >= 0) arr.splice(i, 1); else arr.push(val);
          chip.classList.toggle("active", arr.includes(val));
        }
        render();
      });
    });
  });

  g("feature-clear").addEventListener("click", () => {
    state.feature = { size: null, colors: [], seasons: [], habitats: [] };
    g("panel-feature").querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
    render();
  });
  g("voice-clear").addEventListener("click", () => {
    state.voice = { voice_type: [], seasons: [], habitats: [] };
    g("panel-voice").querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
    render();
  });
  // 「検索する」ボタン:絞り込みはチップ操作の時点で即時反映済みなので、
  // ここでは結果へスクロールして押した手応えを出す(参考サイトのボタン挙動に寄せつつ、即時絞り込みも維持)
  g("feature-search").addEventListener("click", () => grid.scrollIntoView({ behavior: "smooth", block: "start" }));
  g("voice-search").addEventListener("click", () => grid.scrollIntoView({ behavior: "smooth", block: "start" }));

  // ===================================================================
  // 50音順タブ
  // ===================================================================
  g("kana-rows").querySelectorAll(".kana-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const row = btn.dataset.row;
      state.kanaRow = state.kanaRow === row ? null : row;
      g("kana-rows").querySelectorAll(".kana-btn").forEach((b) => b.classList.toggle("active", b.dataset.row === state.kanaRow));
      render();
    });
  });

  // ===================================================================
  // フリーワード検索(スペース区切りAND)
  // ===================================================================
  let freewordTimer = null;
  g("freeword").addEventListener("input", (e) => {
    clearTimeout(freewordTimer);
    freewordTimer = setTimeout(() => {
      state.freeword = e.target.value.trim();
      render();
    }, 120);
  });

  function matchesFreeword(b, words) {
    if (!words.length) return true;
    const haystack = [
      b.name, b.kana, b.features, b.beak, b.voice_text,
      ...(b.colors || []), ...(b.habitats || []), ...(b.similar || []),
    ].filter(Boolean).join(" ").toLowerCase();
    return words.every((w) => haystack.includes(w.toLowerCase()));
  }

  // ===================================================================
  // 絞り込みロジック
  // ===================================================================
  function filterFeature(list) {
    const f = state.feature;
    return list.filter((b) => {
      if (f.size && b.size !== f.size) return false;
      if (f.colors.length && !f.colors.some((c) => b.colors.includes(c))) return false;
      if (f.seasons.length && !f.seasons.some((s) => b.seasons.includes(s))) return false;
      if (f.habitats.length && !f.habitats.some((h) => b.habitats.includes(h))) return false;
      return true;
    });
  }

  function filterVoice(list) {
    const f = state.voice;
    return list.filter((b) => {
      if (f.voice_type.length && !f.voice_type.includes(b.voice_type)) return false;
      if (f.seasons.length && !f.seasons.some((s) => b.seasons.includes(s))) return false;
      if (f.habitats.length && !f.habitats.some((h) => b.habitats.includes(h))) return false;
      return true;
    });
  }

  function currentResults() {
    const words = state.freeword ? state.freeword.split(/\s+/).filter(Boolean) : [];
    let base = state.birds.filter((b) => matchesFreeword(b, words));

    if (state.activeTab === "feature") return filterFeature(base);
    if (state.activeTab === "voice") return filterVoice(base);
    if (state.activeTab === "kana") {
      if (!state.kanaRow && !words.length) return [];
      if (state.kanaRow) base = base.filter((b) => b.row === state.kanaRow);
      return base.sort((a, b) => a.kana.localeCompare(b.kana, "ja"));
    }
    return base;
  }

  // ===================================================================
  // 描画
  // ===================================================================
  function render() {
    const results = currentResults();

    if (state.activeTab === "feature") g("feature-count").textContent = results.length;
    if (state.activeTab === "voice") g("voice-count").textContent = results.length;

    grid.innerHTML = "";
    if (state.activeTab === "kana" && !state.kanaRow && !state.freeword) {
      statusEl.hidden = false;
      statusEl.textContent = "上の行を選ぶと、その行の鳥が表示されます";
      emptyEl.hidden = true;
      return;
    }
    statusEl.hidden = true;

    if (!results.length) {
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;

    const frag = document.createDocumentFragment();
    results.forEach((b) => frag.appendChild(buildCard(b)));
    grid.appendChild(frag);
  }

  function buildCard(b) {
    const card = document.createElement("button");
    card.className = "card";
    card.type = "button";
    card.setAttribute("aria-label", b.name + "の詳細");
    const hasVoice = !!(b.audio || b.voice_text);
    card.innerHTML = `
      <div class="card-photo"><img src="${b.image}" alt="${b.name}" loading="lazy" onerror="this.style.visibility='hidden'"></div>
      ${hasVoice ? '<span class="card-voice-badge" aria-hidden="true">🔊</span>' : ""}
      <div class="card-body">
        <p class="card-name">${b.name}</p>
        <p class="card-sub">${b.size}・${b.seasons.join("")}</p>
      </div>`;
    card.addEventListener("click", () => openDetail(b.id));
    return card;
  }

  // ===================================================================
  // 詳細モーダル
  // ===================================================================
  const detailModal = g("detail-modal");
  let currentDetailId = null;

  function openDetail(id) {
    const b = state.byId.get(id);
    if (!b) return;
    currentDetailId = id;

    g("detail-img").src = b.image;
    g("detail-img").alt = b.name;
    g("detail-name").textContent = b.name;
    g("detail-kana").textContent = b.kana;

    const tags = [b.size, ...b.colors].map((t) => `<span class="tag">${t}</span>`).join("");
    g("detail-tags").innerHTML = tags;
    g("detail-features").textContent = b.features;
    g("detail-beak").textContent = b.beak;
    g("detail-seasons").textContent = b.seasons.join("・");
    g("detail-habitats").textContent = b.habitats.join("・");

    const voiceBlock = g("detail-voice-block");
    if (b.voice_type || b.voice_text) {
      voiceBlock.hidden = false;
      g("detail-voice-text").textContent = [
        b.voice_type ? VOICE_TYPE_LABEL[b.voice_type] || b.voice_type : null,
        b.voice_text ? "「" + b.voice_text + "」" : null,
      ].filter(Boolean).join(" ／ ");
      const audioEl = g("detail-audio");
      const playBtn = g("detail-voice-play");
      if (b.audio) {
        audioEl.src = b.audio;
        playBtn.hidden = false;
        playBtn.onclick = () => audioEl.play();
      } else {
        playBtn.hidden = true;
      }
    } else {
      voiceBlock.hidden = true;
    }

    const simBlock = g("detail-similar-block");
    if (b.similar && b.similar.length) {
      simBlock.hidden = false;
      g("detail-similar").innerHTML = b.similar.map((name) => {
        const target = state.byName.get(name);
        return target
          ? `<button class="chip" data-goto="${target.id}">${name}</button>`
          : `<span class="chip disabled">${name}</span>`;
      }).join("");
      g("detail-similar").querySelectorAll("[data-goto]").forEach((el) => {
        el.addEventListener("click", () => openDetail(el.dataset.goto));
      });
    } else {
      simBlock.hidden = true;
    }

    detailModal.hidden = false;
  }

  g("log-record-btn").addEventListener("click", () => {
    if (currentDetailId) addLogEntry(currentDetailId);
  });

  // ===================================================================
  // モーダル共通の開閉
  // ===================================================================
  document.querySelectorAll(".modal").forEach((modal) => {
    modal.querySelectorAll("[data-close]").forEach((el) => {
      el.addEventListener("click", () => (modal.hidden = true));
    });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") document.querySelectorAll(".modal").forEach((m) => (m.hidden = true));
  });

  // ===================================================================
  // ダークモード
  // ===================================================================
  g("theme-toggle").addEventListener("click", () => {
    const root = document.documentElement;
    const cur = root.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = cur === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    store.set("theme", next);
  });
  (function initTheme() {
    const saved = store.get("theme");
    if (saved) document.documentElement.dataset.theme = saved;
  })();

  // ===================================================================
  // 撮影記録(ローカル保存 + GitHub同期)
  // ===================================================================
  const LOG_KEY = "bird-log-entries";

  function getLog() {
    try { return JSON.parse(store.get(LOG_KEY) || "[]"); } catch (_) { return []; }
  }
  function setLog(entries) {
    store.set(LOG_KEY, JSON.stringify(entries));
  }

  function addLogEntry(birdId) {
    const b = state.byId.get(birdId);
    if (!b) return;
    const entries = getLog();
    entries.unshift({
      id: birdId,
      name: b.name,
      image: b.image,
      ts: new Date().toISOString(),
    });
    setLog(entries);
    renderLog();
    flashStatus("log-sync-status", `${b.name} を記録しました`);
    syncLogToGitHub(); // 設定済みなら自動で同期を試みる(未設定なら何もしない)
  }

  function removeLogEntry(index) {
    const entries = getLog();
    entries.splice(index, 1);
    setLog(entries);
    renderLog();
    syncLogToGitHub();
  }

  function renderLog() {
    const entries = getLog();
    const list = g("log-list");
    const empty = g("log-empty");
    if (!entries.length) {
      list.innerHTML = "";
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    list.innerHTML = entries.map((e, i) => {
      const d = new Date(e.ts);
      const dateStr = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      return `<div class="log-item">
        <img src="${e.image}" alt="" onerror="this.style.visibility='hidden'">
        <div>
          <div class="log-item-name">${e.name}</div>
          <div class="log-item-meta">${dateStr}</div>
        </div>
        <button class="log-item-del" data-idx="${i}" type="button">削除</button>
      </div>`;
    }).join("");
    list.querySelectorAll("[data-idx]").forEach((btn) => {
      btn.addEventListener("click", () => removeLogEntry(Number(btn.dataset.idx)));
    });
  }

  g("log-toggle").addEventListener("click", () => {
    renderLog();
    g("log-modal").hidden = false;
    // 開いたタイミングでリモートの最新も取り込む
    pullLogFromGitHub();
  });

  function flashStatus(elId, msg, ms = 2500) {
    const el = g(elId);
    el.textContent = msg;
    if (ms) setTimeout(() => { if (el.textContent === msg) el.textContent = ""; }, ms);
  }

  // ---- GitHub Contents API 同期 ----
  // 締切トラッカーの同期処理を流用:公開URL(owner.github.io/repo/)からowner候補を推定し、
  // Fine-grained token(Private repo, Contents: Read and write)でlog.jsonを読み書きする。
  const GH_CFG_KEY = "gh-log-sync";
  const GH_TOKEN_KEY = "gh-log-token";

  function guessRepoFromURL() {
    const host = location.hostname;
    const m = host.match(/^([^.]+)\.github\.io$/);
    if (!m) return {};
    return { owner: m[1], repo: "bird-log" };
  }

  function ghConfig() {
    try { return JSON.parse(store.get(GH_CFG_KEY) || "{}"); } catch (_) { return {}; }
  }

  function ghToken() {
    return store.get(GH_TOKEN_KEY) || "";
  }

  async function ghApi(path, opts = {}) {
    const res = await fetch("https://api.github.com" + path, {
      ...opts,
      headers: {
        "Accept": "application/vnd.github+json",
        "Authorization": "Bearer " + ghToken(),
        ...(opts.headers || {}),
      },
    });
    return res;
  }

  async function pullLogFromGitHub() {
    const cfg = ghConfig();
    if (!cfg.owner || !cfg.repo || !ghToken()) return;
    try {
      const res = await ghApi(`/repos/${cfg.owner}/${cfg.repo}/contents/log.json?ref=${cfg.branch || "main"}`);
      if (!res.ok) return;
      const data = await res.json();
      const remote = JSON.parse(decodeURIComponent(escape(atob(data.content.replace(/\n/g, "")))));
      // ローカルとリモートをtsで重複排除しつつマージ(端末間の追記を両方残す)
      const local = getLog();
      const seen = new Set(local.map((e) => e.id + "|" + e.ts));
      remote.forEach((e) => {
        const key = e.id + "|" + e.ts;
        if (!seen.has(key)) { local.push(e); seen.add(key); }
      });
      local.sort((a, b) => new Date(b.ts) - new Date(a.ts));
      setLog(local);
      renderLog();
      flashStatus("log-sync-status", "GitHubの記録を取り込みました");
    } catch (err) {
      // ネットワーク不通や未設定時は静かに諦める(ローカル保存だけで動作継続)
      console.warn("pullLogFromGitHub failed", err);
    }
  }

  async function syncLogToGitHub() {
    const cfg = ghConfig();
    if (!cfg.owner || !cfg.repo || !ghToken()) return;
    try {
      const entries = getLog();
      const body = unescape(encodeURIComponent(JSON.stringify(entries, null, 2)));
      const content = btoa(body);

      // 既存ファイルのshaを取得(なければ新規作成)
      let sha;
      const getRes = await ghApi(`/repos/${cfg.owner}/${cfg.repo}/contents/log.json?ref=${cfg.branch || "main"}`);
      if (getRes.ok) sha = (await getRes.json()).sha;

      const putRes = await ghApi(`/repos/${cfg.owner}/${cfg.repo}/contents/log.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `撮影記録を更新 (${entries.length}件)`,
          content,
          branch: cfg.branch || "main",
          ...(sha ? { sha } : {}),
        }),
      });
      if (putRes.ok) {
        flashStatus("log-sync-status", "GitHubに同期しました");
        flashStatus("ghStatus", "同期しました");
      } else {
        const errBody = await putRes.json().catch(() => ({}));
        flashStatus("log-sync-status", "同期に失敗しました(" + (errBody.message || putRes.status) + ")", 4000);
      }
    } catch (err) {
      console.warn("syncLogToGitHub failed", err);
      flashStatus("log-sync-status", "同期に失敗しました(通信エラー)", 4000);
    }
  }

  // ---- 設定パネル ----
  g("settings-toggle").addEventListener("click", () => {
    const cfg = ghConfig();
    const guess = guessRepoFromURL();
    g("ghOwner").value = cfg.owner || guess.owner || "";
    g("ghRepo").value = cfg.repo || guess.repo || "";
    g("ghBranch").value = cfg.branch || "main";
    g("ghToken").value = "";
    g("ghRemember").checked = !!ghToken();
    g("ghStatus").textContent = cfg.owner ? "" : (guess.owner ? `このページのURLから ${guess.owner}/${guess.repo} を仮入力しました。` : "");
    g("settings-modal").hidden = false;
  });

  g("ghSave").addEventListener("click", () => {
    const owner = g("ghOwner").value.trim();
    const repo = g("ghRepo").value.trim();
    const branch = g("ghBranch").value.trim() || "main";
    const token = g("ghToken").value.trim();

    if (!owner || !repo) {
      flashStatus("ghStatus", "OwnerとRepositoryを入力してください", 3000);
      return;
    }
    store.set(GH_CFG_KEY, JSON.stringify({ owner, repo, branch }));
    if (g("ghRemember").checked && token) {
      store.set(GH_TOKEN_KEY, token);
    } else if (!g("ghRemember").checked) {
      store.remove(GH_TOKEN_KEY);
    } else if (token) {
      store.set(GH_TOKEN_KEY, token);
    }
    flashStatus("ghStatus", "保存しました。同期しています…", 0);
    syncLogToGitHub();
  });

  g("ghForget").addEventListener("click", () => {
    store.remove(GH_CFG_KEY);
    store.remove(GH_TOKEN_KEY);
    g("ghOwner").value = "";
    g("ghRepo").value = "";
    g("ghBranch").value = "main";
    g("ghToken").value = "";
    g("ghRemember").checked = false;
    flashStatus("ghStatus", "この端末の設定を削除しました");
  });

  // ===================================================================
  // 起動
  // ===================================================================
  async function init() {
    try {
      await loadBirds();
    } catch (err) {
      statusEl.textContent = "birds.json を読み込めませんでした。";
      console.error(err);
      return;
    }
    render();
    pullLogFromGitHub();
  }
  init();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch((err) => console.warn("SW registration failed", err));
    });
  }
})();

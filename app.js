/* 野鳥クイックリファレンス app.js */
(() => {
  "use strict";

  // ===== 絞り込みの選択肢（計画表どおり） =====
  const OPTIONS = {
    size:    ["スズメ大", "ムクドリ大", "ハト大", "カラス大", "それ以上"],
    colors:  ["茶", "黒", "白", "灰", "青", "緑", "黄", "赤・橙"],
    habitat: ["市街地", "公園", "林", "水辺", "田畑", "海岸"],
    season:  ["留鳥", "夏鳥", "冬鳥", "旅鳥"],
    beak:    ["細く尖る", "太く短い", "長い", "鉤状", "平たい"],
  };
  // birds.json 側の細かい場所表記を6区分にまとめる
  const HABITAT_ALIAS = {
    "河川": "水辺", "池": "水辺", "渓流": "水辺", "河川敷": "水辺",
    "藪": "林", "草地": "田畑", "芝生": "公園",
    "駅": "市街地", "駐車場": "市街地",
  };
  // 色チップの見本色
  const SWATCH = {
    "茶": "#8a5a2b", "黒": "#111", "白": "#fff", "灰": "#9a9a9a",
    "青": "#2b6cd4", "緑": "#4d8b3a", "黄": "#e8c62a", "赤・橙": "#e0602a",
  };

  const state = {
    birds: [],
    byName: new Map(),
    query: "",
    filters: { size: new Set(), colors: new Set(), habitat: new Set(), season: new Set(), beak: new Set() },
  };

  const $ = (sel) => document.querySelector(sel);
  const grid = $("#grid"), empty = $("#empty"), status = $("#status");

  // ===== かな正規化（ひらがな・カタカナ両対応） =====
  const toHira = (s) => s.replace(/[\u30a1-\u30f6]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
  const norm = (s) => toHira(String(s || "")).replace(/\s+/g, "").toLowerCase();

  // ===== プレースホルダー画像（色から生成） =====
  function placeholder(bird) {
    const cols = (bird.colors || ["灰"]).map((c) => SWATCH[c] || "#999");
    const w = 400, h = 300, bw = w / cols.length;
    const rects = cols.map((c, i) => `<rect x="${i * bw}" y="0" width="${bw + 1}" height="${h}" fill="${c}" opacity="0.55"/>`).join("");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">
      <rect width="${w}" height="${h}" fill="#e6e6e6"/>${rects}
      <rect x="0" y="${h/2-46}" width="${w}" height="92" fill="rgba(0,0,0,0.55)"/>
      <text x="50%" y="${h/2-4}" text-anchor="middle" font-size="32" font-weight="700" font-family="sans-serif" fill="#fff">${bird.name}</text>
      <text x="50%" y="${h/2+30}" text-anchor="middle" font-size="16" font-family="sans-serif" fill="#ddd">写真準備中</text>
    </svg>`;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }
  function setImg(img, bird) {
    img.alt = bird.name;
    img.onerror = () => { img.onerror = null; img.src = placeholder(bird); };
    img.src = bird.image || "";
    if (!bird.image) img.src = placeholder(bird);
  }

  // ===== フィルターUI生成 =====
  function buildFilters() {
    document.querySelectorAll(".filter-group").forEach((g) => {
      const key = g.dataset.key;
      const box = g.querySelector(".chips");
      OPTIONS[key].forEach((v) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "chip";
        b.setAttribute("aria-pressed", "false");
        b.dataset.key = key; b.dataset.value = v;
        if (key === "colors") {
          b.innerHTML = `<span class="sw" style="--sw:${SWATCH[v]}"></span>${v}`;
        } else {
          b.textContent = v;
        }
        b.addEventListener("click", () => {
          const set = state.filters[key];
          set.has(v) ? set.delete(v) : set.add(v);
          b.setAttribute("aria-pressed", set.has(v) ? "true" : "false");
          render();
        });
        box.appendChild(b);
      });
    });
  }

  // ===== 判定 =====
  function habitatsOf(bird) {
    return new Set((bird.habitat || []).map((h) => HABITAT_ALIAS[h] || h));
  }
  function matches(bird) {
    const f = state.filters;
    if (f.size.size && !f.size.has(bird.size)) return false;
    if (f.season.size && !f.season.has(bird.season)) return false;
    if (f.beak.size && !f.beak.has(bird.beak)) return false;
    if (f.colors.size && ![...f.colors].some((c) => (bird.colors || []).includes(c))) return false;
    if (f.habitat.size) {
      const hs = habitatsOf(bird);
      if (![...f.habitat].some((h) => hs.has(h))) return false;
    }
    if (state.query) {
      const q = norm(state.query);
      if (!norm(bird.name).includes(q) && !norm(bird.kana).includes(q)) return false;
    }
    return true;
  }

  // ===== 描画 =====
  function render() {
    const list = state.birds.filter(matches);
    grid.innerHTML = "";
    const frag = document.createDocumentFragment();
    list.forEach((bird) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "card";
      card.innerHTML = `
        <div class="card-photo"><img loading="lazy"></div>
        <div class="card-text">
          <div class="card-name"></div>
          <div class="card-meta"><span></span><span class="tag-season"></span></div>
        </div>`;
      setImg(card.querySelector("img"), bird);
      card.querySelector(".card-name").textContent = bird.name;
      card.querySelector(".card-meta span").textContent = bird.size;
      card.querySelector(".tag-season").textContent = bird.season;
      card.addEventListener("click", () => openModal(bird));
      frag.appendChild(card);
    });
    grid.appendChild(frag);
    empty.hidden = list.length > 0;
    status.textContent = `${list.length} / ${state.birds.length} 種`;

    const active = Object.values(state.filters).reduce((n, s) => n + s.size, 0);
    $("#clear-btn").hidden = active === 0 && !state.query;
    $("#sheet-summary").innerHTML = active
      ? `絞り込み <small>${active}件の条件</small>`
      : `絞り込み <small>条件なし</small>`;
  }

  function clearAll() {
    Object.values(state.filters).forEach((s) => s.clear());
    document.querySelectorAll(".chip[aria-pressed]").forEach((b) => b.setAttribute("aria-pressed", "false"));
    state.query = "";
    $("#search").value = "";
    render();
  }

  // ===== 詳細モーダル =====
  const modal = $("#modal");
  function openModal(bird) {
    setImg($("#modal-img"), bird);
    $("#modal-name").textContent = bird.name;
    $("#modal-kana").textContent = bird.kana || "";
    $("#modal-attrs").innerHTML = [
      ["大きさ", bird.size],
      ["色", (bird.colors || []).join("・")],
      ["場所", (bird.habitat || []).join("・")],
      ["季節", bird.season],
      ["くちばし", bird.beak],
    ].map(([k, v]) => `<dt>${k}</dt><dd>${v || "—"}</dd>`).join("");
    $("#modal-features").textContent = bird.features || "";
    const sim = $("#modal-similar");
    sim.innerHTML = "";
    if (!bird.similar || bird.similar.length === 0) {
      sim.innerHTML = `<span class="kana">特になし</span>`;
    } else {
      bird.similar.forEach((name) => {
        const target = state.byName.get(name);
        const b = document.createElement("button");
        b.type = "button";
        b.className = "chip " + (target ? "link" : "disabled");
        b.textContent = name;
        if (target) b.addEventListener("click", () => openModal(target));
        else b.title = "未収録";
        sim.appendChild(b);
      });
    }
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    $(".modal-card").scrollTop = 0;
    $(".modal-close").focus();
  }
  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = "";
  }
  modal.addEventListener("click", (e) => { if (e.target.dataset.close !== undefined) closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) closeModal(); });

  // ===== 下部シート =====
  const sheet = $("#filter-sheet");
  $("#sheet-toggle").addEventListener("click", (e) => {
    if (e.target.closest("#clear-btn")) return;
    const open = sheet.dataset.open !== "true";
    sheet.dataset.open = open ? "true" : "false";
    $("#sheet-toggle").setAttribute("aria-expanded", String(open));
  });
  $("#clear-btn").addEventListener("click", (e) => { e.stopPropagation(); clearAll(); });
  $("#clear-btn").addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); clearAll(); } });

  // ===== 検索 =====
  $("#search").addEventListener("input", (e) => { state.query = e.target.value; render(); });

  // ===== テーマ切替 =====
  const root = document.documentElement;
  try {
    const saved = localStorage.getItem("theme");
    if (saved) root.dataset.theme = saved;
  } catch (_) {}
  $("#theme-toggle").addEventListener("click", () => {
    const sysDark = matchMedia("(prefers-color-scheme: dark)").matches;
    const cur = root.dataset.theme || (sysDark ? "dark" : "light");
    const next = cur === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch (_) {}
  });

  // ===== 起動 =====
  async function init() {
    buildFilters();
    try {
      const res = await fetch("birds.json");
      state.birds = await res.json();
    } catch (err) {
      status.textContent = "birds.json を読み込めませんでした。";
      return;
    }
    // 名前で引けるように（"ドバト(カワラバト)" → "ドバト" でも引ける）
    state.birds.forEach((b) => {
      state.byName.set(b.name, b);
      const short = b.name.replace(/[（(].*$/, "");
      if (!state.byName.has(short)) state.byName.set(short, b);
    });
    render();
  }
  init();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js"));
  }
})();

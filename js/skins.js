// js/skins.js (PERF: 900 skins / 80 thèmes) + images
// - Attente window.SKINS_READY
// - Mode thème lazy (cards à l'ouverture)
// - Rendering par chunks (évite freeze)
// - Debounce sur recherche/filters
// - Cache HTML des cards
(function () {
  const $ = (id) => document.getElementById(id);

  function toast(type, title, message) {
    if (typeof window.showToast === "function") window.showToast(message, type, title, 2500);
  }

  function safeStr(x) { return (x ?? "").toString(); }
  function norm(x) { return safeStr(x).toLowerCase().trim(); }

  function uniqueSorted(arr) {
    return [...new Set(arr)]
      .map((v) => safeStr(v).trim())
      .filter((v) => v.length > 0)
      .sort((a, b) => a.localeCompare(b, "fr"));
  }

  function debounce(fn, wait = 140) {
    let t = null;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  function rafChunk(items, chunkSize, renderChunk, done) {
    let i = 0;
    function step() {
      const start = i;
      const end = Math.min(i + chunkSize, items.length);
      i = end;
      renderChunk(items.slice(start, end), start, end);
      if (i < items.length) requestAnimationFrame(step);
      else if (done) done();
    }
    requestAnimationFrame(step);
  }

  // DOM
  const modeBrawlerBtn = $("modeBrawler");
  const modeThemeBtn = $("modeCategory");
  const selectLabel = $("selectLabel");
  const select = $("select");
  const rarity = $("rarity");
  const search = $("search");
  const host = $("cards");
  const resultCount = $("resultCount");
  const resultTitle = $("resultTitle");
  const accountLine = $("accountLine"); // optionnel

  const required = { modeBrawlerBtn, modeThemeBtn, selectLabel, select, rarity, search, host, resultCount, resultTitle };
  const missing = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) {
    console.error("skins.js: éléments UI manquants:", missing);
    toast("error", "UI", "IDs manquants sur la page Skins (F12 console).");
    return;
  }

  // Optional auth/owned
  const supa = window.supabaseClient || null;
  const Svc = window.OwnedService || null;

  let currentUser = null;
  let ownedSet = new Set();
  let ownedToken = 0;

  function canEditOwned() {
    return !!currentUser && !!Svc && typeof Svc.loadOwnedSet === "function" && typeof Svc.setOwned === "function";
  }

  async function loadOwnedSafe() {
    if (!canEditOwned()) { ownedSet = new Set(); return; }
    const t = ++ownedToken;
    try {
      const s = await Svc.loadOwnedSet(currentUser.id);
      if (t !== ownedToken) return;
      ownedSet = s instanceof Set ? s : new Set();
    } catch (e) {
      console.warn("loadOwnedSafe:", e);
      ownedSet = new Set();
    }
  }

  async function toggleOwnedSafe(skinId, isOwned) {
    if (!canEditOwned()) {
      toast("info", "Lecture seule", "Connecte-toi sur MyBrawl pour cocher.");
      return;
    }
    try {
      await Svc.setOwned(currentUser.id, skinId, isOwned);
      if (isOwned) ownedSet.add(skinId);
      else ownedSet.delete(skinId);
      toast("success", "Enregistré", isOwned ? "Skin ajouté." : "Skin retiré.");
      updateThemeOwnedBadges();
    } catch (e) {
      toast("error", "Erreur", e?.message || String(e));
    }
  }

  // Rarity mapping
  const RARITY_CLASS = {
    Rare: "rarity-rare",
    "Super Rare": "rarity-super-rare",
    Epic: "rarity-epic",
    Mythique: "rarity-mythic",
    "Légendaire": "rarity-legendary",
    Hypercharge: "rarity-hypercharge",
    "Argent": "rarity-silver",
    "Or": "rarity-gold",

  };

  function themeOf(s) {
    const t = safeStr(s?.category).trim();
    return t || "Sans thème";
  }

  // ----- IMG helpers -----
  function imgOf(s) {
    const direct = safeStr(s?.img).trim();
    if (direct) return direct;
    if (typeof window.getSkinImageUrl === "function" && s?.id) return window.getSkinImageUrl(s.id);
    return "";
  }

  function escapeHtml(str) {
    return String(str || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ---------- MAIN INIT (attend SKINS_READY) ----------
  (async () => {
    // attendre les 900 skins
    if (window.SKINS_READY && typeof window.SKINS_READY.then === "function") {
      await window.SKINS_READY;
    }

    const SKINS = Array.isArray(window.SKINS) ? window.SKINS : [];
    const RARITY_ORDER = window.RARITY_ORDER ?? ["Rare", "Super Rare", "Epic", "Mythique", "Légendaire", "Hypercharge"];

    if (!SKINS.length) {
      console.warn("SKINS vide: vérifie /data/skins.json + data/skins-data.js");
      toast("warn", "Skins", "SKINS est vide. Vérifie /data/skins.json.");
    }

    // ---------- PERF: pre-index ----------
    const indexed = SKINS.map((s) => ({
      s,
      id: s?.id,
      brawler: safeStr(s?.brawler).trim(),
      theme: themeOf(s),
      rarity: safeStr(s?.rarity).trim(),
      name: safeStr(s?.name).trim(),
      img: imgOf(s),
      searchKey: (
        norm(s?.name) + "|" +
        norm(s?.brawler) + "|" +
        norm(themeOf(s)) + "|" +
        norm(s?.rarity)
      )
    }));

    const indexedById = new Map();
    indexed.forEach((x) => { if (x.id) indexedById.set(x.id, x); });

    // Cache HTML des cards
    const cardHtmlCache = new Map();

function cardHtmlFor(s) {
  const id = s?.id || "";
  const t = themeOf(s);
  const rarityClass = RARITY_CLASS[s?.rarity] ?? "";

  const imgPath = id
    ? `../asset/skins/${id}.png`
    : `../asset/skins/placeholder.png`;

  const html = `
    <article class="card" data-skin-id="${id}">
      <img
        src="${imgPath}"
        alt="${s?.name ?? ""}"
        class="skin-img"
        onerror="this.src='../asset/skins/placeholder.png'"
      />

      <div class="row">
        <span class="pill">${t}</span>
        <span class="pill ${rarityClass}">${s?.rarity ?? "—"}</span>
      </div>

      <h3>${s?.name ?? "—"}</h3>
      <p class="muted">Brawler : <strong>${s?.brawler ?? "—"}</strong></p>

      <label class="owned-toggle">
        <input type="checkbox" />
        <span>Je l’ai</span>
      </label>
    </article>
  `;

  if (id) cardHtmlCache.set(id, html);
  return html;
}



    // ---------- UI State ----------
    let mode = "brawler";
    const LS_KEY = "brawldex_theme_collapsed_v2";
    let collapsedMap = loadCollapsedMap();
    let lastFiltered = [];

    function loadCollapsedMap() {
      try {
        const raw = localStorage.getItem(LS_KEY);
        const obj = raw ? JSON.parse(raw) : {};
        return obj && typeof obj === "object" ? obj : {};
      } catch {
        return {};
      }
    }
    function saveCollapsedMap() {
      try { localStorage.setItem(LS_KEY, JSON.stringify(collapsedMap)); } catch {}
    }

    function buildOptions() {
      const values = mode === "brawler"
        ? uniqueSorted(indexed.map((x) => x.brawler))
        : uniqueSorted(indexed.map((x) => x.theme));

      select.innerHTML = "";
      const optAll = document.createElement("option");
      optAll.value = "all";
      optAll.textContent = "Tous";
      select.appendChild(optAll);

      values.forEach((v) => {
        const opt = document.createElement("option");
        opt.value = v;
        opt.textContent = v;
        select.appendChild(opt);
      });

      selectLabel.textContent = mode === "brawler" ? "Choisir un brawler" : "Choisir un thème";
      resultTitle.textContent = mode === "brawler" ? "Skins par brawler" : "Skins par thème (lazy)";
    }

    function buildRarities() {
      rarity.innerHTML = "";
      const optAll = document.createElement("option");
      optAll.value = "all";
      optAll.textContent = "Toutes";
      rarity.appendChild(optAll);

      const existing = new Set(indexed.map((x) => x.rarity).filter(Boolean));
      RARITY_ORDER.forEach((r) => {
        if (!existing.has(r)) return;
        const opt = document.createElement("option");
        opt.value = r;
        opt.textContent = r;
        rarity.appendChild(opt);
      });
    }

    function setMode(next) {
      mode = next;

      const isB = mode === "brawler";
      modeBrawlerBtn.classList.toggle("is-active", isB);
      modeThemeBtn.classList.toggle("is-active", !isB);

      buildOptions();
      select.value = "all";
      debouncedRender();
    }

    function computeFiltered() {
      const selected = select.value || "all";
      const selectedRarity = rarity.value || "all";
      const q = norm(search.value);

      return indexed.filter((x) => {
        const groupValue = mode === "brawler" ? x.brawler : x.theme;
        const matchGroup = selected === "all" || groupValue === selected;
        const matchRarity = selectedRarity === "all" || x.rarity === selectedRarity;
        const matchSearch = !q || x.searchKey.includes(q);
        return matchGroup && matchRarity && matchSearch;
      });
    }

    // ---------- Theme controls ----------
    function ensureThemeControls() {
      let bar = document.getElementById("themeControls");
      if (bar) return bar;

      bar = document.createElement("div");
      bar.id = "themeControls";
      bar.className = "theme-controls";
      bar.innerHTML = `
        <button class="seg-btn theme-mini" type="button" id="btnExpandAll">Tout ouvrir</button>
        <button class="seg-btn theme-mini is-active" type="button" id="btnCollapseAll">Tout fermer</button>
        <span class="muted theme-hint">Rendu lazy : les cartes se chargent à l’ouverture.</span>
      `;
      host.prepend(bar);

      document.getElementById("btnExpandAll").addEventListener("click", () => expandAllThemes());
      document.getElementById("btnCollapseAll").addEventListener("click", () => collapseAllThemes());

      return bar;
    }

    function paintThemeControlButtons() {
      const b1 = document.getElementById("btnExpandAll");
      const b2 = document.getElementById("btnCollapseAll");
      if (!b1 || !b2) return;

      const sections = host.querySelectorAll(".theme-group");
      let allCollapsed = true;
      sections.forEach((sec) => { if (sec.dataset.collapsed !== "1") allCollapsed = false; });

      if (allCollapsed) {
        b2.classList.add("is-active");
        b1.classList.remove("is-active");
      } else {
        b1.classList.add("is-active");
        b2.classList.remove("is-active");
      }
    }

    function collapseAllThemes() {
      const sections = host.querySelectorAll(".theme-group");
      sections.forEach((sec) => {
        const theme = sec.getAttribute("data-theme") || "";
        collapsedMap[theme] = true;
        sec.dataset.collapsed = "1";
        const btn = sec.querySelector(".theme-toggle");
        if (btn) btn.setAttribute("aria-expanded", "false");
        const body = sec.querySelector(".theme-body");
        if (body) body.innerHTML = `<div class="cards theme-grid"></div>`;
        sec.dataset.rendered = "0";
      });
      saveCollapsedMap();
      paintThemeControlButtons();
    }

    function expandAllThemes() {
      const sections = [...host.querySelectorAll(".theme-group")];

      sections.forEach((sec) => {
        const theme = sec.getAttribute("data-theme") || "";
        collapsedMap[theme] = false;
        sec.dataset.collapsed = "0";
        const btn = sec.querySelector(".theme-toggle");
        if (btn) btn.setAttribute("aria-expanded", "true");
      });
      saveCollapsedMap();
      paintThemeControlButtons();

      let idx = 0;
      function next() {
        if (idx >= sections.length) return;
        const sec = sections[idx++];
        lazyRenderThemeSection(sec, true, () => requestAnimationFrame(next));
      }
      requestAnimationFrame(next);
    }

    function lazyRenderThemeSection(sectionEl, force, done) {
      if (!sectionEl) return done && done();

      const rendered = sectionEl.dataset.rendered === "1";
      if (rendered && !force) return done && done();

      const listJson = sectionEl.getAttribute("data-list");
      let ids = [];
      try { ids = listJson ? JSON.parse(listJson) : []; } catch { ids = []; }

      const grid = sectionEl.querySelector(".theme-grid");
      if (!grid) return done && done();

      grid.innerHTML = "";
      sectionEl.dataset.rendered = "0";

      const CHUNK = 30;
      rafChunk(ids, CHUNK, (chunkIds) => {
        const frag = document.createDocumentFragment();

        chunkIds.forEach((id) => {
          const x = indexedById.get(id);
          if (!x) return;

          const tmp = document.createElement("div");
          tmp.innerHTML = cardHtmlFor(x.s).trim();
          const card = tmp.firstElementChild;

          const cb = card.querySelector("input[type='checkbox']");
          const editable = canEditOwned();
          cb.checked = ownedSet.has(id);
          cb.disabled = !editable;
          const label = card.querySelector(".owned-toggle");
          if (label) label.style.opacity = editable ? "1" : "0.65";

          cb.addEventListener("change", (e) => toggleOwnedSafe(id, e.target.checked));
          frag.appendChild(card);
        });

        grid.appendChild(frag);
      }, () => {
        sectionEl.dataset.rendered = "1";
        if (done) done();
      });
    }

    function updateThemeOwnedBadges() {
      const sections = host.querySelectorAll(".theme-group");
      sections.forEach((sec) => {
        const listJson = sec.getAttribute("data-list");
        let ids = [];
        try { ids = listJson ? JSON.parse(listJson) : []; } catch { ids = []; }

        let owned = 0;
        ids.forEach((id) => { if (ownedSet.has(id)) owned++; });

        const ownedEl = sec.querySelector("[data-owned-count]");
        if (ownedEl) ownedEl.textContent = String(owned);
      });
    }

    // ---------- Render ----------
    function renderBrawler(filtered) {
      host.innerHTML = "";

      const CHUNK = 42;
      const ids = filtered.map((x) => x.id).filter(Boolean);
      resultCount.textContent = `${ids.length} skin(s) affiché(s)`;

      rafChunk(ids, CHUNK, (chunkIds) => {
        const frag = document.createDocumentFragment();

        chunkIds.forEach((id) => {
          const x = indexedById.get(id);
          if (!x) return;

          const tmp = document.createElement("div");
          tmp.innerHTML = cardHtmlFor(x.s).trim();
          const card = tmp.firstElementChild;

          const cb = card.querySelector("input[type='checkbox']");
          const editable = canEditOwned();
          cb.checked = ownedSet.has(id);
          cb.disabled = !editable;
          const label = card.querySelector(".owned-toggle");
          if (label) label.style.opacity = editable ? "1" : "0.65";
          cb.addEventListener("change", (e) => toggleOwnedSafe(id, e.target.checked));

          frag.appendChild(card);
        });

        host.appendChild(frag);
      });
    }

    function renderTheme(filtered) {
      host.innerHTML = "";
      ensureThemeControls();

      const groups = new Map();
      filtered.forEach((x) => {
        const t = x.theme;
        if (!groups.has(t)) groups.set(t, []);
        groups.get(t).push(x.id);
      });

      const themes = [...groups.keys()].sort((a, b) => a.localeCompare(b, "fr"));
      const totalSkins = filtered.length;

      resultCount.textContent = `${totalSkins} skin(s) dans ${themes.length} thème(s)`;
      if (!themes.length) return;

      const mobileDefaultCollapse = window.matchMedia("(max-width: 980px)").matches;

      const frag = document.createDocumentFragment();

      themes.forEach((theme) => {
        const ids = groups.get(theme) || [];
        ids.sort((ida, idb) => {
          const a = indexedById.get(ida)?.s;
          const b = indexedById.get(idb)?.s;
          const ra = RARITY_ORDER.indexOf(a?.rarity);
          const rb = RARITY_ORDER.indexOf(b?.rarity);
          if (ra !== rb) return (ra === -1 ? 999 : ra) - (rb === -1 ? 999 : rb);
          return safeStr(a?.name).localeCompare(safeStr(b?.name), "fr");
        });

        const hasSaved = Object.prototype.hasOwnProperty.call(collapsedMap, theme);
        const collapsed = hasSaved ? !!collapsedMap[theme] : !!mobileDefaultCollapse;

        let owned = 0;
        ids.forEach((id) => { if (ownedSet.has(id)) owned++; });

        const section = document.createElement("section");
        section.className = "theme-group";
        section.setAttribute("data-theme", theme);
        section.setAttribute("data-list", JSON.stringify(ids));
        section.dataset.collapsed = collapsed ? "1" : "0";
        section.dataset.rendered = "0";

        section.innerHTML = `
          <div class="theme-head">
            <button class="theme-toggle" type="button" aria-expanded="${collapsed ? "false" : "true"}">
              <span class="theme-caret" aria-hidden="true"></span>
              <span class="theme-title">${escapeHtml(theme)}</span>
            </button>

            <div class="theme-meta">
              <span class="theme-chip">
                <span class="theme-num">${ids.length}</span>
                <span class="theme-lbl">skins</span>
              </span>

              <span class="theme-chip ${canEditOwned() ? "ok" : ""}">
                <span class="theme-num" data-owned-count>${owned}</span>
                <span class="theme-lbl">possédés</span>
              </span>
            </div>
          </div>

          <div class="theme-body">
            <div class="cards theme-grid"></div>
          </div>
        `;

        const toggleBtn = section.querySelector(".theme-toggle");
        toggleBtn.addEventListener("click", () => {
          const nowCollapsed = section.dataset.collapsed === "1" ? false : true;
          section.dataset.collapsed = nowCollapsed ? "1" : "0";
          collapsedMap[theme] = nowCollapsed;
          saveCollapsedMap();
          toggleBtn.setAttribute("aria-expanded", nowCollapsed ? "false" : "true");
          paintThemeControlButtons();

          if (!nowCollapsed) {
            lazyRenderThemeSection(section, false);
          } else {
            const body = section.querySelector(".theme-body");
            if (body) body.innerHTML = `<div class="cards theme-grid"></div>`;
            section.dataset.rendered = "0";
          }
        });

        frag.appendChild(section);

        if (!collapsed) {
          requestAnimationFrame(() => lazyRenderThemeSection(section, false));
        }
      });

      host.appendChild(frag);
      paintThemeControlButtons();
    }

    function render() {
      lastFiltered = computeFiltered();
      if (mode === "brawler") renderBrawler(lastFiltered);
      else renderTheme(lastFiltered);
    }

    const debouncedRender = debounce(render, 140);

    // Events
    modeBrawlerBtn.addEventListener("click", () => setMode("brawler"));
    modeThemeBtn.addEventListener("click", () => setMode("theme"));
    select.addEventListener("change", debouncedRender);
    rarity.addEventListener("change", debouncedRender);
    search.addEventListener("input", debouncedRender);

    // Init UI
    buildRarities();
    buildOptions();
    render();

    // Auth (never blocks UI)
    (async () => {
      if (!supa || !supa.auth) {
        if (accountLine) accountLine.textContent = "Mode visiteur : connexion via MyBrawl pour cocher tes skins.";
        return;
      }

      try {
        const { data } = await supa.auth.getSession();
        currentUser = data.session?.user ?? null;

        if (accountLine) {
          accountLine.textContent = currentUser
            ? `Connecté : ${currentUser.email ?? currentUser.id} (tu peux cocher tes skins)`
            : "Non connecté : affichage en lecture seule. Va sur MyBrawl pour te connecter.";
        }

        await loadOwnedSafe();
        render();

        supa.auth.onAuthStateChange(async (_event, session) => {
          currentUser = session?.user ?? null;

          if (accountLine) {
            accountLine.textContent = currentUser
              ? `Connecté : ${currentUser.email ?? currentUser.id} (tu peux cocher tes skins)`
              : "Non connecté : affichage en lecture seule. Va sur MyBrawl pour te connecter.";
          }

          await loadOwnedSafe();
          render();
        });
      } catch (e) {
        console.warn("Auth init failed:", e);
        if (accountLine) accountLine.textContent = "Mode visiteur : connexion via MyBrawl pour cocher tes skins.";
      }
    })();
  })();
})();

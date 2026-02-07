// js/skins.js (THEMES GROUPED + COUNTS + MOBILE ACCORDION + SAFE)
(function () {
  const $ = (id) => document.getElementById(id);

  // ---------- Toast ----------
  function toast(type, title, message) {
    if (typeof window.showToast === "function") window.showToast(message, type, title, 3500);
  }

  // ---------- Utils ----------
  function uniqueSorted(arr) {
    return [...new Set(arr)]
      .map((v) => (v ?? "").toString().trim())
      .filter((v) => v.length > 0)
      .sort((a, b) => a.localeCompare(b, "fr"));
  }

  function safeStr(x) {
    return (x ?? "").toString();
  }

  function isMobile() {
    return window.matchMedia && window.matchMedia("(max-width: 980px)").matches;
  }

  const LS_KEY = "brawldex_skins_theme_collapsed_v1";

  function loadCollapsedMap() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      const obj = raw ? JSON.parse(raw) : {};
      return obj && typeof obj === "object" ? obj : {};
    } catch {
      return {};
    }
  }

  function saveCollapsedMap(map) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(map || {}));
    } catch {}
  }

  // ---------- DOM ----------
  const modeBrawlerBtn = $("modeBrawler");
  const modeThemeBtn = $("modeCategory"); // ton id existant
  const selectLabel = $("selectLabel");
  const select = $("select");
  const rarity = $("rarity");
  const search = $("search");
  const cardsHost = $("cards");
  const resultCount = $("resultCount");
  const resultTitle = $("resultTitle");
  const accountLine = $("accountLine"); // optionnel

  const required = { modeBrawlerBtn, modeThemeBtn, selectLabel, select, rarity, search, cardsHost, resultCount, resultTitle };
  const missing = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) {
    console.error("skins.js: éléments UI manquants:", missing);
    toast("error", "UI", "IDs manquants sur la page Skins. Ouvre la console (F12).");
    return;
  }

  // ---------- Data ----------
  const SKINS = Array.isArray(window.SKINS) ? window.SKINS : [];
  const RARITY_ORDER = window.RARITY_ORDER ?? ["Rare", "Super Rare", "Epic", "Mythique", "Légendaire", "Hypercharge"];
  const RARITY_CLASS = {
    Rare: "rarity-rare",
    "Super Rare": "rarity-super-rare",
    Epic: "rarity-epic",
    Mythique: "rarity-mythic",
    "Légendaire": "rarity-legendary",
    Hypercharge: "rarity-hypercharge",
  };

  // ✅ Thème = category (ton dataset)
  function themeOf(s) {
    const t = safeStr(s?.category).trim();
    return t || "Sans thème";
  }

  if (!SKINS.length) {
    console.warn("skins.js: SKINS vide. Vérifie ../data/skins-data.js AVANT js/skins.js");
    toast("warn", "Skins", "SKINS est vide. Vérifie l’ordre des scripts sur pages/skins.html.");
  }

  // ---------- Optional auth/owned ----------
  const supa = window.supabaseClient || null;
  const Svc = window.OwnedService || null;

  let currentUser = null;
  let ownedSet = new Set();
  let ownedToken = 0;

  function canEditOwned() {
    return !!currentUser && !!Svc && typeof Svc.loadOwnedSet === "function" && typeof Svc.setOwned === "function";
  }

  async function loadOwnedSafe() {
    if (!canEditOwned()) {
      ownedSet = new Set();
      return;
    }
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
      toast("info", "Lecture seule", "Connecte-toi sur MyBrawl pour cocher tes skins.");
      return;
    }
    try {
      await Svc.setOwned(currentUser.id, skinId, isOwned);
      if (isOwned) ownedSet.add(skinId);
      else ownedSet.delete(skinId);
      toast("success", "Enregistré", isOwned ? "Skin ajouté." : "Skin retiré.");
      render();
    } catch (e) {
      console.warn("toggleOwnedSafe:", e);
      toast("error", "Erreur", e?.message || String(e));
    }
  }

  // ---------- UI State ----------
  let mode = "brawler"; // "brawler" | "theme"
  let collapsedMap = loadCollapsedMap(); // theme -> boolean

  function setMode(next) {
    mode = next;

    const isB = mode === "brawler";
    modeBrawlerBtn.classList.toggle("is-active", isB);
    modeThemeBtn.classList.toggle("is-active", !isB);

    buildOptions();
    select.value = "all";
    render();
  }

  function buildOptions() {
    const values =
      mode === "brawler"
        ? uniqueSorted(SKINS.map((s) => safeStr(s?.brawler).trim()))
        : uniqueSorted(SKINS.map((s) => themeOf(s)));

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
    resultTitle.textContent = mode === "brawler" ? "Skins par brawler" : "Skins par thème (groupés)";
  }

  function buildRarities() {
    rarity.innerHTML = "";

    const optAll = document.createElement("option");
    optAll.value = "all";
    optAll.textContent = "Toutes";
    rarity.appendChild(optAll);

    const existing = new Set(SKINS.map((s) => s?.rarity).filter(Boolean));
    RARITY_ORDER.forEach((r) => {
      if (!existing.has(r)) return;
      const opt = document.createElement("option");
      opt.value = r;
      opt.textContent = r;
      rarity.appendChild(opt);
    });
  }

  function makeSkinCard(s) {
    const editable = canEditOwned();
    const checked = ownedSet.has(s.id);
    const rarityClass = RARITY_CLASS[s.rarity] ?? "";

    const el = document.createElement("article");
    el.className = "card";
    el.innerHTML = `
      <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start; flex-wrap:wrap;">
        <div>
          <div class="row">
            <span class="pill">${themeOf(s)}</span>
            <span class="pill ${rarityClass}">${s?.rarity ?? "—"}</span>
          </div>
          <h3 style="margin:8px 0 6px 0;">${s?.name ?? "—"}</h3>
          <p class="muted" style="margin:0;">Brawler : <strong>${s?.brawler ?? "—"}</strong></p>
        </div>

        <label class="owned-toggle" style="display:flex; gap:8px; align-items:center; user-select:none; opacity:${editable ? "1" : "0.65"};">
          <input type="checkbox" ${checked ? "checked" : ""} ${editable ? "" : "disabled"} />
          <span>Je l’ai</span>
        </label>
      </div>
    `;

    const cb = el.querySelector("input[type='checkbox']");
    cb.addEventListener("change", async (e) => {
      await toggleOwnedSafe(s.id, e.target.checked);
    });

    return el;
  }

  function groupBy(list, keyFn) {
    const m = new Map();
    list.forEach((x) => {
      const k = keyFn(x);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(x);
    });
    return m;
  }

  function countOwned(list) {
    if (!ownedSet || ownedSet.size === 0) return 0;
    let c = 0;
    list.forEach((s) => { if (s?.id && ownedSet.has(s.id)) c++; });
    return c;
  }

  function applyCollapse(theme, collapse) {
    collapsedMap[theme] = !!collapse;
    saveCollapsedMap(collapsedMap);

    const section = cardsHost.querySelector(`[data-theme="${CSS.escape(theme)}"]`);
    if (!section) return;

    section.dataset.collapsed = collapse ? "1" : "0";

    const btn = section.querySelector(".theme-toggle");
    if (btn) btn.setAttribute("aria-expanded", collapse ? "false" : "true");
  }

  function setAllCollapsed(collapse) {
    const sections = cardsHost.querySelectorAll(".theme-group");
    sections.forEach((sec) => {
      const theme = sec.getAttribute("data-theme") || "";
      if (!theme) return;
      collapsedMap[theme] = !!collapse;
      sec.dataset.collapsed = collapse ? "1" : "0";
      const btn = sec.querySelector(".theme-toggle");
      if (btn) btn.setAttribute("aria-expanded", collapse ? "false" : "true");
    });
    saveCollapsedMap(collapsedMap);
  }

  function ensureToolbarControlsInThemeMode() {
    // injecte une mini-toolbar (ouvrir/fermer) au-dessus des sections en mode thème
    const existing = $("themeControls");
    if (existing) return existing;

    const wrap = document.createElement("div");
    wrap.id = "themeControls";
    wrap.className = "theme-controls";

    wrap.innerHTML = `
      <button class="seg-btn theme-mini" type="button" id="btnExpandAll">Tout ouvrir</button>
      <button class="seg-btn theme-mini is-active" type="button" id="btnCollapseAll">Tout fermer</button>
      <span class="muted theme-hint">Astuce : sur mobile les thèmes sont repliables.</span>
    `;

    // insère au tout début du host
    cardsHost.prepend(wrap);

    $("btnExpandAll").addEventListener("click", () => {
      setAllCollapsed(false);
      $("btnExpandAll").classList.add("is-active");
      $("btnCollapseAll").classList.remove("is-active");
    });

    $("btnCollapseAll").addEventListener("click", () => {
      setAllCollapsed(true);
      $("btnCollapseAll").classList.add("is-active");
      $("btnExpandAll").classList.remove("is-active");
    });

    return wrap;
  }

  function render() {
    const selected = select.value || "all";
    const selectedRarity = rarity.value || "all";
    const q = (search.value || "").toLowerCase().trim();

    const filtered = SKINS.filter((s) => {
      if (!s) return false;

      const groupValue = mode === "brawler" ? safeStr(s?.brawler).trim() : themeOf(s);

      const matchGroup = selected === "all" || groupValue === selected;
      const matchRarity = selectedRarity === "all" || s?.rarity === selectedRarity;

      const matchSearch =
        q === "" ||
        safeStr(s?.name).toLowerCase().includes(q) ||
        safeStr(s?.brawler).toLowerCase().includes(q) ||
        safeStr(themeOf(s)).toLowerCase().includes(q) ||
        safeStr(s?.rarity).toLowerCase().includes(q);

      return matchGroup && matchRarity && matchSearch;
    });

    resultCount.textContent = `${filtered.length} skin(s) affiché(s)`;
    cardsHost.innerHTML = "";

    // ----- Mode BRAWLER : grille simple -----
    if (mode === "brawler") {
      filtered.forEach((s) => cardsHost.appendChild(makeSkinCard(s)));
      return;
    }

    // ----- Mode THEME : groupé + accordion -----
    ensureToolbarControlsInThemeMode();

    const groups = groupBy(filtered, (s) => themeOf(s));
    const themes = [...groups.keys()].sort((a, b) => a.localeCompare(b, "fr"));

    if (!themes.length) {
      const p = document.createElement("p");
      p.className = "muted";
      p.textContent = "Aucun thème trouvé. Vérifie que tes skins ont bien un champ 'category'.";
      cardsHost.appendChild(p);
      return;
    }

    // Sur mobile: par défaut replier (sauf si l’utilisateur a déjà un état sauvegardé)
    const mobile = isMobile();

    themes.forEach((theme) => {
      const list = groups.get(theme) || [];

      // tri interne: rareté puis nom (plus “encyclopédie”)
      list.sort((a, b) => {
        const ra = RARITY_ORDER.indexOf(a?.rarity);
        const rb = RARITY_ORDER.indexOf(b?.rarity);
        if (ra !== rb) return (ra === -1 ? 999 : ra) - (rb === -1 ? 999 : rb);
        return safeStr(a?.name).localeCompare(safeStr(b?.name), "fr");
      });

      const total = list.length;
      const owned = countOwned(list);

      // collapse state
      const hasSaved = Object.prototype.hasOwnProperty.call(collapsedMap, theme);
      const collapsed = hasSaved ? !!collapsedMap[theme] : (mobile ? true : false);

      const section = document.createElement("section");
      section.className = "theme-group";
      section.setAttribute("data-theme", theme);
      section.dataset.collapsed = collapsed ? "1" : "0";

      section.innerHTML = `
        <div class="theme-head">
          <button class="theme-toggle" type="button" aria-expanded="${collapsed ? "false" : "true"}">
            <span class="theme-caret" aria-hidden="true"></span>
            <span class="theme-title">${theme}</span>
          </button>

          <div class="theme-meta">
            <span class="theme-chip">
              <span class="theme-num">${total}</span>
              <span class="theme-lbl">skins</span>
            </span>

            <span class="theme-chip ${canEditOwned() ? "ok" : ""}">
              <span class="theme-num">${owned}</span>
              <span class="theme-lbl">possédés</span>
            </span>
          </div>
        </div>

        <div class="theme-body">
          <div class="cards theme-grid"></div>
        </div>
      `;

      const grid = section.querySelector(".theme-grid");
      list.forEach((s) => grid.appendChild(makeSkinCard(s)));

      // toggle collapse
      const btn = section.querySelector(".theme-toggle");
      btn.addEventListener("click", () => {
        const isCollapsed = section.dataset.collapsed === "1";
        applyCollapse(theme, !isCollapsed);
      });

      cardsHost.appendChild(section);
    });

    // met à jour l'état visuel des mini boutons (optionnel)
    const btnExpandAll = $("btnExpandAll");
    const btnCollapseAll = $("btnCollapseAll");
    if (btnExpandAll && btnCollapseAll) {
      // si tout replié => collapse actif, sinon expand actif
      const secs = cardsHost.querySelectorAll(".theme-group");
      let allCollapsed = true;
      secs.forEach((s) => { if (s.dataset.collapsed !== "1") allCollapsed = false; });
      if (allCollapsed) {
        btnCollapseAll.classList.add("is-active");
        btnExpandAll.classList.remove("is-active");
      } else {
        btnExpandAll.classList.add("is-active");
        btnCollapseAll.classList.remove("is-active");
      }
    }
  }

  // ---------- Events ----------
  modeBrawlerBtn.addEventListener("click", () => setMode("brawler"));
  modeThemeBtn.addEventListener("click", () => setMode("theme"));
  select.addEventListener("change", render);
  rarity.addEventListener("change", render);
  search.addEventListener("input", render);

  // ---------- Init ----------
  buildRarities();
  buildOptions();
  render();

  // ---------- Auth (never blocks UI) ----------
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

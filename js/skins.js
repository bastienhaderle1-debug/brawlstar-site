// js/skins.js (GROUPED THEME VIEW + SAFE / NO-CRASH)
(function () {
  const $ = (id) => document.getElementById(id);

  function toast(type, title, message) {
    if (typeof window.showToast === "function") window.showToast(message, type, title, 3500);
  }

  function uniqueSorted(arr) {
    return [...new Set(arr)]
      .map((v) => (v ?? "").toString().trim())
      .filter((v) => v.length > 0)
      .sort((a, b) => a.localeCompare(b, "fr"));
  }

  // ---- DOM ----
  const modeBrawlerBtn = $("modeBrawler");
  const modeThemeBtn = $("modeCategory"); // bouton "Par thème"
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

  // ---- Data ----
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

  // ✅ On utilise category comme "thème"
  function themeOf(s) {
    const t = (s?.category ?? "").toString().trim();
    return t || "Sans thème";
  }

  if (!SKINS.length) {
    console.warn("skins.js: SKINS vide. Vérifie que ../data/skins-data.js est chargé AVANT js/skins.js");
    toast("warn", "Skins", "SKINS est vide. Vérifie l’ordre des scripts sur pages/skins.html.");
  }

  // ---- Optional auth/owned ----
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

  // ---- UI state ----
  let mode = "brawler"; // "brawler" | "theme"

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
    const values = mode === "brawler"
      ? uniqueSorted(SKINS.map((s) => (s?.brawler ?? "").toString().trim()))
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

        <label style="display:flex; gap:8px; align-items:center; user-select:none; opacity:${editable ? "1" : "0.65"};">
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

  function render() {
    const selected = select.value || "all";
    const selectedRarity = rarity.value || "all";
    const q = (search.value || "").toLowerCase().trim();

    // Filtre commun
    const filtered = SKINS.filter((s) => {
      if (!s) return false;

      const groupValue = mode === "brawler"
        ? (s?.brawler ?? "").toString().trim()
        : themeOf(s);

      const matchGroup = selected === "all" || groupValue === selected;
      const matchRarity = selectedRarity === "all" || s?.rarity === selectedRarity;

      const matchSearch =
        q === "" ||
        String(s?.name ?? "").toLowerCase().includes(q) ||
        String(s?.brawler ?? "").toLowerCase().includes(q) ||
        String(themeOf(s)).toLowerCase().includes(q) ||
        String(s?.rarity ?? "").toLowerCase().includes(q);

      return matchGroup && matchRarity && matchSearch;
    });

    resultCount.textContent = `${filtered.length} skin(s) affiché(s)`;
    cardsHost.innerHTML = "";

    // ✅ Mode BRAWLER: rendu simple (une grille)
    if (mode === "brawler") {
      filtered.forEach((s) => cardsHost.appendChild(makeSkinCard(s)));
      return;
    }

    // ✅ Mode THEME: rendu GROUPÉ par thème (vrai "classement")
    const groups = new Map(); // theme -> array
    filtered.forEach((s) => {
      const t = themeOf(s);
      if (!groups.has(t)) groups.set(t, []);
      groups.get(t).push(s);
    });

    const themes = [...groups.keys()].sort((a, b) => a.localeCompare(b, "fr"));

    // aucun thème (cas extrême)
    if (!themes.length) {
      const p = document.createElement("p");
      p.className = "muted";
      p.textContent = "Aucun thème trouvé. Vérifie que tes skins ont bien un champ 'category'.";
      cardsHost.appendChild(p);
      console.warn("Aucun thème trouvé. Exemple de clés d'un skin:", Object.keys(SKINS[0] || {}));
      return;
    }

    themes.forEach((t) => {
      const section = document.createElement("section");
      section.style.margin = "16px 0 6px 0";

      const h = document.createElement("h3");
      h.textContent = t;
      h.style.margin = "6px 0 10px 0";
      h.style.textTransform = "uppercase";
      h.style.letterSpacing = ".8px";
      section.appendChild(h);

      const grid = document.createElement("div");
      grid.className = "cards"; // réutilise ta grille CSS

      // tri interne par nom
      groups.get(t)
        .slice()
        .sort((a, b) => String(a?.name ?? "").localeCompare(String(b?.name ?? ""), "fr"))
        .forEach((s) => grid.appendChild(makeSkinCard(s)));

      section.appendChild(grid);
      cardsHost.appendChild(section);
    });
  }

  // ---- Events ----
  modeBrawlerBtn.addEventListener("click", () => setMode("brawler"));
  modeThemeBtn.addEventListener("click", () => setMode("theme"));

  select.addEventListener("change", render);
  rarity.addEventListener("change", render);
  search.addEventListener("input", render);

  // ---- Init (affiche tout tout de suite) ----
  buildRarities();
  buildOptions();
  render();

  // ---- Auth (ne bloque jamais l'affichage) ----
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

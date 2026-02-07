// js/skins.js
(function () {
  if (!window.supabaseClient) {
    if (window.showToast) showToast("supabaseClient introuvable. Vérifie ../data/supabase-client.js et l’ordre des scripts.", "error", "Supabase", 4000);
    throw new Error("supabaseClient introuvable");
  }
  if (!window.OwnedService) {
    if (window.showToast) showToast("OwnedService introuvable. Vérifie ../js/owned-service.js", "error", "Erreur", 4000);
    throw new Error("OwnedService introuvable");
  }

  const supa = window.supabaseClient;
  const Svc = window.OwnedService;
  const skins = Svc.getSkins();

  const RARITY_ORDER = window.RARITY_ORDER ?? ["Rare","Super Rare","Epic","Mythique","Légendaire","Hypercharge"];
  const RARITY_CLASS = {
    "Rare": "rarity-rare",
    "Super Rare": "rarity-super-rare",
    "Epic": "rarity-epic",
    "Mythique": "rarity-mythic",
    "Légendaire": "rarity-legendary",
    "Hypercharge": "rarity-hypercharge",
  };

  // UI
  let mode = "brawler"; // "brawler" | "theme"

  const modeBrawlerBtn = document.getElementById("modeBrawler");
  const modeThemeBtn = document.getElementById("modeCategory"); // ton id existant
  const selectLabel = document.getElementById("selectLabel");
  const select = document.getElementById("select");
  const rarity = document.getElementById("rarity");
  const search = document.getElementById("search");
  const cards = document.getElementById("cards");
  const resultCount = document.getElementById("resultCount");
  const resultTitle = document.getElementById("resultTitle");
  const accountLine = document.getElementById("accountLine"); // optionnel

  let currentUser = null;
  let ownedSet = new Set();
  let loadingToken = 0;

  function uniqueSorted(arr) {
    return [...new Set(arr)]
      .map(v => (v ?? "").trim())
      .filter(v => v.length > 0)
      .sort((a, b) => a.localeCompare(b, "fr"));
  }

  function getQueryParam(name) {
    try { return new URL(window.location.href).searchParams.get(name); } catch { return null; }
  }

  // ✅ THEME = category (tes données actuelles)
  function themeOf(s) {
    return (s?.category ?? "").trim();
  }

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
      ? uniqueSorted(skins.map(s => s?.brawler))
      : uniqueSorted(skins.map(s => themeOf(s)));

    select.innerHTML = "";

    const optAll = document.createElement("option");
    optAll.value = "all";
    optAll.textContent = "Tous";
    select.appendChild(optAll);

    values.forEach(v => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      select.appendChild(opt);
    });

    selectLabel.textContent = mode === "brawler" ? "Choisir un brawler" : "Choisir un thème";
    resultTitle.textContent = mode === "brawler" ? "Skins par brawler" : "Skins par thème";
  }

  function buildRarities() {
    rarity.innerHTML = "";
    const optAll = document.createElement("option");
    optAll.value = "all";
    optAll.textContent = "Toutes";
    rarity.appendChild(optAll);

    const existing = new Set(skins.map(s => s?.rarity).filter(Boolean));
    RARITY_ORDER.forEach(r => {
      if (!existing.has(r)) return;
      const opt = document.createElement("option");
      opt.value = r;
      opt.textContent = r;
      rarity.appendChild(opt);
    });
  }

  async function loadOwned() {
    if (!currentUser) { ownedSet = new Set(); return; }
    const myToken = ++loadingToken;

    try {
      const s = await Svc.loadOwnedSet(currentUser.id);
      if (myToken !== loadingToken) return;
      ownedSet = s;
    } catch (e) {
      if (Svc.isAbortError?.(e)) return;
      ownedSet = new Set();
    }
  }

  async function toggleOwned(skinId, isOwned) {
    if (!currentUser) {
      if (window.showToast) showToast("Connecte-toi sur MyBrawl pour remplir tes skins.", "info", "Lecture seule");
      return;
    }

    try {
      await Svc.setOwned(currentUser.id, skinId, isOwned);
      if (isOwned) ownedSet.add(skinId);
      else ownedSet.delete(skinId);

      if (window.showToast) showToast(isOwned ? "Skin ajouté." : "Skin retiré.", "success", "Enregistré");
      render();
    } catch (e) {
      if (Svc.isAbortError?.(e)) return;
      if (window.showToast) showToast(e.message || String(e), "error", "Erreur");
    }
  }

  function render() {
    const selected = select.value || "all";
    const selectedRarity = rarity.value || "all";
    const q = (search.value || "").toLowerCase().trim();

    const filtered = skins.filter(s => {
      const groupValue = mode === "brawler" ? (s?.brawler ?? "") : themeOf(s);

      const matchGroup = selected === "all" || groupValue === selected;
      const matchRarity = selectedRarity === "all" || s?.rarity === selectedRarity;

      const matchSearch =
        q === "" ||
        String(s?.name ?? "").toLowerCase().includes(q) ||
        String(s?.brawler ?? "").toLowerCase().includes(q) ||
        String(themeOf(s) ?? "").toLowerCase().includes(q) ||
        String(s?.rarity ?? "").toLowerCase().includes(q);

      return matchGroup && matchRarity && matchSearch;
    });

    cards.innerHTML = "";
    resultCount.textContent = `${filtered.length} skin(s) affiché(s)`;

    const canEdit = !!currentUser;

    filtered.forEach(s => {
      const el = document.createElement("article");
      el.className = "card";

      const rarityClass = RARITY_CLASS[s?.rarity] ?? "";
      const checked = ownedSet.has(s?.id);

      el.innerHTML = `
        <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start; flex-wrap:wrap;">
          <div>
            <div class="row">
              <span class="pill">${themeOf(s) || "—"}</span>
              <span class="pill ${rarityClass}">${s?.rarity ?? "—"}</span>
            </div>
            <h3 style="margin:8px 0 6px 0;">${s?.name ?? "—"}</h3>
            <p class="muted" style="margin:0;">Brawler : <strong>${s?.brawler ?? "—"}</strong></p>
          </div>

          <label style="display:flex; gap:8px; align-items:center; user-select:none; opacity:${canEdit ? "1" : "0.65"};">
            <input type="checkbox" ${checked ? "checked" : ""} ${canEdit ? "" : "disabled"} />
            <span>Je l’ai</span>
          </label>
        </div>
      `;

      const cb = el.querySelector("input[type='checkbox']");
      cb.addEventListener("change", async (e) => {
        await toggleOwned(s.id, e.target.checked);
      });

      cards.appendChild(el);
    });
  }

  modeBrawlerBtn.addEventListener("click", () => setMode("brawler"));
  modeThemeBtn.addEventListener("click", () => setMode("theme"));
  select.addEventListener("change", render);
  rarity.addEventListener("change", render);
  search.addEventListener("input", render);

  buildRarities();
  buildOptions();

  const themeParam = getQueryParam("theme") || getQueryParam("category");
  if (themeParam) {
    setMode("theme");
    select.value = themeParam;
  } else {
    render();
  }

  (async () => {
    const { data } = await supa.auth.getSession();
    currentUser = data.session?.user ?? null;

    if (accountLine) {
      accountLine.textContent = currentUser
        ? `Connecté : ${currentUser.email ?? currentUser.id} (tu peux cocher tes skins)`
        : "Non connecté : affichage en lecture seule. Va sur MyBrawl pour te connecter.";
    }

    if (currentUser) await loadOwned();
    render();

    supa.auth.onAuthStateChange(async (_event, session) => {
      currentUser = session?.user ?? null;

      if (accountLine) {
        accountLine.textContent = currentUser
          ? `Connecté : ${currentUser.email ?? currentUser.id} (tu peux cocher tes skins)`
          : "Non connecté : affichage en lecture seule. Va sur MyBrawl pour te connecter.";
      }

      if (currentUser) await loadOwned();
      else ownedSet = new Set();

      render();
    });
  })();
})();

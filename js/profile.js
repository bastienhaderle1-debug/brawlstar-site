// js/profile.js
(function () {
  // --- Elements (search) ---
  const searchName = document.getElementById("searchName");
  const btnSearch = document.getElementById("btnSearch");
  const btnClear = document.getElementById("btnClear");
  const searchMsg = document.getElementById("searchMsg");
  const searchResults = document.getElementById("searchResults");

  // --- Elements (profile) ---
  const errorCard = document.getElementById("errorCard");
  const errorMsg = document.getElementById("errorMsg");

  const profileCard = document.getElementById("profileCard");
  const displayNameEl = document.getElementById("displayName");
  const bioEl = document.getElementById("bio");
  const updatedLine = document.getElementById("updatedLine");
  const shareLine = document.getElementById("shareLine");
  const publicModeLine = document.getElementById("publicModeLine");

  const statOwned = document.getElementById("statOwned");
  const statTotal = document.getElementById("statTotal");
  const statPct = document.getElementById("statPct");
  const progressBar = document.getElementById("progressBar");

  const btnCopyLink = document.getElementById("btnCopyLink");
  const toolbar = document.getElementById("toolbar");
  const skinsSection = document.getElementById("skinsSection");
  const cards = document.getElementById("cards");
  const resultCount = document.getElementById("resultCount");

  const searchSkins = document.getElementById("searchSkins");
  const filterRarity = document.getElementById("filterRarity");

  function toast(type, title, message) {
    if (window.showToast) window.showToast(message, type, title, 3200);
  }

  function fail(msg) {
    errorCard.style.display = "block";
    errorMsg.textContent = msg;

    profileCard.style.display = "none";
    toolbar.style.display = "none";
    skinsSection.style.display = "none";
  }

  function clearError() {
    errorCard.style.display = "none";
    errorMsg.textContent = "";
  }

  if (!window.supabaseClient) {
    fail("supabaseClient introuvable. Vérifie data/supabase-client.js et l’ordre des scripts.");
    return;
  }
  if (!window.OwnedService) {
    fail("OwnedService introuvable. Vérifie js/owned-service.js et l’ordre des scripts.");
    return;
  }

  const supa = window.supabaseClient;
  const Svc = window.OwnedService;

  const allSkins = Svc.getSkins();
  const RARITY_ORDER = window.RARITY_ORDER ?? ["Rare","Super Rare","Epic","Mythique","Légendaire","Hypercharge"];
  const RARITY_CLASS = {
    "Rare": "rarity-rare",
    "Super Rare": "rarity-super-rare",
    "Epic": "rarity-epic",
    "Mythique": "rarity-mythic",
    "Légendaire": "rarity-legendary",
    "Hypercharge": "rarity-hypercharge",
  };

  function fmtDate(iso) {
    if (!iso) return "";
    try { return new Date(iso).toLocaleString("fr-FR"); } catch { return ""; }
  }

  function parseUserIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get("u");
  }

  function setUserIdInUrl(userId) {
    const url = new URL(window.location.href);
    url.searchParams.set("u", userId);
    window.history.pushState({}, "", url.toString());
  }

  function shareUrlFor(userId) {
    const url = new URL(window.location.href);
    url.searchParams.set("u", userId);
    return url.toString();
  }

  function buildRarityFilter() {
    filterRarity.innerHTML = "";
    const optAll = document.createElement("option");
    optAll.value = "all";
    optAll.textContent = "Toutes";
    filterRarity.appendChild(optAll);

    const existing = new Set(allSkins.map(s => s?.rarity).filter(Boolean));
    RARITY_ORDER.forEach(r => {
      if (!existing.has(r)) return;
      const opt = document.createElement("option");
      opt.value = r;
      opt.textContent = r;
      filterRarity.appendChild(opt);
    });
  }

  function getSkinById(id) {
    return allSkins.find(s => s && s.id === id) || { id, name: id, brawler: "—", category: "—", rarity: "—" };
  }

  async function loadProfile(userId) {
    const { data, error } = await supa
      .from("public_profiles")
      .select("user_id, display_name, bio, is_public, show_owned, updated_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async function loadPublicOwned(userId) {
    const { data, error } = await supa
      .from("public_user_skins")
      .select("skin_id")
      .eq("user_id", userId);

    if (error) throw error;
    return (data || []).map(r => r.skin_id).filter(Boolean);
  }

  // --- NEW: search by pseudo ---
  async function searchProfilesByName(query) {
    // recherche "contains" insensible à la casse
    const q = (query || "").trim();
    if (!q) return [];

    const { data, error } = await supa
      .from("public_profiles")
      .select("user_id, display_name, bio, updated_at")
      .eq("is_public", true)
      .ilike("display_name", `%${q}%`)
      .order("updated_at", { ascending: false })
      .limit(20);

    if (error) throw error;
    return data || [];
  }

  // --- UI render search results ---
  function renderSearchResults(list) {
    searchResults.innerHTML = "";

    if (!list.length) {
      searchMsg.textContent = "Aucun profil public trouvé.";
      return;
    }

    searchMsg.textContent = `${list.length} profil(s) trouvé(s). Clique pour ouvrir.`;

    list.forEach(p => {
      const el = document.createElement("article");
      el.className = "card clickable";
      el.innerHTML = `
        <div class="row">
          <span class="pill">Profil public</span>
          <span class="pill">🕒 ${p.updated_at ? fmtDate(p.updated_at) : "—"}</span>
        </div>
        <h3 style="margin:8px 0 6px 0;">${p.display_name || "Profil"}</h3>
        <p class="muted" style="margin:0;">${p.bio ? p.bio : "—"}</p>
      `;

      el.addEventListener("click", async () => {
        await openProfile(p.user_id);
        window.scrollTo({ top: profileCard.offsetTop - 12, behavior: "smooth" });
      });

      searchResults.appendChild(el);
    });
  }

  // --- Profile rendering ---
  let currentProfile = null;
  let publicOwnedIds = [];

  function updateProfileUI(userId, profile, ownedIds) {
    clearError();

    profileCard.style.display = "block";

    displayNameEl.textContent = profile.display_name || "Profil";
    bioEl.textContent = profile.bio || "—";
    updatedLine.textContent = profile.updated_at ? ("Dernière mise à jour : " + fmtDate(profile.updated_at)) : "";
    shareLine.textContent = "Lien : " + shareUrlFor(userId);

    statTotal.textContent = String(allSkins.length);

    const ownedCount = ownedIds.length;
    statOwned.textContent = String(ownedCount);

    const pct = allSkins.length > 0 ? Math.round((ownedCount / allSkins.length) * 100) : 0;
    statPct.textContent = pct + "%";
    progressBar.style.width = pct + "%";

    if (!profile.is_public) {
      publicModeLine.textContent = "⚠️ Profil non-public.";
    } else if (!profile.show_owned) {
      publicModeLine.textContent = "ℹ️ Profil public, mais liste des skins masquée.";
    } else {
      publicModeLine.textContent = "✅ Profil public + liste des skins visible.";
    }

    if (profile.show_owned) {
      toolbar.style.display = "flex";
      skinsSection.style.display = "block";
      renderSkins();
    } else {
      toolbar.style.display = "none";
      skinsSection.style.display = "none";
    }
  }

  function renderSkins() {
    if (!currentProfile?.show_owned) return;

    const q = (searchSkins.value || "").toLowerCase().trim();
    const r = filterRarity.value || "all";

    const list = publicOwnedIds
      .map(getSkinById)
      .filter(s => {
        if (r !== "all" && s.rarity !== r) return false;
        if (!q) return true;
        return String(s.name).toLowerCase().includes(q)
          || String(s.brawler).toLowerCase().includes(q)
          || String(s.category).toLowerCase().includes(q)
          || String(s.rarity).toLowerCase().includes(q);
      })
      .sort((a, b) => {
        const ra = RARITY_ORDER.indexOf(a.rarity);
        const rb = RARITY_ORDER.indexOf(b.rarity);
        if (ra !== rb) return (ra === -1 ? 999 : ra) - (rb === -1 ? 999 : rb);
        return String(a.name).localeCompare(String(b.name), "fr");
      });

    resultCount.textContent = `${list.length} skin(s) affiché(s)`;
    cards.innerHTML = "";

    list.forEach(s => {
      const el = document.createElement("article");
      el.className = "card";
      el.innerHTML = `
        <div class="row">
          <span class="pill">${s.category ?? "—"}</span>
          <span class="pill ${RARITY_CLASS[s.rarity] ?? ""}">${s.rarity ?? "—"}</span>
        </div>
        <h3>${s.name}</h3>
        <p class="muted">Brawler : <strong>${s.brawler ?? "—"}</strong></p>
      `;
      cards.appendChild(el);
    });
  }

  async function openProfile(userId) {
    if (!userId) return;

    try {
      setUserIdInUrl(userId);

      const profile = await loadProfile(userId);
      if (!profile) return fail("Profil introuvable.");

      // profil doit être public pour être consulté (ici page publique)
      if (!profile.is_public) return fail("Ce profil n’est pas public.");

      const ownedIds = profile.show_owned ? await loadPublicOwned(userId) : [];

      currentProfile = profile;
      publicOwnedIds = ownedIds;

      updateProfileUI(userId, profile, ownedIds);
      toast("success", "Profil", "Profil chargé.");
    } catch (e) {
      console.error(e);
      fail("Erreur Supabase : " + (e.message || String(e)));
    }
  }

  // Copy link
  btnCopyLink.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      btnCopyLink.textContent = "✅ Lien copié";
      setTimeout(() => btnCopyLink.textContent = "🔗 Copier le lien", 1200);
    } catch {
      alert("Copie impossible. Copie manuellement l’URL dans la barre d’adresse.");
    }
  });

  // Search events
  async function doSearch() {
    const q = (searchName.value || "").trim();
    if (!q) {
      searchMsg.textContent = "Tape un pseudo.";
      searchResults.innerHTML = "";
      return;
    }

    searchMsg.textContent = "Recherche...";
    searchResults.innerHTML = "";

    try {
      const res = await searchProfilesByName(q);
      renderSearchResults(res);
    } catch (e) {
      console.error(e);
      searchMsg.textContent = "❌ Erreur recherche : " + (e.message || String(e));
    }
  }

  btnSearch.addEventListener("click", doSearch);
  searchName.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSearch();
  });

  btnClear.addEventListener("click", () => {
    searchName.value = "";
    searchMsg.textContent = "";
    searchResults.innerHTML = "";
  });

  // Filters skins
  searchSkins.addEventListener("input", renderSkins);
  filterRarity.addEventListener("change", renderSkins);

  // Init
  (async () => {
    buildRarityFilter();

    // Si on arrive avec ?u=UUID : ouvrir direct
    const userId = parseUserIdFromUrl();
    if (userId) {
      await openProfile(userId);
    } else {
      // Par défaut: juste recherche
      profileCard.style.display = "none";
      toolbar.style.display = "none";
      skinsSection.style.display = "none";
      searchMsg.textContent = "Tu peux rechercher un joueur par pseudo (profil public uniquement).";
    }
  })();
})();

(function () {
  const FAVORITES_KEY = "brawldex_public_favorites";
  const COMPARE_KEY = "brawldex_compare_base";
  const supa = window.supabaseClient;

  if (!supa || !window.OwnedService) {
    console.error("Supabase ou OwnedService introuvable.");
    return;
  }

  const $ = (id) => document.getElementById(id);
  const myProfileCard = $("myProfileCard");
  const needAuthCard = $("needAuthCard");
  const meLine = $("meLine");
  const btnMeReload = $("btnMeReload");
  const btnMeLogout = $("btnMeLogout");
  const meDisplayName = $("meDisplayName");
  const meBio = $("meBio");
  const meIsPublic = $("meIsPublic");
  const meShowOwned = $("meShowOwned");
  const btnMeSave = $("btnMeSave");
  const btnMePublish = $("btnMePublish");
  const btnMeOpen = $("btnMeOpen");
  const btnMeCopy = $("btnMeCopy");
  const meMsg = $("meMsg");

  const searchName = $("searchName");
  const sortProfiles = $("sortProfiles");
  const favoritesOnly = $("favoritesOnly");
  const btnSearch = $("btnSearch");
  const btnClear = $("btnClear");
  const btnRefreshDirectory = $("btnRefreshDirectory");
  const searchMsg = $("searchMsg");
  const searchResults = $("searchResults");

  const errorCard = $("errorCard");
  const errorMsg = $("errorMsg");
  const profileCard = $("profileCard");
  const displayNameEl = $("displayName");
  const bioEl = $("bio");
  const updatedLine = $("updatedLine");
  const shareLine = $("shareLine");
  const publicModeLine = $("publicModeLine");
  const statOwned = $("statOwned");
  const statTotal = $("statTotal");
  const statPct = $("statPct");
  const progressBar = $("progressBar");
  const btnSetCompareBase = $("btnSetCompareBase");
  const btnFavoriteProfile = $("btnFavoriteProfile");
  const btnCopyLink = $("btnCopyLink");

  const compareCard = $("compareCard");
  const compareSummary = $("compareSummary");
  const compareOverlap = $("compareOverlap");
  const compareLeftOnly = $("compareLeftOnly");
  const compareRightOnly = $("compareRightOnly");
  const compareLeft = $("compareLeft");
  const compareRight = $("compareRight");
  const compareInsights = $("compareInsights");
  const btnClearCompare = $("btnClearCompare");

  const toolbar = $("toolbar");
  const skinsSection = $("skinsSection");
  const cards = $("cards");
  const resultCount = $("resultCount");
  const searchSkins = $("searchSkins");
  const filterRarity = $("filterRarity");

  let allSkins = [];
  let me = null;
  let viewedProfileUserId = "";
  let currentDirectory = [];
  let currentProfile = null;
  let publicOwnedIds = [];
  let compareBase = null;

  function toast(type, title, message) {
    if (window.showToast) window.showToast(message, type, title, 3000);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function readFavorites() {
    try {
      const raw = localStorage.getItem(FAVORITES_KEY);
      return new Set(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set();
    }
  }

  function writeFavorites(set) {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify([...set]));
    } catch {}
  }

  function isFavorite(userId) {
    return readFavorites().has(userId);
  }

  function toggleFavorite(userId) {
    const favorites = readFavorites();
    if (favorites.has(userId)) favorites.delete(userId);
    else favorites.add(userId);
    writeFavorites(favorites);
    return favorites.has(userId);
  }

  function readCompareBaseId() {
    try {
      return (localStorage.getItem(COMPARE_KEY) || "").trim();
    } catch {
      return "";
    }
  }

  function writeCompareBaseId(userId) {
    try {
      if (userId) localStorage.setItem(COMPARE_KEY, userId);
      else localStorage.removeItem(COMPARE_KEY);
    } catch {}
  }

  function clearError() {
    errorCard.style.display = "none";
    errorMsg.textContent = "";
  }

  function fail(message) {
    errorCard.style.display = "block";
    errorMsg.textContent = message;
    profileCard.style.display = "none";
    toolbar.style.display = "none";
    skinsSection.style.display = "none";
  }

  function fmtDate(iso) {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleString("fr-FR");
    } catch {
      return "";
    }
  }

  function parseUserIdFromUrl() {
    return new URLSearchParams(window.location.search).get("u");
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

    const all = document.createElement("option");
    all.value = "all";
    all.textContent = "Toutes";
    filterRarity.appendChild(all);

    const rarities = [...new Set(allSkins.map((skin) => skin?.rarity).filter(Boolean))];
    rarities.forEach((rarity) => {
      const option = document.createElement("option");
      option.value = rarity;
      option.textContent = rarity;
      filterRarity.appendChild(option);
    });
  }

  function getSkinById(id) {
    return allSkins.find((skin) => skin.id === id) || {
      id,
      name: id,
      brawler: "-",
      category: "-",
      rarity: "-"
    };
  }

  function countSkinsByBrawler(ids) {
    const counts = {};
    ids.forEach((id) => {
      const skin = getSkinById(id);
      const brawler = (skin?.brawler || "-").trim();
      counts[brawler] = (counts[brawler] || 0) + 1;
    });
    return counts;
  }

  function topBrawlerLabel(ids) {
    const entries = Object.entries(countSkinsByBrawler(ids)).filter(([name]) => name && name !== "-");
    if (!entries.length) return "Aucun";
    entries.sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0], "fr");
    });
    return `${entries[0][0]} (${entries[0][1]})`;
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
    const { data, error } = await supa.from("public_user_skins").select("skin_id").eq("user_id", userId);
    if (error) throw error;
    return (data || []).map((row) => row.skin_id).filter(Boolean);
  }

  async function loadComparableProfile(userId) {
    const profile = await loadProfile(userId);
    if (!profile) return null;
    if (!profile.is_public || !profile.show_owned) return null;
    const ownedIds = await loadPublicOwned(userId);
    return { userId, profile, ownedIds };
  }

  async function searchProfilesByName(query) {
    const q = (query || "").trim();
    if (!q) return [];

    const { data, error } = await supa
      .from("public_profiles")
      .select("user_id, display_name, bio, updated_at")
      .eq("is_public", true)
      .ilike("display_name", `%${q}%`)
      .order("updated_at", { ascending: false })
      .limit(24);

    if (error) throw error;
    return data || [];
  }

  async function loadLatestPublicProfiles() {
    const { data, error } = await supa
      .from("public_profiles")
      .select("user_id, display_name, bio, updated_at")
      .eq("is_public", true)
      .order("updated_at", { ascending: false })
      .limit(24);

    if (error) throw error;
    return data || [];
  }

  async function enrichProfiles(list) {
    const ids = list.map((profile) => profile.user_id).filter(Boolean);
    if (!ids.length) return [];

    const { data, error } = await supa.from("public_user_skins").select("user_id, skin_id").in("user_id", ids);
    if (error) throw error;

    const counts = {};
    (data || []).forEach((row) => {
      counts[row.user_id] = (counts[row.user_id] || 0) + 1;
    });

    return list.map((profile) => ({
      ...profile,
      ownedCount: counts[profile.user_id] || 0,
      pct: allSkins.length > 0 ? Math.round(((counts[profile.user_id] || 0) / allSkins.length) * 100) : 0,
      favorite: isFavorite(profile.user_id)
    }));
  }

  function sortDirectory(list) {
    const mode = sortProfiles.value || "latest";
    const favoritesMode = !!favoritesOnly.checked;
    const next = list.filter((profile) => (favoritesMode ? profile.favorite : true));

    next.sort((a, b) => {
      if (mode === "skins" && b.ownedCount !== a.ownedCount) return b.ownedCount - a.ownedCount;
      if (mode === "name") return (a.display_name || "").localeCompare(b.display_name || "", "fr");
      return new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime();
    });

    return next;
  }

  function buildDirectoryCard(profile, mode) {
    const card = document.createElement("article");
    card.className = "card clickable";
    card.innerHTML = `
      <div class="list-head">
        <div>
          <div class="row">
            <span class="pill">Profil public</span>
            <span class="pill">${profile.ownedCount} skins</span>
            <span class="pill">${profile.pct}%</span>
          </div>
          <h3>${escapeHtml(profile.display_name || "Profil")}</h3>
          <p class="muted">${escapeHtml(profile.bio || "-")}</p>
        </div>
      </div>
      <div class="section-actions">
        <button class="choice-btn ${profile.favorite ? "is-selected" : ""}" type="button" data-favorite-btn>
          ${profile.favorite ? "Favori" : "Ajouter"}
        </button>
        <button class="choice-btn" type="button" data-compare-btn>Comparer</button>
      </div>
      <p class="small">Mis a jour: ${profile.updated_at ? fmtDate(profile.updated_at) : "-"}</p>
    `;

    card.addEventListener("click", async (event) => {
      if (event.target.closest("[data-favorite-btn]") || event.target.closest("[data-compare-btn]")) return;
      await openProfile(profile.user_id);
      window.scrollTo({ top: profileCard.offsetTop - 12, behavior: "smooth" });
    });

    card.querySelector("[data-favorite-btn]").addEventListener("click", (event) => {
      event.stopPropagation();
      profile.favorite = toggleFavorite(profile.user_id);
      renderDirectory(currentDirectory, mode);
    });

    card.querySelector("[data-compare-btn]").addEventListener("click", async (event) => {
      event.stopPropagation();
      await setCompareBase(profile.user_id);
    });

    return card;
  }

  function renderDirectory(list, mode = "latest") {
    currentDirectory = list;
    const sorted = sortDirectory(list);
    searchResults.innerHTML = "";

    if (!sorted.length) {
      searchMsg.textContent = "Aucun profil public a afficher.";
      return;
    }

    searchMsg.textContent =
      mode === "search"
        ? `${sorted.length} profil(s) trouves. Clique pour ouvrir ou comparer.`
        : `${sorted.length} profil(s) publics recents. Clique pour ouvrir ou comparer.`;

    sorted.forEach((profile) => {
      searchResults.appendChild(buildDirectoryCard(profile, mode));
    });
  }

  function renderViewedSkins() {
    if (!currentProfile?.show_owned) return;

    const q = (searchSkins.value || "").toLowerCase().trim();
    const rarity = filterRarity.value || "all";

    const list = publicOwnedIds
      .map(getSkinById)
      .filter((skin) => {
        if (rarity !== "all" && skin.rarity !== rarity) return false;
        if (!q) return true;
        return [skin.name, skin.brawler, skin.category, skin.rarity].join("|").toLowerCase().includes(q);
      });

    resultCount.textContent = `${list.length} skin(s) affiches`;
    cards.innerHTML = "";

    list.forEach((skin) => {
      const card = document.createElement("article");
      card.className = "card";
      card.innerHTML = `
        <div class="row">
          <span class="pill">${escapeHtml(skin.category ?? "-")}</span>
          <span class="pill">${escapeHtml(skin.rarity ?? "-")}</span>
        </div>
        <h3>${escapeHtml(skin.name)}</h3>
        <p class="muted">Brawler : <strong>${escapeHtml(skin.brawler ?? "-")}</strong></p>
      `;
      cards.appendChild(card);
    });
  }

  function renderComparePanel(target, title, payload, isCurrent) {
    if (!payload) {
      target.innerHTML = `
        <h3>${title}</h3>
        <p class="muted">Choisis un profil public avec skins visibles.</p>
      `;
      return;
    }

    const profile = payload.profile;
    const ownedIds = payload.ownedIds || [];
    const pct = allSkins.length ? Math.round((ownedIds.length / allSkins.length) * 100) : 0;
    const skinsVisible = profile.show_owned !== false;
    const detailLine = skinsVisible ? `Top brawler skins: ${topBrawlerLabel(ownedIds)}` : "Liste des skins masquee pour ce profil.";

    target.innerHTML = `
      <div class="row">
        <span class="pill">${isCurrent ? "Profil ouvert" : "Base"}</span>
        <span class="pill">${skinsVisible ? "Skins visibles" : "Skins masques"}</span>
        <span class="pill">${ownedIds.length} skins</span>
        <span class="pill">${pct}%</span>
      </div>
      <h3>${escapeHtml(profile.display_name || "Profil")}</h3>
      <p class="muted">${escapeHtml(profile.bio || "-")}</p>
      <p class="small">${escapeHtml(detailLine)}</p>
    `;
  }

  function renderCompareInsights(lines) {
    compareInsights.innerHTML = "";
    lines.forEach((line) => {
      const p = document.createElement("p");
      p.className = "muted";
      p.textContent = line;
      compareInsights.appendChild(p);
    });
  }

  function renderCompareSection() {
    const currentPayload =
      currentProfile && viewedProfileUserId
        ? {
            userId: viewedProfileUserId,
            profile: currentProfile,
            ownedIds: publicOwnedIds
          }
        : null;

    if (!compareBase) {
      compareCard.style.display = "none";
      return;
    }

    compareCard.style.display = "block";
    renderComparePanel(compareLeft, "Base de comparaison", compareBase, false);
    renderComparePanel(compareRight, "Profil ouvert", currentPayload, true);

    if (!currentPayload || compareBase.userId === currentPayload.userId) {
      compareSummary.textContent = `Base active: ${compareBase.profile.display_name || "Profil"}. Ouvre un autre profil pour lancer la comparaison.`;
      compareOverlap.textContent = "0";
      compareLeftOnly.textContent = String(compareBase.ownedIds.length);
      compareRightOnly.textContent = "0";
      renderCompareInsights([
        "La base de comparaison est prete.",
        "Ouvre maintenant un autre profil public pour voir les skins en commun et les ecarts."
      ]);
      return;
    }

    if (!currentPayload.profile.show_owned) {
      compareSummary.textContent = "Impossible de comparer: le profil ouvert masque sa liste de skins.";
      compareOverlap.textContent = "0";
      compareLeftOnly.textContent = String(compareBase.ownedIds.length);
      compareRightOnly.textContent = "0";
      renderCompareInsights([
        "Le profil ouvert est public, mais sa collection de skins est masquee.",
        "Choisis un autre profil avec skins visibles pour activer la comparaison."
      ]);
      return;
    }

    const leftSet = new Set(compareBase.ownedIds);
    const rightSet = new Set(currentPayload.ownedIds);
    const overlap = compareBase.ownedIds.filter((id) => rightSet.has(id));
    const leftOnly = compareBase.ownedIds.filter((id) => !rightSet.has(id));
    const rightOnly = currentPayload.ownedIds.filter((id) => !leftSet.has(id));
    const coverage = Math.round((overlap.length / Math.max(1, Math.min(compareBase.ownedIds.length, currentPayload.ownedIds.length))) * 100);

    compareOverlap.textContent = String(overlap.length);
    compareLeftOnly.textContent = String(leftOnly.length);
    compareRightOnly.textContent = String(rightOnly.length);

    const leftName = compareBase.profile.display_name || "Base";
    const rightName = currentPayload.profile.display_name || "Profil";
    const lines = [];

    if (compareBase.ownedIds.length === currentPayload.ownedIds.length) {
      lines.push(`${leftName} et ${rightName} ont le meme nombre de skins publics.`);
    } else if (compareBase.ownedIds.length > currentPayload.ownedIds.length) {
      lines.push(`${leftName} a ${compareBase.ownedIds.length - currentPayload.ownedIds.length} skin(s) publics de plus.`);
    } else {
      lines.push(`${rightName} a ${currentPayload.ownedIds.length - compareBase.ownedIds.length} skin(s) publics de plus.`);
    }

    lines.push(`${overlap.length} skin(s) en commun, soit ${coverage}% de recouvrement sur la plus petite collection.`);

    if (leftOnly.length || rightOnly.length) {
      lines.push(`${leftOnly.length} skin(s) exclusifs a la base contre ${rightOnly.length} exclusifs au profil ouvert.`);
    }

    compareSummary.textContent = `${leftName} vs ${rightName}`;
    renderCompareInsights(lines);
  }

  async function setCompareBase(userId, silent) {
    try {
      const payload =
        userId === viewedProfileUserId && currentProfile?.show_owned
          ? { userId, profile: currentProfile, ownedIds: [...publicOwnedIds] }
          : await loadComparableProfile(userId);

      if (!payload) {
        toast("error", "Comparaison", "Ce profil doit etre public avec skins visibles.");
        return;
      }

      compareBase = payload;
      writeCompareBaseId(userId);
      renderCompareSection();

      if (!silent) {
        toast("success", "Comparaison", `Base definie: ${payload.profile.display_name || "Profil"}.`);
      }
    } catch (error) {
      console.error(error);
      toast("error", "Comparaison", error.message || String(error));
    }
  }

  function clearCompareBase() {
    compareBase = null;
    writeCompareBaseId("");
    renderCompareSection();
    toast("info", "Comparaison", "Base de comparaison effacee.");
  }

  async function restoreCompareBase() {
    const savedId = readCompareBaseId();
    if (!savedId) return;
    await setCompareBase(savedId, true);
  }

  function updateProfileUI(userId, profile, ownedIds) {
    clearError();
    viewedProfileUserId = userId;
    currentProfile = profile;
    publicOwnedIds = ownedIds;
    const canCompare = !!profile.show_owned;

    profileCard.style.display = "block";
    displayNameEl.textContent = profile.display_name || "Profil";
    bioEl.textContent = profile.bio || "-";
    updatedLine.textContent = profile.updated_at ? `Derniere mise a jour : ${fmtDate(profile.updated_at)}` : "";
    shareLine.textContent = `Lien : ${shareUrlFor(userId)}`;
    statOwned.textContent = String(ownedIds.length);
    statTotal.textContent = String(allSkins.length);

    const pct = allSkins.length > 0 ? Math.round((ownedIds.length / allSkins.length) * 100) : 0;
    statPct.textContent = `${pct}%`;
    progressBar.style.width = `${pct}%`;
    btnFavoriteProfile.textContent = isFavorite(userId) ? "Retirer des favoris" : "Ajouter aux favoris";
    btnSetCompareBase.disabled = !canCompare;
    btnSetCompareBase.textContent = canCompare ? "Definir comme base" : "Base indisponible";
    btnSetCompareBase.title = canCompare
      ? "Utiliser ce profil comme base de comparaison."
      : "Impossible de comparer un profil qui masque sa liste de skins.";

    if (!profile.is_public) publicModeLine.textContent = "Profil non public.";
    else if (!profile.show_owned) publicModeLine.textContent = "Profil public, mais liste des skins masquee.";
    else publicModeLine.textContent = "Profil public avec liste de skins visible.";

    if (profile.show_owned) {
      toolbar.style.display = "flex";
      skinsSection.style.display = "block";
      renderViewedSkins();
    } else {
      toolbar.style.display = "none";
      skinsSection.style.display = "none";
    }

    renderCompareSection();
  }

  async function openProfile(userId) {
    try {
      setUserIdInUrl(userId);
      const profile = await loadProfile(userId);
      if (!profile) return fail("Profil introuvable.");
      if (!profile.is_public) return fail("Ce profil n'est pas public.");

      const ownedIds = profile.show_owned ? await loadPublicOwned(userId) : [];
      updateProfileUI(userId, profile, ownedIds);
      toast("success", "Profil", "Profil charge.");
    } catch (error) {
      console.error(error);
      fail(error.message || String(error));
    }
  }

  async function doSearch() {
    const q = (searchName.value || "").trim();
    searchMsg.textContent = "Recherche...";
    try {
      const result = q ? await searchProfilesByName(q) : await loadLatestPublicProfiles();
      const enriched = await enrichProfiles(result);
      renderDirectory(enriched, q ? "search" : "latest");
    } catch (error) {
      console.error(error);
      searchMsg.textContent = error.message || String(error);
    }
  }

  btnSearch.addEventListener("click", doSearch);
  btnClear.addEventListener("click", async () => {
    searchName.value = "";
    favoritesOnly.checked = false;
    sortProfiles.value = "latest";
    await doSearch();
  });
  btnRefreshDirectory.addEventListener("click", doSearch);
  searchName.addEventListener("keydown", (event) => {
    if (event.key === "Enter") doSearch();
  });
  sortProfiles.addEventListener("change", () => renderDirectory(currentDirectory, searchName.value.trim() ? "search" : "latest"));
  favoritesOnly.addEventListener("change", () => renderDirectory(currentDirectory, searchName.value.trim() ? "search" : "latest"));
  searchSkins.addEventListener("input", renderViewedSkins);
  filterRarity.addEventListener("change", renderViewedSkins);

  btnCopyLink.addEventListener("click", async () => {
    if (!viewedProfileUserId) return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast("success", "Lien", "Lien copie.");
    } catch {
      toast("error", "Lien", "Copie impossible.");
    }
  });

  btnSetCompareBase.addEventListener("click", async () => {
    if (!viewedProfileUserId) return;
    await setCompareBase(viewedProfileUserId);
  });

  btnFavoriteProfile.addEventListener("click", () => {
    if (!viewedProfileUserId) return;
    const favorite = toggleFavorite(viewedProfileUserId);
    btnFavoriteProfile.textContent = favorite ? "Retirer des favoris" : "Ajouter aux favoris";
    renderDirectory(currentDirectory, searchName.value.trim() ? "search" : "latest");
  });

  btnClearCompare.addEventListener("click", clearCompareBase);

  function setMeMsg(message) {
    meMsg.textContent = message || "";
  }

  async function loadOwnedMe() {
    if (!me) return new Set();
    try {
      return await window.OwnedService.loadOwnedSet(me.id);
    } catch {
      return new Set();
    }
  }

  async function loadMyProfile() {
    if (!me) return;
    setMeMsg("Chargement de ton profil...");

    try {
      const { data, error } = await supa
        .from("public_profiles")
        .select("display_name, bio, is_public, show_owned")
        .eq("user_id", me.id)
        .maybeSingle();

      if (error) throw error;

      meDisplayName.value = data?.display_name ?? ((me.email || "").split("@")[0] || "");
      meBio.value = data?.bio ?? "";
      meIsPublic.checked = data?.is_public ?? true;
      meShowOwned.checked = data?.show_owned ?? true;
      setMeMsg("Profil charge.");
    } catch (error) {
      setMeMsg(error.message || String(error));
    }
  }

  async function saveMyProfile() {
    if (!me) return false;
    setMeMsg("Enregistrement...");

    try {
      const payload = {
        user_id: me.id,
        display_name: (meDisplayName.value || "Profil").trim(),
        bio: (meBio.value || "").trim(),
        is_public: !!meIsPublic.checked,
        show_owned: !!meShowOwned.checked,
        updated_at: new Date().toISOString()
      };

      const { error } = await supa.from("public_profiles").upsert(payload, { onConflict: "user_id" });
      if (error) throw error;

      setMeMsg("Profil enregistre.");
      toast("success", "Profil", "Profil enregistre.");
      return true;
    } catch (error) {
      setMeMsg(error.message || String(error));
      toast("error", "Profil", error.message || String(error));
      return false;
    }
  }

  async function publishMyOwned() {
    if (!me) return;
    setMeMsg("Publication des skins...");

    try {
      const saved = await saveMyProfile();
      if (!saved) return;
      setMeMsg("Publication des skins...");
      const ownedSet = await loadOwnedMe();
      const { error: delErr } = await supa.from("public_user_skins").delete().eq("user_id", me.id);
      if (delErr) throw delErr;

      if (!ownedSet.size) {
        setMeMsg("Liste publique videe.");
        toast("success", "Publication", "Liste publique videe.");
        return;
      }

      const rows = [...ownedSet].map((skin_id) => ({ user_id: me.id, skin_id }));
      const { error: insErr } = await supa.from("public_user_skins").upsert(rows, { onConflict: "user_id,skin_id" });
      if (insErr) throw insErr;

      setMeMsg(`${ownedSet.size} skin(s) publies.`);
      toast("success", "Publication", `${ownedSet.size} skin(s) publies.`);
    } catch (error) {
      setMeMsg(error.message || String(error));
      toast("error", "Publication", error.message || String(error));
    }
  }

  function myUrl() {
    return me ? shareUrlFor(me.id) : "";
  }

  async function copyMyLink() {
    if (!me) return;
    try {
      await navigator.clipboard.writeText(myUrl());
      setMeMsg("Lien copie.");
      toast("success", "Lien", "Lien copie.");
    } catch {
      setMeMsg("Copie impossible.");
    }
  }

  function openMyProfile() {
    if (!me) return;
    window.open(myUrl(), "_blank");
  }

  async function refreshMe() {
    if (!me) return;
    await loadMyProfile();
  }

  btnMeSave.addEventListener("click", saveMyProfile);
  btnMePublish.addEventListener("click", publishMyOwned);
  btnMeCopy.addEventListener("click", copyMyLink);
  btnMeOpen.addEventListener("click", openMyProfile);
  btnMeReload.addEventListener("click", refreshMe);
  btnMeLogout.addEventListener("click", async () => {
    await supa.auth.signOut();
  });

  (async () => {
    try {
      if (window.SKINS_READY && typeof window.SKINS_READY.then === "function") {
        await window.SKINS_READY;
      }
    } catch {}

    allSkins = Array.isArray(window.SKINS) ? window.SKINS : [];
    buildRarityFilter();

    try {
      const { data } = await supa.auth.getSession();
      me = data.session?.user ?? null;

      if (me) {
        myProfileCard.style.display = "block";
        needAuthCard.style.display = "none";
        meLine.textContent = me.email ?? me.id;
        await refreshMe();
      } else {
        myProfileCard.style.display = "none";
        needAuthCard.style.display = "block";
      }

      supa.auth.onAuthStateChange(async (_event, session) => {
        me = session?.user ?? null;
        if (me) {
          myProfileCard.style.display = "block";
          needAuthCard.style.display = "none";
          meLine.textContent = me.email ?? me.id;
          await refreshMe();
        } else {
          myProfileCard.style.display = "none";
          needAuthCard.style.display = "block";
          setMeMsg("");
        }
      });
    } catch {
      myProfileCard.style.display = "none";
      needAuthCard.style.display = "block";
    }

    const userId = parseUserIdFromUrl();
    if (userId) {
      await openProfile(userId);
    } else {
      profileCard.style.display = "none";
      toolbar.style.display = "none";
      skinsSection.style.display = "none";
      await doSearch();
    }

    await restoreCompareBase();
    renderCompareSection();
  })();
})();

(function () {
  const FAVORITES_KEY = "brawldex_public_favorites";
  const COMPARE_KEY = "brawldex_compare_base";
  const supa = window.supabaseClient;
  const PublicProfiles = window.PublicProfileService;
  const Brawldex = window.BrawldexService;

  if (!supa || !window.OwnedService || !PublicProfiles || !Brawldex) {
    console.error("Supabase, OwnedService, BrawldexService ou PublicProfileService introuvable.");
    return;
  }

  const $ = (id) => document.getElementById(id);
  const globalAuthBadge = $("globalAuthBadge");
  const myProfileCard = $("myProfileCard");
  const needAuthCard = $("needAuthCard");
  const meLine = $("meLine");
  const btnMeReload = $("btnMeReload");
  const btnMeLogout = $("btnMeLogout");
  const meDisplayName = $("meDisplayName");
  const meClubName = $("meClubName");
  const meFriendCode = $("meFriendCode");
  const meTrophies = $("meTrophies");
  const meBio = $("meBio");
  const btnMeSave = $("btnMeSave");
  const btnMePublish = $("btnMePublish");
  const btnMeOpen = $("btnMeOpen");
  const btnMeCopy = $("btnMeCopy");
  const meMsg = $("meMsg");
  const meLiveState = $("meLiveState");
  const meDraftState = $("meDraftState");
  const meCollectionState = $("meCollectionState");
  const meCollectionDetail = $("meCollectionDetail");
  const meLinkState = $("meLinkState");
  const meLinkDetail = $("meLinkDetail");

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
  const viewClubName = $("viewClubName");
  const viewFriendCode = $("viewFriendCode");
  const viewTrophies = $("viewTrophies");
  const publicModeLine = $("publicModeLine");
  const profileSummary = $("profileSummary");
  const statGlobalPct = $("statGlobalPct");
  const statBrawlerPct = $("statBrawlerPct");
  const statSkinsPct = $("statSkinsPct");
  const statOwnedBrawlers = $("statOwnedBrawlers");
  const statOwnedSkins = $("statOwnedSkins");
  const statMissingCoins = $("statMissingCoins");
  const statMissingPowerPoints = $("statMissingPowerPoints");
  const statHypercharges = $("statHypercharges");
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
  let myProfileSnapshot = null;
  let myOwnedIds = [];
  let myPublishedIds = [];

  function toast(type, title, message) {
    if (window.showToast) window.showToast(message, type, title, 3000);
  }

  function renderAuthBadge(user) {
    if (!globalAuthBadge) return;
    globalAuthBadge.classList.remove("ok", "ko");
    globalAuthBadge.classList.add(user ? "ok" : "ko");
    const label = globalAuthBadge.querySelector("span:last-child");
    if (label) label.textContent = user ? "Connecte" : "Non connecte";
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

  function safeStr(value) {
    return (value ?? "").toString().trim();
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("fr-FR").format(Number(value) || 0);
  }

  function computeProgressSnapshot(userId, ownedIds) {
    const stats = Brawldex.getStats(userId);
    const skinStats = window.OwnedService.computeOwnedStats(new Set(uniqueIds(ownedIds)));
    const global = Brawldex.getGlobalProgress(userId, skinStats);
    return {
      global_pct: global.globalPct,
      brawler_pct: stats.completionPct,
      skins_pct: skinStats.pct,
      owned_brawlers: stats.owned,
      total_brawlers: stats.total,
      owned_skins: skinStats.owned,
      total_skins: skinStats.total,
      missing_coins: stats.missingCoins,
      missing_power_points: stats.missingPowerPoints,
      hypercharges: stats.hypercharges
    };
  }

  function uniqueIds(list) {
    return [...new Set((Array.isArray(list) ? list : []).map((item) => safeStr(item)).filter(Boolean))];
  }

  function sameIdSet(left, right) {
    const a = uniqueIds(left);
    const b = uniqueIds(right);
    if (a.length !== b.length) return false;
    const lookup = new Set(a);
    return b.every((id) => lookup.has(id));
  }

  function fallbackMeDisplayName() {
    return safeStr((me?.email || "").split("@")[0]) || "Profil";
  }

  function normalizeMeDraft(source) {
    const snapshot = source?.progress_snapshot || computeProgressSnapshot(me?.id || "visitor", myOwnedIds);
    return {
      display_name: safeStr(source?.display_name ?? meDisplayName?.value) || fallbackMeDisplayName(),
      bio: safeStr(source?.bio ?? meBio?.value),
      club_name: safeStr(source?.club_name ?? meClubName?.value),
      friend_code: safeStr(source?.friend_code ?? meFriendCode?.value),
      trophies: Math.max(0, Number(source?.trophies ?? meTrophies?.value) || 0),
      is_public: true,
      show_owned: true,
      progress_snapshot: snapshot
    };
  }

  function sameMeDraft(left, right) {
    return !!left &&
      !!right &&
      safeStr(left.display_name) === safeStr(right.display_name) &&
      safeStr(left.bio) === safeStr(right.bio) &&
      safeStr(left.club_name) === safeStr(right.club_name) &&
      safeStr(left.friend_code) === safeStr(right.friend_code) &&
      Number(left.trophies || 0) === Number(right.trophies || 0) &&
      !!left.is_public === !!right.is_public &&
      !!left.show_owned === !!right.show_owned &&
      JSON.stringify(PublicProfiles.normalizeProgressSnapshot(left.progress_snapshot)) ===
        JSON.stringify(PublicProfiles.normalizeProgressSnapshot(right.progress_snapshot));
  }

  function syncMyProfileSnapshot(profile) {
    myProfileSnapshot = profile ? { ...profile } : null;
  }

  function renderMyProfileState() {
    const draft = normalizeMeDraft();
    const live = myProfileSnapshot ? { ...myProfileSnapshot } : null;
    const localCount = myOwnedIds.length;
    const publishedCount = myPublishedIds.length;
    const hasLiveProfile = !!myProfileSnapshot;
    const liveIsPublic = !!myProfileSnapshot?.is_public;
    const draftDirty = !live || !sameMeDraft(draft, live);
    const needsPublish = !sameIdSet(myOwnedIds, myPublishedIds);
    const canShare = !!me && liveIsPublic;

    if (meLiveState) {
      if (!hasLiveProfile) meLiveState.textContent = "Brouillon";
      else if (liveIsPublic) meLiveState.textContent = "Public";
      else meLiveState.textContent = "Prive";
    }

    if (meDraftState) {
      if (!hasLiveProfile) meDraftState.textContent = "Enregistre une premiere fois pour creer ton profil public.";
      else if (draftDirty) meDraftState.textContent = "Des modifications locales attendent encore un enregistrement.";
      else if (liveIsPublic) meDraftState.textContent = "Ton profil en ligne est aligne avec le formulaire.";
      else meDraftState.textContent = "Reenregistre ton profil pour reappliquer le mode public par defaut.";
    }

    if (meCollectionState) {
      meCollectionState.textContent = `${publishedCount} / ${localCount}`;
    }

    if (meCollectionDetail) {
      if (!localCount && !publishedCount) meCollectionDetail.textContent = "Aucun skin coche pour l'instant.";
      else if (needsPublish && !localCount) meCollectionDetail.textContent = "Ta liste publique n'est pas vide. Republie pour la vider.";
      else if (needsPublish) meCollectionDetail.textContent = `Local: ${localCount} skin(s) coches. Republie pour aligner la version en ligne.`;
      else if (!publishedCount) meCollectionDetail.textContent = "Aucune collection publique pour l'instant.";
      else meCollectionDetail.textContent = `${publishedCount} skins sont visibles et prets pour la comparaison.`;
    }

    if (meLinkState) {
      if (!hasLiveProfile) meLinkState.textContent = "Inactif";
      else if (!liveIsPublic) meLinkState.textContent = "Prive";
      else meLinkState.textContent = "Comparaison OK";
    }

    if (meLinkDetail) {
      if (!hasLiveProfile) meLinkDetail.textContent = "Le lien sera pret apres le premier enregistrement.";
      else if (!liveIsPublic) meLinkDetail.textContent = "Enregistre a nouveau ton profil pour activer le lien public.";
      else if (!publishedCount) meLinkDetail.textContent = "Le profil est public, mais aucune collection n'est encore publiee.";
      else meLinkDetail.textContent = "Lien actif et comparaison disponible depuis cette page.";
    }

    if (btnMeSave) btnMeSave.classList.toggle("is-active", draftDirty);
    if (btnMePublish) {
      btnMePublish.classList.toggle("is-active", needsPublish);
      btnMePublish.title = "Mettre a jour la liste publique de skins.";
    }
    if (btnMeOpen) {
      btnMeOpen.disabled = !canShare;
      btnMeOpen.title = canShare ? "Ouvrir ton profil public." : "Enregistre ton profil pour activer le lien public.";
    }
    if (btnMeCopy) {
      btnMeCopy.disabled = !canShare;
      btnMeCopy.title = canShare ? myUrl() : "Aucun lien public actif pour le moment.";
    }
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
    return PublicProfiles.loadProfile(userId);
  }

  async function loadPublicOwned(userId) {
    return PublicProfiles.loadOwned(userId);
  }

  async function loadComparableProfile(userId) {
    return PublicProfiles.loadComparableProfile(userId);
  }

  async function searchProfilesByName(query) {
    return PublicProfiles.searchProfilesByName(query, 24);
  }

  async function loadLatestPublicProfiles() {
    return PublicProfiles.loadLatestProfiles(24);
  }

  async function enrichProfiles(list) {
    return PublicProfiles.enrichProfiles(list, {
      totalSkins: allSkins.length,
      isFavorite
    });
  }

  function sortDirectory(list) {
    const mode = sortProfiles.value || "latest";
    const favoritesMode = !!favoritesOnly.checked;
    const next = list.filter((profile) => (favoritesMode ? profile.favorite : true));

    next.sort((a, b) => {
      if (mode === "progress" && b.globalPct !== a.globalPct) return b.globalPct - a.globalPct;
      if (mode === "skins" && b.ownedCount !== a.ownedCount) return b.ownedCount - a.ownedCount;
      if (mode === "name") return (a.display_name || "").localeCompare(b.display_name || "", "fr");
      return new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime();
    });

    return next;
  }

  function buildDirectoryCard(profile, mode) {
    const isCompareBase = compareBase?.userId === profile.user_id;
    const compareAvailable = profile.skinsVisible !== false;
    const progressValue = Number.isFinite(Number(profile.globalPct)) ? Number(profile.globalPct) : Number(profile.pct || 0);
    const progressLabel = `${progressValue}% jeu`;
    const identityLine = [
      profile.club_name ? `Clan: ${profile.club_name}` : "",
      profile.trophies ? `${formatNumber(profile.trophies)} troph.` : ""
    ].filter(Boolean).join(" - ");
    const card = document.createElement("article");
    card.className = "card clickable";
    card.innerHTML = `
      <div class="list-head">
        <div>
          <div class="row">
            <span class="pill">Profil public</span>
            <span class="pill">${compareAvailable ? `${profile.ownedCount} skins` : "Skins masques"}</span>
            <span class="pill">${compareAvailable ? progressLabel : "Comparaison off"}</span>
          </div>
          <h3>${escapeHtml(profile.display_name || "Profil")}</h3>
          <p class="muted">${escapeHtml(profile.bio || "-")}</p>
          <p class="small">${escapeHtml(identityLine || "Profil public partageable")}</p>
        </div>
      </div>
      <div class="section-actions">
        <button class="choice-btn ${profile.favorite ? "is-selected" : ""}" type="button" data-favorite-btn>
          ${profile.favorite ? "Favori" : "Ajouter"}
        </button>
        <button class="choice-btn ${isCompareBase ? "is-selected" : ""}" type="button" data-compare-btn ${compareAvailable ? "" : "disabled"}>
          ${!compareAvailable ? "Indisponible" : isCompareBase ? "Base active" : "Comparer"}
        </button>
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
    const snapshot = PublicProfiles.normalizeProgressSnapshot(profile.progress_snapshot);
    const detailLine = skinsVisible ? `Top brawler skins: ${topBrawlerLabel(ownedIds)}` : "Liste des skins masquee pour ce profil.";

    target.innerHTML = `
      <div class="row">
        <span class="pill">${isCurrent ? "Profil ouvert" : "Base"}</span>
        <span class="pill">${skinsVisible ? "Skins visibles" : "Skins masques"}</span>
        <span class="pill">${ownedIds.length} skins</span>
        <span class="pill">${Number.isFinite(Number(snapshot.global_pct)) ? Number(snapshot.global_pct) : pct}%</span>
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

  function refreshCompareUi() {
    const mode = searchName.value.trim() ? "search" : "latest";
    if (currentProfile && viewedProfileUserId) {
      updateProfileUI(viewedProfileUserId, currentProfile, publicOwnedIds);
    } else {
      renderCompareSection();
    }
    renderDirectory(currentDirectory, mode);
  }

  async function setCompareBase(userId, options) {
    const silent = typeof options === "boolean" ? options : !!options?.silent;
    const clearInvalid = typeof options === "object" && !!options?.clearInvalid;
    try {
      const payload =
        userId === viewedProfileUserId && currentProfile?.show_owned
          ? { userId, profile: currentProfile, ownedIds: [...publicOwnedIds] }
          : await loadComparableProfile(userId);

      if (!payload) {
        if (compareBase?.userId === userId) {
          compareBase = null;
          writeCompareBaseId("");
        }
        if (clearInvalid) {
          writeCompareBaseId("");
          refreshCompareUi();
          return false;
        }
        if (!silent) {
          toast("error", "Comparaison", "Ce profil doit etre public avec skins visibles.");
        }
        return false;
      }

      compareBase = payload;
      writeCompareBaseId(userId);
      refreshCompareUi();

      if (!silent) {
        toast("success", "Comparaison", `Base definie: ${payload.profile.display_name || "Profil"}.`);
      }
      return true;
    } catch (error) {
      console.error(error);
      if (!silent) {
        toast("error", "Comparaison", error.message || String(error));
      }
      return false;
    }
  }

  function clearCompareBase() {
    compareBase = null;
    writeCompareBaseId("");
    refreshCompareUi();
    toast("info", "Comparaison", "Base de comparaison effacee.");
  }

  async function restoreCompareBase() {
    const savedId = readCompareBaseId();
    if (!savedId) return;
    await setCompareBase(savedId, { silent: true, clearInvalid: true });
  }

  function updateProfileUI(userId, profile, ownedIds) {
    clearError();
    viewedProfileUserId = userId;
    currentProfile = profile;
    publicOwnedIds = ownedIds;
    const canCompare = !!profile.show_owned;
    const snapshot = PublicProfiles.normalizeProgressSnapshot(profile.progress_snapshot);

    profileCard.style.display = "block";
    displayNameEl.textContent = profile.display_name || "Profil";
    bioEl.textContent = profile.bio || "-";
    updatedLine.textContent = profile.updated_at ? `Derniere mise a jour : ${fmtDate(profile.updated_at)}` : "";
    shareLine.textContent = `Lien : ${shareUrlFor(userId)}`;
    if (viewClubName) viewClubName.textContent = `Clan : ${profile.club_name || "-"}`;
    if (viewFriendCode) viewFriendCode.textContent = `Code ami : ${profile.friend_code || "-"}`;
    if (viewTrophies) viewTrophies.textContent = `Trophees : ${formatNumber(profile.trophies || 0)}`;
    if (statGlobalPct) statGlobalPct.textContent = `${snapshot.global_pct}%`;
    if (statBrawlerPct) statBrawlerPct.textContent = `${snapshot.brawler_pct}%`;
    if (statSkinsPct) statSkinsPct.textContent = `${snapshot.skins_pct}%`;
    if (statOwnedBrawlers) statOwnedBrawlers.textContent = `${snapshot.owned_brawlers} / ${snapshot.total_brawlers}`;
    if (statOwnedSkins) statOwnedSkins.textContent = `${snapshot.owned_skins} / ${snapshot.total_skins}`;
    if (statMissingCoins) statMissingCoins.textContent = formatNumber(snapshot.missing_coins);
    if (statMissingPowerPoints) statMissingPowerPoints.textContent = formatNumber(snapshot.missing_power_points);
    if (statHypercharges) statHypercharges.textContent = String(snapshot.hypercharges);
    progressBar.style.width = `${snapshot.global_pct}%`;
    if (profileSummary) {
      profileSummary.textContent =
        `${snapshot.global_pct}% de progression jeu, ${snapshot.owned_brawlers}/${snapshot.total_brawlers} Brawlers, ` +
        `${snapshot.owned_skins}/${snapshot.total_skins} skins et ${formatNumber(snapshot.missing_coins)} pieces / ` +
        `${formatNumber(snapshot.missing_power_points)} PP manquants pour tout full.`;
    }
    btnFavoriteProfile.textContent = isFavorite(userId) ? "Retirer des favoris" : "Ajouter aux favoris";
    btnSetCompareBase.classList.toggle("is-active", compareBase?.userId === userId && canCompare);
    btnSetCompareBase.disabled = !canCompare;
    btnSetCompareBase.textContent = !canCompare
      ? "Base indisponible"
      : compareBase?.userId === userId
        ? "Base active"
        : "Definir comme base";
    btnSetCompareBase.title = canCompare
      ? "Utiliser ce profil comme base de comparaison."
      : "Impossible de comparer un profil qui masque sa liste de skins.";

    if (!profile.is_public) publicModeLine.textContent = "Profil non public. Un nouvel enregistrement reappliquera le mode public par defaut.";
    else if (!profile.show_owned) publicModeLine.textContent = "Profil public, collection en attente de republication.";
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
      const localProfile = Brawldex.getProfile(me.id);
      const [data, ownedSet, publishedIds] = await Promise.all([
        loadProfile(me.id),
        loadOwnedMe(),
        PublicProfiles.loadOwned(me.id).catch(() => [])
      ]);
      meDisplayName.value = data?.display_name ?? ((me.email || "").split("@")[0] || "");
      meClubName.value = data?.club_name ?? localProfile.club ?? "";
      meFriendCode.value = data?.friend_code ?? "";
      meTrophies.value = String(data?.trophies ?? localProfile.trophies ?? 0);
      meBio.value = data?.bio ?? "";
      syncMyProfileSnapshot(data);
      myOwnedIds = uniqueIds([...ownedSet]);
      myPublishedIds = uniqueIds(publishedIds);
      setMeMsg("Profil charge.");
    } catch (error) {
      syncMyProfileSnapshot(null);
      myOwnedIds = [];
      myPublishedIds = [];
      setMeMsg(error.message || String(error));
    }
    renderMyProfileState();
  }

  async function saveMyProfile() {
    if (!me) return false;
    setMeMsg("Enregistrement...");

    try {
      myOwnedIds = uniqueIds([...await loadOwnedMe()]);
      const payload = normalizeMeDraft();
      await PublicProfiles.saveProfile(
        me.id,
        payload,
        {
          fallbackDisplayName: fallbackMeDisplayName()
        }
      );

      syncMyProfileSnapshot({
        user_id: me.id,
        updated_at: new Date().toISOString(),
        ...payload
      });
      renderMyProfileState();
      setMeMsg("Profil enregistre.");
      toast("success", "Profil", "Profil enregistre.");
      try {
        await refreshViewedOwnProfile();
        await doSearch();
      } catch (error) {
        console.error(error);
      }
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
      myOwnedIds = uniqueIds([...ownedSet]);
      const result = await PublicProfiles.publishOwned(me.id, [...ownedSet]);
      if (!result.publishedCount) {
        myPublishedIds = [];
        renderMyProfileState();
        setMeMsg("Liste publique videe.");
        toast("success", "Publication", "Liste publique videe.");
        try {
          await refreshViewedOwnProfile();
          await doSearch();
        } catch (error) {
          console.error(error);
        }
        return;
      }

      myPublishedIds = uniqueIds([...ownedSet]);
      renderMyProfileState();
      setMeMsg(`${result.publishedCount} skin(s) publies.`);
      toast("success", "Publication", `${result.publishedCount} skin(s) publies.`);
      try {
        await refreshViewedOwnProfile();
        await doSearch();
      } catch (error) {
        console.error(error);
      }
    } catch (error) {
      setMeMsg(error.message || String(error));
      toast("error", "Publication", error.message || String(error));
    }
  }

  async function refreshViewedOwnProfile() {
    if (!me || viewedProfileUserId !== me.id) return;

    const profile = await loadProfile(me.id);
    if (!profile || !profile.is_public) {
      currentProfile = null;
      publicOwnedIds = [];
      profileCard.style.display = "none";
      toolbar.style.display = "none";
      skinsSection.style.display = "none";
      if (compareBase?.userId === me.id) {
        compareBase = null;
        writeCompareBaseId("");
      }
      renderCompareSection();
      return;
    }

    const ownedIds = profile.show_owned ? await loadPublicOwned(me.id) : [];
    updateProfileUI(me.id, profile, ownedIds);
  }

  function myUrl() {
    return me ? shareUrlFor(me.id) : "";
  }

  async function copyMyLink() {
    if (!me) return;
    if (!myProfileSnapshot?.is_public) {
      setMeMsg("Enregistre ton profil pour activer le lien public.");
      return;
    }
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
    if (!myProfileSnapshot?.is_public) {
      setMeMsg("Enregistre a nouveau ton profil pour activer le lien public.");
      return;
    }
    window.open(myUrl(), "_blank");
  }

  async function refreshMe() {
    if (!me) return;
    await loadMyProfile();
    renderMyProfileState();
  }

  btnMeSave.addEventListener("click", saveMyProfile);
  btnMePublish.addEventListener("click", publishMyOwned);
  btnMeCopy.addEventListener("click", copyMyLink);
  btnMeOpen.addEventListener("click", openMyProfile);
  btnMeReload.addEventListener("click", refreshMe);
  meDisplayName.addEventListener("input", renderMyProfileState);
  meClubName.addEventListener("input", renderMyProfileState);
  meFriendCode.addEventListener("input", renderMyProfileState);
  meTrophies.addEventListener("input", renderMyProfileState);
  meBio.addEventListener("input", renderMyProfileState);
  btnMeLogout.addEventListener("click", async () => {
    await supa.auth.signOut();
  });

  renderMyProfileState();

  (async () => {
    try {
      if (window.SKINS_READY && typeof window.SKINS_READY.then === "function") {
        await window.SKINS_READY;
      }
    } catch {}

    try {
      if (window.BRAWLDEX_READY && typeof window.BRAWLDEX_READY.then === "function") {
        await window.BRAWLDEX_READY;
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
        renderAuthBadge(me);
        await refreshMe();
      } else {
        myProfileCard.style.display = "none";
        needAuthCard.style.display = "block";
        renderAuthBadge(null);
        syncMyProfileSnapshot(null);
        myOwnedIds = [];
        myPublishedIds = [];
        renderMyProfileState();
      }

      supa.auth.onAuthStateChange(async (_event, session) => {
        me = session?.user ?? null;
        if (me) {
          myProfileCard.style.display = "block";
          needAuthCard.style.display = "none";
          meLine.textContent = me.email ?? me.id;
          renderAuthBadge(me);
          await refreshMe();
        } else {
          myProfileCard.style.display = "none";
          needAuthCard.style.display = "block";
          renderAuthBadge(null);
          syncMyProfileSnapshot(null);
          myOwnedIds = [];
          myPublishedIds = [];
          renderMyProfileState();
          setMeMsg("");
        }
      });
    } catch {
      myProfileCard.style.display = "none";
      needAuthCard.style.display = "block";
      renderAuthBadge(null);
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

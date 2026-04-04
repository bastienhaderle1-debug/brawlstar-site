(function () {
  const supa = window.AppGuard?.requireSupabase("mybrawl");
  if (!supa) return;

  if (!window.OwnedService || !window.BrawldexService || !window.PublicProfileService) {
    window.AppGuard?.fail(
      "Services introuvables. Verifie owned-service.js, brawldex-service.js et public-profile-service.js.",
      "mybrawl"
    );
    return;
  }

  const OwnedService = window.OwnedService;
  const Brawldex = window.BrawldexService;
  const PublicProfiles = window.PublicProfileService;
  const PlayerApi = window.BrawlStarsApi || null;
  const brawlApiEnabled = window.BRAWLDEX_CONFIG?.enableBrawlApi === true;
  const RARITY_ORDER =
    window.RARITY_ORDER ?? ["Rare", "Super Rare", "Epic", "Mythique", "Legendaire", "Hypercharge", "Argent", "Or"];
  const RARITY_CLASS = {
    Rare: "rarity-rare",
    "Super Rare": "rarity-super-rare",
    Epic: "rarity-epic",
    Mythique: "rarity-mythic",
    Legendaire: "rarity-legendary",
    "Légendaire": "rarity-legendary",
    Hypercharge: "rarity-hypercharge",
    Argent: "rarity-silver",
    Or: "rarity-gold"
  };

  const authCard = document.getElementById("authCard");
  const app = document.getElementById("app");
  const authMsg = document.getElementById("authMsg");
  const email = document.getElementById("email");
  const password = document.getElementById("password");
  const btnLogin = document.getElementById("btnLogin");
  const btnSignup = document.getElementById("btnSignup");
  const btnResend = document.getElementById("btnResend");
  const btnLogout = document.getElementById("btnLogout");
  const btnReload = document.getElementById("btnReload");
  const btnExport = document.getElementById("btnExport");
  const btnReset = document.getElementById("btnReset");
  const importFile = document.getElementById("importFile");
  const globalAuthBadge = document.getElementById("globalAuthBadge");

  const userLine = document.getElementById("userLine");
  const collectionSummary = document.getElementById("collectionSummary");
  const status = document.getElementById("status");
  const profileStatus = document.getElementById("profileStatus");
  const publicStatus = document.getElementById("publicStatus");
  const dataSourceLabel = document.getElementById("dataSourceLabel");
  const dataSourceMessage = document.getElementById("dataSourceMessage");

  const playerTag = document.getElementById("playerTag");
  const club = document.getElementById("club");
  const favoriteMode = document.getElementById("favoriteMode");
  const mainBrawler = document.getElementById("mainBrawler");
  const goal = document.getElementById("goal");
  const btnSavePersonal = document.getElementById("btnSavePersonal");

  const publicDisplayName = document.getElementById("publicDisplayName");
  const publicBio = document.getElementById("publicBio");
  const publicIsPublic = document.getElementById("publicIsPublic");
  const publicShowOwned = document.getElementById("publicShowOwned");
  const btnSavePublic = document.getElementById("btnSavePublic");
  const btnPublishOwned = document.getElementById("btnPublishOwned");
  const btnOpenPublic = document.getElementById("btnOpenPublic");
  const btnCopyPublic = document.getElementById("btnCopyPublic");
  const publicLiveState = document.getElementById("publicLiveState");
  const publicDraftState = document.getElementById("publicDraftState");
  const publicCollectionState = document.getElementById("publicCollectionState");
  const publicCollectionDetail = document.getElementById("publicCollectionDetail");
  const publicLinkState = document.getElementById("publicLinkState");
  const publicLinkDetail = document.getElementById("publicLinkDetail");
  const dashboardFocusMessage = document.getElementById("dashboardFocusMessage");
  const dashboardStepAuth = document.getElementById("dashboardStepAuth");
  const dashboardStepCollection = document.getElementById("dashboardStepCollection");
  const dashboardStepPublic = document.getElementById("dashboardStepPublic");
  const apiPlayerTag = document.getElementById("apiPlayerTag");
  const btnSyncPlayer = document.getElementById("btnSyncPlayer");
  const btnClearPlayerSync = document.getElementById("btnClearPlayerSync");
  const playerApiStatus = document.getElementById("playerApiStatus");
  const playerApiName = document.getElementById("playerApiName");
  const playerApiMeta = document.getElementById("playerApiMeta");
  const playerApiTag = document.getElementById("playerApiTag");
  const playerApiTrophies = document.getElementById("playerApiTrophies");
  const playerApiHighest = document.getElementById("playerApiHighest");
  const playerApiBrawlers = document.getElementById("playerApiBrawlers");
  const playerApiExp = document.getElementById("playerApiExp");
  const playerApiClub = document.getElementById("playerApiClub");
  const playerApiFavorite = document.getElementById("playerApiFavorite");
  const playerApiSyncedAt = document.getElementById("playerApiSyncedAt");

  const brawlerOwned = document.getElementById("brawlerOwned");
  const brawlerTotal = document.getElementById("brawlerTotal");
  const avgPower = document.getElementById("avgPower");
  const trophyTotal = document.getElementById("trophyTotal");
  const unlockTotal = document.getElementById("unlockTotal");
  const hyperchargeTotal = document.getElementById("hyperchargeTotal");
  const skinOwned = document.getElementById("skinOwned");
  const skinTotal = document.getElementById("skinTotal");
  const skinProgressBar = document.getElementById("skinProgressBar");
  const badgeCloud = document.getElementById("badgeCloud");
  const collectionHighlights = document.getElementById("collectionHighlights");
  const topBrawlers = document.getElementById("topBrawlers");
  const activityFeed = document.getElementById("activityFeed");

  const search = document.getElementById("search");
  const filterBrawler = document.getElementById("filterBrawler");
  const filterRarity = document.getElementById("filterRarity");
  const onlyOwned = document.getElementById("onlyOwned");
  const cards = document.getElementById("cards");
  const resultCount = document.getElementById("resultCount");

  let currentUser = null;
  let authBusy = false;
  let ownedSet = new Set();
  let SKINS = [];
  let livePublicProfile = null;
  let livePublicOwnedIds = [];
  let playerApiHealth = {
    configured: null,
    status: brawlApiEnabled ? "checking" : "paused",
    message: brawlApiEnabled
      ? "Verification du proxy Brawl Stars..."
      : "La synchro live est mise de cote pour l'instant. Le flow principal passe par Supabase."
  };

  function viewerKey() {
    return currentUser?.id || "visitor";
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function toast(type, title, message) {
    if (window.showToast) window.showToast(message, type, title, 3200);
  }

  function setAuthMessage(message) {
    authMsg.textContent = message || "";
  }

  function setStatus(message) {
    status.textContent = message || "";
  }

  function setProfileStatus(message) {
    profileStatus.textContent = message || "";
  }

  function setPublicStatus(message) {
    publicStatus.textContent = message || "";
  }

  function setPlayerApiStatus(message) {
    if (playerApiStatus) playerApiStatus.textContent = message || "";
  }

  async function refreshPlayerApiHealth(options) {
    if (!brawlApiEnabled) {
      playerApiHealth = {
        configured: null,
        status: "paused",
        message: "La synchro live est mise de cote pour l'instant. Le flow principal passe par Supabase."
      };
      updatePlayerApiControls();
      const profile = Brawldex.getProfile(viewerKey());
      if (!profile.playerName) {
        setPlayerApiStatus(playerApiHealth.message);
        renderSyncedPlayer(profile);
      }
      return;
    }

    if (!PlayerApi?.fetchProxyHealth) {
      playerApiHealth = {
        configured: null,
        status: "unavailable",
        message: "Le client Brawl Stars API est introuvable."
      };
      updatePlayerApiControls();
      return;
    }

    playerApiHealth = await PlayerApi.fetchProxyHealth(options).catch(() => ({
      configured: null,
      status: "unavailable",
      message: "Impossible de verifier l'etat du proxy Brawl Stars pour l'instant."
    }));

    updatePlayerApiControls();
    const profile = Brawldex.getProfile(viewerKey());
    if (!profile.playerName) {
      setPlayerApiStatus(playerApiHealth.message);
      renderSyncedPlayer(profile);
    }
  }

  function updatePlayerApiControls() {
    if (btnSyncPlayer) {
      btnSyncPlayer.disabled = !brawlApiEnabled || playerApiHealth.configured === false;
      btnSyncPlayer.title =
        !brawlApiEnabled
          ? "La synchro live est en pause pour l'instant. Le projet fonctionne uniquement avec Supabase."
          : playerApiHealth.configured === false
          ? "Configure BRAWL_STARS_API_TOKEN sur Vercel pour activer la synchro."
          : "Synchroniser ce tag via le proxy serveur.";
    }
  }

  function renderAuthBadge(user) {
    if (!globalAuthBadge) return;
    globalAuthBadge.classList.remove("ok", "ko");
    globalAuthBadge.classList.add(user ? "ok" : "ko");
    const label = globalAuthBadge.querySelector("span:last-child");
    if (label) label.textContent = user ? "Connecte" : "Non connecte";
  }

  function getSourceStatus() {
    return window.SKINS_SOURCE_STATUS || {
      label: "Local fallback",
      message: "Le connecteur Google Sheet est pret mais pas encore branche."
    };
  }

  function authRedirectUrl() {
    return new URL("/pages/mybrawl.html", window.location.origin).toString();
  }

  function renderSourceStatus() {
    const source = getSourceStatus();
    if (dataSourceLabel) dataSourceLabel.textContent = source.label || "Local fallback";
    if (dataSourceMessage) {
      dataSourceMessage.textContent = source.message || "Le connecteur Google Sheet est pret.";
    }
  }

  function normalizeAuthError(err) {
    const msg = String(err?.message || err || "");
    const low = msg.toLowerCase();
    if (low.includes("invalid login credentials")) return { title: "Connexion", message: "Email ou mot de passe incorrect." };
    if (low.includes("email not confirmed")) return { title: "Connexion", message: "Email non confirme. Renvoye l'email." };
    if (low.includes("user already registered")) return { title: "Inscription", message: "Un compte existe deja avec cet email." };
    if (low.includes("password should be at least")) return { title: "Inscription", message: "Mot de passe trop court." };
    if (low.includes("rate limit")) return { title: "Connexion", message: "Trop de tentatives. Reessaie plus tard." };
    return { title: "Erreur", message: msg || "Une erreur est survenue." };
  }

  function setAuthBusyState(busy, message) {
    authBusy = !!busy;
    btnLogin.disabled = authBusy;
    btnSignup.disabled = authBusy;
    btnResend.disabled = authBusy;
    if (message !== undefined) setAuthMessage(message);
  }

  function uniqueSorted(values) {
    return [...new Set(values.map((value) => (value ?? "").toString().trim()).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, "fr")
    );
  }

  function buildSkinFilters() {
    filterBrawler.innerHTML = "";
    filterRarity.innerHTML = "";

    const allBrawlers = document.createElement("option");
    allBrawlers.value = "all";
    allBrawlers.textContent = "Tous";
    filterBrawler.appendChild(allBrawlers);

    uniqueSorted(SKINS.map((skin) => skin?.brawler)).forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      filterBrawler.appendChild(option);
    });

    const allRarities = document.createElement("option");
    allRarities.value = "all";
    allRarities.textContent = "Toutes";
    filterRarity.appendChild(allRarities);

    const existing = new Set(SKINS.map((skin) => skin?.rarity).filter(Boolean));
    RARITY_ORDER.forEach((rarity) => {
      if (!existing.has(rarity)) return;
      const option = document.createElement("option");
      option.value = rarity;
      option.textContent = rarity;
      filterRarity.appendChild(option);
    });
  }

  function fillMainBrawlerOptions() {
    const currentValue = mainBrawler.value;
    mainBrawler.innerHTML = "";

    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "Choisir";
    mainBrawler.appendChild(empty);

    Brawldex.getCatalog().forEach((meta) => {
      const option = document.createElement("option");
      option.value = meta.name;
      option.textContent = meta.name;
      mainBrawler.appendChild(option);
    });

    mainBrawler.value = currentValue;
  }

  function publicProfileUrl(userId) {
    const url = new URL("./profile.html", window.location.href);
    url.searchParams.set("u", userId);
    return url.toString();
  }

  function safeStr(value) {
    return (value ?? "").toString().trim();
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

  function fallbackPublicDisplayName() {
    return safeStr((currentUser?.email || "").split("@")[0]) || "Profil";
  }

  function normalizePublicDraft(source) {
    return {
      display_name: safeStr(source?.display_name ?? publicDisplayName?.value) || fallbackPublicDisplayName(),
      bio: safeStr(source?.bio ?? publicBio?.value),
      is_public: source?.is_public ?? !!publicIsPublic?.checked,
      show_owned: source?.show_owned ?? !!publicShowOwned?.checked
    };
  }

  function samePublicDraft(left, right) {
    return !!left &&
      !!right &&
      safeStr(left.display_name) === safeStr(right.display_name) &&
      safeStr(left.bio) === safeStr(right.bio) &&
      !!left.is_public === !!right.is_public &&
      !!left.show_owned === !!right.show_owned;
  }

  function syncLivePublicProfile(profile) {
    livePublicProfile = profile ? { ...profile, ...normalizePublicDraft(profile) } : null;
  }

  function paintStep(node, text, state) {
    if (!node) return;
    node.textContent = text;
    node.dataset.state = state || "idle";
  }

  function renderWorkflowFocus() {
    const profile = Brawldex.getProfile(viewerKey());
    const skinStats = OwnedService.computeOwnedStats(ownedSet);
    const localOwnedIds = [...ownedSet];
    const needsPublish = !sameIdSet(localOwnedIds, livePublicOwnedIds);
    const hasLiveProfile = !!livePublicProfile;
    const isPublic = !!livePublicProfile?.is_public;
    const canCompare = isPublic && (livePublicProfile?.show_owned !== false);

    let focusMessage = "Connecte-toi pour commencer a construire ton espace.";
    if (currentUser) {
      if (!skinStats.owned) {
        focusMessage = "Commence par cocher tes premiers skins pour donner de la matiere a ton profil.";
      } else if (!hasLiveProfile) {
        focusMessage = "Ton compte est pret : enregistre maintenant ta fiche publique pour la creer.";
      } else if (!isPublic) {
        focusMessage = "Ton profil existe deja. Passe-le en public pour activer ton lien partageable.";
      } else if (needsPublish) {
        focusMessage = "Il te reste a republier ta collection pour aligner la version en ligne avec tes skins coches.";
      } else if (!canCompare) {
        focusMessage = "Ton profil est partageable. Si tu veux la comparaison, rends aussi ta collection visible.";
      } else {
        focusMessage = "Tout est en place : ton profil est propre, partageable et pret pour la comparaison.";
      }
    }

    if (dashboardFocusMessage) dashboardFocusMessage.textContent = focusMessage;

    paintStep(dashboardStepAuth, currentUser ? "Actif" : "A connecter", currentUser ? "done" : "next");

    if (!currentUser) {
      paintStep(dashboardStepCollection, "En attente", "idle");
      paintStep(dashboardStepPublic, "En attente", "idle");
      return;
    }

    if (!skinStats.owned) paintStep(dashboardStepCollection, "A remplir", "next");
    else if (needsPublish) paintStep(dashboardStepCollection, "A publier", "next");
    else paintStep(dashboardStepCollection, "A jour", "done");

    if (!hasLiveProfile) paintStep(dashboardStepPublic, "Brouillon", "next");
    else if (!isPublic) paintStep(dashboardStepPublic, "Prive", "next");
    else if (!canCompare) paintStep(dashboardStepPublic, "Partage OK", "done");
    else paintStep(dashboardStepPublic, "Comparaison OK", "done");
  }

  function renderPublicProfileState() {
    const draft = normalizePublicDraft();
    const live = livePublicProfile ? normalizePublicDraft(livePublicProfile) : null;
    const localOwnedIds = [...ownedSet];
    const localCount = localOwnedIds.length;
    const publishedCount = livePublicOwnedIds.length;
    const hasLiveProfile = !!livePublicProfile;
    const liveIsPublic = !!livePublicProfile?.is_public;
    const liveShowOwned = !!livePublicProfile && livePublicProfile.show_owned !== false;
    const draftDirty = !live || !samePublicDraft(draft, live);
    const needsPublish = !sameIdSet(localOwnedIds, livePublicOwnedIds);
    const canShare = !!currentUser && liveIsPublic;

    if (publicLiveState) {
      if (!hasLiveProfile) publicLiveState.textContent = "Brouillon";
      else if (liveIsPublic) publicLiveState.textContent = "Public";
      else publicLiveState.textContent = "Prive";
    }

    if (publicDraftState) {
      if (!hasLiveProfile) publicDraftState.textContent = "Enregistre une premiere fois pour creer ton profil public.";
      else if (draftDirty) publicDraftState.textContent = "Des modifications locales attendent encore un enregistrement.";
      else if (liveIsPublic) publicDraftState.textContent = "Ton profil en ligne est aligne avec le formulaire.";
      else publicDraftState.textContent = "Ton profil est sauvegarde, mais il reste prive.";
    }

    if (publicCollectionState) {
      publicCollectionState.textContent = `${publishedCount} / ${localCount}`;
    }

    if (publicCollectionDetail) {
      if (!localCount && !publishedCount) publicCollectionDetail.textContent = "Aucun skin coche pour l'instant.";
      else if (needsPublish && !localCount) publicCollectionDetail.textContent = "Ta liste publique n'est pas vide. Republie pour la vider.";
      else if (needsPublish) publicCollectionDetail.textContent = `Local: ${localCount} skin(s) coches. Republie pour aligner la version en ligne.`;
      else if (!publishedCount) publicCollectionDetail.textContent = "Aucune collection publique pour l'instant.";
      else if (!liveShowOwned) publicCollectionDetail.textContent = `${publishedCount} skins sont publies, mais masques dans ton profil.`;
      else publicCollectionDetail.textContent = `${publishedCount} skins sont visibles et prets pour la comparaison.`;
    }

    if (publicLinkState) {
      if (!hasLiveProfile) publicLinkState.textContent = "Inactif";
      else if (!liveIsPublic) publicLinkState.textContent = "Prive";
      else if (!liveShowOwned) publicLinkState.textContent = "Partage OK";
      else publicLinkState.textContent = "Comparaison OK";
    }

    if (publicLinkDetail) {
      if (!hasLiveProfile) publicLinkDetail.textContent = "Le lien sera pret apres le premier enregistrement.";
      else if (!liveIsPublic) publicLinkDetail.textContent = "Passe le profil en public puis enregistre pour activer le lien.";
      else if (!liveShowOwned) publicLinkDetail.textContent = "Le profil est partageable, mais la liste de skins reste masquee.";
      else if (!publishedCount) publicLinkDetail.textContent = "Le profil est public, mais aucune collection n'est encore publiee.";
      else publicLinkDetail.textContent = "Lien actif et comparaison disponible depuis la page profils.";
    }

    if (btnSavePublic) btnSavePublic.classList.toggle("is-active", draftDirty);
    if (btnPublishOwned) {
      btnPublishOwned.classList.toggle("is-active", needsPublish);
      btnPublishOwned.title = draft.show_owned
        ? "Mettre a jour la liste publique de skins."
        : "Les skins seront publies, mais resteront masques tant que cette option est desactivee.";
    }
    if (btnOpenPublic) {
      btnOpenPublic.disabled = !canShare;
      btnOpenPublic.title = canShare ? "Ouvrir ton profil public." : "Rends le profil public puis enregistre pour activer le lien.";
    }
    if (btnCopyPublic) {
      btnCopyPublic.disabled = !canShare;
      btnCopyPublic.title = canShare ? publicProfileUrl(currentUser.id) : "Aucun lien public actif pour le moment.";
    }

    renderWorkflowFocus();
  }

  function clearSyncedPlayerProfile() {
    Brawldex.updateProfile(viewerKey(), {
      playerName: "",
      apiClubName: "",
      apiClubTag: "",
      apiFavoriteBrawler: "",
      apiSyncedAt: "",
      trophies: 0,
      highestTrophies: 0,
      expLevel: 0,
      victories3v3: 0,
      soloVictories: 0,
      duoVictories: 0,
      brawlersCount: 0
    });
  }

  function renderSyncedPlayer(profile) {
    if (!playerApiName) return;

    const hasSyncedProfile = !!profile.playerName;
    playerApiName.textContent = hasSyncedProfile
      ? profile.playerName
      : !brawlApiEnabled
        ? "Synchro en pause"
      : playerApiHealth.configured === false
        ? "Proxy non configure"
        : "Compte non synchronise";
    playerApiMeta.textContent = hasSyncedProfile
      ? `${profile.trophies} trophees officiels - ${profile.victories3v3 || 0} victoires 3v3 - ${profile.soloVictories || 0} solo - ${profile.duoVictories || 0} duo`
      : !brawlApiEnabled
        ? "Le site fonctionne pour l'instant uniquement avec Supabase. La synchro live reviendra plus tard."
      : playerApiHealth.configured === true
        ? "Synchronise un tag pour recuperer ton vrai profil Brawl Stars."
        : playerApiHealth.message || "Verification du proxy Brawl Stars...";
    playerApiTag.textContent = profile.playerTag || "#---";
    playerApiTrophies.textContent = String(profile.trophies || 0);
    playerApiHighest.textContent = String(profile.highestTrophies || 0);
    playerApiBrawlers.textContent = String(profile.brawlersCount || 0);
    playerApiExp.textContent = String(profile.expLevel || 0);
    playerApiClub.textContent = profile.apiClubName || profile.club || "-";
    playerApiFavorite.textContent = profile.apiFavoriteBrawler || profile.mainBrawler || "-";
    playerApiSyncedAt.textContent = profile.apiSyncedAt ? new Date(profile.apiSyncedAt).toLocaleString("fr-FR") : "-";

    if (apiPlayerTag) apiPlayerTag.value = profile.playerTag || "";
  }

  function showLoggedIn(user) {
    currentUser = user;
    authCard.style.display = "none";
    app.style.display = "block";
    userLine.textContent = user.email ?? user.id;
    renderAuthBadge(user);
    renderPublicProfileState();
    renderSourceStatus();
  }

  function showLoggedOut() {
    currentUser = null;
    ownedSet = new Set();
    syncLivePublicProfile(null);
    livePublicOwnedIds = [];
    authCard.style.display = "block";
    app.style.display = "none";
    setAuthMessage("");
    setStatus("");
    setProfileStatus("");
    setPublicStatus("");
    setPlayerApiStatus("");
    setAuthBusyState(false, "");
    renderAuthBadge(null);
    renderPublicProfileState();
  }

  async function signup() {
    if (authBusy) return;
    const em = (email.value || "").trim();
    const pw = password.value || "";

    if (!em || !pw) {
      setAuthMessage("Renseigne email et mot de passe.");
      toast("error", "Inscription", "Renseigne email et mot de passe.");
      return;
    }

    setAuthBusyState(true, "Creation du compte...");
    try {
      const { error } = await supa.auth.signUp({
        email: em,
        password: pw,
        options: { emailRedirectTo: authRedirectUrl() }
      });
      if (error) {
        const normalized = normalizeAuthError(error);
        setAuthBusyState(false, normalized.message);
        toast("error", normalized.title, normalized.message);
        return;
      }
      setAuthBusyState(false, "Compte cree. Verifie ton email.");
      toast("success", "Inscription", "Compte cree. Verifie ton email.");
    } catch (error) {
      const normalized = normalizeAuthError(error);
      setAuthBusyState(false, normalized.message);
      toast("error", normalized.title, normalized.message);
    }
  }

  async function resendConfirmationEmail() {
    if (authBusy) return;
    const em = (email.value || "").trim();
    if (!em) {
      setAuthMessage("Entre ton email puis renvoie l'email.");
      toast("info", "Email", "Entre ton email puis renvoie l'email.");
      return;
    }

    setAuthBusyState(true, "Envoi de l'email...");
    try {
      const { error } = await supa.auth.resend({
        type: "signup",
        email: em,
        options: { emailRedirectTo: authRedirectUrl() }
      });
      if (error) {
        const normalized = normalizeAuthError(error);
        setAuthBusyState(false, normalized.message);
        toast("error", "Email", normalized.message);
        return;
      }
      setAuthBusyState(false, "Email renvoye. Verifie ta boite mail.");
      toast("success", "Email", "Email renvoye.");
    } catch (error) {
      const normalized = normalizeAuthError(error);
      setAuthBusyState(false, normalized.message);
      toast("error", normalized.title, normalized.message);
    }
  }

  async function login() {
    if (authBusy) return;
    const em = (email.value || "").trim();
    const pw = password.value || "";

    if (!em || !pw) {
      setAuthMessage("Renseigne email et mot de passe.");
      toast("error", "Connexion", "Renseigne email et mot de passe.");
      return;
    }

    setAuthBusyState(true, "Connexion...");
    try {
      const { data, error } = await supa.auth.signInWithPassword({ email: em, password: pw });
      if (error) {
        const normalized = normalizeAuthError(error);
        setAuthBusyState(false, normalized.message);
        toast("error", normalized.title, normalized.message);
        return;
      }
      showLoggedIn(data.user);
      setAuthBusyState(false, "");
      toast("success", "Connexion", "Connecte.");
      await refreshAll();
    } catch (error) {
      const normalized = normalizeAuthError(error);
      setAuthBusyState(false, normalized.message);
      toast("error", normalized.title, normalized.message);
    }
  }

  async function logout() {
    try {
      await supa.auth.signOut();
    } finally {
      showLoggedOut();
    }
  }

  async function loadOwned() {
    if (!currentUser) return;
    setStatus("Chargement de tes skins...");

    try {
      ownedSet = await OwnedService.loadOwnedSet(currentUser.id);
      setStatus(`${ownedSet.size} skin(s) coches charges.`);
    } catch (error) {
      setStatus(`Erreur de chargement: ${error.message || String(error)}`);
    }
    renderPublicProfileState();
  }

  async function setOwned(skinId, isOwned) {
    if (!currentUser) return;

    try {
      await OwnedService.setOwned(currentUser.id, skinId, isOwned);
      if (isOwned) ownedSet.add(skinId);
      else ownedSet.delete(skinId);
      renderSkins();
      renderDashboard();
      renderPublicProfileState();
      setStatus(`${ownedSet.size} skin(s) coches enregistres.`);
    } catch (error) {
      setStatus(error.message || String(error));
    }
  }

  function renderSkins() {
    const q = (search.value || "").toLowerCase().trim();
    const brawler = filterBrawler.value || "all";
    const rarity = filterRarity.value || "all";
    const only = !!onlyOwned.checked;

    const list = SKINS.filter((skin) => {
      if (!skin) return false;
      if (only && !ownedSet.has(skin.id)) return false;
      if (brawler !== "all" && skin.brawler !== brawler) return false;
      if (rarity !== "all" && skin.rarity !== rarity) return false;
      if (!q) return true;
      return [skin.name, skin.brawler, skin.category, skin.rarity].join("|").toLowerCase().includes(q);
    });

    resultCount.textContent = `${list.length} skin(s) affiches`;
    cards.innerHTML = "";

    list.forEach((skin) => {
      const article = document.createElement("article");
      article.className = "card";
      article.innerHTML = `
        <div class="row">
          <span class="pill">${escapeHtml(skin.category ?? "-")}</span>
          <span class="pill ${escapeHtml(RARITY_CLASS[skin.rarity] ?? "")}">${escapeHtml(skin.rarity ?? "-")}</span>
        </div>
        <h3>${escapeHtml(skin.name)}</h3>
        <p class="muted">Brawler : <strong>${escapeHtml(skin.brawler ?? "-")}</strong></p>
        <label class="switch-line">
          <input type="checkbox" ${ownedSet.has(skin.id) ? "checked" : ""} />
          <span>Je l'ai</span>
        </label>
      `;

      article.querySelector("input[type='checkbox']").addEventListener("change", (event) => {
        setOwned(skin.id, event.target.checked);
      });
      cards.appendChild(article);
    });
  }

  function renderPersonalProfile() {
    fillMainBrawlerOptions();
    const profile = Brawldex.getProfile(viewerKey());
    playerTag.value = profile.playerTag || "";
    club.value = profile.club || "";
    favoriteMode.value = profile.favoriteMode || "";
    mainBrawler.value = profile.mainBrawler || "";
    goal.value = profile.goal || "";
    if (apiPlayerTag) apiPlayerTag.value = profile.playerTag || "";
    renderSyncedPlayer(profile);
  }

  function renderActivity() {
    const activity = Brawldex.getActivity(viewerKey(), 8);
    activityFeed.innerHTML = "";

    if (!activity.length) {
      activityFeed.innerHTML = `
        <div class="list-card">
          <h3>Aucune activite</h3>
          <p class="muted">Commence par modifier tes brawlers ou ton profil pour creer une timeline.</p>
        </div>
      `;
      return;
    }

    activity.forEach((item) => {
      const node = document.createElement("article");
      node.className = "list-card";
      node.innerHTML = `
        <div class="list-head">
          <div>
            <h3>${escapeHtml(item.title)}</h3>
            <p class="muted">${escapeHtml(item.detail || "Mise a jour de ton Brawldex.")}</p>
          </div>
          <span class="pill">${new Date(item.ts).toLocaleDateString("fr-FR")}</span>
        </div>
      `;
      activityFeed.appendChild(node);
    });
  }

  function renderBadgesAndGoals(stats, skinStats) {
    const insights = Brawldex.getInsights(viewerKey());
    const profile = Brawldex.getProfile(viewerKey());

    badgeCloud.innerHTML = "";
    if (!insights.badges.length) {
      const badge = document.createElement("span");
      badge.className = "pill";
      badge.textContent = "Premier roster";
      badgeCloud.appendChild(badge);
    } else {
      insights.badges.forEach((item) => {
        const badge = document.createElement("span");
        badge.className = "pill";
        badge.textContent = item.label;
        badge.title = item.detail;
        badgeCloud.appendChild(badge);
      });
    }

    const lines = [
      `${stats.owned}/${stats.total} brawlers possedes et ${stats.incompleteOwned} encore a completer.`,
      `${stats.unlocks} unlocks equipes, dont ${stats.hypercharges} hypercharges et ${stats.maxed} brawlers maxes.`,
      `${skinStats.owned}/${skinStats.total} skins coches, soit ${skinStats.pct}% de progression skin.`,
      profile.mainBrawler ? `Main actuel : ${profile.mainBrawler}.` : "Ajoute un main brawler pour personnaliser encore ton profil.",
      profile.goal || insights.recommendations[0] || "Ajoute un objectif pour donner une direction a ta progression."
    ];

    collectionHighlights.innerHTML = "";
    lines.forEach((line) => {
      const p = document.createElement("p");
      p.className = "muted";
      p.textContent = line;
      collectionHighlights.appendChild(p);
    });
  }

  function renderTopBrawlers() {
    const top = Brawldex.getTopBrawlers(viewerKey(), 5);
    topBrawlers.innerHTML = "";

    if (!top.length) {
      topBrawlers.innerHTML = `
        <div class="list-card">
          <h3>Aucun brawler renseigne</h3>
          <p class="muted">Va sur la page Brawlers pour remplir ta collection et ton top apparaitra ici.</p>
        </div>
      `;
      return;
    }

    top.forEach(({ meta, entry }) => {
      const node = document.createElement("article");
      node.className = "list-card";
      node.innerHTML = `
        <div class="list-head">
          <div>
            <h3>${escapeHtml(meta.name)}</h3>
            <p class="muted">${escapeHtml(meta.role)} - ${escapeHtml(meta.rarity)}</p>
          </div>
          <span class="pill">${entry.trophies} troph.</span>
        </div>
        <p class="muted">Puissance ${entry.powerLevel} - Mastery ${entry.mastery} - ${entry.hypercharge ? "Hypercharge" : "Sans hypercharge"}</p>
      `;
      topBrawlers.appendChild(node);
    });
  }

  function renderDashboard() {
    const brawldexStats = Brawldex.getStats(viewerKey());
    const skinStats = OwnedService.computeOwnedStats(ownedSet);
    const profile = Brawldex.getProfile(viewerKey());

    brawlerOwned.textContent = String(brawldexStats.owned);
    brawlerTotal.textContent = `/ ${brawldexStats.total}`;
    avgPower.textContent = String(brawldexStats.avgPower);
    trophyTotal.textContent = String(profile.trophies || brawldexStats.trophies);
    unlockTotal.textContent = String(brawldexStats.unlocks);
    hyperchargeTotal.textContent = String(brawldexStats.hypercharges);
    skinOwned.textContent = String(skinStats.owned);
    skinTotal.textContent = `/ ${skinStats.total}`;
    skinProgressBar.style.width = `${skinStats.pct}%`;

    const mainText = profile.mainBrawler ? `Main: ${profile.mainBrawler}.` : "Choisis ton main brawler.";
    const syncedText = profile.playerName
      ? `Compte sync: ${profile.playerName} avec ${profile.trophies} trophees.`
      : livePublicProfile?.is_public
        ? "Profil public pret pour le partage."
        : "Profil local pret a etre complete et publie.";
    collectionSummary.textContent = `${mainText} ${syncedText} ${brawldexStats.owned} brawler(s), ${brawldexStats.unlocks} unlocks et ${skinStats.owned} skin(s) coches.`;

    renderBadgesAndGoals(brawldexStats, skinStats);
    renderTopBrawlers();
    renderActivity();
    renderSourceStatus();
    renderWorkflowFocus();
    renderSyncedPlayer(profile);
    renderPublicProfileState();
  }

  function savePersonalProfile() {
    Brawldex.updateProfile(viewerKey(), {
      playerTag: playerTag.value,
      club: club.value,
      favoriteMode: favoriteMode.value,
      mainBrawler: mainBrawler.value,
      goal: goal.value
    });
    setProfileStatus("Profil perso enregistre localement.");
    toast("success", "Profil", "Profil perso enregistre.");
    renderDashboard();
  }

  async function syncPlayerProfile() {
    if (!brawlApiEnabled) {
      setPlayerApiStatus("La synchro live est mise de cote pour l'instant. On avance uniquement avec Supabase.");
      toast("info", "Synchro live", "La synchro Brawl Stars API est en pause pour le moment.");
      return;
    }

    if (!PlayerApi) {
      setPlayerApiStatus("Le client Brawl Stars API est introuvable.");
      return;
    }

    const tag = PlayerApi.normalizeTag((apiPlayerTag?.value || playerTag.value || "").trim());
    if (!tag) {
      setPlayerApiStatus("Entre un tag joueur valide.");
      toast("error", "API Brawl Stars", "Entre un tag joueur valide.");
      return;
    }

    setPlayerApiStatus("Synchronisation du profil Brawl Stars...");

    try {
      const payload = await PlayerApi.fetchPlayerProfile(tag);
      Brawldex.updateProfile(viewerKey(), {
        playerTag: payload.tag || tag,
        playerName: payload.name || "",
        club: payload.club?.name || club.value || "",
        apiClubName: payload.club?.name || "",
        apiClubTag: payload.club?.tag || "",
        apiFavoriteBrawler: payload.favoriteBrawler || "",
        apiSyncedAt: payload.syncedAt || new Date().toISOString(),
        trophies: payload.trophies || 0,
        highestTrophies: payload.highestTrophies || 0,
        expLevel: payload.expLevel || 0,
        victories3v3: payload.victories3v3 || 0,
        soloVictories: payload.soloVictories || 0,
        duoVictories: payload.duoVictories || 0,
        brawlersCount: payload.brawlersCount || 0
      });

      playerTag.value = payload.tag || tag;
      if (payload.club?.name) club.value = payload.club.name;
      setPlayerApiStatus(`Profil synchronise pour ${payload.name || tag}.`);
      toast("success", "API Brawl Stars", "Profil officiel synchronise.");
      renderPersonalProfile();
      renderDashboard();
    } catch (error) {
      setPlayerApiStatus(error.message || String(error));
      toast("error", "API Brawl Stars", error.message || String(error));
    }
  }

  function clearPlayerSync() {
    clearSyncedPlayerProfile();
    setPlayerApiStatus(
      !brawlApiEnabled
        ? "Ancienne synchro effacee. Ton espace fonctionne maintenant uniquement avec Supabase."
        : playerApiHealth.configured === false
          ? playerApiHealth.message
          : "Synchronisation Brawl Stars effacee."
    );
    toast("info", "Synchro live", "Les donnees synchronisees ont ete supprimees.");
    renderPersonalProfile();
    renderDashboard();
  }

  async function loadPublicProfile() {
    if (!currentUser) return;
    setPublicStatus("Chargement du profil public...");
    try {
      const [data, publishedIds] = await Promise.all([
        PublicProfiles.loadProfile(currentUser.id),
        PublicProfiles.loadOwned(currentUser.id).catch(() => [])
      ]);
      publicDisplayName.value = data?.display_name ?? ((currentUser.email || "").split("@")[0] || "");
      publicBio.value = data?.bio ?? "";
      publicIsPublic.checked = data?.is_public ?? true;
      publicShowOwned.checked = data?.show_owned ?? true;
      syncLivePublicProfile(data);
      livePublicOwnedIds = uniqueIds(publishedIds);
      setPublicStatus("Profil public charge.");
    } catch (error) {
      syncLivePublicProfile(null);
      livePublicOwnedIds = [];
      setPublicStatus(error.message || String(error));
    }
    renderPublicProfileState();
  }

  async function savePublicProfile() {
    if (!currentUser) return false;
    setPublicStatus("Enregistrement du profil public...");
    try {
      const payload = normalizePublicDraft();
      await PublicProfiles.saveProfile(
        currentUser.id,
        payload,
        {
          fallbackDisplayName: fallbackPublicDisplayName()
        }
      );
      syncLivePublicProfile({
        user_id: currentUser.id,
        updated_at: new Date().toISOString(),
        ...payload
      });
      renderPublicProfileState();
      setPublicStatus("Profil public enregistre.");
      toast("success", "Profil public", "Profil public enregistre.");
      return true;
    } catch (error) {
      setPublicStatus(error.message || String(error));
      toast("error", "Profil public", error.message || String(error));
      return false;
    }
  }

  async function publishOwned() {
    if (!currentUser) return;
    setPublicStatus("Publication de tes skins...");
    try {
      const saved = await savePublicProfile();
      if (!saved) return;
      setPublicStatus("Publication de tes skins...");
      const result = await PublicProfiles.publishOwned(currentUser.id, [...ownedSet]);
      if (!result.publishedCount) {
        livePublicOwnedIds = [];
        renderPublicProfileState();
        setPublicStatus("Aucun skin coche: la liste publique a ete videe.");
        toast("success", "Publication", "Liste publique videe.");
        return;
      }

      livePublicOwnedIds = uniqueIds([...ownedSet]);
      renderPublicProfileState();
      setPublicStatus(`${result.publishedCount} skin(s) publies.`);
      toast("success", "Publication", `${result.publishedCount} skin(s) publies.`);
    } catch (error) {
      setPublicStatus(error.message || String(error));
      toast("error", "Publication", error.message || String(error));
    }
  }

  function openPublicProfile() {
    if (!currentUser) return;
    if (!livePublicProfile?.is_public) {
      setPublicStatus("Rends le profil public puis enregistre pour ouvrir le lien.");
      return;
    }
    window.open(publicProfileUrl(currentUser.id), "_blank");
  }

  async function copyPublicLink() {
    if (!currentUser) return;
    if (!livePublicProfile?.is_public) {
      setPublicStatus("Aucun lien actif tant que le profil reste prive.");
      return;
    }
    try {
      await navigator.clipboard.writeText(publicProfileUrl(currentUser.id));
      setPublicStatus("Lien public copie.");
      toast("success", "Lien", "Lien public copie.");
    } catch {
      setPublicStatus("Copie impossible. Copie l'URL manuellement.");
    }
  }

  function downloadJson(filename, payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function refreshAll() {
    if (!currentUser) return;
    await loadOwned();
    renderPersonalProfile();
    await loadPublicProfile();
    renderSkins();
    renderDashboard();
  }

  function wireActions() {
    btnSignup.addEventListener("click", signup);
    btnLogin.addEventListener("click", login);
    btnResend.addEventListener("click", resendConfirmationEmail);
    btnLogout.addEventListener("click", logout);
    btnReload.addEventListener("click", refreshAll);
    btnSavePersonal.addEventListener("click", savePersonalProfile);
    btnSavePublic.addEventListener("click", savePublicProfile);
    btnPublishOwned.addEventListener("click", publishOwned);
    btnOpenPublic.addEventListener("click", openPublicProfile);
    btnCopyPublic.addEventListener("click", copyPublicLink);
    publicDisplayName.addEventListener("input", renderPublicProfileState);
    publicBio.addEventListener("input", renderPublicProfileState);
    publicIsPublic.addEventListener("change", renderPublicProfileState);
    publicShowOwned.addEventListener("change", renderPublicProfileState);
    if (btnSyncPlayer) btnSyncPlayer.addEventListener("click", syncPlayerProfile);
    if (btnClearPlayerSync) btnClearPlayerSync.addEventListener("click", clearPlayerSync);

    search.addEventListener("input", renderSkins);
    filterBrawler.addEventListener("change", renderSkins);
    filterRarity.addEventListener("change", renderSkins);
    onlyOwned.addEventListener("change", renderSkins);
    if (apiPlayerTag) {
      apiPlayerTag.addEventListener("keydown", (event) => {
        if (event.key === "Enter") syncPlayerProfile();
      });
    }

    btnExport.addEventListener("click", () => {
      downloadJson(`brawldex-${viewerKey()}.json`, Brawldex.exportState(viewerKey()));
      toast("success", "Export", "Brawldex exporte.");
    });

    importFile.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        Brawldex.importState(viewerKey(), JSON.parse(text));
        renderPersonalProfile();
        renderDashboard();
        toast("success", "Import", "Brawldex importe.");
      } catch (error) {
        toast("error", "Import", error.message || "Import impossible.");
      } finally {
        importFile.value = "";
      }
    });

    btnReset.addEventListener("click", () => {
      const ok = window.confirm("Reinitialiser ton Brawldex local ?");
      if (!ok) return;
      Brawldex.resetState(viewerKey());
      renderPersonalProfile();
      renderDashboard();
      toast("info", "Reset", "Brawldex reinitialise.");
    });

    window.addEventListener("brawldex:changed", (event) => {
      if (event.detail?.userId !== viewerKey()) return;
      renderPersonalProfile();
      renderDashboard();
    });

    renderPublicProfileState();
  }

  (async () => {
    wireActions();

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

    SKINS = Array.isArray(window.SKINS) ? window.SKINS : [];
    buildSkinFilters();
    fillMainBrawlerOptions();
    renderSourceStatus();
    updatePlayerApiControls();
    await refreshPlayerApiHealth();

    const { data } = await supa.auth.getSession();
    const user = data.session?.user ?? null;
    if (user) {
      showLoggedIn(user);
      await refreshAll();
    } else {
      showLoggedOut();
    }

    supa.auth.onAuthStateChange(async (_event, session) => {
      const nextUser = session?.user ?? null;
      if (nextUser) {
        showLoggedIn(nextUser);
        await refreshAll();
      } else {
        showLoggedOut();
      }
    });
  })();
})();

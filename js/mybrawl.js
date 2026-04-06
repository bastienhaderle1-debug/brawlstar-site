(function () {
  const supa = window.AppGuard?.requireSupabase("mybrawl");
  if (!supa) return;

  const OwnedService = window.OwnedService;
  const Brawldex = window.BrawldexService;
  const PublicProfiles = window.PublicProfileService;

  if (!OwnedService || !Brawldex || !PublicProfiles) {
    window.AppGuard?.fail(
      "Services introuvables. Verifie owned-service.js, brawldex-service.js et public-profile-service.js.",
      "mybrawl"
    );
    return;
  }

  const $ = (id) => document.getElementById(id);

  const authCard = $("authCard");
  const app = $("app");
  const authMsg = $("authMsg");
  const email = $("email");
  const password = $("password");
  const btnLogin = $("btnLogin");
  const btnSignup = $("btnSignup");
  const btnResend = $("btnResend");
  const btnLogout = $("btnLogout");
  const btnReload = $("btnReload");
  const btnExport = $("btnExport");
  const btnReset = $("btnReset");
  const importFile = $("importFile");
  const globalAuthBadge = $("globalAuthBadge");

  const userLine = $("userLine");
  const collectionSummary = $("collectionSummary");
  const status = $("status");
  const profileStatus = $("profileStatus");
  const publicStatus = $("publicStatus");
  const dataSourceLabel = $("dataSourceLabel");
  const dataSourceMessage = $("dataSourceMessage");

  const playerTag = $("playerTag");
  const club = $("club");
  const favoriteMode = $("favoriteMode");
  const mainBrawler = $("mainBrawler");
  const goal = $("goal");
  const btnSavePersonal = $("btnSavePersonal");

  const publicDisplayName = $("publicDisplayName");
  const publicClub = $("publicClub");
  const publicFriendCode = $("publicFriendCode");
  const publicTrophies = $("publicTrophies");
  const publicBio = $("publicBio");
  const btnSavePublic = $("btnSavePublic");
  const btnPublishOwned = $("btnPublishOwned");
  const btnOpenPublic = $("btnOpenPublic");
  const btnCopyPublic = $("btnCopyPublic");
  const publicLiveState = $("publicLiveState");
  const publicDraftState = $("publicDraftState");
  const publicCollectionState = $("publicCollectionState");
  const publicCollectionDetail = $("publicCollectionDetail");
  const publicLinkState = $("publicLinkState");
  const publicLinkDetail = $("publicLinkDetail");

  const dashboardFocusMessage = $("dashboardFocusMessage");
  const dashboardStepAuth = $("dashboardStepAuth");
  const dashboardStepCollection = $("dashboardStepCollection");
  const dashboardStepPublic = $("dashboardStepPublic");

  const globalProgressPct = $("globalProgressPct");
  const brawlerProgressPct = $("brawlerProgressPct");
  const skinsProgressPct = $("skinsProgressPct");
  const fullBrawlersCount = $("fullBrawlersCount");
  const missingCoinsTotal = $("missingCoinsTotal");
  const missingPowerPointsTotal = $("missingPowerPointsTotal");
  const gameProgressBar = $("gameProgressBar");
  const publicProfileHeadline = $("publicProfileHeadline");
  const badgeCloud = $("badgeCloud");
  const collectionHighlights = $("collectionHighlights");
  const topBrawlers = $("topBrawlers");
  const activityFeed = $("activityFeed");
  const skinQuickSummary = $("skinQuickSummary");
  const skinRarityCloud = $("skinRarityCloud");
  const skinQuickHighlights = $("skinQuickHighlights");

  let currentUser = null;
  let authBusy = false;
  let ownedSet = new Set();
  let livePublicProfile = null;
  let livePublicOwnedIds = [];

  function viewerKey() {
    return currentUser?.id || "visitor";
  }

  function safeStr(value) {
    return (value ?? "").toString().trim();
  }

  function escapeHtml(value) {
    return safeStr(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("fr-FR").format(Number(value) || 0);
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

  function getSourceStatus() {
    return window.SKINS_SOURCE_STATUS || {
      label: "Proxy serveur",
      message: "Le catalogue passe par le proxy serveur avec fallback local."
    };
  }

  function toast(type, title, message) {
    if (window.showToast) window.showToast(message, type, title, 3200);
  }

  function setAuthMessage(message) {
    if (authMsg) authMsg.textContent = message || "";
  }

  function setStatus(message) {
    if (status) status.textContent = message || "";
  }

  function setProfileStatus(message) {
    if (profileStatus) profileStatus.textContent = message || "";
  }

  function setPublicStatus(message) {
    if (publicStatus) publicStatus.textContent = message || "";
  }

  function renderAuthBadge(user) {
    if (!globalAuthBadge) return;
    globalAuthBadge.classList.remove("ok", "ko");
    globalAuthBadge.classList.add(user ? "ok" : "ko");
    const label = globalAuthBadge.querySelector("span:last-child");
    if (label) label.textContent = user ? "Connecte" : "Non connecte";
  }

  function renderSourceStatus() {
    const source = getSourceStatus();
    if (dataSourceLabel) dataSourceLabel.textContent = source.label || "Proxy serveur";
    if (dataSourceMessage) dataSourceMessage.textContent = source.message || "Le catalogue passe par le proxy serveur.";
  }

  function authRedirectUrl() {
    return new URL("/pages/mybrawl.html", window.location.origin).toString();
  }

  function fallbackPublicDisplayName() {
    return safeStr((currentUser?.email || "").split("@")[0]) || "Profil";
  }

  function buildProgressSnapshot(stats, skinStats, global) {
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

  function normalizePublicDraft(source) {
    const stats = Brawldex.getStats(viewerKey());
    const skinStats = OwnedService.computeOwnedStats(ownedSet);
    const global = Brawldex.getGlobalProgress(viewerKey(), skinStats);

    return {
      display_name: safeStr(source?.display_name ?? publicDisplayName?.value) || fallbackPublicDisplayName(),
      bio: safeStr(source?.bio ?? publicBio?.value),
      club_name: safeStr(source?.club_name ?? publicClub?.value),
      friend_code: safeStr(source?.friend_code ?? publicFriendCode?.value),
      trophies: Math.max(0, Number(source?.trophies ?? publicTrophies?.value) || 0),
      is_public: true,
      show_owned: true,
      progress_snapshot: source?.progress_snapshot || buildProgressSnapshot(stats, skinStats, global)
    };
  }

  function samePublicDraft(left, right) {
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

  function syncLivePublicProfile(profile) {
    livePublicProfile = profile ? { ...profile } : null;
  }

  function fillMainBrawlerOptions() {
    if (!mainBrawler) return;
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

  function showLoggedIn(user) {
    currentUser = user;
    if (authCard) authCard.style.display = "none";
    if (app) app.style.display = "";
    if (userLine) userLine.textContent = user.email || user.id;
    renderAuthBadge(user);
  }

  function showLoggedOut() {
    currentUser = null;
    ownedSet = new Set();
    livePublicProfile = null;
    livePublicOwnedIds = [];
    if (authCard) authCard.style.display = "";
    if (app) app.style.display = "none";
    renderAuthBadge(null);
    setAuthMessage("");
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
    if (btnLogin) btnLogin.disabled = authBusy;
    if (btnSignup) btnSignup.disabled = authBusy;
    if (btnResend) btnResend.disabled = authBusy;
    if (message !== undefined) setAuthMessage(message);
  }

  async function signup() {
    const em = safeStr(email?.value);
    const pw = safeStr(password?.value);
    if (!em || !pw) {
      setAuthMessage("Entre un email et un mot de passe.");
      return;
    }

    setAuthBusyState(true, "Creation du compte...");
    try {
      const { error } = await supa.auth.signUp({
        email: em,
        password: pw,
        options: {
          emailRedirectTo: authRedirectUrl()
        }
      });

      if (error) throw error;
      setAuthBusyState(false, "Compte cree. Verifie ton email pour confirmer l'inscription.");
      toast("success", "Inscription", "Compte cree. Verifie ton email.");
    } catch (error) {
      const normalized = normalizeAuthError(error);
      setAuthBusyState(false, normalized.message);
      toast("error", normalized.title, normalized.message);
    }
  }

  async function resendConfirmationEmail() {
    const em = safeStr(email?.value);
    if (!em) {
      setAuthMessage("Entre ton email pour renvoyer la confirmation.");
      return;
    }

    setAuthBusyState(true, "Envoi de l'email...");
    try {
      const { error } = await supa.auth.resend({
        type: "signup",
        email: em,
        options: {
          emailRedirectTo: authRedirectUrl()
        }
      });
      if (error) throw error;
      setAuthBusyState(false, "Email de confirmation renvoye.");
      toast("success", "Email", "Email de confirmation renvoye.");
    } catch (error) {
      const normalized = normalizeAuthError(error);
      setAuthBusyState(false, normalized.message);
      toast("error", normalized.title, normalized.message);
    }
  }

  async function login() {
    const em = safeStr(email?.value);
    const pw = safeStr(password?.value);
    if (!em || !pw) {
      setAuthMessage("Entre ton email et ton mot de passe.");
      return;
    }

    setAuthBusyState(true, "Connexion...");
    try {
      const { data, error } = await supa.auth.signInWithPassword({ email: em, password: pw });
      if (error) throw error;
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
      ownedSet = new Set();
    }
  }

  function renderPersonalProfile() {
    fillMainBrawlerOptions();
    const profile = Brawldex.getProfile(viewerKey());
    if (playerTag) playerTag.value = profile.playerTag || "";
    if (club) club.value = profile.club || "";
    if (favoriteMode) favoriteMode.value = profile.favoriteMode || "";
    if (mainBrawler) mainBrawler.value = profile.mainBrawler || "";
    if (goal) goal.value = profile.goal || "";
  }

  function savePersonalProfile() {
    Brawldex.updateProfile(viewerKey(), {
      playerTag: playerTag?.value || "",
      club: club?.value || "",
      favoriteMode: favoriteMode?.value || "",
      mainBrawler: mainBrawler?.value || "",
      goal: goal?.value || ""
    });
    setProfileStatus("Profil joueur local enregistre.");
    toast("success", "Profil local", "Profil joueur local enregistre.");
    renderDashboard();
  }

  function paintStep(node, text, state) {
    if (!node) return;
    node.textContent = text;
    node.dataset.state = state || "idle";
  }

  function renderWorkflowFocus(stats, skinStats) {
    const localOwnedIds = [...ownedSet];
    const hasLiveProfile = !!livePublicProfile;
    const isPublic = !!livePublicProfile?.is_public;
    const needsPublish = !sameIdSet(localOwnedIds, livePublicOwnedIds);

    let focusMessage = "Connecte-toi pour commencer a construire ton espace.";
    if (currentUser) {
      if (!stats.owned) {
        focusMessage = "Commence par remplir la page Brawlers pour poser la base de ta progression.";
      } else if (!hasLiveProfile) {
        focusMessage = "Ton compte est pret : enregistre maintenant ta fiche publique pour creer ton lien.";
      } else if (!isPublic) {
        focusMessage = "Ton profil existe deja. Enregistre-le a nouveau pour reappliquer la publication par defaut.";
      } else if (needsPublish) {
        focusMessage = "Tes skins locaux ont change : republie la collection pour aligner la version en ligne.";
      } else if (stats.incompleteOwned > 0) {
        focusMessage = "Ton profil est propre. La meilleure prochaine action est de terminer tes Brawlers incomplets.";
      } else {
        focusMessage = "Tout est bien aligne : progression, profil public et collection partageable.";
      }
    }

    if (dashboardFocusMessage) dashboardFocusMessage.textContent = focusMessage;

    paintStep(dashboardStepAuth, currentUser ? "Actif" : "A connecter", currentUser ? "done" : "next");

    if (!currentUser) {
      paintStep(dashboardStepCollection, "En attente", "idle");
      paintStep(dashboardStepPublic, "En attente", "idle");
      return;
    }

    if (!stats.owned) paintStep(dashboardStepCollection, "A remplir", "next");
    else if (stats.incompleteOwned > 0 || !skinStats.owned) paintStep(dashboardStepCollection, "En cours", "next");
    else paintStep(dashboardStepCollection, "A jour", "done");

    if (!hasLiveProfile) paintStep(dashboardStepPublic, "Brouillon", "next");
    else if (!isPublic) paintStep(dashboardStepPublic, "Prive", "next");
    else if (needsPublish) paintStep(dashboardStepPublic, "A finaliser", "next");
    else paintStep(dashboardStepPublic, "Partage OK", "done");
  }

  function renderPublicProfileState() {
    const draft = normalizePublicDraft();
    const live = livePublicProfile ? { ...livePublicProfile } : null;
    const localOwnedIds = [...ownedSet];
    const localCount = localOwnedIds.length;
    const publishedCount = livePublicOwnedIds.length;
    const hasLiveProfile = !!livePublicProfile;
    const liveIsPublic = !!livePublicProfile?.is_public;
    const draftDirty = !live || !samePublicDraft(draft, live);
    const needsPublish = !sameIdSet(localOwnedIds, livePublicOwnedIds);
    const canShare = !!currentUser && liveIsPublic;

    if (publicLiveState) {
      if (!hasLiveProfile) publicLiveState.textContent = "Brouillon";
      else if (liveIsPublic) publicLiveState.textContent = "Public";
      else publicLiveState.textContent = "Prive";
    }

    if (publicDraftState) {
      if (!hasLiveProfile) publicDraftState.textContent = "Enregistre une premiere fois pour creer ta fiche publique.";
      else if (draftDirty) publicDraftState.textContent = "Des changements locaux n'ont pas encore ete sauvegardes.";
      else if (liveIsPublic) publicDraftState.textContent = "Ton profil public est aligne avec le formulaire.";
      else publicDraftState.textContent = "Reenregistre ton profil pour reappliquer le mode public par defaut.";
    }

    if (publicCollectionState) publicCollectionState.textContent = `${publishedCount} / ${localCount}`;

    if (publicCollectionDetail) {
      if (!localCount && !publishedCount) publicCollectionDetail.textContent = "Aucun skin coche pour l'instant.";
      else if (needsPublish && !localCount) publicCollectionDetail.textContent = "Ta collection publique sera vide apres republication.";
      else if (needsPublish) publicCollectionDetail.textContent = `Local: ${localCount} skin(s). Republie pour aligner la version publique.`;
      else if (!publishedCount) publicCollectionDetail.textContent = "Aucune collection publique pour l'instant.";
      else publicCollectionDetail.textContent = `${publishedCount} skins sont visibles et prets pour la comparaison.`;
    }

    if (publicLinkState) {
      if (!hasLiveProfile) publicLinkState.textContent = "Inactif";
      else if (!liveIsPublic) publicLinkState.textContent = "Prive";
      else publicLinkState.textContent = "Comparaison OK";
    }

    if (publicLinkDetail) {
      if (!hasLiveProfile) publicLinkDetail.textContent = "Le lien sera pret apres le premier enregistrement.";
      else if (!liveIsPublic) publicLinkDetail.textContent = "Enregistre a nouveau ton profil pour activer le lien public.";
      else publicLinkDetail.textContent = "Lien actif et comparaison possible depuis la page publique.";
    }

    if (btnSavePublic) btnSavePublic.classList.toggle("is-active", draftDirty);
    if (btnPublishOwned) btnPublishOwned.classList.toggle("is-active", needsPublish);
    if (btnOpenPublic) btnOpenPublic.disabled = !canShare;
    if (btnCopyPublic) btnCopyPublic.disabled = !canShare;
  }

  function renderActivity() {
    if (!activityFeed) return;
    const activity = Brawldex.getActivity(viewerKey(), 8);
    activityFeed.innerHTML = "";

    if (!activity.length) {
      activityFeed.innerHTML = `
        <div class="list-card">
          <h3>Aucune activite</h3>
          <p class="muted">Commence par modifier tes Brawlers ou ton profil pour creer une timeline.</p>
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
            <p class="muted">${escapeHtml(item.detail || "Mise a jour de ton espace Brawldex.")}</p>
          </div>
          <span class="pill">${new Date(item.ts).toLocaleDateString("fr-FR")}</span>
        </div>
      `;
      activityFeed.appendChild(node);
    });
  }

  function renderBadgesAndGoals(stats, skinStats, global) {
    const insights = Brawldex.getInsights(viewerKey());
    const profile = Brawldex.getProfile(viewerKey());

    if (badgeCloud) {
      badgeCloud.innerHTML = "";
      const tags = insights.badges.length
        ? insights.badges
        : [{ label: "Premier cap", detail: "Commence a remplir ta progression." }];

      tags.forEach((item) => {
        const badge = document.createElement("span");
        badge.className = "pill";
        badge.textContent = item.label;
        badge.title = item.detail;
        badgeCloud.appendChild(badge);
      });
    }

    if (collectionHighlights) {
      collectionHighlights.innerHTML = "";
      [
        `${global.globalPct}% de progression globale du jeu avec ${stats.completionPct}% cote Brawlers et ${skinStats.pct}% cote skins.`,
        `${stats.owned}/${stats.total} Brawlers possedes, dont ${stats.full} deja full et ${stats.incompleteOwned} encore a terminer.`,
        `${formatNumber(stats.missingCoins)} pieces et ${formatNumber(stats.missingPowerPoints)} PP restent necessaires pour tout full.`,
        profile.mainBrawler ? `Main actuel : ${profile.mainBrawler}.` : "Ajoute ton main Brawler pour personnaliser davantage ton espace.",
        profile.goal || insights.recommendations[0] || "Ajoute un objectif du moment pour garder un cap clair."
      ].forEach((line) => {
        const p = document.createElement("p");
        p.className = "muted";
        p.textContent = line;
        collectionHighlights.appendChild(p);
      });
    }
  }

  function renderTopBrawlers() {
    if (!topBrawlers) return;
    const top = Brawldex.getTopBrawlers(viewerKey(), 5);
    topBrawlers.innerHTML = "";

    if (!top.length) {
      topBrawlers.innerHTML = `
        <div class="list-card">
          <h3>Aucun Brawler renseigne</h3>
          <p class="muted">Va sur la page Brawlers pour remplir ta collection et voir ton top apparaitre ici.</p>
        </div>
      `;
      return;
    }

    top.forEach(({ meta, entry }) => {
      const progress = Brawldex.getProgress(meta, entry);
      const node = document.createElement("article");
      node.className = "list-card";
      node.innerHTML = `
        <div class="list-head">
          <div>
            <h3>${escapeHtml(meta.name)}</h3>
            <p class="muted">${escapeHtml(meta.role)} - ${escapeHtml(meta.rarity)}</p>
          </div>
          <span class="pill">${progress.completion.pct}%</span>
        </div>
        <p class="muted">Niveau ${entry.powerLevel} - ${entry.trophies} troph. - ${entry.hypercharge ? "Hypercharge active" : "Sans hypercharge"}</p>
      `;
      topBrawlers.appendChild(node);
    });
  }

  function renderSkinQuickView(skinStats) {
    if (skinQuickSummary) {
      skinQuickSummary.textContent =
        `${skinStats.owned}/${skinStats.total} skins coches, soit ${skinStats.pct}% de progression cosmetique. ` +
        `Le detail complet reste sur la page Catalogue skins.`;
    }

    if (skinRarityCloud) {
      skinRarityCloud.innerHTML = "";
      Object.entries(skinStats.byRarity || {})
        .filter(([, count]) => count > 0)
        .forEach(([rarity, count]) => {
          const pill = document.createElement("span");
          pill.className = "pill";
          pill.textContent = `${rarity}: ${count}`;
          skinRarityCloud.appendChild(pill);
        });

      if (!skinRarityCloud.children.length) {
        const pill = document.createElement("span");
        pill.className = "pill";
        pill.textContent = "Aucun skin coche";
        skinRarityCloud.appendChild(pill);
      }
    }

    if (skinQuickHighlights) {
      skinQuickHighlights.innerHTML = "";
      const rarityEntries = Object.entries(skinStats.byRarity || {})
        .filter(([, count]) => count > 0)
        .sort((a, b) => b[1] - a[1]);
      const topRarity = rarityEntries[0] ? `${rarityEntries[0][0]} (${rarityEntries[0][1]})` : "Aucune rarete dominante";

      [
        `${skinStats.owned} skin(s) coches au total sur ${skinStats.total}.`,
        `Rarete la plus representee : ${topRarity}.`,
        "Utilise le Catalogue skins pour filtrer par Brawler, theme ou rarete."
      ].forEach((line) => {
        const p = document.createElement("p");
        p.className = "muted";
        p.textContent = line;
        skinQuickHighlights.appendChild(p);
      });
    }
  }

  function renderDashboard() {
    const stats = Brawldex.getStats(viewerKey());
    const skinStats = OwnedService.computeOwnedStats(ownedSet);
    const global = Brawldex.getGlobalProgress(viewerKey(), skinStats);
    const profile = Brawldex.getProfile(viewerKey());

    if (globalProgressPct) globalProgressPct.textContent = `${global.globalPct}%`;
    if (brawlerProgressPct) brawlerProgressPct.textContent = `${stats.completionPct}%`;
    if (skinsProgressPct) skinsProgressPct.textContent = `${skinStats.pct}%`;
    if (fullBrawlersCount) fullBrawlersCount.textContent = String(stats.full);
    if (missingCoinsTotal) missingCoinsTotal.textContent = formatNumber(stats.missingCoins);
    if (missingPowerPointsTotal) missingPowerPointsTotal.textContent = formatNumber(stats.missingPowerPoints);
    if (gameProgressBar) gameProgressBar.style.width = `${global.globalPct}%`;

    if (collectionSummary) {
      collectionSummary.textContent =
        `${global.globalPct}% de progression globale. ${stats.owned}/${stats.total} Brawlers, ` +
        `${skinStats.owned}/${skinStats.total} skins, ${formatNumber(stats.missingCoins)} pieces et ` +
        `${formatNumber(stats.missingPowerPoints)} PP encore necessaires pour arriver au full.`;
    }

    if (publicProfileHeadline) {
      const draft = normalizePublicDraft();
      publicProfileHeadline.textContent =
        `${draft.display_name || fallbackPublicDisplayName()} peut afficher ${global.globalPct}% de progression jeu, ` +
        `${stats.completionPct}% cote Brawlers et ${skinStats.pct}% cote skins.`;
    }

    renderSourceStatus();
    renderWorkflowFocus(stats, skinStats);
    renderBadgesAndGoals(stats, skinStats, global);
    renderTopBrawlers();
    renderActivity();
    renderSkinQuickView(skinStats);
    renderPublicProfileState();

    const mainLine = profile.mainBrawler ? `Main: ${profile.mainBrawler}. ` : "";
    const syncLine = profile.playerName
      ? `Profil sync connu: ${profile.playerName} avec ${formatNumber(profile.trophies)} trophees.`
      : currentUser
        ? "Ton espace prive est pret a etre complete et partage."
        : "Connecte-toi pour sauvegarder tes skins et ton profil public.";
    setStatus(`${mainLine}${syncLine}`);
  }

  async function loadPublicProfile() {
    if (!currentUser) return;
    setPublicStatus("Chargement du profil public...");
    try {
      const profile = Brawldex.getProfile(viewerKey());
      const [data, publishedIds] = await Promise.all([
        PublicProfiles.loadProfile(currentUser.id),
        PublicProfiles.loadOwned(currentUser.id).catch(() => [])
      ]);

      if (publicDisplayName) publicDisplayName.value = data?.display_name ?? fallbackPublicDisplayName();
      if (publicClub) publicClub.value = data?.club_name ?? profile.club ?? "";
      if (publicFriendCode) publicFriendCode.value = data?.friend_code ?? "";
      if (publicTrophies) publicTrophies.value = String(data?.trophies ?? profile.trophies ?? 0);
      if (publicBio) publicBio.value = data?.bio ?? "";

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
      await PublicProfiles.saveProfile(currentUser.id, payload, {
        fallbackDisplayName: fallbackPublicDisplayName()
      });

      syncLivePublicProfile({
        user_id: currentUser.id,
        updated_at: new Date().toISOString(),
        ...payload
      });
      renderPublicProfileState();
      renderDashboard();
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

      const result = await PublicProfiles.publishOwned(currentUser.id, [...ownedSet]);
      livePublicOwnedIds = result.publishedCount ? uniqueIds([...ownedSet]) : [];
      renderPublicProfileState();
      renderDashboard();

      if (!result.publishedCount) {
        setPublicStatus("Aucun skin coche: la liste publique a ete videe.");
        toast("success", "Publication", "Liste publique videe.");
        return;
      }

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
      setPublicStatus("Enregistre a nouveau ton profil pour activer le lien public.");
      return;
    }
    window.open(publicProfileUrl(currentUser.id), "_blank");
  }

  async function copyPublicLink() {
    if (!currentUser) return;
    if (!livePublicProfile?.is_public) {
      setPublicStatus("Enregistre ton profil pour activer le lien public.");
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
    renderDashboard();
  }

  function wireActions() {
    if (btnSignup) btnSignup.addEventListener("click", signup);
    if (btnLogin) btnLogin.addEventListener("click", login);
    if (btnResend) btnResend.addEventListener("click", resendConfirmationEmail);
    if (btnLogout) btnLogout.addEventListener("click", logout);
    if (btnReload) btnReload.addEventListener("click", refreshAll);
    if (btnSavePersonal) btnSavePersonal.addEventListener("click", savePersonalProfile);
    if (btnSavePublic) btnSavePublic.addEventListener("click", savePublicProfile);
    if (btnPublishOwned) btnPublishOwned.addEventListener("click", publishOwned);
    if (btnOpenPublic) btnOpenPublic.addEventListener("click", openPublicProfile);
    if (btnCopyPublic) btnCopyPublic.addEventListener("click", copyPublicLink);

    [publicDisplayName, publicClub, publicFriendCode, publicTrophies, publicBio].forEach((field) => {
      if (field) field.addEventListener("input", () => {
        renderPublicProfileState();
        renderDashboard();
      });
    });

    if (btnExport) {
      btnExport.addEventListener("click", () => {
        downloadJson(`brawldex-${viewerKey()}.json`, Brawldex.exportState(viewerKey()));
        toast("success", "Export", "Brawldex exporte.");
      });
    }

    if (importFile) {
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
    }

    if (btnReset) {
      btnReset.addEventListener("click", () => {
        const ok = window.confirm("Reinitialiser ton Brawldex local ?");
        if (!ok) return;
        Brawldex.resetState(viewerKey());
        renderPersonalProfile();
        renderDashboard();
        toast("info", "Reset", "Brawldex reinitialise.");
      });
    }

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

    fillMainBrawlerOptions();
    renderSourceStatus();

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

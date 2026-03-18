(function () {
  const supa = window.AppGuard?.requireSupabase("mybrawl");
  if (!supa) return;

  if (!window.OwnedService || !window.BrawldexService) {
    window.AppGuard?.fail(
      "Services de collection introuvables. Verifie owned-service.js et brawldex-service.js.",
      "mybrawl"
    );
    return;
  }

  const OwnedService = window.OwnedService;
  const Brawldex = window.BrawldexService;
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

  const userLine = document.getElementById("userLine");
  const collectionSummary = document.getElementById("collectionSummary");
  const status = document.getElementById("status");
  const profileStatus = document.getElementById("profileStatus");
  const publicStatus = document.getElementById("publicStatus");

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

  function viewerKey() {
    return currentUser?.id || "visitor";
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

  function showLoggedIn(user) {
    currentUser = user;
    authCard.style.display = "none";
    app.style.display = "block";
    userLine.textContent = user.email ?? user.id;
  }

  function showLoggedOut() {
    currentUser = null;
    ownedSet = new Set();
    authCard.style.display = "block";
    app.style.display = "none";
    setAuthMessage("");
    setStatus("");
    setProfileStatus("");
    setPublicStatus("");
    setAuthBusyState(false, "");
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
        options: { emailRedirectTo: "https://brawlstar-site.vercel.app/pages/mybrawl.html" }
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
        options: { emailRedirectTo: "https://brawlstar-site.vercel.app/pages/mybrawl.html" }
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
  }

  async function setOwned(skinId, isOwned) {
    if (!currentUser) return;

    try {
      await OwnedService.setOwned(currentUser.id, skinId, isOwned);
      if (isOwned) ownedSet.add(skinId);
      else ownedSet.delete(skinId);
      renderSkins();
      renderDashboard();
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
          <span class="pill">${skin.category ?? "-"}</span>
          <span class="pill ${RARITY_CLASS[skin.rarity] ?? ""}">${skin.rarity ?? "-"}</span>
        </div>
        <h3>${skin.name}</h3>
        <p class="muted">Brawler : <strong>${skin.brawler ?? "-"}</strong></p>
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
            <h3>${item.title}</h3>
            <p class="muted">${item.detail || "Mise a jour de ton Brawldex."}</p>
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
            <h3>${meta.name}</h3>
            <p class="muted">${meta.role} • ${meta.rarity}</p>
          </div>
          <span class="pill">${entry.trophies} troph.</span>
        </div>
        <p class="muted">Puissance ${entry.powerLevel} • Mastery ${entry.mastery} • ${entry.hypercharge ? "Hypercharge" : "Sans hypercharge"}</p>
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
    trophyTotal.textContent = String(brawldexStats.trophies);
    unlockTotal.textContent = String(brawldexStats.unlocks);
    hyperchargeTotal.textContent = String(brawldexStats.hypercharges);
    skinOwned.textContent = String(skinStats.owned);
    skinTotal.textContent = `/ ${skinStats.total}`;
    skinProgressBar.style.width = `${skinStats.pct}%`;

    const mainText = profile.mainBrawler ? `Main: ${profile.mainBrawler}.` : "Choisis ton main brawler.";
    collectionSummary.textContent = `${mainText} ${brawldexStats.owned} brawler(s), ${brawldexStats.unlocks} unlocks et ${skinStats.owned} skin(s) coches.`;

    renderBadgesAndGoals(brawldexStats, skinStats);
    renderTopBrawlers();
    renderActivity();
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

  async function loadPublicProfile() {
    if (!currentUser) return;
    setPublicStatus("Chargement du profil public...");
    try {
      const { data, error } = await supa
        .from("public_profiles")
        .select("display_name, bio, is_public, show_owned")
        .eq("user_id", currentUser.id)
        .maybeSingle();

      if (error) throw error;

      publicDisplayName.value = data?.display_name ?? ((currentUser.email || "").split("@")[0] || "");
      publicBio.value = data?.bio ?? "";
      publicIsPublic.checked = data?.is_public ?? true;
      publicShowOwned.checked = data?.show_owned ?? true;
      setPublicStatus("Profil public charge.");
    } catch (error) {
      setPublicStatus(error.message || String(error));
    }
  }

  async function savePublicProfile() {
    if (!currentUser) return;
    setPublicStatus("Enregistrement du profil public...");
    try {
      const payload = {
        user_id: currentUser.id,
        display_name: (publicDisplayName.value || "Profil").trim(),
        bio: (publicBio.value || "").trim(),
        is_public: !!publicIsPublic.checked,
        show_owned: !!publicShowOwned.checked,
        updated_at: new Date().toISOString()
      };
      const { error } = await supa.from("public_profiles").upsert(payload, { onConflict: "user_id" });
      if (error) throw error;
      setPublicStatus("Profil public enregistre.");
      toast("success", "Profil public", "Profil public enregistre.");
    } catch (error) {
      setPublicStatus(error.message || String(error));
      toast("error", "Profil public", error.message || String(error));
    }
  }

  async function publishOwned() {
    if (!currentUser) return;
    setPublicStatus("Publication de tes skins...");
    try {
      await savePublicProfile();
      const { error: delErr } = await supa.from("public_user_skins").delete().eq("user_id", currentUser.id);
      if (delErr) throw delErr;

      if (!ownedSet.size) {
        setPublicStatus("Aucun skin coche: la liste publique a ete videe.");
        toast("success", "Publication", "Liste publique videe.");
        return;
      }

      const rows = [...ownedSet].map((skin_id) => ({ user_id: currentUser.id, skin_id }));
      const { error: insErr } = await supa.from("public_user_skins").upsert(rows, { onConflict: "user_id,skin_id" });
      if (insErr) throw insErr;

      setPublicStatus(`${ownedSet.size} skin(s) publies.`);
      toast("success", "Publication", `${ownedSet.size} skin(s) publies.`);
    } catch (error) {
      setPublicStatus(error.message || String(error));
      toast("error", "Publication", error.message || String(error));
    }
  }

  function openPublicProfile() {
    if (!currentUser) return;
    window.open(publicProfileUrl(currentUser.id), "_blank");
  }

  async function copyPublicLink() {
    if (!currentUser) return;
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

    search.addEventListener("input", renderSkins);
    filterBrawler.addEventListener("change", renderSkins);
    filterRarity.addEventListener("change", renderSkins);
    onlyOwned.addEventListener("change", renderSkins);

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

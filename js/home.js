(function () {
  const Brawldex = window.BrawldexService;
  if (!Brawldex) return;
  const $ = (id) => document.getElementById(id);
  const homeViewer = $("homeViewer");
  const homeSummary = $("homeSummary");
  const homeBrawlerPct = $("homeBrawlerPct");
  const homeUnlocks = $("homeUnlocks");
  const homeBadges = $("homeBadges");
  const homeGoals = $("homeGoals");
  const homeTopBrawlers = $("homeTopBrawlers");
  const homeLatestProfiles = $("homeLatestProfiles");
  const homeSourceStatus = $("homeSourceStatus");
  const homeSourceStatusLabel = $("homeSourceStatusLabel");
  const homeSourceMessage = $("homeSourceMessage");
  const homeApiStatus = $("homeApiStatus");
  const homeApiMessage = $("homeApiMessage");
  const supa = window.supabaseClient || null;
  const PublicProfiles = window.PublicProfileService || null;
  let viewerId = "visitor";
  const brawlApiEnabled = window.BRAWLDEX_CONFIG?.enableBrawlApi === true;
  let apiHealth = {
    configured: null,
    status: brawlApiEnabled ? "checking" : "paused",
    message: brawlApiEnabled
      ? "Verification du proxy Brawl Stars..."
      : "Connexion, collection et partage sont les priorites du site."
  };

  function viewerKey() {
    return viewerId || "visitor";
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function sourceStatus() {
    return window.SKINS_SOURCE_STATUS || {
      label: "Local fallback",
      message: "Le Google Sheet n'est pas encore connecte."
    };
  }

  async function refreshApiHealth(options) {
    if (!brawlApiEnabled) {
      apiHealth = {
        configured: null,
        status: "paused",
        message: "Connexion, collection et partage sont les priorites du site."
      };
      renderSnapshot();
      return;
    }

    if (!window.BrawlStarsApi?.fetchProxyHealth) return;
    apiHealth = await window.BrawlStarsApi.fetchProxyHealth(options).catch(() => ({
      configured: null,
      status: "unavailable",
      message: "Impossible de verifier l'etat du proxy Brawl Stars pour l'instant."
    }));
    renderSnapshot();
  }

  function renderSnapshot() {
    const stats = Brawldex.getStats(viewerKey());
    const insights = Brawldex.getInsights(viewerKey());
    const profile = Brawldex.getProfile(viewerKey());
    const source = sourceStatus();

    const playerLabel = profile.playerName
      ? `${profile.playerName} ${profile.playerTag ? `(${profile.playerTag})` : ""}`.trim()
      : profile.mainBrawler
        ? `Main actuel: ${profile.mainBrawler}`
        : "Aucun profil joueur renseigne";

    homeViewer.textContent = playerLabel;
    homeSummary.textContent = profile.trophies
      ? `${profile.trophies} trophees officiels, ${stats.owned} brawler(s) locaux et ${stats.unlocks} unlocks dans ton Brawldex.`
      : `${stats.owned} brawler(s) possedes, ${stats.unlocks} unlocks et ${stats.hypercharges} hypercharges dans ton Brawldex local.`;
    homeBrawlerPct.textContent = `${stats.pct}%`;
    homeUnlocks.textContent = String(stats.unlocks);

    if (homeSourceStatus) homeSourceStatus.textContent = source.label || "Local fallback";
    if (homeSourceStatusLabel) homeSourceStatusLabel.textContent = source.connected ? "Connecte" : "En attente";
    if (homeSourceMessage) homeSourceMessage.textContent = source.message || "Source skins non renseignee.";

    if (homeApiStatus) {
      homeApiStatus.textContent = !brawlApiEnabled
        ? viewerId === "visitor"
          ? "Pret a commencer"
          : stats.owned || profile.mainBrawler
            ? "Tableau de bord actif"
            : "Compte pret"
        : profile.apiSyncedAt
          ? "Compte synchronise"
          : apiHealth.configured === true
            ? "Proxy configure"
            : apiHealth.configured === false
              ? "Token manquant"
              : apiHealth.status === "checking"
                ? "Verification..."
                : "Etat inconnu";
    }
    if (homeApiMessage) {
      homeApiMessage.textContent = !brawlApiEnabled
        ? viewerId === "visitor"
          ? "Connecte-toi pour sauvegarder ta collection et publier ton profil public."
          : stats.owned || profile.mainBrawler
            ? "Ton espace avance bien. Prochaine etape ideale : finaliser puis partager ton profil public."
            : "Ton compte est pret. Passe par le dashboard pour cocher tes premiers skins."
        : profile.apiSyncedAt
          ? `Derniere synchro le ${new Date(profile.apiSyncedAt).toLocaleString("fr-FR")}.`
          : apiHealth.message || "Etat du proxy Brawl Stars indisponible.";
    }

    homeBadges.innerHTML = "";
    (insights.badges.length ? insights.badges : [{ label: "Nouveau roster", detail: "Commence a remplir ton Brawldex." }]).forEach((badge) => {
      const el = document.createElement("span");
      el.className = "pill";
      el.textContent = badge.label;
      el.title = badge.detail;
      homeBadges.appendChild(el);
    });

    homeGoals.innerHTML = "";
    const lines = insights.recommendations.length
      ? insights.recommendations
      : ["Ajoute ton premier brawler pour lancer ta progression."];
    lines.forEach((line) => {
      const el = document.createElement("p");
      el.className = "muted";
      el.textContent = line;
      homeGoals.appendChild(el);
    });

    const top = Brawldex.getTopBrawlers(viewerKey(), 3);
    homeTopBrawlers.innerHTML = "";
    if (!top.length) {
      homeTopBrawlers.innerHTML = `
        <div class="list-card">
          <h3>Ton top apparaitra ici</h3>
          <p class="muted">Renseigne ta collection dans la page Roster pour voir tes meilleurs picks.</p>
        </div>
      `;
      return;
    }

    top.forEach(({ meta, entry }) => {
      const card = document.createElement("article");
      card.className = "list-card";
      card.innerHTML = `
        <div class="list-head">
          <div>
            <h3>${escapeHtml(meta.name)}</h3>
            <p class="muted">${escapeHtml(meta.role)} - ${escapeHtml(meta.rarity)}</p>
          </div>
          <span class="pill">${entry.trophies} troph.</span>
        </div>
      `;
      homeTopBrawlers.appendChild(card);
    });
  }

  async function renderLatestProfiles() {
    if (!supa || !PublicProfiles) return;
    homeLatestProfiles.innerHTML = `
      <div class="card empty-card">
        <h3>Chargement...</h3>
        <p class="muted">Recuperation des profils publics recents.</p>
      </div>
    `;

    try {
      const profiles = await PublicProfiles.enrichProfiles(await PublicProfiles.loadLatestProfiles(3), {
        totalSkins: Array.isArray(window.SKINS) ? window.SKINS.length : 0
      });
      if (!profiles.length) {
        homeLatestProfiles.innerHTML = `
          <div class="card empty-card">
            <h3>Aucun profil public</h3>
            <p class="muted">Publie ton profil depuis le dashboard pour lancer l'annuaire.</p>
          </div>
        `;
        return;
      }

      homeLatestProfiles.innerHTML = "";
      profiles.forEach((profile) => {
        const skinsLabel = profile.skinsVisible !== false ? `${profile.ownedCount} skins` : "Skins masques";
        const pctLabel = profile.skinsVisible !== false ? `${profile.pct}%` : "Comparaison off";
        const card = document.createElement("article");
        card.className = "card quick-card";
        card.innerHTML = `
          <div class="row">
            <span class="pill">Profil public</span>
            <span class="pill">${skinsLabel}</span>
            <span class="pill">${pctLabel}</span>
          </div>
          <h3>${escapeHtml(profile.display_name || "Profil")}</h3>
          <p class="muted">${escapeHtml(profile.bio || "-")}</p>
          <p class="small">${profile.updated_at ? new Date(profile.updated_at).toLocaleDateString("fr-FR") : ""}</p>
          <a class="seg-btn" href="pages/profile.html?u=${encodeURIComponent(profile.user_id)}">Ouvrir</a>
        `;
        homeLatestProfiles.appendChild(card);
      });
    } catch {
      homeLatestProfiles.innerHTML = `
        <div class="card empty-card">
          <h3>Annuaire indisponible</h3>
          <p class="muted">Le chargement des profils publics a echoue pour l'instant.</p>
        </div>
      `;
    }
  }

  async function initViewer() {
    if (!supa || !supa.auth) return;
    try {
      const { data } = await supa.auth.getSession();
      viewerId = data.session?.user?.id || "visitor";
      supa.auth.onAuthStateChange((_event, session) => {
        viewerId = session?.user?.id || "visitor";
        renderSnapshot();
      });
    } catch {}
  }

  (async () => {
    if (window.SKINS_READY && typeof window.SKINS_READY.then === "function") {
      try {
        await window.SKINS_READY;
      } catch {}
    }
    if (window.BRAWLDEX_READY && typeof window.BRAWLDEX_READY.then === "function") {
      try {
        await window.BRAWLDEX_READY;
      } catch {}
    }

    await initViewer();
    renderSnapshot();
    await refreshApiHealth();
    await renderLatestProfiles();
    window.addEventListener("brawldex:changed", renderSnapshot);
  })();
})();

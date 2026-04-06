(function () {
  const Brawldex = window.BrawldexService;
  const OwnedService = window.OwnedService || null;
  const PublicProfiles = window.PublicProfileService || null;
  const supa = window.supabaseClient || null;
  if (!Brawldex) return;

  const $ = (id) => document.getElementById(id);
  const homeViewer = $("homeViewer");
  const homeSummary = $("homeSummary");
  const homeGlobalPct = $("homeGlobalPct");
  const homeBrawlerPct = $("homeBrawlerPct");
  const homeSkinsPct = $("homeSkinsPct");
  const homePublicState = $("homePublicState");
  const homeSourceStatusLabel = $("homeSourceStatusLabel");
  const homeSourceMessage = $("homeSourceMessage");
  const homeApiStatus = $("homeApiStatus");
  const homeApiMessage = $("homeApiMessage");
  const homeOwnedLine = $("homeOwnedLine");
  const homeMissingLine = $("homeMissingLine");
  const homeBadges = $("homeBadges");
  const homeGoals = $("homeGoals");
  const homeTopBrawlers = $("homeTopBrawlers");
  const homeSectionNotes = $("homeSectionNotes");
  const homeLatestProfiles = $("homeLatestProfiles");

  let viewerId = "visitor";
  let ownedSet = new Set();
  let publicProfile = null;

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
      label: "Proxy serveur",
      message: "Le catalogue passe par le proxy serveur avec fallback local."
    };
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("fr-FR").format(Number(value) || 0);
  }

  function renderLatestProfilesEmpty(title, detail) {
    if (!homeLatestProfiles) return;
    homeLatestProfiles.innerHTML = `
      <div class="card empty-card">
        <h3>${escapeHtml(title)}</h3>
        <p class="muted">${escapeHtml(detail)}</p>
      </div>
    `;
  }

  function renderStaticSections() {
    if (!homeSectionNotes) return;
    homeSectionNotes.innerHTML = "";

    [
      "Quartier general : resume prive, ressources restantes et acces rapides vers tout le reste.",
      "Brawlers : la page principale pour indiquer possession, niveau et build complet de chaque personnage.",
      "Catalogue skins : suivi cosmetique separe pour garder une lecture claire de la collection.",
      "Profil public : fiche partageable avec identite joueur et snapshot public de progression."
    ].forEach((line) => {
      const p = document.createElement("p");
      p.className = "muted";
      p.textContent = line;
      homeSectionNotes.appendChild(p);
    });
  }

  function renderSnapshot() {
    const stats = Brawldex.getStats(viewerKey());
    const insights = Brawldex.getInsights(viewerKey());
    const profile = Brawldex.getProfile(viewerKey());
    const skinStats = OwnedService ? OwnedService.computeOwnedStats(ownedSet) : { total: 0, owned: 0, pct: 0 };
    const global = Brawldex.getGlobalProgress(viewerKey(), skinStats);
    const source = sourceStatus();

    const viewerLabel = profile.playerName
      ? `${profile.playerName}${profile.playerTag ? ` (${profile.playerTag})` : ""}`
      : profile.mainBrawler
        ? `Main actuel : ${profile.mainBrawler}`
        : viewerId === "visitor"
          ? "Mode visiteur"
          : "Compte connecte";

    if (homeViewer) homeViewer.textContent = viewerLabel;
    if (homeSummary) {
      homeSummary.textContent =
        `${global.globalPct}% de progression globale, ${stats.owned}/${stats.total} Brawlers possedes, ` +
        `${skinStats.owned}/${skinStats.total} skins coches et ${formatNumber(stats.missingCoins)} pieces / ` +
        `${formatNumber(stats.missingPowerPoints)} PP encore necessaires pour tout full.`;
    }

    if (homeGlobalPct) homeGlobalPct.textContent = `${global.globalPct}%`;
    if (homeBrawlerPct) homeBrawlerPct.textContent = `${stats.completionPct}%`;
    if (homeSkinsPct) homeSkinsPct.textContent = `${skinStats.pct}%`;
    if (homePublicState) {
      homePublicState.textContent = viewerId === "visitor"
        ? "Visiteur"
        : !publicProfile
          ? "Brouillon"
          : publicProfile.is_public
            ? publicProfile.show_owned
              ? "Public + skins"
              : "Public"
            : "Prive";
    }

    if (homeSourceStatusLabel) homeSourceStatusLabel.textContent = source.label || "Proxy serveur";
    if (homeSourceMessage) homeSourceMessage.textContent = source.message || "Catalogue pret.";
    if (homeApiStatus) {
      homeApiStatus.textContent = viewerId === "visitor"
        ? "Pret a demarrer"
        : publicProfile?.is_public
          ? "Profil partageable"
          : "Espace prive actif";
    }
    if (homeApiMessage) {
      homeApiMessage.textContent = viewerId === "visitor"
        ? "Connecte-toi pour sauvegarder tes skins, ton profil et ton avancement."
        : publicProfile?.is_public
          ? "Ton profil public est actif. Tu peux maintenant partager ton lien et comparer les collections."
          : "Passe par le Quartier general pour finaliser ou publier ton profil public.";
    }
    if (homeOwnedLine) homeOwnedLine.textContent = `${stats.owned} / ${stats.total} Brawlers`;
    if (homeMissingLine) {
      homeMissingLine.textContent =
        `${formatNumber(stats.missingCoins)} pieces et ${formatNumber(stats.missingPowerPoints)} PP manquants pour terminer tous les Brawlers.`;
    }

    if (homeBadges) {
      homeBadges.innerHTML = "";
      const badges = insights.badges.length
        ? insights.badges
        : [{ label: "Premiers pas", detail: "Commence a remplir ta collection Brawldex." }];

      badges.forEach((badge) => {
        const el = document.createElement("span");
        el.className = "pill";
        el.textContent = badge.label;
        el.title = badge.detail;
        homeBadges.appendChild(el);
      });
    }

    if (homeGoals) {
      homeGoals.innerHTML = "";
      const lines = insights.recommendations.length
        ? insights.recommendations
        : ["Passe sur la page Brawlers pour commencer a renseigner ton compte."];

      lines.forEach((line) => {
        const p = document.createElement("p");
        p.className = "muted";
        p.textContent = line;
        homeGoals.appendChild(p);
      });
    }

    if (homeTopBrawlers) {
      const top = Brawldex.getTopBrawlers(viewerKey(), 3);
      homeTopBrawlers.innerHTML = "";
      if (!top.length) {
        homeTopBrawlers.innerHTML = `
          <div class="list-card">
            <h3>Ton top apparaitra ici</h3>
            <p class="muted">Renseigne ta collection dans la page Brawlers pour voir tes meilleurs picks.</p>
          </div>
        `;
      } else {
        top.forEach(({ meta, entry }) => {
          const progress = Brawldex.getProgress(meta, entry);
          const card = document.createElement("article");
          card.className = "list-card";
          card.innerHTML = `
            <div class="list-head">
              <div>
                <h3>${escapeHtml(meta.name)}</h3>
                <p class="muted">${escapeHtml(meta.role)} - ${escapeHtml(meta.rarity)}</p>
              </div>
              <span class="pill">${progress.completion.pct}%</span>
            </div>
            <p class="muted">Niveau ${entry.powerLevel} - ${entry.trophies} troph. - ${entry.hypercharge ? "Hypercharge active" : "Sans hypercharge"}</p>
          `;
          homeTopBrawlers.appendChild(card);
        });
      }
    }
  }

  async function renderLatestProfiles() {
    if (!PublicProfiles || !homeLatestProfiles) return;
    renderLatestProfilesEmpty("Chargement...", "Recuperation des profils publics recents.");

    try {
      const profiles = await PublicProfiles.enrichProfiles(await PublicProfiles.loadLatestProfiles(3), {
        totalSkins: Array.isArray(window.SKINS) ? window.SKINS.length : 0
      });

      if (!profiles.length) {
        renderLatestProfilesEmpty("Aucun profil public", "Publie ton profil depuis le Quartier general pour lancer l'annuaire.");
        return;
      }

      homeLatestProfiles.innerHTML = "";
      profiles.forEach((profile) => {
        const progressValue = Number.isFinite(Number(profile.globalPct)) ? Number(profile.globalPct) : Number(profile.pct || 0);
        const progressLabel = `${progressValue}% jeu`;
        const metaLabel = profile.club_name
          ? `Clan : ${profile.club_name}`
          : profile.bio || "Profil public";
        const card = document.createElement("article");
        card.className = "card quick-card";
        card.innerHTML = `
          <div class="row">
            <span class="pill">Profil public</span>
            <span class="pill">${profile.skinsVisible !== false ? `${profile.ownedCount} skins` : "Skins masques"}</span>
            <span class="pill">${progressLabel}</span>
          </div>
          <h3>${escapeHtml(profile.display_name || "Profil")}</h3>
          <p class="muted">${escapeHtml(metaLabel)}</p>
          <p class="small">${profile.updated_at ? new Date(profile.updated_at).toLocaleDateString("fr-FR") : ""}</p>
          <a class="seg-btn" href="pages/profile.html?u=${encodeURIComponent(profile.user_id)}">Ouvrir</a>
        `;
        homeLatestProfiles.appendChild(card);
      });
    } catch {
      renderLatestProfilesEmpty("Annuaire indisponible", "Le chargement des profils publics a echoue pour l'instant.");
    }
  }

  async function loadViewerContext() {
    if (!supa?.auth) return;

    const applySession = async (session) => {
      viewerId = session?.user?.id || "visitor";
      if (viewerId === "visitor") {
        ownedSet = new Set();
        publicProfile = null;
      } else {
        try {
          ownedSet = OwnedService ? await OwnedService.loadOwnedSet(viewerId) : new Set();
        } catch {
          ownedSet = new Set();
        }

        try {
          publicProfile = PublicProfiles ? await PublicProfiles.loadProfile(viewerId) : null;
        } catch {
          publicProfile = null;
        }
      }
      renderSnapshot();
    };

    try {
      const { data } = await supa.auth.getSession();
      await applySession(data.session);
    } catch {}

    supa.auth.onAuthStateChange(async (_event, session) => {
      await applySession(session);
    });
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

    renderStaticSections();
    renderSnapshot();
    await loadViewerContext();
    await renderLatestProfiles();

    window.addEventListener("brawldex:changed", () => {
      renderSnapshot();
    });
  })();
})();

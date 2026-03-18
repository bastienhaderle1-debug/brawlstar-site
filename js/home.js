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
  const supa = window.supabaseClient || null;
  let viewerId = "visitor";

  function viewerKey() {
    return viewerId || "visitor";
  }

  function renderSnapshot() {
    const stats = Brawldex.getStats(viewerKey());
    const insights = Brawldex.getInsights(viewerKey());
    const profile = Brawldex.getProfile(viewerKey());

    homeViewer.textContent = profile.mainBrawler
      ? `Main actuel: ${profile.mainBrawler}`
      : "Aucun main defini pour le moment";
    homeSummary.textContent = `${stats.owned} brawler(s) possedes, ${stats.unlocks} unlocks et ${stats.hypercharges} hypercharges dans ton Brawldex local.`;
    homeBrawlerPct.textContent = `${stats.pct}%`;
    homeUnlocks.textContent = String(stats.unlocks);

    homeBadges.innerHTML = "";
    (insights.badges.length ? insights.badges : [{ label: "Nouveau roster", detail: "Commence a remplir ton Brawldex." }]).forEach((badge) => {
      const el = document.createElement("span");
      el.className = "pill";
      el.textContent = badge.label;
      el.title = badge.detail;
      homeBadges.appendChild(el);
    });

    homeGoals.innerHTML = "";
    (insights.recommendations.length ? insights.recommendations : ["Ajoute ton premier brawler pour lancer ta progression."]).forEach((line) => {
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
          <p class="muted">Renseigne ta collection dans la page Brawlers pour voir ressortir tes meilleurs picks.</p>
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
            <h3>${meta.name}</h3>
            <p class="muted">${meta.role} • ${meta.rarity}</p>
          </div>
          <span class="pill">${entry.trophies} troph.</span>
        </div>
      `;
      homeTopBrawlers.appendChild(card);
    });
  }

  async function renderLatestProfiles() {
    if (!supa) return;
    homeLatestProfiles.innerHTML = `
      <div class="card empty-card">
        <h3>Chargement...</h3>
        <p class="muted">Recuperation des profils publics recents.</p>
      </div>
    `;

    try {
      const { data, error } = await supa
        .from("public_profiles")
        .select("user_id, display_name, bio, updated_at")
        .eq("is_public", true)
        .order("updated_at", { ascending: false })
        .limit(3);

      if (error) throw error;

      const profiles = data || [];
      if (!profiles.length) {
        homeLatestProfiles.innerHTML = `
          <div class="card empty-card">
            <h3>Aucun profil public</h3>
            <p class="muted">Publie ton profil depuis MyBrawl pour lancer l'annuaire.</p>
          </div>
        `;
        return;
      }

      homeLatestProfiles.innerHTML = "";
      profiles.forEach((profile) => {
        const card = document.createElement("article");
        card.className = "card quick-card";
        card.innerHTML = `
          <span class="pill">Profil public</span>
          <h3>${profile.display_name || "Profil"}</h3>
          <p class="muted">${profile.bio || "-"}</p>
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
    await renderLatestProfiles();
    window.addEventListener("brawldex:changed", renderSnapshot);
  })();
})();

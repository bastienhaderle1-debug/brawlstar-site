(function () {
  const supa = window.supabaseClient || null;
  const badge = document.getElementById("globalAuthBadge");
  const navLinks = document.querySelectorAll(".nav a");
  const headerRight = document.querySelector(".header-right");
  const disableGlobalSearch = true;
  const isPagesDir = window.location.pathname.replace(/\\/g, "/").includes("/pages/");
  const searchState = {
    viewerId: "visitor",
    scope: "all",
    timer: null
  };

  function safeStr(value) {
    return (value ?? "").toString();
  }

  function escapeHtml(value) {
    return safeStr(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function pageHref(page, params) {
    const base = isPagesDir ? `./${page}.html` : `pages/${page}.html`;
    const url = new URL(base, window.location.href);
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      url.searchParams.set(key, value);
    });
    return isPagesDir ? `${url.pathname.split("/").pop()}${url.search}` : `${url.pathname.split("/").slice(-2).join("/")}${url.search}`;
  }

  function paint(session) {
    if (!badge) return;

    const user = session?.user;
    if (user) {
      const name = user.email ? user.email.split("@")[0] : user.id.slice(0, 8);
      badge.className = "badge ok";
      badge.innerHTML = `
        <span class="dot"></span>
        <span>Connecte : <strong>${escapeHtml(name)}</strong></span>
      `;
    } else if (!supa) {
      badge.className = "badge info";
      badge.innerHTML = `
        <span class="dot"></span>
        <span>Mode visiteur</span>
      `;
    } else {
      badge.className = "badge ko";
      badge.innerHTML = `
        <span class="dot"></span>
        <span>Non connecte</span>
      `;
    }
  }

  function markActiveNav() {
    navLinks.forEach((a) => {
      try {
        const href = a.getAttribute("href");
        if (!href) return;
        const url = new URL(href, window.location.href);
        if (url.pathname === window.location.pathname) a.classList.add("is-active");
      } catch {}
    });
  }

  function getSearchModal() {
    return document.getElementById("globalSearchModal");
  }

  function getSearchInput() {
    return document.getElementById("globalSearchInput");
  }

  function getSearchResults() {
    return document.getElementById("globalSearchResults");
  }

  async function ensureBrawldexReady() {
    if (window.BRAWLDEX_READY && typeof window.BRAWLDEX_READY.then === "function") {
      try {
        await window.BRAWLDEX_READY;
      } catch {}
    }
  }

  async function ensureSkinsReady() {
    if (window.SKINS_READY && typeof window.SKINS_READY.then === "function") {
      try {
        await window.SKINS_READY;
      } catch {}
    }
  }

  async function getBrawlerResults(query) {
    await ensureBrawldexReady();

    const q = query.toLowerCase().trim();
    let list = [];

    if (window.BrawldexService) {
      const collection = window.BrawldexService.getCollection(searchState.viewerId || "visitor");
      list = collection.catalog.map((meta) => ({
        type: "brawler",
        title: meta.name,
        subtitle: `${meta.rarity} - ${meta.role} - ${collection.entries[meta.id].owned ? "Possede" : "Manquant"}`,
        href: pageHref("brawlers", { q: meta.name, brawler: meta.id }),
        sortKey: meta.name
      }));
    } else {
      const names = new Set();
      const presets = window.BRAWLDEX_DATA?.presets || {};
      Object.values(presets).forEach((preset) => names.add(preset.name || ""));
      (window.BRAWLDEX_DATA?.fallbackBrawlers || []).forEach((name) => names.add(name));
      (window.SKINS || []).forEach((skin) => names.add(skin?.brawler || ""));
      list = [...names]
        .map((name) => safeStr(name).trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "fr"))
        .map((name) => ({
          type: "brawler",
          title: name,
          subtitle: "Ouvrir la collection brawlers",
          href: pageHref("brawlers", { q: name }),
          sortKey: name
        }));
    }

    return list
      .filter((item) => !q || `${item.title}|${item.subtitle}`.toLowerCase().includes(q))
      .slice(0, 8);
  }

  async function getSkinResults(query) {
    await ensureSkinsReady();
    const q = query.toLowerCase().trim();
    const skins = Array.isArray(window.SKINS) ? window.SKINS : [];

    return skins
      .filter((skin) => {
        const haystack = [skin?.name, skin?.brawler, skin?.category, skin?.rarity].join("|").toLowerCase();
        return !q || haystack.includes(q);
      })
      .slice(0, 8)
      .map((skin) => ({
        type: "skin",
        title: skin.name || skin.id || "Skin",
        subtitle: `${skin.brawler || "-"} - ${skin.rarity || "Collection"} - ${skin.category || "Theme"}`,
        href: pageHref("skins", { q: skin.name || "", brawler: skin.brawler || "" }),
        sortKey: skin.name || ""
      }));
  }

  async function getProfileResults(query) {
    const q = query.trim();
    if (!supa || q.length < 2) return [];

    try {
      const { data, error } = await supa
        .from("public_profiles")
        .select("user_id, display_name, bio, updated_at")
        .eq("is_public", true)
        .ilike("display_name", `%${q}%`)
        .order("updated_at", { ascending: false })
        .limit(6);

      if (error) throw error;

      return (data || []).map((profile) => ({
        type: "profile",
        title: profile.display_name || "Profil",
        subtitle: profile.bio || "Profil public",
        href: pageHref("profile", { u: profile.user_id }),
        sortKey: profile.display_name || ""
      }));
    } catch {
      return [];
    }
  }

  function renderSearchResults(query, groups) {
    const host = getSearchResults();
    if (!host) return;

    const filteredGroups = groups.filter((group) => {
      if (searchState.scope === "all") return group.items.length > 0;
      return group.id === searchState.scope && group.items.length > 0;
    });

    if (!query.trim()) {
      host.innerHTML = `
          <div class="search-empty">
            <h3>Recherche rapide</h3>
            <p class="muted">Cherche un brawler, un skin ou un profil public. Raccourci clavier: <strong>Ctrl+K</strong> ou <strong>/</strong>.</p>
            <div class="section-actions">
            <a class="seg-btn" href="${pageHref("mybrawl")}">Ouvrir le Quartier general</a>
            <a class="seg-btn" href="${pageHref("brawlers")}">Voir les Brawlers</a>
            <a class="seg-btn" href="${pageHref("profile")}">Explorer les profils</a>
            </div>
          </div>
        `;
      return;
    }

    if (!filteredGroups.length) {
      host.innerHTML = `
        <div class="search-empty">
          <h3>Aucun resultat</h3>
          <p class="muted">Essaie un autre mot-cle ou change le filtre de recherche.</p>
        </div>
      `;
      return;
    }

    host.innerHTML = filteredGroups
      .map(
        (group) => `
          <section class="search-group">
            <div class="section-head">
              <div>
                <h2>${escapeHtml(group.label)}</h2>
                <p class="muted">${group.items.length} resultat(s)</p>
              </div>
            </div>
            <div class="list-stack">
              ${group.items
                .map(
                  (item) => `
                    <a class="search-hit" href="${escapeHtml(item.href)}">
                      <div>
                        <div class="row">
                          <span class="pill">${escapeHtml(group.label)}</span>
                        </div>
                        <h3>${escapeHtml(item.title)}</h3>
                        <p class="muted">${escapeHtml(item.subtitle)}</p>
                      </div>
                      <span class="small">Ouvrir</span>
                    </a>
                  `
                )
                .join("")}
            </div>
          </section>
        `
      )
      .join("");
  }

  async function runGlobalSearch() {
    const input = getSearchInput();
    if (!input) return;

    const query = input.value || "";
    const host = getSearchResults();
    if (host && query.trim()) {
      host.innerHTML = `
        <div class="search-empty">
          <h3>Recherche...</h3>
          <p class="muted">On rassemble les resultats sur tout le site.</p>
        </div>
      `;
    }

    const [brawlers, skins, profiles] = await Promise.all([
      getBrawlerResults(query),
      getSkinResults(query),
      getProfileResults(query)
    ]);

    renderSearchResults(query, [
      { id: "brawlers", label: "Brawlers", items: brawlers },
      { id: "skins", label: "Catalogue skins", items: skins },
      { id: "profiles", label: "Profils", items: profiles }
    ]);
  }

  function scheduleSearch() {
    clearTimeout(searchState.timer);
    searchState.timer = window.setTimeout(runGlobalSearch, 140);
  }

  function setScope(scope) {
    searchState.scope = scope;
    document.querySelectorAll("[data-search-scope]").forEach((button) => {
      button.classList.toggle("is-active", button.getAttribute("data-search-scope") === scope);
    });
    runGlobalSearch();
  }

  function openSearch() {
    const modal = getSearchModal();
    const input = getSearchInput();
    if (!modal || !input) return;
    modal.hidden = false;
    input.focus();
    input.select();
    runGlobalSearch();
  }

  function closeSearch() {
    const modal = getSearchModal();
    if (!modal) return;
    modal.hidden = true;
  }

  function injectSearchUi() {
    if (disableGlobalSearch) return;

    if (headerRight && !document.getElementById("btnGlobalSearch")) {
      const button = document.createElement("button");
      button.type = "button";
      button.id = "btnGlobalSearch";
      button.className = "seg-btn";
      button.textContent = "Recherche";
      button.addEventListener("click", openSearch);
      headerRight.appendChild(button);
    }

    if (getSearchModal()) return;

    const modal = document.createElement("div");
    modal.id = "globalSearchModal";
    modal.className = "modal-backdrop";
    modal.hidden = true;
    modal.innerHTML = `
      <div class="modal-card search-modal" role="dialog" aria-modal="true" aria-labelledby="globalSearchTitle">
        <div class="section-head">
          <div>
            <h2 id="globalSearchTitle">Recherche globale</h2>
            <p class="muted">Brawlers, Catalogue skins et profils publics dans une seule barre.</p>
          </div>
          <div class="section-actions">
            <button class="seg-btn" id="btnCloseGlobalSearch" type="button">Fermer</button>
          </div>
        </div>

        <div class="filter">
          <label for="globalSearchInput">Recherche</label>
          <input id="globalSearchInput" class="input" type="text" placeholder="ex: shelly, pirate, bastien..." />
        </div>

        <div class="section-actions">
          <button class="choice-btn is-selected" type="button" data-search-scope="all">Tout</button>
          <button class="choice-btn" type="button" data-search-scope="brawlers">Brawlers</button>
          <button class="choice-btn" type="button" data-search-scope="skins">Catalogue skins</button>
          <button class="choice-btn" type="button" data-search-scope="profiles">Profils</button>
        </div>

        <div id="globalSearchResults" class="list-stack"></div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById("btnCloseGlobalSearch").addEventListener("click", closeSearch);
    document.getElementById("globalSearchInput").addEventListener("input", scheduleSearch);

    document.querySelectorAll("[data-search-scope]").forEach((button) => {
      button.addEventListener("click", () => setScope(button.getAttribute("data-search-scope")));
    });

    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeSearch();
    });

    window.addEventListener("keydown", (event) => {
      const tag = event.target?.tagName || "";
      const typing = /INPUT|TEXTAREA|SELECT/.test(tag) || event.target?.isContentEditable;

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openSearch();
        return;
      }

      if (!typing && event.key === "/") {
        event.preventDefault();
        openSearch();
        return;
      }

      if (event.key === "Escape" && !modal.hidden) {
        closeSearch();
      }
    });
  }

  async function initAuth() {
    if (!supa || !supa.auth) {
      paint(null);
      return;
    }

    try {
      const { data } = await supa.auth.getSession();
      searchState.viewerId = data.session?.user?.id || "visitor";
      paint(data.session);
    } catch {
      paint(null);
    }

    supa.auth.onAuthStateChange((_event, session) => {
      searchState.viewerId = session?.user?.id || "visitor";
      paint(session);
    });
  }

  markActiveNav();
  injectSearchUi();
  initAuth();
})();

(function () {
  const Brawldex = window.BrawldexService;
  if (!Brawldex) {
    console.error("BrawldexService introuvable.");
    return;
  }

  const $ = (id) => document.getElementById(id);
  const search = $("search");
  const ownedFilter = $("ownedFilter");
  const buildFilter = $("buildFilter");
  const sortBy = $("sortBy");
  const cards = $("cards");
  const resultCount = $("resultCount");
  const accountLine = $("accountLine");
  const importFile = $("importFile");
  const btnExport = $("btnExport");
  const btnReset = $("btnReset");
  const btnOnlyMissing = $("btnOnlyMissing");
  const btnClearFilters = $("btnClearFilters");
  const brawlerInsights = $("brawlerInsights");

  const statOwnedBrawlers = $("statOwnedBrawlers");
  const statTotalBrawlers = $("statTotalBrawlers");
  const statAvgPower = $("statAvgPower");
  const statTrophies = $("statTrophies");
  const statUnlocks = $("statUnlocks");
  const statHypercharges = $("statHypercharges");

  const detailModal = $("brawlerDetailModal");
  const btnCloseDetail = $("btnCloseBrawlerDetail");
  const detailName = $("detailName");
  const detailMeta = $("detailMeta");
  const detailOwned = $("detailOwned");
  const detailPower = $("detailPower");
  const detailTrophies = $("detailTrophies");
  const detailMastery = $("detailMastery");
  const detailRelatedSkins = $("detailRelatedSkins");
  const detailProgress = $("detailProgress");
  const detailSummary = $("detailSummary");
  const detailNext = $("detailNext");
  const detailNotes = $("detailNotes");
  const detailUnlocked = $("detailUnlocked");
  const detailMissing = $("detailMissing");

  const supa = window.supabaseClient || null;
  let viewerId = "visitor";
  let detailBrawlerId = "";
  let pendingUrlBrawlerId = "";

  function toast(type, title, message) {
    if (window.showToast) window.showToast(message, type, title, 2400);
  }

  function safeStr(value) {
    return (value ?? "").toString();
  }

  function slugify(value) {
    return safeStr(value)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function viewerKey() {
    return viewerId || "visitor";
  }

  function getCollection() {
    return Brawldex.getCollection(viewerKey());
  }

  function getFilteredItems() {
    const q = (search.value || "").toLowerCase().trim();
    const mode = ownedFilter.value || "all";
    const build = buildFilter.value || "all";
    const sort = sortBy.value || "name";
    const collection = getCollection();

    const items = collection.catalog.map((meta) => ({
      meta,
      entry: collection.entries[meta.id],
      completion: Brawldex.getCompletion(meta, collection.entries[meta.id])
    }));

    const filtered = items.filter(({ meta, entry, completion }) => {
      if (mode === "owned" && !entry.owned) return false;
      if (mode === "missing" && entry.owned) return false;
      if (mode === "favorites" && !entry.favorite) return false;

      if (build === "incomplete" && (!entry.owned || completion.current >= completion.total)) return false;
      if (build === "maxed" && entry.powerLevel < 11) return false;
      if (build === "hypercharge" && !entry.hypercharge) return false;
      if (build === "ready" && (!entry.owned || completion.current < completion.total - 1 || completion.current >= completion.total)) {
        return false;
      }

      if (!q) return true;
      const haystack = [meta.name, meta.role, meta.rarity, meta.difficulty, entry.notes].join("|").toLowerCase();
      return haystack.includes(q);
    });

    filtered.sort((a, b) => {
      if (sort === "trophies" && b.entry.trophies !== a.entry.trophies) return b.entry.trophies - a.entry.trophies;
      if (sort === "power" && b.entry.powerLevel !== a.entry.powerLevel) return b.entry.powerLevel - a.entry.powerLevel;
      if (sort === "completion" && b.completion.current !== a.completion.current) return b.completion.current - a.completion.current;
      if (a.entry.favorite !== b.entry.favorite) return a.entry.favorite ? -1 : 1;
      if (a.entry.owned !== b.entry.owned) return a.entry.owned ? -1 : 1;
      return a.meta.name.localeCompare(b.meta.name, "fr");
    });

    return filtered;
  }

  function updateSummary() {
    const stats = Brawldex.getStats(viewerKey());
    const insights = Brawldex.getInsights(viewerKey());

    statOwnedBrawlers.textContent = String(stats.owned);
    statTotalBrawlers.textContent = String(stats.total);
    statAvgPower.textContent = String(stats.avgPower);
    statTrophies.textContent = String(stats.trophies);
    statUnlocks.textContent = String(stats.unlocks);
    statHypercharges.textContent = String(stats.hypercharges);

    const lines = [
      `${stats.incompleteOwned} brawler(s) possedes ont encore un build incomplet.`,
      insights.recommendations[0] || "Commence a remplir les builds de tes brawlers preferes.",
      insights.recommendations[1] || "Astuce: ajoute un brawler manquant ou vise une hypercharge."
    ];

    brawlerInsights.innerHTML = "";
    lines.forEach((line) => {
      const p = document.createElement("p");
      p.className = "muted";
      p.textContent = line;
      brawlerInsights.appendChild(p);
    });
  }

  function syncCardState(card, meta, entry) {
    const completion = Brawldex.getCompletion(meta, entry);
    const disabled = !entry.owned;

    card.dataset.owned = entry.owned ? "1" : "0";
    card.querySelector("[data-owned-text]").textContent = entry.owned ? "Possede" : "Manquant";
    card.querySelector("[data-owned-toggle]").checked = entry.owned;
    card.querySelector("[data-favorite-toggle]").checked = entry.favorite;
    card.querySelector("[data-power]").value = entry.powerLevel;
    card.querySelector("[data-trophies]").value = entry.trophies;
    card.querySelector("[data-mastery]").value = entry.mastery;
    card.querySelector("[data-hypercharge]").checked = entry.hypercharge;
    card.querySelector("[data-notes]").value = entry.notes;
    card.querySelector("[data-completion]").textContent = `${completion.current}/${completion.total} unlocks`;
    card.querySelector("[data-progress]").style.width = `${Math.round((completion.current / completion.total) * 100)}%`;

    card.querySelectorAll("[data-lockable='1']").forEach((node) => {
      node.disabled = disabled;
    });

    card.querySelectorAll("[data-choice-group]").forEach((group) => {
      const field = group.getAttribute("data-choice-group");
      group.querySelectorAll("[data-choice-id]").forEach((button) => {
        const id = button.getAttribute("data-choice-id");
        button.classList.toggle("is-selected", Array.isArray(entry[field]) && entry[field].includes(id));
        button.disabled = disabled;
      });
    });
  }

  function createChoiceButtons(label, field, options, selected) {
    const wrap = document.createElement("div");
    wrap.className = "choice-block";
    wrap.innerHTML = `<div class="choice-title">${label}</div>`;

    const group = document.createElement("div");
    group.className = "choice-grid";
    group.setAttribute("data-choice-group", field);

    options.forEach((option) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choice-btn";
      btn.setAttribute("data-choice-id", option.id);
      btn.textContent = option.label;
      btn.classList.toggle("is-selected", selected.includes(option.id));
      group.appendChild(btn);
    });

    wrap.appendChild(group);
    return wrap;
  }

  function setBrawlerInUrl(brawlerId) {
    const url = new URL(window.location.href);
    if (brawlerId) url.searchParams.set("brawler", brawlerId);
    else url.searchParams.delete("brawler");
    window.history.replaceState({}, "", url.toString());
  }

  function renderDetailTags(target, labels, fallback) {
    target.innerHTML = "";
    if (!labels.length) {
      const empty = document.createElement("span");
      empty.className = "pill";
      empty.textContent = fallback;
      target.appendChild(empty);
      return;
    }

    labels.forEach((label) => {
      const node = document.createElement("span");
      node.className = "pill";
      node.textContent = label;
      target.appendChild(node);
    });
  }

  function buildUnlockLabels(meta, entry) {
    const unlocked = [];
    const missing = [];

    meta.gadgets.forEach((item) => {
      if (entry.gadgets.includes(item.id)) unlocked.push(`Gadget: ${item.label}`);
      else missing.push(`Gadget: ${item.label}`);
    });
    meta.starPowers.forEach((item) => {
      if (entry.starPowers.includes(item.id)) unlocked.push(`Star power: ${item.label}`);
      else missing.push(`Star power: ${item.label}`);
    });
    meta.gears.forEach((item) => {
      if (entry.gears.includes(item.id)) unlocked.push(`Gear: ${item.label}`);
      else missing.push(`Gear: ${item.label}`);
    });

    if (entry.hypercharge) unlocked.push("Hypercharge");
    else missing.push("Hypercharge");

    return { unlocked, missing };
  }

  function nextStepFor(meta, entry) {
    if (!entry.owned) return `Ajoute ${meta.name} a ta collection pour commencer son build.`;
    if (entry.powerLevel < 11) return `Monte ${meta.name} au niveau ${Math.min(entry.powerLevel + 1, 11)}.`;

    const firstMissingGadget = meta.gadgets.find((item) => !entry.gadgets.includes(item.id));
    if (firstMissingGadget) return `Debloque le gadget "${firstMissingGadget.label}".`;

    const firstMissingStar = meta.starPowers.find((item) => !entry.starPowers.includes(item.id));
    if (firstMissingStar) return `Ajoute le pouvoir star "${firstMissingStar.label}".`;

    const firstMissingGear = meta.gears.find((item) => !entry.gears.includes(item.id));
    if (firstMissingGear) return `Equipe le gear "${firstMissingGear.label}".`;

    if (!entry.hypercharge) return "Vise l'hypercharge pour finaliser le build.";
    return `${meta.name} est complet. Tu peux maintenant optimiser tes notes et tes trophees.`;
  }

  function openDetailByMeta(meta) {
    if (!detailModal || !meta) return;
    const collection = getCollection();
    const entry = collection.entries[meta.id];
    const completion = Brawldex.getCompletion(meta, entry);
    const relatedSkins = (Array.isArray(window.SKINS) ? window.SKINS : []).filter((skin) => skin?.brawler === meta.name);
    const unlockLabels = buildUnlockLabels(meta, entry);
    const pct = completion.total ? Math.round((completion.current / completion.total) * 100) : 0;

    detailBrawlerId = meta.id;
    detailName.textContent = meta.name;
    detailMeta.textContent = `${meta.rarity} • ${meta.role} • ${meta.difficulty}`;
    detailOwned.textContent = entry.owned ? "Possede" : "Manquant";
    detailPower.textContent = String(entry.powerLevel);
    detailTrophies.textContent = String(entry.trophies);
    detailMastery.textContent = String(entry.mastery);
    detailRelatedSkins.textContent = String(relatedSkins.length);
    detailProgress.style.width = `${pct}%`;
    detailSummary.textContent = `${completion.current}/${completion.total} unlocks actifs • ${pct}% de build.`;
    detailNext.textContent = nextStepFor(meta, entry);
    detailNotes.textContent = entry.notes || "Aucune note pour ce brawler.";

    renderDetailTags(detailUnlocked, unlockLabels.unlocked, "Aucun unlock equipe");
    renderDetailTags(detailMissing, unlockLabels.missing, "Build complet");

    detailModal.hidden = false;
    setBrawlerInUrl(meta.id);
  }

  function openDetailById(brawlerId) {
    const meta = getCollection().catalog.find((item) => item.id === brawlerId);
    if (meta) openDetailByMeta(meta);
  }

  function closeDetail() {
    if (!detailModal) return;
    detailModal.hidden = true;
    detailBrawlerId = "";
    setBrawlerInUrl("");
  }

  function createCard(meta, entry) {
    const article = document.createElement("article");
    article.className = "card collection-card";
    article.dataset.brawlerId = meta.id;

    article.innerHTML = `
      <div class="collection-head">
        <div>
          <div class="row">
            <span class="pill">${meta.rarity}</span>
            <span class="pill">${meta.role}</span>
            <span class="pill">${meta.difficulty}</span>
          </div>
          <h3>${meta.name}</h3>
          <p class="muted" data-completion>0/0 unlocks</p>
        </div>
        <div class="collection-toggles">
          <label class="switch-line">
            <input type="checkbox" data-owned-toggle />
            <span data-owned-text>Manquant</span>
          </label>
          <label class="switch-line">
            <input type="checkbox" data-favorite-toggle />
            <span>Favori</span>
          </label>
          <button class="choice-btn" type="button" data-open-detail>Details</button>
        </div>
      </div>
      <div class="progress"><div class="progress-bar" data-progress style="width:0%"></div></div>
    `;

    const fields = document.createElement("div");
    fields.className = "collection-fields";
    fields.innerHTML = `
      <div class="filter">
        <label>Puissance</label>
        <input class="input" type="number" min="1" max="11" data-power data-lockable="1" />
      </div>
      <div class="filter">
        <label>Trophees</label>
        <input class="input" type="number" min="0" max="99999" data-trophies data-lockable="1" />
      </div>
      <div class="filter">
        <label>Mastery</label>
        <input class="input" type="number" min="0" max="30000" data-mastery data-lockable="1" />
      </div>
      <label class="switch-line hyper-line">
        <input type="checkbox" data-hypercharge data-lockable="1" />
        <span>Hypercharge</span>
      </label>
    `;
    article.appendChild(fields);
    article.appendChild(createChoiceButtons("Gadgets", "gadgets", meta.gadgets, entry.gadgets));
    article.appendChild(createChoiceButtons("Pouvoirs stars", "starPowers", meta.starPowers, entry.starPowers));
    article.appendChild(createChoiceButtons("Gears", "gears", meta.gears, entry.gears));

    const notes = document.createElement("div");
    notes.className = "choice-block";
    notes.innerHTML = `
      <div class="choice-title">Notes perso</div>
      <textarea class="textarea" rows="3" data-notes data-lockable="1" placeholder="Mode prefere, build, objectif..."></textarea>
    `;
    article.appendChild(notes);

    article.querySelector("[data-open-detail]").addEventListener("click", () => openDetailByMeta(meta));

    article.querySelector("[data-owned-toggle]").addEventListener("change", (event) => {
      const next = Brawldex.patchEntry(viewerKey(), meta.id, { owned: event.target.checked });
      if (!next) return;
      syncCardState(article, meta, next);
      updateSummary();
      if (detailBrawlerId === meta.id) openDetailByMeta(meta);
      toast("success", "Brawler", `${meta.name} ${next.owned ? "ajoute" : "retire"} de ta collection.`);
    });

    article.querySelector("[data-favorite-toggle]").addEventListener("change", (event) => {
      const next = Brawldex.patchEntry(viewerKey(), meta.id, { favorite: event.target.checked });
      if (!next) return;
      syncCardState(article, meta, next);
      updateSummary();
      if (detailBrawlerId === meta.id) openDetailByMeta(meta);
    });

    ["power", "trophies", "mastery"].forEach((field) => {
      article.querySelector(`[data-${field}]`).addEventListener("change", (event) => {
        const patchField = field === "power" ? "powerLevel" : field;
        const next = Brawldex.patchEntry(viewerKey(), meta.id, { [patchField]: event.target.value, owned: true });
        if (!next) return;
        syncCardState(article, meta, next);
        updateSummary();
        if (detailBrawlerId === meta.id) openDetailByMeta(meta);
      });
    });

    article.querySelector("[data-hypercharge]").addEventListener("change", (event) => {
      const next = Brawldex.patchEntry(viewerKey(), meta.id, { hypercharge: event.target.checked, owned: true });
      if (!next) return;
      syncCardState(article, meta, next);
      updateSummary();
      if (detailBrawlerId === meta.id) openDetailByMeta(meta);
    });

    article.querySelectorAll("[data-choice-group]").forEach((group) => {
      const field = group.getAttribute("data-choice-group");
      const maxSize = field === "gears" ? meta.gears.length : 2;
      group.addEventListener("click", (event) => {
        const button = event.target.closest("[data-choice-id]");
        if (!button || button.disabled) return;
        const next = Brawldex.toggleChoice(viewerKey(), meta.id, field, button.getAttribute("data-choice-id"), maxSize);
        if (!next) return;
        syncCardState(article, meta, next);
        updateSummary();
        if (detailBrawlerId === meta.id) openDetailByMeta(meta);
      });
    });

    article.querySelector("[data-notes]").addEventListener("change", (event) => {
      const next = Brawldex.patchEntry(viewerKey(), meta.id, { notes: event.target.value, owned: true });
      if (!next) return;
      syncCardState(article, meta, next);
      if (detailBrawlerId === meta.id) openDetailByMeta(meta);
    });

    syncCardState(article, meta, entry);
    return article;
  }

  function render() {
    const items = getFilteredItems();
    cards.innerHTML = "";
    resultCount.textContent = `${items.length} brawler(s) affiches`;

    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "card empty-card";
      empty.innerHTML = `
        <h3>Aucun resultat</h3>
        <p class="muted">Change tes filtres ou importe ton Brawldex pour voir ta progression.</p>
      `;
      cards.appendChild(empty);
      return;
    }

    const frag = document.createDocumentFragment();
    items.forEach(({ meta, entry }) => frag.appendChild(createCard(meta, entry)));
    cards.appendChild(frag);

    if (pendingUrlBrawlerId) {
      const match = getCollection().catalog.find(
        (meta) => meta.id === pendingUrlBrawlerId || slugify(meta.name) === slugify(pendingUrlBrawlerId)
      );
      if (match) {
        openDetailByMeta(match);
      }
      pendingUrlBrawlerId = "";
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

  async function initViewer() {
    if (!supa || !supa.auth) {
      viewerId = "visitor";
      accountLine.textContent = "Mode local visiteur: ta collection reste dans ce navigateur.";
      return;
    }

    try {
      const { data } = await supa.auth.getSession();
      const user = data.session?.user ?? null;
      viewerId = user?.id || "visitor";
      accountLine.textContent = user
        ? `Collection locale liee a ${user.email ?? user.id}.`
        : "Mode local visiteur: connecte-toi au dashboard pour lier ta collection a ton compte.";

      supa.auth.onAuthStateChange((_event, session) => {
        const nextUser = session?.user ?? null;
        viewerId = nextUser?.id || "visitor";
        accountLine.textContent = nextUser
          ? `Collection locale liee a ${nextUser.email ?? nextUser.id}.`
          : "Mode local visiteur: connecte-toi au dashboard pour lier ta collection a ton compte.";
        updateSummary();
        render();
      });
    } catch {
      viewerId = "visitor";
      accountLine.textContent = "Mode local visiteur: ta collection reste dans ce navigateur.";
    }
  }

  function applyUrlFilters() {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    const owned = params.get("owned");
    const build = params.get("build");
    const sort = params.get("sort");
    const brawler = params.get("brawler");

    if (q) search.value = q;
    if (owned && [...ownedFilter.options].some((option) => option.value === owned)) ownedFilter.value = owned;
    if (build && [...buildFilter.options].some((option) => option.value === build)) buildFilter.value = build;
    if (sort && [...sortBy.options].some((option) => option.value === sort)) sortBy.value = sort;
    if (brawler) pendingUrlBrawlerId = brawler;
  }

  function wireActions() {
    search.addEventListener("input", render);
    ownedFilter.addEventListener("change", render);
    buildFilter.addEventListener("change", render);
    sortBy.addEventListener("change", render);

    btnOnlyMissing.addEventListener("click", () => {
      ownedFilter.value = "missing";
      render();
    });

    btnClearFilters.addEventListener("click", () => {
      search.value = "";
      ownedFilter.value = "all";
      buildFilter.value = "all";
      sortBy.value = "name";
      render();
    });

    btnExport.addEventListener("click", () => {
      const payload = Brawldex.exportState(viewerKey());
      downloadJson(`brawldex-${viewerKey()}.json`, payload);
      toast("success", "Export", "Export JSON telecharge.");
    });

    importFile.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const payload = JSON.parse(text);
        Brawldex.importState(viewerKey(), payload);
        updateSummary();
        render();
        toast("success", "Import", "Brawldex importe.");
      } catch (error) {
        toast("error", "Import", error.message || "Fichier invalide.");
      } finally {
        importFile.value = "";
      }
    });

    btnReset.addEventListener("click", () => {
      const ok = window.confirm("Reinitialiser tout ton Brawldex local ?");
      if (!ok) return;
      Brawldex.resetState(viewerKey());
      updateSummary();
      render();
      closeDetail();
      toast("info", "Reset", "Brawldex reinitialise.");
    });

    window.addEventListener("brawldex:changed", () => {
      updateSummary();
      render();
      if (detailBrawlerId) openDetailById(detailBrawlerId);
    });

    if (btnCloseDetail) btnCloseDetail.addEventListener("click", closeDetail);
    if (detailModal) {
      detailModal.addEventListener("click", (event) => {
        if (event.target === detailModal) closeDetail();
      });
    }

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && detailModal && !detailModal.hidden) closeDetail();
    });
  }

  async function init() {
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
    wireActions();
    applyUrlFilters();
    updateSummary();
    render();
  }

  init();
})();

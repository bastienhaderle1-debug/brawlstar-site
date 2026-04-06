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
  const rules = Brawldex.getRules ? Brawldex.getRules() : { maxPowerLevel: 11 };

  const statOwnedBrawlers = $("statOwnedBrawlers");
  const statTotalBrawlers = $("statTotalBrawlers");
  const statCompletionPct = $("statCompletionPct");
  const statMissingCoins = $("statMissingCoins");
  const statMissingPowerPoints = $("statMissingPowerPoints");
  const statFullBrawlers = $("statFullBrawlers");

  const detailModal = $("brawlerDetailModal");
  const btnCloseDetail = $("btnCloseBrawlerDetail");
  const detailName = $("detailName");
  const detailMeta = $("detailMeta");
  const detailOwned = $("detailOwned");
  const detailLevel = $("detailLevel");
  const detailCompletionPct = $("detailCompletionPct");
  const detailMissingCoins = $("detailMissingCoins");
  const detailMissingPowerPoints = $("detailMissingPowerPoints");
  const detailRelatedSkins = $("detailRelatedSkins");
  const detailProgress = $("detailProgress");
  const detailSummary = $("detailSummary");
  const detailNext = $("detailNext");
  const detailNotes = $("detailNotes");
  const detailUnlocked = $("detailUnlocked");
  const detailMissing = $("detailMissing");
  const detailEditHint = $("detailEditHint");
  const detailOwnedToggle = $("detailOwnedToggle");
  const detailFavoriteToggle = $("detailFavoriteToggle");
  const detailHyperchargeToggle = $("detailHyperchargeToggle");
  const detailPowerInput = $("detailPowerInput");
  const detailTrophiesInput = $("detailTrophiesInput");
  const detailMasteryInput = $("detailMasteryInput");
  const detailGadgets = $("detailGadgets");
  const detailStarPowers = $("detailStarPowers");
  const detailGears = $("detailGears");
  const detailBuffs = $("detailBuffs");
  const detailNotesInput = $("detailNotesInput");

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

  function escapeHtml(value) {
    return safeStr(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function slugify(value) {
    return safeStr(value)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString("fr-FR");
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
      if (build === "maxed" && entry.powerLevel < rules.maxPowerLevel) return false;
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
    statCompletionPct.textContent = `${stats.completionPct}%`;
    statMissingCoins.textContent = formatNumber(stats.missingCoins);
    statMissingPowerPoints.textContent = formatNumber(stats.missingPowerPoints);
    statFullBrawlers.textContent = String(stats.full);

    const lines = [
      `${stats.completionPct}% de progression globale sur ${stats.completionCurrent}/${stats.completionTotal} etapes.`,
      `Il manque ${formatNumber(stats.missingCoins)} pieces et ${formatNumber(stats.missingPowerPoints)} points de pouvoir pour tout full.`,
      insights.recommendations[0] || "Commence par monter les niveaux et cocher les premiers builds."
    ];

    brawlerInsights.innerHTML = "";
    lines.forEach((line) => {
      const p = document.createElement("p");
      p.className = "muted";
      p.textContent = line;
      brawlerInsights.appendChild(p);
    });
  }

  function getMetaById(brawlerId) {
    return getCollection().catalog.find((item) => item.id === brawlerId) || null;
  }

  function getActiveDetailMeta() {
    return detailBrawlerId ? getMetaById(detailBrawlerId) : null;
  }

  function getChoiceMax(meta, field) {
    if (field === "gadgets") return meta.gadgets.length;
    if (field === "starPowers") return meta.starPowers.length;
    if (field === "gears") return meta.gears.length;
    return meta.buffs.length;
  }

  function renderDetailChoiceGroup(target, options, selected, disabled) {
    if (!target) return;
    target.innerHTML = "";

    options.forEach((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "choice-btn";
      button.setAttribute("data-choice-id", option.id);
      button.textContent = option.label;
      button.classList.toggle("is-selected", selected.includes(option.id));
      button.disabled = disabled;
      target.appendChild(button);
    });
  }

  function syncMiniCardState(card, meta, entry) {
    const progress = Brawldex.getProgress(meta, entry);
    const completion = progress.completion;

    card.dataset.owned = entry.owned ? "1" : "0";
    card.querySelector("[data-mini-state]").textContent = entry.owned ? "Possede" : "Manquant";
    card.querySelector("[data-mini-percent]").textContent = `${completion.pct}%`;
    card.querySelector("[data-mini-progress]").style.width = `${completion.pct}%`;
    card.querySelector("[data-mini-level]").textContent = entry.owned ? `Niveau ${entry.powerLevel}` : "Pas encore renseigne";
    card.querySelector("[data-mini-steps]").textContent = `${completion.current}/${completion.total} etapes completees`;
  }

  function syncDetailEditor(meta, entry) {
    if (!detailOwnedToggle) return;
    const completion = Brawldex.getCompletion(meta, entry);
    const disabled = !entry.owned;

    detailOwnedToggle.checked = entry.owned;
    detailFavoriteToggle.checked = entry.favorite;
    detailHyperchargeToggle.checked = entry.hypercharge;
    detailFavoriteToggle.disabled = disabled;
    detailHyperchargeToggle.disabled = disabled;

    detailPowerInput.max = String(rules.maxPowerLevel);
    detailPowerInput.value = String(entry.powerLevel);
    detailTrophiesInput.value = String(entry.trophies);
    detailMasteryInput.value = String(entry.mastery);
    detailNotesInput.value = entry.notes;

    [detailPowerInput, detailTrophiesInput, detailMasteryInput, detailNotesInput].forEach((node) => {
      if (node) node.disabled = disabled;
    });

    renderDetailChoiceGroup(detailGadgets, meta.gadgets, entry.gadgets, disabled);
    renderDetailChoiceGroup(detailStarPowers, meta.starPowers, entry.starPowers, disabled);
    renderDetailChoiceGroup(detailGears, meta.gears, entry.gears, disabled);
    renderDetailChoiceGroup(detailBuffs, meta.buffs, entry.buffs, disabled);

    if (detailEditHint) {
      detailEditHint.textContent = disabled
        ? `Ajoute ${meta.name} a ta collection pour debloquer le niveau, les gadgets, les pouvoirs stars, les equipements, les buffs et l'hypercharge.`
        : `${meta.name} est a ${completion.pct}% de completion. Mets a jour ce build directement ici.`;
    }
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
      if (entry.starPowers.includes(item.id)) unlocked.push(`Pouvoir star: ${item.label}`);
      else missing.push(`Pouvoir star: ${item.label}`);
    });
    meta.gears.forEach((item) => {
      if (entry.gears.includes(item.id)) unlocked.push(`Equipement: ${item.label}`);
      else missing.push(`Equipement: ${item.label}`);
    });
    meta.buffs.forEach((item) => {
      if (entry.buffs.includes(item.id)) unlocked.push(`Buff: ${item.label}`);
      else missing.push(`Buff: ${item.label}`);
    });

    if (entry.hypercharge) unlocked.push("Hypercharge");
    else missing.push("Hypercharge");

    return { unlocked, missing };
  }

  function nextStepFor(meta, entry) {
    if (!entry.owned) return `Ajoute ${meta.name} a ta collection pour commencer son build.`;
    if (entry.powerLevel < rules.maxPowerLevel) {
      return `Monte ${meta.name} au niveau ${Math.min(entry.powerLevel + 1, rules.maxPowerLevel)}.`;
    }

    const firstMissingGadget = meta.gadgets.find((item) => !entry.gadgets.includes(item.id));
    if (firstMissingGadget) return `Debloque le gadget "${firstMissingGadget.label}".`;

    const firstMissingStar = meta.starPowers.find((item) => !entry.starPowers.includes(item.id));
    if (firstMissingStar) return `Ajoute le pouvoir star "${firstMissingStar.label}".`;

    const firstMissingGear = meta.gears.find((item) => !entry.gears.includes(item.id));
    if (firstMissingGear) return `Equipe l'equipement "${firstMissingGear.label}".`;

    const firstMissingBuff = meta.buffs.find((item) => !entry.buffs.includes(item.id));
    if (firstMissingBuff) return `Active le buff "${firstMissingBuff.label}".`;

    if (!entry.hypercharge) return "Vise l'hypercharge pour finaliser le build.";
    return `${meta.name} est complet. Tu peux maintenant optimiser tes notes et tes trophees.`;
  }

  function openDetailByMeta(meta) {
    if (!detailModal || !meta) return;
    const collection = getCollection();
    const entry = collection.entries[meta.id];
    const progress = Brawldex.getProgress(meta, entry);
    const completion = progress.completion;
    const resources = progress.resources;
    const relatedSkins = (Array.isArray(window.SKINS) ? window.SKINS : []).filter((skin) => skin?.brawler === meta.name);
    const unlockLabels = buildUnlockLabels(meta, entry);

    detailBrawlerId = meta.id;
    detailName.textContent = meta.name;
    detailMeta.textContent = `${meta.rarity} - ${meta.role} - ${meta.difficulty}`;
    detailOwned.textContent = entry.owned ? "Possede" : "Manquant";
    detailLevel.textContent = String(entry.powerLevel);
    detailCompletionPct.textContent = `${completion.pct}%`;
    detailMissingCoins.textContent = formatNumber(resources.missing.coins);
    detailMissingPowerPoints.textContent = formatNumber(resources.missing.powerPoints);
    detailRelatedSkins.textContent = String(relatedSkins.length);
    detailProgress.style.width = `${completion.pct}%`;
    detailSummary.textContent =
      `${completion.current}/${completion.total} etapes remplies. Il manque ${formatNumber(resources.missing.coins)} pieces et ` +
      `${formatNumber(resources.missing.powerPoints)} points de pouvoir.`;
    detailNext.textContent = nextStepFor(meta, entry);
    detailNotes.textContent = entry.notes || "Aucune note pour ce brawler.";

    renderDetailTags(detailUnlocked, unlockLabels.unlocked, "Aucun element obtenu");
    renderDetailTags(detailMissing, unlockLabels.missing, "Build complet");
    syncDetailEditor(meta, entry);

    detailModal.hidden = false;
    setBrawlerInUrl(meta.id);
  }

  function openDetailById(brawlerId) {
    const meta = getMetaById(brawlerId);
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
    article.className = "card mini-brawler-card clickable";
    article.dataset.brawlerId = meta.id;
    article.tabIndex = 0;
    article.setAttribute("role", "button");
    article.setAttribute("aria-label", `Ouvrir ${meta.name}`);

    article.innerHTML = `
      <div class="mini-brawler-head">
        <h3>${escapeHtml(meta.name)}</h3>
        <span class="mini-brawler-state" data-mini-state>Manquant</span>
      </div>
      <div class="mini-brawler-percent" data-mini-percent>0%</div>
      <div class="progress"><div class="progress-bar" data-mini-progress style="width:0%"></div></div>
      <p class="muted mini-brawler-level" data-mini-level>Pas encore renseigne</p>
      <p class="small mini-brawler-steps" data-mini-steps>0/0 etapes completees</p>
    `;

    article.addEventListener("click", () => openDetailByMeta(meta));
    article.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openDetailByMeta(meta);
      }
    });

    syncMiniCardState(article, meta, entry);
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
        : "Mode local visiteur: connecte-toi au Quartier general pour lier ta collection a ton compte.";

      supa.auth.onAuthStateChange((_event, session) => {
        const nextUser = session?.user ?? null;
        viewerId = nextUser?.id || "visitor";
        accountLine.textContent = nextUser
          ? `Collection locale liee a ${nextUser.email ?? nextUser.id}.`
          : "Mode local visiteur: connecte-toi au Quartier general pour lier ta collection a ton compte.";
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

    if (detailOwnedToggle) {
      detailOwnedToggle.addEventListener("change", (event) => {
        const meta = getActiveDetailMeta();
        if (!meta) return;
        const next = Brawldex.patchEntry(viewerKey(), meta.id, { owned: event.target.checked });
        if (!next) return;
        toast("success", "Brawler", `${meta.name} ${next.owned ? "ajoute" : "retire"} de ta collection.`);
      });
    }

    if (detailFavoriteToggle) {
      detailFavoriteToggle.addEventListener("change", (event) => {
        const meta = getActiveDetailMeta();
        if (!meta) return;
        Brawldex.patchEntry(viewerKey(), meta.id, { favorite: event.target.checked });
      });
    }

    if (detailHyperchargeToggle) {
      detailHyperchargeToggle.addEventListener("change", (event) => {
        const meta = getActiveDetailMeta();
        if (!meta) return;
        Brawldex.patchEntry(viewerKey(), meta.id, { hypercharge: event.target.checked, owned: true });
      });
    }

    [
      { node: detailPowerInput, field: "powerLevel" },
      { node: detailTrophiesInput, field: "trophies" },
      { node: detailMasteryInput, field: "mastery" }
    ].forEach(({ node, field }) => {
      if (!node) return;
      node.addEventListener("change", (event) => {
        const meta = getActiveDetailMeta();
        if (!meta) return;
        Brawldex.patchEntry(viewerKey(), meta.id, { [field]: event.target.value, owned: true });
      });
    });

    [detailGadgets, detailStarPowers, detailGears, detailBuffs].forEach((group) => {
      if (!group) return;
      group.addEventListener("click", (event) => {
        const meta = getActiveDetailMeta();
        const button = event.target.closest("[data-choice-id]");
        const field = group.getAttribute("data-detail-choice-group");
        if (!meta || !button || !field || button.disabled) return;
        Brawldex.toggleChoice(viewerKey(), meta.id, field, button.getAttribute("data-choice-id"), getChoiceMax(meta, field));
      });
    });

    if (detailNotesInput) {
      detailNotesInput.addEventListener("change", (event) => {
        const meta = getActiveDetailMeta();
        if (!meta) return;
        Brawldex.patchEntry(viewerKey(), meta.id, { notes: event.target.value, owned: true });
      });
    }

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

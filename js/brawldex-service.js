(function () {
  const CONFIG = window.BRAWLDEX_DATA || {};
  const STORAGE_PREFIX = "brawldex_v2";
  const MAX_ACTIVITY = 40;
  const DEFAULT_PROFILE = {
    playerTag: "",
    club: "",
    favoriteMode: "",
    mainBrawler: "",
    goal: ""
  };

  function safeStr(value) {
    return (value ?? "").toString();
  }

  function slugify(value) {
    return safeStr(value)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "brawler";
  }

  function uniqueSorted(values) {
    return [...new Set(values.map((value) => safeStr(value).trim()).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, "fr")
    );
  }

  function storageKey(userId) {
    const viewer = safeStr(userId).trim() || "visitor";
    return `${STORAGE_PREFIX}:${viewer}`;
  }

  function readStorage(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function getCatalog() {
    const fromSkins = Array.isArray(window.SKINS) ? window.SKINS.map((skin) => skin?.brawler) : [];
    const names = uniqueSorted([...(CONFIG.fallbackBrawlers || []), ...fromSkins]);
    return names.map((name) => buildMeta(name));
  }

  function buildMeta(name) {
    const preset = (CONFIG.presets || {})[name] || {};
    return {
      id: preset.id || slugify(name),
      name,
      rarity: preset.rarity || "Collection",
      role: preset.role || "Polyvalent",
      difficulty: preset.difficulty || "A definir",
      gadgets: Array.isArray(preset.gadgets) && preset.gadgets.length ? preset.gadgets : CONFIG.gadgetOptions || [],
      starPowers:
        Array.isArray(preset.starPowers) && preset.starPowers.length ? preset.starPowers : CONFIG.starPowerOptions || [],
      gears: Array.isArray(CONFIG.gearOptions) ? CONFIG.gearOptions : []
    };
  }

  function normalizeProfile(profile) {
    return {
      playerTag: safeStr(profile?.playerTag).trim(),
      club: safeStr(profile?.club).trim(),
      favoriteMode: safeStr(profile?.favoriteMode).trim(),
      mainBrawler: safeStr(profile?.mainBrawler).trim(),
      goal: safeStr(profile?.goal).trim()
    };
  }

  function defaultEntry(meta) {
    return {
      id: meta.id,
      name: meta.name,
      owned: false,
      powerLevel: 1,
      trophies: 0,
      mastery: 0,
      gadgets: [],
      starPowers: [],
      gears: [],
      hypercharge: false,
      favorite: false,
      notes: ""
    };
  }

  function normalizeNumber(value, min, max, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, Math.round(parsed)));
  }

  function normalizeChoices(values, allowed, maxSize) {
    const allowedSet = new Set(allowed || []);
    const list = Array.isArray(values) ? values : [];
    return [...new Set(list.filter((item) => allowedSet.has(item)))].slice(0, maxSize);
  }

  function normalizeEntry(meta, entry) {
    const base = defaultEntry(meta);
    return {
      ...base,
      ...entry,
      id: meta.id,
      name: meta.name,
      owned: !!entry?.owned,
      powerLevel: normalizeNumber(entry?.powerLevel, 1, 11, 1),
      trophies: normalizeNumber(entry?.trophies, 0, 99999, 0),
      mastery: normalizeNumber(entry?.mastery, 0, 30000, 0),
      gadgets: normalizeChoices(entry?.gadgets, meta.gadgets.map((item) => item.id), 2),
      starPowers: normalizeChoices(entry?.starPowers, meta.starPowers.map((item) => item.id), 2),
      gears: normalizeChoices(entry?.gears, meta.gears.map((item) => item.id), meta.gears.length),
      hypercharge: !!entry?.hypercharge,
      favorite: !!entry?.favorite,
      notes: safeStr(entry?.notes).trim()
    };
  }

  function normalizeActivityItem(item) {
    return {
      type: safeStr(item?.type).trim() || "update",
      title: safeStr(item?.title).trim() || "Mise a jour",
      detail: safeStr(item?.detail).trim(),
      ts: safeStr(item?.ts).trim() || new Date().toISOString()
    };
  }

  function loadState(userId) {
    const state = readStorage(storageKey(userId)) || {};
    return {
      version: 2,
      updatedAt: safeStr(state.updatedAt).trim() || null,
      profile: normalizeProfile(state.profile || DEFAULT_PROFILE),
      brawlers: state.brawlers && typeof state.brawlers === "object" ? state.brawlers : {},
      activities: Array.isArray(state.activities) ? state.activities.map(normalizeActivityItem).slice(0, MAX_ACTIVITY) : []
    };
  }

  function saveState(userId, state) {
    const payload = {
      version: 2,
      updatedAt: new Date().toISOString(),
      profile: normalizeProfile(state.profile),
      brawlers: state.brawlers || {},
      activities: Array.isArray(state.activities) ? state.activities.map(normalizeActivityItem).slice(0, MAX_ACTIVITY) : []
    };

    writeStorage(storageKey(userId), payload);
    window.dispatchEvent(
      new CustomEvent("brawldex:changed", {
        detail: { userId: safeStr(userId).trim() || "visitor", state: payload }
      })
    );
    return payload;
  }

  function pushActivity(state, activity) {
    const item = normalizeActivityItem(activity);
    const next = [item, ...(state.activities || [])];
    state.activities = next.slice(0, MAX_ACTIVITY);
  }

  function getCollection(userId) {
    const catalog = getCatalog();
    const state = loadState(userId);
    const entries = {};

    catalog.forEach((meta) => {
      entries[meta.id] = normalizeEntry(meta, state.brawlers[meta.id]);
    });

    return {
      catalog,
      profile: normalizeProfile(state.profile),
      entries,
      updatedAt: state.updatedAt,
      activities: state.activities || []
    };
  }

  function getCompletion(meta, entry) {
    const total = meta.gadgets.length + meta.starPowers.length + meta.gears.length + 1;
    const current = entry.gadgets.length + entry.starPowers.length + entry.gears.length + (entry.hypercharge ? 1 : 0);
    return { current, total };
  }

  function patchEntry(userId, brawlerId, patch) {
    const collection = getCollection(userId);
    const meta = collection.catalog.find((item) => item.id === brawlerId);
    if (!meta) return null;

    const state = loadState(userId);
    const previous = collection.entries[brawlerId];
    const nextEntry = normalizeEntry(meta, {
      ...previous,
      ...patch
    });

    if (!nextEntry.owned) {
      nextEntry.powerLevel = 1;
      nextEntry.trophies = 0;
      nextEntry.mastery = 0;
      nextEntry.gadgets = [];
      nextEntry.starPowers = [];
      nextEntry.gears = [];
      nextEntry.hypercharge = false;
    }

    state.brawlers[brawlerId] = nextEntry;

    if (previous.owned !== nextEntry.owned) {
      pushActivity(state, {
        type: "owned",
        title: nextEntry.owned ? `${meta.name} ajoute` : `${meta.name} retire`,
        detail: nextEntry.owned ? "Le brawler rejoint ta collection." : "Le brawler est sorti de ta collection."
      });
    } else if (previous.powerLevel !== nextEntry.powerLevel) {
      pushActivity(state, {
        type: "power",
        title: `${meta.name} passe puissance ${nextEntry.powerLevel}`,
        detail: `Ancienne puissance : ${previous.powerLevel}`
      });
    } else if (previous.hypercharge !== nextEntry.hypercharge) {
      pushActivity(state, {
        type: "hypercharge",
        title: nextEntry.hypercharge ? `Hypercharge debloquee pour ${meta.name}` : `Hypercharge retiree pour ${meta.name}`,
        detail: nextEntry.hypercharge ? "Build complete en progression." : ""
      });
    } else if (previous.favorite !== nextEntry.favorite) {
      pushActivity(state, {
        type: "favorite",
        title: nextEntry.favorite ? `${meta.name} passe en favori` : `${meta.name} n'est plus favori`,
        detail: ""
      });
    } else if (
      previous.gadgets.length !== nextEntry.gadgets.length ||
      previous.starPowers.length !== nextEntry.starPowers.length ||
      previous.gears.length !== nextEntry.gears.length
    ) {
      const completion = getCompletion(meta, nextEntry);
      pushActivity(state, {
        type: "build",
        title: `Build mis a jour pour ${meta.name}`,
        detail: `${completion.current}/${completion.total} unlocks equipes.`
      });
    }

    saveState(userId, state);
    return nextEntry;
  }

  function toggleChoice(userId, brawlerId, field, optionId, maxSize) {
    const collection = getCollection(userId);
    const current = collection.entries[brawlerId];
    if (!current) return null;

    const set = new Set(Array.isArray(current[field]) ? current[field] : []);
    if (set.has(optionId)) set.delete(optionId);
    else if (set.size < maxSize) set.add(optionId);

    return patchEntry(userId, brawlerId, { [field]: [...set], owned: true });
  }

  function updateProfile(userId, patch) {
    const state = loadState(userId);
    state.profile = normalizeProfile({
      ...state.profile,
      ...patch
    });
    pushActivity(state, {
      type: "profile",
      title: "Profil perso mis a jour",
      detail: state.profile.mainBrawler ? `Main actuel : ${state.profile.mainBrawler}` : ""
    });
    saveState(userId, state);
    return state.profile;
  }

  function getUnlockStats(entry) {
    const gadgets = entry.gadgets.length;
    const starPowers = entry.starPowers.length;
    const gears = entry.gears.length;
    const hypercharges = entry.hypercharge ? 1 : 0;
    return {
      gadgets,
      starPowers,
      gears,
      hypercharges,
      total: gadgets + starPowers + gears + hypercharges
    };
  }

  function getStats(userId) {
    const collection = getCollection(userId);
    const list = collection.catalog.map((meta) => ({
      meta,
      entry: collection.entries[meta.id]
    }));
    const owned = list.filter((item) => item.entry.owned);

    let trophies = 0;
    let powerSum = 0;
    let mastery = 0;
    let gadgets = 0;
    let starPowers = 0;
    let gears = 0;
    let hypercharges = 0;
    let favorites = 0;
    let maxed = 0;
    let incompleteOwned = 0;

    owned.forEach(({ meta, entry }) => {
      trophies += entry.trophies;
      powerSum += entry.powerLevel;
      mastery += entry.mastery;
      gadgets += entry.gadgets.length;
      starPowers += entry.starPowers.length;
      gears += entry.gears.length;
      if (entry.hypercharge) hypercharges++;
      if (entry.favorite) favorites++;
      if (entry.powerLevel >= 11) maxed++;
      const completion = getCompletion(meta, entry);
      if (completion.current < completion.total) incompleteOwned++;
    });

    const total = list.length;
    const ownedCount = owned.length;
    const pct = total > 0 ? Math.round((ownedCount / total) * 100) : 0;
    const avgPower = ownedCount > 0 ? (powerSum / ownedCount).toFixed(1) : "0.0";

    return {
      total,
      owned: ownedCount,
      pct,
      trophies,
      mastery,
      avgPower,
      gadgets,
      starPowers,
      gears,
      hypercharges,
      favorites,
      maxed,
      incompleteOwned,
      unlocks: gadgets + starPowers + gears + hypercharges
    };
  }

  function getTopBrawlers(userId, limit = 5) {
    const collection = getCollection(userId);
    return collection.catalog
      .map((meta) => ({ meta, entry: collection.entries[meta.id] }))
      .filter(({ entry }) => entry.owned)
      .sort((a, b) => {
        if (a.entry.favorite !== b.entry.favorite) return a.entry.favorite ? -1 : 1;
        if (a.entry.trophies !== b.entry.trophies) return b.entry.trophies - a.entry.trophies;
        if (a.entry.powerLevel !== b.entry.powerLevel) return b.entry.powerLevel - a.entry.powerLevel;
        if (a.entry.mastery !== b.entry.mastery) return b.entry.mastery - a.entry.mastery;
        return a.meta.name.localeCompare(b.meta.name, "fr");
      })
      .slice(0, limit);
  }

  function getActivity(userId, limit = 8) {
    return getCollection(userId).activities.slice(0, limit);
  }

  function getInsights(userId) {
    const collection = getCollection(userId);
    const stats = getStats(userId);
    const profile = collection.profile;
    const items = collection.catalog.map((meta) => ({
      meta,
      entry: collection.entries[meta.id],
      completion: getCompletion(meta, collection.entries[meta.id])
    }));

    const nextOwnedGoal = items
      .filter(({ entry, completion }) => entry.owned && completion.current < completion.total)
      .sort((a, b) => {
        if (a.entry.powerLevel !== b.entry.powerLevel) return b.entry.powerLevel - a.entry.powerLevel;
        return b.completion.current - a.completion.current;
      })[0];

    const nextMissingBrawler = items.find(({ entry }) => !entry.owned) || null;

    const recommendations = [];
    if (nextOwnedGoal) {
      recommendations.push(`Completer le build de ${nextOwnedGoal.meta.name} (${nextOwnedGoal.completion.current}/${nextOwnedGoal.completion.total}).`);
    }
    if (nextMissingBrawler) {
      recommendations.push(`Ajouter ${nextMissingBrawler.meta.name} a ta collection pour monter a ${stats.owned + 1}/${stats.total}.`);
    }
    if (!profile.mainBrawler) {
      recommendations.push("Definir ton main brawler dans MyBrawl pour personnaliser davantage ton dashboard.");
    }
    if (stats.hypercharges === 0 && stats.owned > 0) {
      recommendations.push("Debloquer une premiere hypercharge pour lancer ta progression avancee.");
    }

    const badges = [];
    if (stats.owned >= 10) badges.push({ label: "Collectionneur", detail: `${stats.owned} brawlers possedes` });
    if (stats.maxed >= 3) badges.push({ label: "Maxeur", detail: `${stats.maxed} brawlers puissance 11` });
    if (stats.hypercharges >= 2) badges.push({ label: "Charge max", detail: `${stats.hypercharges} hypercharges debloquees` });
    if (stats.favorites >= 3) badges.push({ label: "Main roster", detail: `${stats.favorites} favoris prepares` });
    if (profile.club) badges.push({ label: "Team player", detail: `Club: ${profile.club}` });

    return {
      recommendations: recommendations.slice(0, 4),
      badges: badges.slice(0, 6)
    };
  }

  function exportState(userId) {
    const state = loadState(userId);
    return {
      exportedAt: new Date().toISOString(),
      userId: safeStr(userId).trim() || "visitor",
      profile: normalizeProfile(state.profile),
      brawlers: state.brawlers || {},
      activities: state.activities || []
    };
  }

  function importState(userId, payload) {
    const incoming = payload && typeof payload === "object" ? payload : {};
    const catalog = getCatalog();
    const incomingBrawlers = incoming.brawlers && typeof incoming.brawlers === "object" ? incoming.brawlers : {};
    const nextState = loadState(userId);

    nextState.profile = normalizeProfile(incoming.profile || nextState.profile);
    nextState.brawlers = {};

    catalog.forEach((meta) => {
      nextState.brawlers[meta.id] = normalizeEntry(meta, incomingBrawlers[meta.id]);
    });

    nextState.activities = Array.isArray(incoming.activities)
      ? incoming.activities.map(normalizeActivityItem).slice(0, MAX_ACTIVITY)
      : [];

    pushActivity(nextState, {
      type: "import",
      title: "Import Brawldex effectue",
      detail: `Collection importee le ${new Date().toLocaleDateString("fr-FR")}.`
    });

    saveState(userId, nextState);
    return getCollection(userId);
  }

  function resetState(userId) {
    const state = {
      version: 2,
      updatedAt: null,
      profile: normalizeProfile(DEFAULT_PROFILE),
      brawlers: {},
      activities: []
    };

    pushActivity(state, {
      type: "reset",
      title: "Brawldex reinitialise",
      detail: "Tu repars sur une collection vide."
    });
    saveState(userId, state);
    return getCollection(userId);
  }

  window.BrawldexService = {
    getCatalog,
    getCollection,
    getProfile(userId) {
      return getCollection(userId).profile;
    },
    updateProfile,
    patchEntry,
    toggleChoice,
    getStats,
    getTopBrawlers,
    getUnlockStats,
    getCompletion,
    getActivity,
    getInsights,
    exportState,
    importState,
    resetState
  };
})();

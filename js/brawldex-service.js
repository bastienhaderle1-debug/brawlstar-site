(function () {
  const CONFIG = window.BRAWLDEX_DATA || {};
  const STORAGE_PREFIX = "brawldex_v2";
  const MAX_ACTIVITY = 40;
  const DEFAULT_LEVEL_COSTS = [
    { fromLevel: 1, powerPoints: 20, coins: 20 },
    { fromLevel: 2, powerPoints: 35, coins: 30 },
    { fromLevel: 3, powerPoints: 75, coins: 50 },
    { fromLevel: 4, powerPoints: 140, coins: 80 },
    { fromLevel: 5, powerPoints: 290, coins: 130 },
    { fromLevel: 6, powerPoints: 480, coins: 210 },
    { fromLevel: 7, powerPoints: 800, coins: 340 },
    { fromLevel: 8, powerPoints: 1250, coins: 550 },
    { fromLevel: 9, powerPoints: 1875, coins: 890 },
    { fromLevel: 10, powerPoints: 2800, coins: 1440 }
  ];
  const DEFAULT_UPGRADE_COSTS = {
    gear: { coins: 1000, powerPoints: 0 },
    hypercharge: { coins: 5000, powerPoints: 0 },
    buff: { coins: 1000, powerPoints: 2000 },
    starPower: { coins: 2000, powerPoints: 0 },
    gadget: { coins: 1000, powerPoints: 0 }
  };
  const LEVEL_COSTS = Array.isArray(CONFIG.levelCosts) && CONFIG.levelCosts.length ? CONFIG.levelCosts : DEFAULT_LEVEL_COSTS;
  const UPGRADE_COSTS = {
    gear: { ...DEFAULT_UPGRADE_COSTS.gear, ...(CONFIG.upgradeCosts?.gear || {}) },
    hypercharge: { ...DEFAULT_UPGRADE_COSTS.hypercharge, ...(CONFIG.upgradeCosts?.hypercharge || {}) },
    buff: { ...DEFAULT_UPGRADE_COSTS.buff, ...(CONFIG.upgradeCosts?.buff || {}) },
    starPower: { ...DEFAULT_UPGRADE_COSTS.starPower, ...(CONFIG.upgradeCosts?.starPower || {}) },
    gadget: { ...DEFAULT_UPGRADE_COSTS.gadget, ...(CONFIG.upgradeCosts?.gadget || {}) }
  };
  const MAX_POWER_LEVEL = LEVEL_COSTS.length + 1;
  const DEFAULT_PROFILE = {
    playerTag: "",
    club: "",
    favoriteMode: "",
    mainBrawler: "",
    goal: "",
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
      gears: Array.isArray(CONFIG.gearOptions) ? CONFIG.gearOptions : [],
      buffs: Array.isArray(CONFIG.buffOptions) ? CONFIG.buffOptions : []
    };
  }

  function emptyResources() {
    return { coins: 0, powerPoints: 0 };
  }

  function withResources(cost) {
    return {
      coins: normalizeNumber(cost?.coins, 0, 99999999, 0),
      powerPoints: normalizeNumber(cost?.powerPoints, 0, 99999999, 0)
    };
  }

  function addResources(target, cost) {
    const bag = withResources(cost);
    target.coins += bag.coins;
    target.powerPoints += bag.powerPoints;
    return target;
  }

  function multiplyResources(cost, count) {
    const bag = withResources(cost);
    const qty = Math.max(0, Number(count) || 0);
    return {
      coins: bag.coins * qty,
      powerPoints: bag.powerPoints * qty
    };
  }

  function subtractResources(total, current) {
    return {
      coins: Math.max(0, total.coins - current.coins),
      powerPoints: Math.max(0, total.powerPoints - current.powerPoints)
    };
  }

  function normalizeProfile(profile) {
    return {
      playerTag: safeStr(profile?.playerTag).trim(),
      club: safeStr(profile?.club).trim(),
      favoriteMode: safeStr(profile?.favoriteMode).trim(),
      mainBrawler: safeStr(profile?.mainBrawler).trim(),
      goal: safeStr(profile?.goal).trim(),
      playerName: safeStr(profile?.playerName).trim(),
      apiClubName: safeStr(profile?.apiClubName).trim(),
      apiClubTag: safeStr(profile?.apiClubTag).trim(),
      apiFavoriteBrawler: safeStr(profile?.apiFavoriteBrawler).trim(),
      apiSyncedAt: safeStr(profile?.apiSyncedAt).trim(),
      trophies: normalizeNumber(profile?.trophies, 0, 999999, 0),
      highestTrophies: normalizeNumber(profile?.highestTrophies, 0, 999999, 0),
      expLevel: normalizeNumber(profile?.expLevel, 0, 9999, 0),
      victories3v3: normalizeNumber(profile?.victories3v3, 0, 999999, 0),
      soloVictories: normalizeNumber(profile?.soloVictories, 0, 999999, 0),
      duoVictories: normalizeNumber(profile?.duoVictories, 0, 999999, 0),
      brawlersCount: normalizeNumber(profile?.brawlersCount, 0, 9999, 0)
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
      buffs: [],
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
    const normalized = {
      ...base,
      ...entry,
      id: meta.id,
      name: meta.name,
      owned: !!entry?.owned,
      powerLevel: normalizeNumber(entry?.powerLevel, 1, MAX_POWER_LEVEL, 1),
      trophies: normalizeNumber(entry?.trophies, 0, 99999, 0),
      mastery: normalizeNumber(entry?.mastery, 0, 30000, 0),
      gadgets: normalizeChoices(entry?.gadgets, meta.gadgets.map((item) => item.id), 2),
      starPowers: normalizeChoices(entry?.starPowers, meta.starPowers.map((item) => item.id), 2),
      gears: normalizeChoices(entry?.gears, meta.gears.map((item) => item.id), meta.gears.length),
      buffs: normalizeChoices(entry?.buffs, meta.buffs.map((item) => item.id), meta.buffs.length),
      hypercharge: !!entry?.hypercharge,
      favorite: !!entry?.favorite,
      notes: safeStr(entry?.notes).trim()
    };

    if (!normalized.owned) {
      normalized.powerLevel = 1;
      normalized.trophies = 0;
      normalized.mastery = 0;
      normalized.gadgets = [];
      normalized.starPowers = [];
      normalized.gears = [];
      normalized.buffs = [];
      normalized.hypercharge = false;
    }

    return normalized;
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

  function getBuildItemCounts(entry) {
    return {
      gadgets: entry.gadgets.length,
      starPowers: entry.starPowers.length,
      gears: entry.gears.length,
      buffs: entry.buffs.length,
      hypercharges: entry.hypercharge ? 1 : 0
    };
  }

  function getLevelResources(powerLevel) {
    const current = emptyResources();
    const total = emptyResources();

    LEVEL_COSTS.forEach((cost) => {
      addResources(total, cost);
      if (cost.fromLevel < powerLevel) addResources(current, cost);
    });

    return {
      current,
      total,
      missing: subtractResources(total, current)
    };
  }

  function getResourceProgress(meta, entry) {
    const levelResources = getLevelResources(entry.powerLevel);
    const counts = getBuildItemCounts(entry);
    const current = {
      coins: levelResources.current.coins,
      powerPoints: levelResources.current.powerPoints
    };
    const total = {
      coins: levelResources.total.coins,
      powerPoints: levelResources.total.powerPoints
    };

    addResources(total, multiplyResources(UPGRADE_COSTS.gadget, meta.gadgets.length));
    addResources(total, multiplyResources(UPGRADE_COSTS.starPower, meta.starPowers.length));
    addResources(total, multiplyResources(UPGRADE_COSTS.gear, meta.gears.length));
    addResources(total, multiplyResources(UPGRADE_COSTS.buff, meta.buffs.length));
    addResources(total, UPGRADE_COSTS.hypercharge);

    addResources(current, multiplyResources(UPGRADE_COSTS.gadget, counts.gadgets));
    addResources(current, multiplyResources(UPGRADE_COSTS.starPower, counts.starPowers));
    addResources(current, multiplyResources(UPGRADE_COSTS.gear, counts.gears));
    addResources(current, multiplyResources(UPGRADE_COSTS.buff, counts.buffs));
    if (entry.hypercharge) addResources(current, UPGRADE_COSTS.hypercharge);

    return {
      current,
      total,
      missing: subtractResources(total, current)
    };
  }

  function getCompletion(meta, entry) {
    const counts = getBuildItemCounts(entry);
    const total = LEVEL_COSTS.length + meta.gadgets.length + meta.starPowers.length + meta.gears.length + meta.buffs.length + 1;
    const current =
      Math.max(0, entry.powerLevel - 1) +
      counts.gadgets +
      counts.starPowers +
      counts.gears +
      counts.buffs +
      counts.hypercharges;
    const pct = total > 0 ? Math.round((current / total) * 100) : 0;
    return { current, total, pct };
  }

  function getProgress(meta, entry) {
    return {
      completion: getCompletion(meta, entry),
      resources: getResourceProgress(meta, entry)
    };
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
      nextEntry.buffs = [];
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
        title: `${meta.name} passe niveau ${nextEntry.powerLevel}`,
        detail: `Ancien niveau : ${previous.powerLevel}`
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
      previous.gears.length !== nextEntry.gears.length ||
      previous.buffs.length !== nextEntry.buffs.length
    ) {
      const completion = getCompletion(meta, nextEntry);
      pushActivity(state, {
        type: "build",
        title: `Build mis a jour pour ${meta.name}`,
        detail: `${completion.current}/${completion.total} etapes de progression renseignees.`
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
    const { gadgets, starPowers, gears, buffs, hypercharges } = getBuildItemCounts(entry);
    return {
      gadgets,
      starPowers,
      gears,
      buffs,
      hypercharges,
      total: gadgets + starPowers + gears + buffs + hypercharges
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
    let buffs = 0;
    let hypercharges = 0;
    let favorites = 0;
    let maxed = 0;
    let full = 0;
    let incompleteOwned = 0;
    let completionCurrent = 0;
    let completionTotal = 0;
    const resourceCurrent = emptyResources();
    const resourceTotal = emptyResources();

    owned.forEach(({ meta, entry }) => {
      trophies += entry.trophies;
      powerSum += entry.powerLevel;
      mastery += entry.mastery;
      gadgets += entry.gadgets.length;
      starPowers += entry.starPowers.length;
      gears += entry.gears.length;
      buffs += entry.buffs.length;
      if (entry.hypercharge) hypercharges++;
      if (entry.favorite) favorites++;
      if (entry.powerLevel >= MAX_POWER_LEVEL) maxed++;
      const completion = getCompletion(meta, entry);
      if (completion.current < completion.total) incompleteOwned++;
      else full++;
    });

    list.forEach(({ meta, entry }) => {
      const completion = getCompletion(meta, entry);
      const resources = getResourceProgress(meta, entry);
      completionCurrent += completion.current;
      completionTotal += completion.total;
      addResources(resourceCurrent, resources.current);
      addResources(resourceTotal, resources.total);
    });

    const total = list.length;
    const ownedCount = owned.length;
    const pct = total > 0 ? Math.round((ownedCount / total) * 100) : 0;
    const completionPct = completionTotal > 0 ? Math.round((completionCurrent / completionTotal) * 100) : 0;
    const avgPower = ownedCount > 0 ? (powerSum / ownedCount).toFixed(1) : "0.0";
    const missingResources = subtractResources(resourceTotal, resourceCurrent);

    return {
      total,
      owned: ownedCount,
      pct,
      ownedPct: pct,
      completionPct,
      completionCurrent,
      completionTotal,
      trophies,
      mastery,
      avgPower,
      gadgets,
      starPowers,
      gears,
      buffs,
      hypercharges,
      favorites,
      maxed,
      full,
      incompleteOwned,
      resources: {
        current: resourceCurrent,
        total: resourceTotal,
        missing: missingResources
      },
      missingCoins: missingResources.coins,
      missingPowerPoints: missingResources.powerPoints,
      unlocks: gadgets + starPowers + gears + buffs + hypercharges
    };
  }

  function buildGlobalProgress(brawlerStats, skinStats) {
    const brawlers = brawlerStats || {};
    const skins = skinStats || {};
    const completionCurrent = normalizeNumber(brawlers.completionCurrent, 0, 999999999, 0);
    const completionTotal = normalizeNumber(brawlers.completionTotal, 0, 999999999, 0);
    const ownedSkins = normalizeNumber(skins.owned, 0, 999999999, 0);
    const totalSkins = normalizeNumber(skins.total, 0, 999999999, 0);
    const current = completionCurrent + ownedSkins;
    const total = completionTotal + totalSkins;
    const globalPct = total > 0 ? Math.round((current / total) * 100) : 0;

    return {
      current,
      total,
      globalPct,
      brawlerPct: normalizeNumber(brawlers.completionPct, 0, 100, 0),
      skinsPct: normalizeNumber(skins.pct, 0, 100, 0),
      ownedBrawlers: normalizeNumber(brawlers.owned, 0, 999999999, 0),
      totalBrawlers: normalizeNumber(brawlers.total, 0, 999999999, 0),
      ownedSkins,
      totalSkins,
      missingCoins: normalizeNumber(brawlers.missingCoins, 0, 999999999, 0),
      missingPowerPoints: normalizeNumber(brawlers.missingPowerPoints, 0, 999999999, 0),
      hypercharges: normalizeNumber(brawlers.hypercharges, 0, 999999999, 0),
      fullBrawlers: normalizeNumber(brawlers.full, 0, 999999999, 0)
    };
  }

  function getGlobalProgress(userId, skinStats) {
    return buildGlobalProgress(getStats(userId), skinStats);
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
      recommendations.push(
        `Completer ${nextOwnedGoal.meta.name} (${nextOwnedGoal.completion.current}/${nextOwnedGoal.completion.total} etapes).`
      );
    }
    if (nextMissingBrawler) {
      recommendations.push(`Ajouter ${nextMissingBrawler.meta.name} a ta collection pour monter a ${stats.owned + 1}/${stats.total}.`);
    }
    if (!profile.mainBrawler) {
      recommendations.push("Definir ton main brawler dans le Quartier general pour personnaliser davantage ton espace.");
    }
    if (stats.hypercharges === 0 && stats.owned > 0) {
      recommendations.push("Debloquer une premiere hypercharge pour lancer ta progression avancee.");
    }
    if (stats.missingCoins > 0 || stats.missingPowerPoints > 0) {
      recommendations.push(
        `Il manque encore ${stats.missingCoins} pieces et ${stats.missingPowerPoints} points de pouvoir pour tout full.`
      );
    }

    const badges = [];
    if (stats.owned >= 10) badges.push({ label: "Collectionneur", detail: `${stats.owned} brawlers possedes` });
    if (stats.maxed >= 3) badges.push({ label: "Maxeur", detail: `${stats.maxed} brawlers niveau ${MAX_POWER_LEVEL}` });
    if (stats.hypercharges >= 2) badges.push({ label: "Charge max", detail: `${stats.hypercharges} hypercharges debloquees` });
    if (stats.favorites >= 3) badges.push({ label: "Line-up", detail: `${stats.favorites} favoris prepares` });
    if (stats.completionPct >= 50) badges.push({ label: "Mi-parcours", detail: `${stats.completionPct}% de progression totale` });
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
    getRules() {
      return {
        maxPowerLevel: MAX_POWER_LEVEL,
        levelCosts: LEVEL_COSTS.map((item) => ({ ...item })),
        upgradeCosts: {
          gear: { ...UPGRADE_COSTS.gear },
          hypercharge: { ...UPGRADE_COSTS.hypercharge },
          buff: { ...UPGRADE_COSTS.buff },
          starPower: { ...UPGRADE_COSTS.starPower },
          gadget: { ...UPGRADE_COSTS.gadget }
        }
      };
    },
    getProfile(userId) {
      return getCollection(userId).profile;
    },
    updateProfile,
    patchEntry,
    toggleChoice,
    getStats,
    buildGlobalProgress,
    getGlobalProgress,
    getTopBrawlers,
    getUnlockStats,
    getCompletion,
    getProgress,
    getActivity,
    getInsights,
    exportState,
    importState,
    resetState
  };
})();

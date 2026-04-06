const fs = require("fs/promises");
const path = require("path");

const SNAPSHOT_PATH = path.resolve(__dirname, "../data/skins.json");
const DEFAULT_REMOTE_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTBmk7mXFfMQ_wUabmypt3E8nAz3bDf2tNq1oFIZVJk1f51juAqw19_VBPhQ9LhBGTBUz56Q4nfOfN1/pub?output=csv";
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_CACHE_TTL_MS = 60000;
const FALLBACK_RARITY_ORDER = ["Rare", "Super Rare", "Epic", "Mythique", "Legendaire", "Hypercharge", "Argent", "Or"];
const DEFAULT_FIELD_MAP = {
  id: "id",
  name: "name",
  brawler: "brawler",
  category: "category",
  rarity: "rarity",
  img: "img_path"
};

let cachedCatalog = null;
let cachedAt = 0;

function safeStr(value) {
  return (value ?? "").toString().trim();
}

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeRarity(value) {
  const rarity = safeStr(value);
  if (!rarity) return "Collection";
  const normalizedKey = rarity
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (normalizedKey === "legendaire" || normalizedKey === "legendary") return "Legendaire";
  return rarity;
}

function normalizeImageValue(value, assetBaseUrl) {
  const img = safeStr(value);
  if (!img) return "";
  if (/^(https?:)?\/\//i.test(img) || img.startsWith("/") || img.startsWith("data:")) return img;

  const base = safeStr(assetBaseUrl).replace(/\/+$/, "");
  if (!base) return "";
  return `${base}/${img.replace(/^\/+/, "")}`;
}

function splitCsvLine(text) {
  const values = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (insideQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (char === "," && !insideQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values.map((value) => value.trim());
}

function parseCsv(text) {
  const rows = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (insideQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (current.trim()) rows.push(splitCsvLine(current));
      current = "";
      if (char === "\r" && next === "\n") index += 1;
      continue;
    }

    current += char;
  }

  if (current.trim()) rows.push(splitCsvLine(current));
  return rows;
}

function csvRowsToObjects(rows) {
  if (!Array.isArray(rows) || !rows.length) return [];
  const headers = rows[0].map((value) => safeStr(value));
  return rows.slice(1).map((values) => {
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });
    return row;
  });
}

function normalizeSkin(raw, fieldMap, assetBaseUrl) {
  const aliases = {
    id: ["id", "skin_id", "identifiant"],
    name: ["name", "nom", "skin", "skin_name"],
    brawler: ["brawler", "brawler_name", "personnage"],
    category: ["category", "categorie", "theme", "collection"],
    rarity: ["rarity", "rarete", "rarite"],
    img: ["img", "image", "image_url", "img_path", "picture", "visuel"]
  };

  const get = (primary, fallback) => {
    const explicitKey = safeStr(fieldMap?.[primary]);
    if (explicitKey) return safeStr(raw?.[explicitKey]);

    const directKey = fallback || primary;
    if (safeStr(raw?.[directKey])) return safeStr(raw?.[directKey]);

    const match = (aliases[primary] || []).find((key) => safeStr(raw?.[key]));
    return match ? safeStr(raw?.[match]) : "";
  };

  const id = get("id");
  if (!id) return null;

  return {
    id,
    name: get("name") || id,
    brawler: get("brawler") || "Unknown",
    category: get("category") || "General",
    rarity: normalizeRarity(get("rarity")),
    img: normalizeImageValue(get("img", "image") || get("image", "img") || get("img_path", "img_path"), assetBaseUrl)
  };
}

function normalizeCatalog(list, options = {}) {
  const fieldMap = options.fieldMap || {};
  const assetBaseUrl = safeStr(options.assetBaseUrl);
  const preferredOrder = Array.isArray(options.rarityOrder) ? options.rarityOrder.map((value) => normalizeRarity(value)) : [];
  const skins = (Array.isArray(list) ? list : [])
    .map((item) => normalizeSkin(item, fieldMap, assetBaseUrl))
    .filter(Boolean);
  const rarities = [...new Set(skins.map((skin) => skin.rarity).filter(Boolean))];
  const baseOrder = preferredOrder.length ? preferredOrder : FALLBACK_RARITY_ORDER;

  const rarity_order = [
    ...baseOrder.filter((rarity) => rarities.includes(rarity)),
    ...rarities.filter((rarity) => !baseOrder.includes(rarity)).sort((left, right) => left.localeCompare(right, "fr"))
  ];

  return { rarity_order, skins };
}

function timeoutSignal(ms) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    clear() {
      clearTimeout(timeout);
    }
  };
}

function getRemoteConfig() {
  const mode = safeStr(process.env.BRAWLDEX_SKINS_SOURCE_MODE).toLowerCase() === "local-json" ? "local-json" : "remote-csv";
  const remoteUrl = safeStr(process.env.BRAWLDEX_SKINS_SOURCE_URL) || DEFAULT_REMOTE_URL;

  return {
    mode,
    url: mode === "local-json" ? "" : remoteUrl,
    assetBaseUrl: safeStr(process.env.BRAWLDEX_SKINS_ASSET_BASE_URL),
    timeoutMs: parseNumber(process.env.BRAWLDEX_SKINS_SOURCE_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    cacheTtlMs: parseNumber(process.env.BRAWLDEX_SKINS_CACHE_TTL_MS, DEFAULT_CACHE_TTL_MS),
    fieldMap: { ...DEFAULT_FIELD_MAP }
  };
}

async function loadLocalSnapshot() {
  const raw = await fs.readFile(SNAPSHOT_PATH, "utf8");
  const payload = JSON.parse(raw);
  const catalog = normalizeCatalog(payload?.skins, {
    rarityOrder: payload?.rarity_order,
    assetBaseUrl: payload?.asset_base_url || payload?.assetBaseUrl
  });

  return {
    ...catalog,
    source: {
      mode: "server-proxy",
      upstreamMode: "local-json",
      connected: false,
      label: "Snapshot local",
      message: "Catalogue charge depuis le snapshot local du projet.",
      remoteConfigured: false,
      remoteUrl: "",
      fetchedAt: new Date().toISOString()
    }
  };
}

async function loadRemoteCatalog(remoteConfig) {
  const request = timeoutSignal(remoteConfig.timeoutMs);

  try {
    const response = await fetch(remoteConfig.url, {
      headers: {
        Accept: "text/csv, text/plain;q=0.9, */*;q=0.8"
      },
      signal: request.signal
    });

    if (!response.ok) {
      throw new Error(`Remote skins source returned ${response.status}.`);
    }

    const csvText = await response.text();
    const rows = parseCsv(csvText);
    if (!rows.length) {
      throw new Error("Remote skins source returned an empty CSV.");
    }

    const catalog = normalizeCatalog(csvRowsToObjects(rows), {
      fieldMap: remoteConfig.fieldMap,
      assetBaseUrl: remoteConfig.assetBaseUrl
    });

    return {
      ...catalog,
      source: {
        mode: "server-proxy",
        upstreamMode: "remote-csv",
        connected: true,
        label: "Proxy serveur",
        message: "Catalogue charge via le proxy serveur depuis la source distante.",
        remoteConfigured: true,
        remoteUrl: remoteConfig.url,
        fetchedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Remote skins source timed out.");
    }
    throw error;
  } finally {
    request.clear();
  }
}

async function loadSkinsCatalog(options = {}) {
  const remoteConfig = getRemoteConfig();
  const useCache = options.useCache !== false;
  const now = Date.now();

  if (useCache && cachedCatalog && now - cachedAt < remoteConfig.cacheTtlMs) {
    return cachedCatalog;
  }

  let result;

  try {
    if (remoteConfig.mode === "local-json" || !safeStr(remoteConfig.url)) {
      result = await loadLocalSnapshot();
    } else {
      result = await loadRemoteCatalog(remoteConfig);
    }
  } catch (error) {
    const snapshot = await loadLocalSnapshot();
    result = {
      ...snapshot,
      source: {
        ...snapshot.source,
        remoteConfigured: remoteConfig.mode !== "local-json" && !!safeStr(remoteConfig.url),
        remoteUrl: safeStr(remoteConfig.url),
        message: safeStr(remoteConfig.url)
          ? `Source distante indisponible cote serveur. Snapshot local utilise en fallback. ${error.message || ""}`.trim()
          : snapshot.source.message,
        error: error?.message || "Unknown remote skins source error."
      }
    };
  }

  cachedCatalog = result;
  cachedAt = now;
  return result;
}

async function refreshSkinsCatalog() {
  cachedCatalog = null;
  cachedAt = 0;
  return loadSkinsCatalog({ useCache: false });
}

module.exports = {
  DEFAULT_REMOTE_URL,
  SNAPSHOT_PATH,
  FALLBACK_RARITY_ORDER,
  getRemoteConfig,
  loadLocalSnapshot,
  loadSkinsCatalog,
  normalizeCatalog,
  refreshSkinsCatalog
};

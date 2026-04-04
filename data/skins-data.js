// data/skins-data.js
// Loads skins from a configurable source.
// Default mode uses local JSON until a Google Sheet is connected.
(function () {
  const scriptUrl = new URL(document.currentScript?.src || window.location.href);
  const localJsonUrl = new URL("./skins.json", scriptUrl).toString();
  const FALLBACK_RARITY_ORDER = [
    "Rare",
    "Super Rare",
    "Epic",
    "Mythique",
    "Legendaire",
    "Hypercharge",
    "Argent",
    "Or"
  ];

  const DEFAULT_STATUS = {
    mode: "local-json",
    connected: false,
    label: "Local fallback",
    message: "Google Sheet non connecte pour le moment. Utilisation du fallback local."
  };

  window.RARITY_ORDER = window.RARITY_ORDER || [...FALLBACK_RARITY_ORDER];
  window.SKINS = window.SKINS || [];
  window.SKINS_SOURCE_STATUS = window.SKINS_SOURCE_STATUS || { ...DEFAULT_STATUS };

  function repairEncoding(value) {
    const text = (value ?? "").toString();
    if (!/[ÃÂâ]/.test(text)) return text;

    try {
      const bytes = Uint8Array.from(Array.from(text, (char) => char.charCodeAt(0) & 0xff));
      const repaired = new TextDecoder("utf-8").decode(bytes);
      return repaired.includes("�") ? text : repaired;
    } catch {
      return text;
    }
  }

  function safeStr(value) {
    return repairEncoding(value).trim();
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

  function normalizeImageValue(value) {
    const img = safeStr(value);
    if (!img) return "";
    if (/^(https?:)?\/\//i.test(img) || img.startsWith("/") || img.startsWith("data:")) return img;
    return `/assets/skins/${img}`;
  }

  function updateSourceStatus(patch) {
    window.SKINS_SOURCE_STATUS = {
      ...window.SKINS_SOURCE_STATUS,
      ...patch
    };
  }

  function getConfig() {
    const source = window.BRAWLDEX_SKINS_SOURCE || {};
    return {
      mode: safeStr(source.mode) || "local-json",
      spreadsheetId: safeStr(source.spreadsheetId),
      gid: safeStr(source.gid) || "0",
      csvUrl: safeStr(source.csvUrl),
      fieldMap: source.fieldMap || {}
    };
  }

  function deriveCsvUrl(config) {
    if (config.csvUrl) return config.csvUrl;
    if (!config.spreadsheetId) return "";
    return `https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/export?format=csv&gid=${encodeURIComponent(config.gid)}`;
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

  function normalizeSkin(raw, fieldMap) {
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

    const img = normalizeImageValue(get("img", "image") || get("image", "img") || get("img_path", "img_path"));

    return {
      id,
      name: get("name") || id,
      brawler: get("brawler") || "Unknown",
      category: get("category") || "General",
      rarity: normalizeRarity(get("rarity")),
      img
    };
  }

  function normalizeSkins(list, fieldMap) {
    const next = (Array.isArray(list) ? list : [])
      .map((item) => normalizeSkin(item, fieldMap))
      .filter(Boolean);

    const rarities = [...new Set(next.map((skin) => skin.rarity).filter(Boolean))];
    if (rarities.length) {
      window.RARITY_ORDER = [
        ...FALLBACK_RARITY_ORDER.filter((rarity) => rarities.includes(rarity)),
        ...rarities.filter((rarity) => !FALLBACK_RARITY_ORDER.includes(rarity)).sort((a, b) => a.localeCompare(b, "fr"))
      ];
    }

    window.SKINS = next;
    return next;
  }

  async function loadFromLocalJson() {
    const response = await fetch(localJsonUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Unable to load local skins.json (${response.status}).`);
    }

    const payload = await response.json();
    const list = Array.isArray(payload?.skins) ? payload.skins : [];
    if (Array.isArray(payload?.rarity_order) && payload.rarity_order.length) {
      window.RARITY_ORDER = payload.rarity_order.map((item) => normalizeRarity(item));
    }

    updateSourceStatus({
      mode: "local-json",
      connected: false,
      label: "Local fallback",
      message: "Utilisation de skins.json tant que le Google Sheet n'est pas branche."
    });

    return normalizeSkins(list, {});
  }

  async function loadFromGoogleSheet(config) {
    const csvUrl = deriveCsvUrl(config);
    if (!csvUrl) {
      throw new Error("Google Sheet mode is enabled, but no CSV URL or spreadsheetId is configured.");
    }

    const response = await fetch(csvUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Unable to load Google Sheet CSV (${response.status}).`);
    }

    const csvText = await response.text();
    const rows = parseCsv(csvText);
    if (!rows.length) return [];

    const headers = rows[0].map((value) => safeStr(value));
    const entries = rows.slice(1).map((values) => {
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] ?? "";
      });
      return row;
    });

    updateSourceStatus({
      mode: "google-sheet",
      connected: true,
      label: "Google Sheet",
      message: "Catalogue charge depuis le Google Sheet configure."
    });

    return normalizeSkins(entries, config.fieldMap);
  }

  async function loadSkins() {
    const config = getConfig();

    if (config.mode === "google-sheet") {
      try {
        const skins = await loadFromGoogleSheet(config);
        if (skins.length) return skins;
        updateSourceStatus({
          mode: "google-sheet",
          connected: false,
          label: "Google Sheet empty",
          message: "Le Google Sheet est connecte mais vide. Retour sur la source locale."
        });
      } catch (error) {
        console.warn("[skins-data] Google Sheet load failed:", error);
        updateSourceStatus({
          mode: "google-sheet",
          connected: false,
          label: "Google Sheet error",
          message: error.message || "Chargement du Google Sheet impossible. Retour sur la source locale."
        });
      }
    }

    return loadFromLocalJson();
  }

  function getSkinImageUrl(id, imgPath) {
    const value = safeStr(imgPath || id);
    if (!value) return "";
    return value;
  }

  window.getSkinImageUrl = getSkinImageUrl;
  window.getSkinsSourceLabel = function getSkinsSourceLabel() {
    const status = window.SKINS_SOURCE_STATUS || DEFAULT_STATUS;
    return status.label || DEFAULT_STATUS.label;
  };

  window.SKINS_READY = loadSkins().catch((error) => {
    console.error("[skins-data] load failed:", error);
    updateSourceStatus({
      mode: "local-json",
      connected: false,
      label: "Source error",
      message: error.message || "Impossible de charger la source de skins."
    });
    window.SKINS = [];
    return [];
  });
})();

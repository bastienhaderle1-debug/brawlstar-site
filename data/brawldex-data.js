(function () {
  const DEFAULT_DATA = {
    fallbackBrawlers: [
      "Shelly",
      "Colt",
      "Nita",
      "Bull",
      "Jessie",
      "Brock",
      "Dynamike",
      "Bo",
      "Tick",
      "8-Bit",
      "Emz",
      "Stu",
      "Poco",
      "Barley",
      "Rosa",
      "El Primo",
      "Rico",
      "Darryl",
      "Penny",
      "Carl",
      "Jacky",
      "Piper",
      "Pam",
      "Frank",
      "Bibi"
    ],
    gadgetOptions: [
      { id: "g1", label: "Gadget 1" },
      { id: "g2", label: "Gadget 2" }
    ],
    starPowerOptions: [
      { id: "sp1", label: "Pouvoir star 1" },
      { id: "sp2", label: "Pouvoir star 2" }
    ],
    gearOptions: [
      { id: "damage", label: "Degats" },
      { id: "shield", label: "Bouclier" },
      { id: "speed", label: "Vitesse" },
      { id: "vision", label: "Vision" },
      { id: "health", label: "Soin" },
      { id: "gadget_charge", label: "Charge gadget" }
    ],
    presets: {
      Shelly: { rarity: "Depart", role: "Damage dealer", difficulty: "Facile" },
      Colt: { rarity: "Depart", role: "Tireur", difficulty: "Moyen" },
      Nita: { rarity: "Rare", role: "Controle", difficulty: "Facile" },
      Bull: { rarity: "Rare", role: "Tank", difficulty: "Facile" },
      Jessie: { rarity: "Super Rare", role: "Controle", difficulty: "Moyen" },
      Brock: { rarity: "Rare", role: "Tireur", difficulty: "Moyen" },
      Dynamike: { rarity: "Super Rare", role: "Lanceur", difficulty: "Difficile" },
      Bo: { rarity: "Epic", role: "Controle", difficulty: "Moyen" },
      Tick: { rarity: "Mythique", role: "Lanceur", difficulty: "Moyen" },
      "8-Bit": { rarity: "Super Rare", role: "Damage dealer", difficulty: "Moyen" },
      Emz: { rarity: "Epic", role: "Controle", difficulty: "Moyen" },
      Stu: { rarity: "Epic", role: "Assassin", difficulty: "Difficile" },
      Poco: { rarity: "Rare", role: "Support", difficulty: "Facile" },
      Barley: { rarity: "Rare", role: "Support", difficulty: "Moyen" },
      Rosa: { rarity: "Rare", role: "Tank", difficulty: "Facile" },
      "El Primo": { rarity: "Rare", role: "Tank", difficulty: "Facile" },
      Rico: { rarity: "Super Rare", role: "Tireur", difficulty: "Difficile" },
      Darryl: { rarity: "Super Rare", role: "Tank", difficulty: "Moyen" },
      Penny: { rarity: "Super Rare", role: "Controle", difficulty: "Moyen" },
      Carl: { rarity: "Super Rare", role: "Damage dealer", difficulty: "Moyen" },
      Jacky: { rarity: "Super Rare", role: "Tank", difficulty: "Facile" },
      Piper: { rarity: "Epic", role: "Tireur", difficulty: "Difficile" },
      Pam: { rarity: "Epic", role: "Support", difficulty: "Moyen" },
      Frank: { rarity: "Epic", role: "Tank", difficulty: "Facile" },
      Bibi: { rarity: "Epic", role: "Tank", difficulty: "Moyen" }
    }
  };

  const SHEET_ID = "1droOJNwz2mXci5XW_QKtQmcoAUpBTtlV7KiJq3Fw5mk";
  const SHEET_GID = "0";
  const CSV_URLS = [
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`,
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${SHEET_GID}`,
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/pub?gid=${SHEET_GID}&single=true&output=csv`
  ];

  function cloneDefaultData() {
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }

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

  function slugify(value) {
    return safeStr(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "value";
  }

  function normalizeHeader(value) {
    return safeStr(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const next = text[i + 1];

      if (char === '"') {
        if (inQuotes && next === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        row.push(current);
        current = "";
      } else if ((char === "\n" || char === "\r") && !inQuotes) {
        if (char === "\r" && next === "\n") i++;
        row.push(current);
        rows.push(row);
        row = [];
        current = "";
      } else {
        current += char;
      }
    }

    if (current.length || row.length) {
      row.push(current);
      rows.push(row);
    }

    return rows.filter((cells) => cells.some((cell) => safeStr(cell)));
  }

  function splitOptions(value, fallbackPrefix) {
    const raw = safeStr(value);
    if (!raw) return [];
    return raw
      .split(/[,;|/]+/g)
      .map((part) => safeStr(part))
      .filter(Boolean)
      .map((label, index) => ({
        id: `${fallbackPrefix}${index + 1}`,
        label
      }));
  }

  function getCell(record, aliases) {
    for (const alias of aliases) {
      if (record[alias]) return record[alias];
    }
    return "";
  }

  function toRecords(rows) {
    if (!rows.length) return [];
    const headers = rows[0].map(normalizeHeader);
    return rows.slice(1).map((cells) => {
      const record = {};
      headers.forEach((header, index) => {
        record[header] = safeStr(cells[index]);
      });
      return record;
    });
  }

  function mapRecordToPreset(record) {
    const name = getCell(record, ["name", "brawler", "nom"]);
    if (!name) return null;

    const gadget1 = getCell(record, ["gadget_1", "gadget1"]);
    const gadget2 = getCell(record, ["gadget_2", "gadget2"]);
    const star1 = getCell(record, ["star_power_1", "starpower_1", "starpower1", "pouvoir_star_1"]);
    const star2 = getCell(record, ["star_power_2", "starpower_2", "starpower2", "pouvoir_star_2"]);
    const gadgetsCombined = getCell(record, ["gadgets"]);
    const starsCombined = getCell(record, ["star_powers", "starpowers", "powers_stars", "pouvoirs_stars"]);
    const gearsCombined = getCell(record, ["gears", "gear"]);

    const gadgets = gadgetsCombined
      ? splitOptions(gadgetsCombined, "g")
      : [gadget1, gadget2]
          .map((label, index) => ({ id: `g${index + 1}`, label: safeStr(label) }))
          .filter((item) => item.label);

    const starPowers = starsCombined
      ? splitOptions(starsCombined, "sp")
      : [star1, star2]
          .map((label, index) => ({ id: `sp${index + 1}`, label: safeStr(label) }))
          .filter((item) => item.label);

    const gears = gearsCombined ? splitOptions(gearsCombined, "gear") : null;

    return {
      name,
      preset: {
        rarity: getCell(record, ["rarity", "rarete"]) || DEFAULT_DATA.presets[name]?.rarity || "Collection",
        role: getCell(record, ["role", "class", "classe"]) || DEFAULT_DATA.presets[name]?.role || "Polyvalent",
        difficulty: getCell(record, ["difficulty", "difficulte"]) || DEFAULT_DATA.presets[name]?.difficulty || "A definir",
        gadgets: gadgets.length ? gadgets : undefined,
        starPowers: starPowers.length ? starPowers : undefined,
        gears: gears && gears.length ? gears : undefined
      }
    };
  }

  async function fetchCsv(url) {
    const response = await fetch(url, { method: "GET", mode: "cors" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.text();
  }

  async function loadFromGoogleSheet() {
    let lastError = null;

    for (const url of CSV_URLS) {
      try {
        const csv = await fetchCsv(url);
        const records = toRecords(parseCsv(csv));
        const mapped = records.map(mapRecordToPreset).filter(Boolean);
        if (!mapped.length) continue;

        const nextData = cloneDefaultData();
        mapped.forEach(({ name, preset }) => {
          if (!nextData.fallbackBrawlers.includes(name)) nextData.fallbackBrawlers.push(name);
          nextData.presets[name] = {
            ...(nextData.presets[name] || {}),
            ...preset
          };
        });

        return {
          ok: true,
          data: nextData,
          source: url
        };
      } catch (error) {
        lastError = error;
      }
    }

    return {
      ok: false,
      data: cloneDefaultData(),
      error: lastError
    };
  }

  const data = cloneDefaultData();
  data.googleSheet = {
    id: SHEET_ID,
    gid: SHEET_GID,
    urls: CSV_URLS,
    status: "loading",
    lastError: ""
  };

  window.BRAWLDEX_DATA = data;
  window.BRAWLDEX_READY = loadFromGoogleSheet().then((result) => {
    if (result.ok) {
      Object.assign(window.BRAWLDEX_DATA, result.data);
      window.BRAWLDEX_DATA.googleSheet.status = "connected";
      window.BRAWLDEX_DATA.googleSheet.source = result.source;
      return window.BRAWLDEX_DATA;
    }

    window.BRAWLDEX_DATA.googleSheet.status = "fallback";
    window.BRAWLDEX_DATA.googleSheet.lastError = safeStr(result.error?.message || result.error || "Google Sheet inaccessible");
    console.warn("[brawldex-data] Google Sheet inaccessible, fallback local utilise.");
    return window.BRAWLDEX_DATA;
  });
})();

const API_BASE = "https://api.brawlstars.com/v1";
const REQUEST_TIMEOUT_MS = 10000;
const VALID_TAG_CHARS = new Set("0289PYLQGRJCUV".split(""));

function normalizeTag(tag) {
  const raw = String(tag || "").trim().toUpperCase().replace(/\s+/g, "");
  const maybeUrl = raw.includes("/PLAYERS/") ? raw.split("/PLAYERS/").pop() : raw;
  const cleaned = maybeUrl.replace(/[^A-Z0-9#]/g, "").replace(/^#+/, "").replace(/O/g, "0");

  if (!cleaned) return "";
  if ([...cleaned].some((char) => !VALID_TAG_CHARS.has(char))) return "";
  return `#${cleaned}`;
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

function sendJson(res, status, payload, headers = {}) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", status === 200 ? "public, max-age=0, s-maxage=60, stale-while-revalidate=300" : "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
  Object.entries(headers).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  res.end(JSON.stringify(payload));
}

function mapUpstreamError(status, payload, tag) {
  if (status === 404) {
    return {
      status: 404,
      error: `No Brawl Stars player was found for ${tag}.`
    };
  }

  if (status === 401 || status === 403) {
    return {
      status: 502,
      error: "The server token was rejected by the Brawl Stars API."
    };
  }

  if (status === 429) {
    return {
      status: 429,
      error: "The Brawl Stars API rate limit has been reached. Try again shortly."
    };
  }

  return {
    status: 502,
    error: payload?.reason || payload?.message || "Unable to load the Brawl Stars player profile."
  };
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return sendJson(res, 200, { ok: true });
  }

  if (req.method !== "GET") {
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  const token = process.env.BRAWL_STARS_API_TOKEN;
  if (!token) {
    return sendJson(res, 500, {
      error: "BRAWL_STARS_API_TOKEN is not configured on the server."
    });
  }

  const tag = normalizeTag(req.query?.tag);
  if (!tag) {
    return sendJson(res, 400, {
      error: "Missing or invalid player tag. Use a Brawl Stars tag with the alphabet 0289PYLQGRJCUV."
    });
  }

  const endpoint = `${API_BASE}/players/${encodeURIComponent(tag)}`;
  const upstreamRequest = timeoutSignal(REQUEST_TIMEOUT_MS);

  try {
    const upstream = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json"
      },
      signal: upstreamRequest.signal
    });

    const payload = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      const mapped = mapUpstreamError(upstream.status, payload, tag);
      return sendJson(res, mapped.status, { error: mapped.error });
    }

    const brawlers = Array.isArray(payload.brawlers) ? payload.brawlers : [];
    const favoriteBrawler = brawlers.length
      ? [...brawlers]
          .sort((left, right) => {
            const trophiesDiff = Number(right.trophies || 0) - Number(left.trophies || 0);
            if (trophiesDiff !== 0) return trophiesDiff;
            return Number(right.power || 0) - Number(left.power || 0);
          })[0]?.name || ""
      : "";

    const normalized = {
      tag: payload.tag || tag,
      name: payload.name || "Unknown player",
      trophies: Number(payload.trophies || 0),
      highestTrophies: Number(payload.highestTrophies || 0),
      expLevel: Number(payload.expLevel || 0),
      expPoints: Number(payload.expPoints || 0),
      soloVictories: Number(payload.soloVictories || 0),
      duoVictories: Number(payload.duoVictories || 0),
      victories3v3: Number(payload["3vs3Victories"] || 0),
      bestRoboRumbleTime: Number(payload.bestRoboRumbleTime || 0),
      bestTimeAsBigBrawler: Number(payload.bestTimeAsBigBrawler || 0),
      club: payload.club
        ? {
            tag: payload.club.tag || "",
            name: payload.club.name || ""
          }
        : null,
      iconId: payload.icon?.id ?? null,
      brawlersCount: brawlers.length,
      favoriteBrawler,
      syncedAt: new Date().toISOString(),
      source: "brawl-stars-api"
    };

    return sendJson(res, 200, normalized);
  } catch (error) {
    if (error?.name === "AbortError") {
      return sendJson(res, 504, {
        error: "The Brawl Stars API took too long to respond."
      });
    }

    return sendJson(res, 500, {
      error: error?.message || "Unexpected Brawl Stars API error."
    });
  } finally {
    upstreamRequest.clear();
  }
};

module.exports.normalizeTag = normalizeTag;

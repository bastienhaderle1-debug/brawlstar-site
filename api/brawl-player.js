const API_BASE = "https://api.brawlstars.com/v1";

function normalizeTag(tag) {
  const raw = String(tag || "").trim().toUpperCase().replace(/\s+/g, "");
  const cleaned = raw.replace(/[^A-Z0-9#]/g, "").replace(/^#+/, "");
  return cleaned ? `#${cleaned}` : "";
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

module.exports = async function handler(req, res) {
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
    return sendJson(res, 400, { error: "Missing or invalid player tag." });
  }

  try {
    const endpoint = `${API_BASE}/players/${encodeURIComponent(tag)}`;
    const upstream = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json"
      }
    });

    const payload = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      return sendJson(res, upstream.status, {
        error: payload?.reason || payload?.message || "Unable to load player profile."
      });
    }

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
      brawlersCount: Array.isArray(payload.brawlers) ? payload.brawlers.length : 0,
      favoriteBrawler: Array.isArray(payload.brawlers) && payload.brawlers.length
        ? [...payload.brawlers]
            .sort((left, right) => {
              const trophiesDiff = Number(right.trophies || 0) - Number(left.trophies || 0);
              if (trophiesDiff !== 0) return trophiesDiff;
              return Number(right.power || 0) - Number(left.power || 0);
            })[0]?.name || ""
        : "",
      syncedAt: new Date().toISOString()
    };

    return sendJson(res, 200, normalized);
  } catch (error) {
    return sendJson(res, 500, {
      error: error?.message || "Unexpected Brawl Stars API error."
    });
  }
};

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=60, stale-while-revalidate=300");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
  res.end(JSON.stringify(payload));
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return sendJson(res, 200, { ok: true });
  }

  if (req.method !== "GET") {
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  const configured = !!process.env.BRAWL_STARS_API_TOKEN;
  return sendJson(res, 200, {
    configured,
    status: configured ? "ready" : "missing_token",
    message: configured
      ? "Le proxy Brawl Stars est configure et pret pour la synchronisation."
      : "BRAWL_STARS_API_TOKEN manque encore sur le serveur."
  });
};

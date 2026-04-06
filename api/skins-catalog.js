const { loadSkinsCatalog } = require("./skins-catalog-source.js");

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", status === 200 ? "public, max-age=0, s-maxage=60, stale-while-revalidate=300" : "no-store");
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

  try {
    const catalog = await loadSkinsCatalog();
    return sendJson(res, 200, catalog);
  } catch (error) {
    return sendJson(res, 500, {
      error: error?.message || "Unable to load the skins catalog."
    });
  }
};

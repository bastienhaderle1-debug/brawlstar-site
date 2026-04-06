const http = require("http");
const playerHandler = require("./brawl-player.js");
const healthHandler = require("./brawl-health.js");
const skinsCatalogHandler = require("./skins-catalog.js");

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 3000);

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || `127.0.0.1:${PORT}`}`);
  req.query = Object.fromEntries(url.searchParams.entries());

  if (url.pathname === "/api/brawl-health") {
    return healthHandler(req, res);
  }

  if (url.pathname === "/api/brawl-player") {
    return playerHandler(req, res);
  }

  if (url.pathname === "/api/skins-catalog") {
    return skinsCatalogHandler(req, res);
  }

  res.statusCode = 404;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ error: "Not found." }));
});

server.listen(PORT, HOST, () => {
  console.log(`Brawldex proxy listening on http://${HOST}:${PORT}`);
});

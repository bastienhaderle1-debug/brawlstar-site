const http = require("http");
const skinsCatalogHandler = require("../api/skins-catalog.js");
const { refreshSkinsCatalog } = require("../api/skins-catalog-source.js");

const HOST = "127.0.0.1";
const API_PORT = Number(process.env.BRAWLDEX_SKINS_SMOKE_PORT || 4176);
const REMOTE_PORT = Number(process.env.BRAWLDEX_SKINS_REMOTE_PORT || 4177);
const API_BASE_URL = `http://${HOST}:${API_PORT}`;
const REMOTE_BASE_URL = `http://${HOST}:${REMOTE_PORT}`;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function createApiServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url, API_BASE_URL);
    req.query = Object.fromEntries(url.searchParams.entries());
    return skinsCatalogHandler(req, res);
  });
}

function createRemoteCsvServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url, REMOTE_BASE_URL);

    if (url.pathname === "/skins.csv") {
      res.writeHead(200, { "Content-Type": "text/csv; charset=utf-8" });
      res.end(
        [
          "id,name,brawler,category,rarity,img_path",
          "night_witch_shelly,Night Witch Shelly,Shelly,Halloween,Legendary,night-witch-shelly.png",
          "space_colt,Space Colt,Colt,Sci-Fi,Mythique,"
        ].join("\n")
      );
      return;
    }

    if (url.pathname === "/fail.csv") {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("boom");
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("not found");
  });
}

async function fetchJson(pathname) {
  const response = await fetch(`${API_BASE_URL}${pathname}`, {
    headers: {
      Accept: "application/json"
    }
  });
  const payload = await response.json().catch(() => ({}));
  return {
    status: response.status,
    payload
  };
}

async function runCase(label, fn) {
  await fn();
  console.log(`OK - ${label}`);
}

async function applyEnv(values) {
  Object.entries(values).forEach(([key, value]) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  });
  await refreshSkinsCatalog();
}

async function main() {
  const originalEnv = {
    BRAWLDEX_SKINS_SOURCE_MODE: process.env.BRAWLDEX_SKINS_SOURCE_MODE,
    BRAWLDEX_SKINS_SOURCE_URL: process.env.BRAWLDEX_SKINS_SOURCE_URL,
    BRAWLDEX_SKINS_ASSET_BASE_URL: process.env.BRAWLDEX_SKINS_ASSET_BASE_URL,
    BRAWLDEX_SKINS_CACHE_TTL_MS: process.env.BRAWLDEX_SKINS_CACHE_TTL_MS
  };
  const apiServer = createApiServer();
  const remoteServer = createRemoteCsvServer();

  await Promise.all([
    new Promise((resolve, reject) => {
      apiServer.once("error", reject);
      apiServer.listen(API_PORT, HOST, resolve);
    }),
    new Promise((resolve, reject) => {
      remoteServer.once("error", reject);
      remoteServer.listen(REMOTE_PORT, HOST, resolve);
    })
  ]);

  try {
    await runCase("local snapshot mode", async () => {
      await applyEnv({
        BRAWLDEX_SKINS_SOURCE_MODE: "local-json",
        BRAWLDEX_SKINS_SOURCE_URL: undefined,
        BRAWLDEX_SKINS_ASSET_BASE_URL: undefined,
        BRAWLDEX_SKINS_CACHE_TTL_MS: "1"
      });

      const result = await fetchJson("/skins");
      assert(result.status === 200, `Expected 200, got ${result.status}`);
      assert(result.payload?.source?.upstreamMode === "local-json", "Expected local snapshot source.");
      assert(Array.isArray(result.payload?.skins) && result.payload.skins.length > 0, "Snapshot payload is empty.");
    });

    await runCase("remote csv mode", async () => {
      await applyEnv({
        BRAWLDEX_SKINS_SOURCE_MODE: "remote-csv",
        BRAWLDEX_SKINS_SOURCE_URL: `${REMOTE_BASE_URL}/skins.csv`,
        BRAWLDEX_SKINS_ASSET_BASE_URL: "https://cdn.example.com/skins",
        BRAWLDEX_SKINS_CACHE_TTL_MS: "1"
      });

      const result = await fetchJson("/skins");
      assert(result.status === 200, `Expected 200, got ${result.status}`);
      assert(result.payload?.source?.upstreamMode === "remote-csv", "Expected remote source.");
      assert(result.payload?.source?.connected === true, "Expected connected remote source.");
      assert(Array.isArray(result.payload?.skins) && result.payload.skins.length === 2, "Expected two remote skins.");
      assert(result.payload.skins[0]?.rarity === "Legendaire", "Legendary rarity was not normalized.");
      assert(
        result.payload.skins[0]?.img === "https://cdn.example.com/skins/night-witch-shelly.png",
        "Remote image path was not normalized with the asset base URL."
      );
    });

    await runCase("remote fallback to snapshot", async () => {
      await applyEnv({
        BRAWLDEX_SKINS_SOURCE_MODE: "remote-csv",
        BRAWLDEX_SKINS_SOURCE_URL: `${REMOTE_BASE_URL}/fail.csv`,
        BRAWLDEX_SKINS_ASSET_BASE_URL: undefined,
        BRAWLDEX_SKINS_CACHE_TTL_MS: "1"
      });

      const result = await fetchJson("/skins");
      assert(result.status === 200, `Expected 200, got ${result.status}`);
      assert(result.payload?.source?.upstreamMode === "local-json", "Expected fallback local snapshot source.");
      assert(result.payload?.source?.connected === false, "Expected disconnected fallback source.");
      assert(result.payload?.source?.remoteConfigured === true, "Expected remoteConfigured=true on fallback.");
      assert(
        String(result.payload?.source?.message || "").toLowerCase().includes("fallback"),
        "Fallback message was not exposed."
      );
    });
  } finally {
    await applyEnv(originalEnv);
    await Promise.all([
      new Promise((resolve) => apiServer.close(resolve)),
      new Promise((resolve) => remoteServer.close(resolve))
    ]);
  }
}

main().catch((error) => {
  console.error("Skins API smoke test failed");
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
});

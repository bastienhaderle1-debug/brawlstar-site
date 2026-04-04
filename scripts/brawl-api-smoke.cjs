const http = require("http");
const playerHandler = require("../api/brawl-player.js");
const healthHandler = require("../api/brawl-health.js");

const HOST = "127.0.0.1";
const PORT = Number(process.env.BRAWLDEX_API_SMOKE_PORT || 4175);
const BASE_URL = `http://${HOST}:${PORT}`;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function createServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url, BASE_URL);
    req.query = Object.fromEntries(url.searchParams.entries());
    if (url.pathname === "/health") {
      return healthHandler(req, res);
    }
    return playerHandler(req, res);
  });
}

async function fetchJson(pathname) {
  const response = await fetch(`${BASE_URL}${pathname}`, {
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

async function main() {
  const originalToken = process.env.BRAWL_STARS_API_TOKEN;
  const realTestTag = process.env.BRAWL_STARS_TEST_TAG || "";
  const server = createServer();

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(PORT, HOST, resolve);
  });

  try {
    await runCase("missing-token guard", async () => {
      delete process.env.BRAWL_STARS_API_TOKEN;
      const result = await fetchJson("/?tag=%23P0LY8Q2");
      assert(result.status === 500, `Expected 500, got ${result.status}`);
      assert(
        String(result.payload?.error || "").includes("BRAWL_STARS_API_TOKEN"),
        "Missing-token error message was not returned."
      );
    });

    await runCase("health endpoint without token", async () => {
      delete process.env.BRAWL_STARS_API_TOKEN;
      const result = await fetchJson("/health");
      assert(result.status === 200, `Expected 200, got ${result.status}`);
      assert(result.payload.configured === false, "Expected configured=false without token.");
      assert(result.payload.status === "missing_token", `Expected missing_token, got ${result.payload.status}`);
    });

    await runCase("invalid-tag validation", async () => {
      process.env.BRAWL_STARS_API_TOKEN = originalToken || "codex-probe-token";
      const result = await fetchJson("/?tag=%23ABC123");
      assert(result.status === 400, `Expected 400, got ${result.status}`);
      assert(
        String(result.payload?.error || "").toLowerCase().includes("invalid player tag"),
        "Invalid-tag error message was not returned."
      );
    });

    await runCase("health endpoint with token", async () => {
      process.env.BRAWL_STARS_API_TOKEN = originalToken || "codex-probe-token";
      const result = await fetchJson("/health");
      assert(result.status === 200, `Expected 200, got ${result.status}`);
      assert(result.payload.configured === true, "Expected configured=true when token is set.");
      assert(result.payload.status === "ready", `Expected ready, got ${result.payload.status}`);
    });

    if (originalToken && realTestTag) {
      await runCase("live upstream sync", async () => {
        process.env.BRAWL_STARS_API_TOKEN = originalToken;
        const result = await fetchJson(`/?tag=${encodeURIComponent(realTestTag)}`);
        assert(result.status === 200, `Expected 200, got ${result.status}`);
        assert(result.payload?.tag, "Normalized payload is missing tag.");
        assert(result.payload?.name, "Normalized payload is missing player name.");
        assert(typeof result.payload?.trophies === "number", "Normalized payload is missing trophies.");
        assert(result.payload?.source === "brawl-stars-api", "Normalized payload is missing source.");
      });
    } else {
      console.log("SKIP - live upstream sync (set BRAWL_STARS_API_TOKEN and BRAWL_STARS_TEST_TAG to enable)");
    }
  } finally {
    if (originalToken) process.env.BRAWL_STARS_API_TOKEN = originalToken;
    else delete process.env.BRAWL_STARS_API_TOKEN;

    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error("Brawl API smoke test failed");
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
});

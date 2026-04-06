const BASE_URL = (process.env.BRAWLDEX_BASE_URL || "").trim().replace(/\/+$/, "");
const TEST_TAG = (process.env.BRAWL_STARS_TEST_TAG || "").trim();

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json"
    }
  });
  const payload = await response.json().catch(() => ({}));
  return { status: response.status, payload };
}

async function main() {
  assert(BASE_URL, "BRAWLDEX_BASE_URL is required. Example: https://your-project.vercel.app");

  const health = await fetchJson(`${BASE_URL}/api/brawl-health`);
  assert(health.status === 200, `Health check failed with status ${health.status}`);

  console.log(`Health: ${health.payload.status}`);
  console.log(`Message: ${health.payload.message}`);

  if (health.payload.configured !== true) {
    throw new Error("The deployed proxy is not configured yet. Add BRAWL_STARS_API_TOKEN on Vercel and redeploy.");
  }

  const skins = await fetchJson(`${BASE_URL}/api/skins-catalog`);
  assert(skins.status === 200, `Skins catalog failed with status ${skins.status}`);
  assert(Array.isArray(skins.payload?.skins) && skins.payload.skins.length > 0, "Skins catalog payload is empty.");

  console.log(`Skins source: ${skins.payload?.source?.label || "unknown"}`);
  console.log(`Skins loaded: ${skins.payload.skins.length}`);

  if (!TEST_TAG) {
    console.log("SKIP - live player fetch (set BRAWL_STARS_TEST_TAG to verify /api/brawl-player)");
    return;
  }

  const player = await fetchJson(`${BASE_URL}/api/brawl-player?tag=${encodeURIComponent(TEST_TAG)}`);
  assert(player.status === 200, `Player fetch failed with status ${player.status}: ${player.payload?.error || "unknown error"}`);
  assert(player.payload?.tag, "Player payload is missing tag.");
  assert(player.payload?.name, "Player payload is missing player name.");
  assert(typeof player.payload?.trophies === "number", "Player payload is missing trophies.");

  console.log(`Player: ${player.payload.name} (${player.payload.tag})`);
  console.log(`Trophies: ${player.payload.trophies}`);
}

main().catch((error) => {
  console.error("Vercel live smoke failed");
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
});

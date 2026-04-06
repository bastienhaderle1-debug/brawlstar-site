const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const brawlPlayerHandler = require("../api/brawl-player.js");
const brawlHealthHandler = require("../api/brawl-health.js");
const skinsCatalogHandler = require("../api/skins-catalog.js");

const ROOT = path.resolve(__dirname, "..");
const HOST = process.env.BRAWLDEX_HOST || "127.0.0.1";
const PORT = Number(process.env.BRAWLDEX_PORT || 4173);
const BASE_URL = `http://${HOST}:${PORT}`;
const EMAIL = process.env.BRAWLDEX_EMAIL || "";
const PASSWORD = process.env.BRAWLDEX_PASSWORD || "";

if (!process.env.BRAWLDEX_SKINS_SOURCE_MODE) {
  process.env.BRAWLDEX_SKINS_SOURCE_MODE = "local-json";
}

const MIME = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function createServer() {
  return http.createServer((req, res) => {
    try {
      const requestUrl = new URL(req.url, BASE_URL);
      if (
        requestUrl.pathname === "/api/brawl-player" ||
        requestUrl.pathname === "/api/brawl-health" ||
        requestUrl.pathname === "/api/skins-catalog"
      ) {
        req.query = Object.fromEntries(requestUrl.searchParams.entries());
        if (requestUrl.pathname === "/api/brawl-health") {
          return brawlHealthHandler(req, res);
        }
        if (requestUrl.pathname === "/api/skins-catalog") {
          return skinsCatalogHandler(req, res);
        }
        return brawlPlayerHandler(req, res);
      }

      let pathname = decodeURIComponent(requestUrl.pathname);
      if (pathname === "/") pathname = "/index.html";

      const filePath = path.resolve(ROOT, `.${pathname}`);
      if (!filePath.startsWith(ROOT)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }

      let finalPath = filePath;
      if (fs.existsSync(finalPath) && fs.statSync(finalPath).isDirectory()) {
        finalPath = path.join(finalPath, "index.html");
      }

      if (!fs.existsSync(finalPath)) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      const ext = path.extname(finalPath).toLowerCase();
      const contentType = MIME[ext] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-store" });
      fs.createReadStream(finalPath).pipe(res);
    } catch (error) {
      res.writeHead(500);
      res.end(error.message || "Server error");
    }
  });
}

async function waitForStatusText(page, selector, matcher, timeout = 20000) {
  await page.waitForFunction(
    ({ selector: innerSelector, matcher: innerMatcher }) => {
      const node = document.querySelector(innerSelector);
      const text = (node?.textContent || "").trim();
      return text && new RegExp(innerMatcher, "i").test(text);
    },
    { selector, matcher: matcher.source || String(matcher) },
    { timeout }
  );
}

async function main() {
  assert(EMAIL, "BRAWLDEX_EMAIL is required.");
  assert(PASSWORD, "BRAWLDEX_PASSWORD is required.");

  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(PORT, HOST, resolve);
  });

  let browser;
  let page;
  let popup;
  let baseline = null;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    page = await context.newPage();

    await page.goto(`${BASE_URL}/pages/mybrawl.html`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#authCard");
    await page.fill("#email", EMAIL);
    await page.fill("#password", PASSWORD);
    await page.click("#btnLogin");
    await page.waitForSelector("#app", { state: "visible", timeout: 30000 });
    await page.waitForSelector("#publicDisplayName", { timeout: 30000 });

    baseline = await page.evaluate(async () => {
      const { data } = await window.supabaseClient.auth.getUser();
      const user = data?.user;
      const liveProfile = await window.PublicProfileService.loadProfile(user.id).catch(() => null);
      const publishedIds = await window.PublicProfileService.loadOwned(user.id).catch(() => []);
      const fallbackDisplayName = ((user.email || "").split("@")[0] || "Profil").trim() || "Profil";

      return {
        userId: user.id,
        fallbackDisplayName,
        hadProfile: !!liveProfile,
        profile: liveProfile || {
          display_name: document.getElementById("publicDisplayName").value,
          club_name: document.getElementById("publicClub").value,
          friend_code: document.getElementById("publicFriendCode").value,
          trophies: Number(document.getElementById("publicTrophies").value || 0),
          bio: document.getElementById("publicBio").value,
          is_public: true,
          show_owned: true,
          progress_snapshot: await (async () => {
            const skinStats = window.OwnedService.computeOwnedStats(await window.OwnedService.loadOwnedSet(user.id).catch(() => new Set()));
            const stats = window.BrawldexService.getStats(user.id);
            const global = window.BrawldexService.getGlobalProgress(user.id, skinStats);
            return {
              global_pct: global.globalPct,
              brawler_pct: stats.completionPct,
              skins_pct: skinStats.pct,
              owned_brawlers: stats.owned,
              total_brawlers: stats.total,
              owned_skins: skinStats.owned,
              total_skins: skinStats.total,
              missing_coins: stats.missingCoins,
              missing_power_points: stats.missingPowerPoints,
              hypercharges: stats.hypercharges
            };
          })()
        },
        publishedIds
      };
    });

    assert(baseline?.userId, "Unable to resolve the current Supabase user.");
    await page.locator("#publicDisplayName").fill(`Smoke ${baseline.fallbackDisplayName}`);
    await page.locator("#publicClub").fill("Smoke Club");
    await page.locator("#publicFriendCode").fill("#SMOKE");
    await page.locator("#publicTrophies").fill("12345");
    await page.click("#btnSavePublic");
    await waitForStatusText(page, "#publicStatus", /profil public enregistre/);
    await page.click("#btnPublishOwned");
    await waitForStatusText(page, "#publicStatus", /publies|videe/);
    await page.waitForFunction(() => !document.getElementById("btnOpenPublic").disabled, { timeout: 15000 });
    await page.waitForFunction(() => !document.getElementById("btnCopyPublic").disabled, { timeout: 15000 });

    const liveState = (await page.textContent("#publicLiveState")).trim();
    const linkState = (await page.textContent("#publicLinkState")).trim();
    assert(liveState === "Public", `Unexpected live state: ${liveState}`);
    assert(linkState === "Comparaison OK" || linkState === "Partage OK", `Unexpected link state: ${linkState}`);

    [popup] = await Promise.all([
      page.waitForEvent("popup"),
      page.click("#btnOpenPublic")
    ]);
    await popup.waitForLoadState("domcontentloaded");
    await popup.waitForSelector("#profileCard", { state: "visible", timeout: 30000 });
    await popup.click("#btnSetCompareBase");
    await waitForStatusText(popup, "#compareSummary", /base active/i);

    const otherUserId = await popup.evaluate(async (selfUserId) => {
      const profiles = await window.PublicProfileService.loadLatestProfiles(24);
      const enriched = await window.PublicProfileService.enrichProfiles(profiles, {
        totalSkins: Array.isArray(window.SKINS) ? window.SKINS.length : 0
      });
      return enriched.find((profile) => profile.user_id !== selfUserId && profile.skinsVisible !== false)?.user_id || "";
    }, baseline.userId);

    assert(otherUserId, "No other public comparable profile was found.");

    await popup.goto(`${BASE_URL}/pages/profile.html?u=${encodeURIComponent(otherUserId)}`, {
      waitUntil: "domcontentloaded"
    });
    await popup.waitForSelector("#profileCard", { state: "visible", timeout: 30000 });
    await popup.waitForSelector("#compareCard", { state: "visible", timeout: 30000 });
    await popup.waitForFunction(() => {
      const summary = (document.getElementById("compareSummary")?.textContent || "").trim();
      const overlap = (document.getElementById("compareOverlap")?.textContent || "").trim();
      const leftOnly = (document.getElementById("compareLeftOnly")?.textContent || "").trim();
      const rightOnly = (document.getElementById("compareRightOnly")?.textContent || "").trim();
      return !!summary && /^\d+$/.test(overlap) && /^\d+$/.test(leftOnly) && /^\d+$/.test(rightOnly);
    }, { timeout: 30000 });

    const compareSnapshot = await popup.evaluate(() => ({
      overlap: document.getElementById("compareOverlap")?.textContent?.trim() || "",
      leftOnly: document.getElementById("compareLeftOnly")?.textContent?.trim() || "",
      rightOnly: document.getElementById("compareRightOnly")?.textContent?.trim() || "",
      summary: document.getElementById("compareSummary")?.textContent?.trim() || ""
    }));

    assert(/^\d+$/.test(compareSnapshot.overlap), "Compare overlap was not rendered.");
    assert(/^\d+$/.test(compareSnapshot.leftOnly), "Compare left-only count was not rendered.");
    assert(/^\d+$/.test(compareSnapshot.rightOnly), "Compare right-only count was not rendered.");

    console.log("UI smoke test OK");
    console.log(`- Dashboard login/save/publish/open passed for ${EMAIL}`);
    console.log(`- Public profile comparison passed against user ${otherUserId}`);
    console.log(`- Compare summary: ${compareSnapshot.summary}`);
  } finally {
    if (page && baseline?.userId) {
      try {
        await page.evaluate(async (snapshot) => {
          if (snapshot.hadProfile) {
            await window.PublicProfileService.saveProfile(snapshot.userId, snapshot.profile, {
              fallbackDisplayName: snapshot.fallbackDisplayName
            });
          } else {
            await window.supabaseClient.from("public_profiles").delete().eq("user_id", snapshot.userId);
          }

          await window.PublicProfileService.publishOwned(snapshot.userId, snapshot.publishedIds || []);
        }, baseline);
      } catch (error) {
        console.error("Cleanup warning:", error.message || error);
      }
    }

    if (popup) await popup.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error("UI smoke test failed");
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
});

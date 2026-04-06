const fs = require("fs/promises");
const { getRemoteConfig, refreshSkinsCatalog, SNAPSHOT_PATH } = require("../api/skins-catalog-source.js");

async function main() {
  const remoteConfig = getRemoteConfig();

  if (remoteConfig.mode === "local-json" || !remoteConfig.url) {
    throw new Error("Remote skins refresh is disabled. Set BRAWLDEX_SKINS_SOURCE_MODE=remote-csv to refresh the snapshot.");
  }

  const catalog = await refreshSkinsCatalog();
  if (catalog?.source?.upstreamMode !== "remote-csv" || catalog?.source?.connected !== true) {
    throw new Error("Remote skins source could not be loaded. Snapshot was not updated.");
  }

  const payload = {
    rarity_order: Array.isArray(catalog.rarity_order) ? catalog.rarity_order : [],
    skins: Array.isArray(catalog.skins) ? catalog.skins : []
  };

  if (remoteConfig.assetBaseUrl) {
    payload.asset_base_url = remoteConfig.assetBaseUrl;
  }

  await fs.writeFile(SNAPSHOT_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log("Skins snapshot refreshed");
  console.log(`- skins: ${payload.skins.length}`);
  console.log(`- source: ${catalog.source.remoteUrl}`);
  console.log(`- file: ${SNAPSHOT_PATH}`);
}

main().catch((error) => {
  console.error("Skins snapshot refresh failed");
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
});

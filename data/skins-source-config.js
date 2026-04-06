// data/skins-source-config.js
// Configure this file when you are ready to switch the skins catalog source.
// Supported modes:
// - "local-json"   -> loads ./data/skins.json
// - "server-proxy" -> loads /api/skins-catalog from the same origin or a configured runtime base URL
// - "google-sheet" -> loads a Google Sheet CSV export
//
// The default setup now uses the server proxy first, with the local snapshot kept as the browser fallback.
(function () {
  window.BRAWLDEX_SKINS_SOURCE = {
    mode: "server-proxy",
    proxyPath: "/api/skins-catalog",
    spreadsheetId: "",
    gid: "0",
    csvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTBmk7mXFfMQ_wUabmypt3E8nAz3bDf2tNq1oFIZVJk1f51juAqw19_VBPhQ9LhBGTBUz56Q4nfOfN1/pub?output=csv",
    assetBaseUrl: "",
    fieldMap: {
      id: "id",
      name: "name",
      brawler: "brawler",
      category: "category",
      rarity: "rarity",
      img: "img_path"
    }
  };
})();

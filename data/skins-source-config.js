// data/skins-source-config.js
// Configure this file when you are ready to connect the real Google Sheet.
// Supported modes:
// - "local-json"  -> loads ./data/skins.json
// - "google-sheet" -> loads a Google Sheet CSV export
//
// When you send me the Google Sheet link, I can fill these values for you.
(function () {
  window.BRAWLDEX_SKINS_SOURCE = {
    mode: "google-sheet",
    spreadsheetId: "",
    gid: "0",
    csvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTBmk7mXFfMQ_wUabmypt3E8nAz3bDf2tNq1oFIZVJk1f51juAqw19_VBPhQ9LhBGTBUz56Q4nfOfN1/pub?output=csv",
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

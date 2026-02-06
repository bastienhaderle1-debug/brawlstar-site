// data/skins-data.js
window.SKINS = [
  { name: "Star Shelly", brawler: "Shelly", category: "Anniversaire", rarity: "Rare" },
  { name: "Bandita Shelly", brawler: "Shelly", category: "Bandits", rarity: "Super Rare" },
  { name: "Witch Shelly", brawler: "Shelly", category: "Halloween", rarity: "Epic" },

  { name: "Outlaw Colt", brawler: "Colt", category: "Bandits", rarity: "Epic" },
  { name: "Rockstar Colt", brawler: "Colt", category: "Musique", rarity: "Super Rare" },

  { name: "Panda Nita", brawler: "Nita", category: "Animaux", rarity: "Epic" },
  { name: "Pirate Poco", brawler: "Poco", category: "Pirates", rarity: "Super Rare" },
];
const raritySelect = document.getElementById("rarity");

function buildRarityOptions() {
  raritySelect.innerHTML = `<option value="all">Toutes</option>`;

  RARITY_ORDER.forEach(rarity => {
    const exists = skins.some(s => s.rarity === rarity);
    if (!exists) return;

    const opt = document.createElement("option");
    opt.value = rarity;
    opt.textContent = rarity;
    raritySelect.appendChild(opt);
  });
}
buildRarityOptions();
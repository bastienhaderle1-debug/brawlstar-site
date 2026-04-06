(function () {
  const DEFAULT_DATA = {
    fallbackBrawlers: [
      "Shelly",
      "Colt",
      "Nita",
      "Bull",
      "Jessie",
      "Brock",
      "Dynamike",
      "Bo",
      "Tick",
      "8-Bit",
      "Emz",
      "Stu",
      "Poco",
      "Barley",
      "Rosa",
      "El Primo",
      "Rico",
      "Darryl",
      "Penny",
      "Carl",
      "Jacky",
      "Piper",
      "Pam",
      "Frank",
      "Bibi"
    ],
    gadgetOptions: [
      { id: "g1", label: "Gadget 1" },
      { id: "g2", label: "Gadget 2" }
    ],
    starPowerOptions: [
      { id: "sp1", label: "Pouvoir star 1" },
      { id: "sp2", label: "Pouvoir star 2" }
    ],
    buffOptions: [
      { id: "buff1", label: "Buff 1" },
      { id: "buff2", label: "Buff 2" },
      { id: "buff3", label: "Buff 3" }
    ],
    gearOptions: [
      { id: "damage", label: "Degats" },
      { id: "shield", label: "Bouclier" },
      { id: "speed", label: "Vitesse" },
      { id: "vision", label: "Vision" },
      { id: "health", label: "Soin" },
      { id: "gadget_charge", label: "Charge gadget" }
    ],
    levelCosts: [
      { fromLevel: 1, powerPoints: 20, coins: 20 },
      { fromLevel: 2, powerPoints: 35, coins: 30 },
      { fromLevel: 3, powerPoints: 75, coins: 50 },
      { fromLevel: 4, powerPoints: 140, coins: 80 },
      { fromLevel: 5, powerPoints: 290, coins: 130 },
      { fromLevel: 6, powerPoints: 480, coins: 210 },
      { fromLevel: 7, powerPoints: 800, coins: 340 },
      { fromLevel: 8, powerPoints: 1250, coins: 550 },
      { fromLevel: 9, powerPoints: 1875, coins: 890 },
      { fromLevel: 10, powerPoints: 2800, coins: 1440 }
    ],
    upgradeCosts: {
      gear: { coins: 1000, powerPoints: 0 },
      hypercharge: { coins: 5000, powerPoints: 0 },
      buff: { coins: 1000, powerPoints: 2000 },
      starPower: { coins: 2000, powerPoints: 0 },
      gadget: { coins: 1000, powerPoints: 0 }
    },
    presets: {
      Shelly: { rarity: "Depart", role: "Damage dealer", difficulty: "Facile" },
      Colt: { rarity: "Depart", role: "Tireur", difficulty: "Moyen" },
      Nita: { rarity: "Rare", role: "Controle", difficulty: "Facile" },
      Bull: { rarity: "Rare", role: "Tank", difficulty: "Facile" },
      Jessie: { rarity: "Super Rare", role: "Controle", difficulty: "Moyen" },
      Brock: { rarity: "Rare", role: "Tireur", difficulty: "Moyen" },
      Dynamike: { rarity: "Super Rare", role: "Lanceur", difficulty: "Difficile" },
      Bo: { rarity: "Epic", role: "Controle", difficulty: "Moyen" },
      Tick: { rarity: "Mythique", role: "Lanceur", difficulty: "Moyen" },
      "8-Bit": { rarity: "Super Rare", role: "Damage dealer", difficulty: "Moyen" },
      Emz: { rarity: "Epic", role: "Controle", difficulty: "Moyen" },
      Stu: { rarity: "Epic", role: "Assassin", difficulty: "Difficile" },
      Poco: { rarity: "Rare", role: "Support", difficulty: "Facile" },
      Barley: { rarity: "Rare", role: "Support", difficulty: "Moyen" },
      Rosa: { rarity: "Rare", role: "Tank", difficulty: "Facile" },
      "El Primo": { rarity: "Rare", role: "Tank", difficulty: "Facile" },
      Rico: { rarity: "Super Rare", role: "Tireur", difficulty: "Difficile" },
      Darryl: { rarity: "Super Rare", role: "Tank", difficulty: "Moyen" },
      Penny: { rarity: "Super Rare", role: "Controle", difficulty: "Moyen" },
      Carl: { rarity: "Super Rare", role: "Damage dealer", difficulty: "Moyen" },
      Jacky: { rarity: "Super Rare", role: "Tank", difficulty: "Facile" },
      Piper: { rarity: "Epic", role: "Tireur", difficulty: "Difficile" },
      Pam: { rarity: "Epic", role: "Support", difficulty: "Moyen" },
      Frank: { rarity: "Epic", role: "Tank", difficulty: "Facile" },
      Bibi: { rarity: "Epic", role: "Tank", difficulty: "Moyen" }
    }
  };

  function cloneDefaultData() {
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }

  const data = cloneDefaultData();
  data.googleSheet = {
    status: "disabled",
    label: "Snapshot local",
    message: "Le roster s'appuie sur les presets locaux pour eviter les erreurs CORS cote navigateur.",
    lastError: "Chargement Google Sheet desactive dans le front public."
  };

  window.BRAWLDEX_DATA = data;
  window.BRAWLDEX_READY = Promise.resolve(window.BRAWLDEX_DATA);
})();

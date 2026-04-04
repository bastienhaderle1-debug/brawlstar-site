// js/owned-service.js
(function () {
  if (!window.supabaseClient) {
    console.error("owned-service: supabaseClient introuvable.");
    return;
  }

  const supa = window.supabaseClient;

  function isAbortError(error) {
    const msg = String(error?.message || error || "").toLowerCase();
    return error?.name === "AbortError" || msg.includes("abort") || msg.includes("signal is aborted");
  }

  async function loadOwnedSet(userId) {
    if (!userId) return new Set();

    const { data, error } = await supa
      .from("user_skins")
      .select("skin_id")
      .eq("user_id", userId);

    if (error) throw error;

    return new Set((data || []).map((row) => row.skin_id).filter(Boolean));
  }

  async function setOwned(userId, skinId, owned) {
    if (!userId) throw new Error("Non connecte");
    if (!skinId) throw new Error("skinId manquant");

    if (owned) {
      const { error } = await supa
        .from("user_skins")
        .upsert([{ user_id: userId, skin_id: skinId }], { onConflict: "user_id,skin_id" });
      if (error) throw error;
      return true;
    }

    const { error } = await supa
      .from("user_skins")
      .delete()
      .eq("user_id", userId)
      .eq("skin_id", skinId);
    if (error) throw error;
    return false;
  }

  function getSkins() {
    return Array.isArray(window.SKINS) ? window.SKINS : [];
  }

  function skinById(id) {
    return getSkins().find((skin) => skin && skin.id === id) || null;
  }

  function computeOwnedStats(ownedSet) {
    const skins = getSkins();
    const total = skins.length;
    const owned = ownedSet.size;
    const pct = total > 0 ? Math.round((owned / total) * 100) : 0;

    const rarityOrder = window.RARITY_ORDER ?? ["Rare", "Super Rare", "Epic", "Mythique", "Legendaire", "Hypercharge"];
    const byRarity = {};
    rarityOrder.forEach((rarity) => {
      byRarity[rarity] = 0;
    });

    skins.forEach((skin) => {
      if (!skin?.id) return;
      if (!ownedSet.has(skin.id)) return;
      if (skin.rarity && byRarity[skin.rarity] !== undefined) byRarity[skin.rarity] += 1;
    });

    return { total, owned, pct, byRarity };
  }

  window.OwnedService = {
    isAbortError,
    loadOwnedSet,
    setOwned,
    getSkins,
    skinById,
    computeOwnedStats
  };
})();

// js/owned-service.js
(function () {
  if (!window.supabaseClient) {
    console.error("owned-service: supabaseClient introuvable.");
    return;
  }

  const supa = window.supabaseClient;

  function isAbortError(e) {
    const msg = String(e?.message || e || "").toLowerCase();
    return e?.name === "AbortError" || msg.includes("abort") || msg.includes("signal is aborted");
  }

  // Lit tous les skins possédés (stockés par skin_id)
  async function loadOwnedSet(userId) {
    if (!userId) return new Set();

    const { data, error } = await supa
      .from("user_skins")
      .select("skin_id")
      .eq("user_id", userId);

    if (error) throw error;

    return new Set((data || []).map(r => r.skin_id).filter(Boolean));
  }

  // Set owned via upsert/delete (nécessite UNIQUE(user_id, skin_id) côté DB)
  async function setOwned(userId, skinId, owned) {
    if (!userId) throw new Error("Non connecté");
    if (!skinId) throw new Error("skinId manquant");

    if (owned) {
      const { error } = await supa
        .from("user_skins")
        .upsert([{ user_id: userId, skin_id: skinId }], { onConflict: "user_id,skin_id" });
      if (error) throw error;
      return true;
    } else {
      const { error } = await supa
        .from("user_skins")
        .delete()
        .eq("user_id", userId)
        .eq("skin_id", skinId);
      if (error) throw error;
      return false;
    }
  }

  // Helpers utilitaires
  function getSkins() {
    return Array.isArray(window.SKINS) ? window.SKINS : [];
  }

  function skinById(id) {
    return getSkins().find(s => s && s.id === id) || null;
  }

  function computeOwnedStats(ownedSet) {
    const skins = getSkins();
    const total = skins.length;
    const owned = ownedSet.size;
    const pct = total > 0 ? Math.round((owned / total) * 100) : 0;

    const rarityOrder = window.RARITY_ORDER ?? ["Rare","Super Rare","Epic","Mythique","Légendaire","Hypercharge"];
    const byRarity = {};
    rarityOrder.forEach(r => (byRarity[r] = 0));

    skins.forEach(s => {
      if (!s?.id) return;
      if (!ownedSet.has(s.id)) return;
      if (s.rarity && byRarity[s.rarity] !== undefined) byRarity[s.rarity]++;
    });

    return { total, owned, pct, byRarity };
  }

  window.OwnedService = {
    isAbortError,
    loadOwnedSet,
    setOwned,
    getSkins,
    skinById,
    computeOwnedStats,
  };
})();

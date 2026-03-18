// data/skins-data.js
// Source = Supabase (table public.skins + storage bucket "skins")
// Expose:
// - window.RARITY_ORDER
// - window.SKINS
// - window.SKINS_READY (Promise)
// - window.getSkinImageUrl(id, imgPath)

(function () {
window.RARITY_ORDER = [
  "Rare",
  "Super Rare",
  "Epic",
  "Mythique",
  "Légendaire",
  "Hypercharge",
  "Argent",
  "Or"
];

  window.SKINS = window.SKINS || [];

  function safeStr(x) {
    return (x ?? "").toString();
  }

  function requireSupabase(where) {
    if (!window.supabaseClient) {
      console.error(`[skins-data:${where}] supabaseClient introuvable. Vérifie l’ordre des scripts.`);
      return null;
    }
    return window.supabaseClient;
  }

  function getSkinImageUrl(id, imgPath) {
    const supa = requireSupabase("getSkinImageUrl");
    const path = safeStr(imgPath).trim() || `${safeStr(id).trim()}.webp`;
    if (!supa) return ""; // mode dégradé

    try {
      const { data } = supa.storage.from("skins").getPublicUrl(path);
      return data?.publicUrl || "";
    } catch (e) {
      console.warn("[skins-data] getPublicUrl failed:", e);
      return "";
    }
  }

  window.getSkinImageUrl = getSkinImageUrl;

  async function loadSkinsFromSupabase() {
    const supa = requireSupabase("loadSkinsFromSupabase");
    if (!supa) return [];

    // ⚠️ 900 rows: ok. Si tu montes plus tard à plusieurs milliers, on paginera.
    const { data, error } = await supa
      .from("skins")
      .select("id,name,brawler,category,rarity,img_path,updated_at")
      .order("brawler", { ascending: true })
      .order("name", { ascending: true });

    if (error) throw error;

    const normalized = (data || [])
      .filter((s) => s && s.id)
      .map((s) => ({
        id: safeStr(s.id),
        name: safeStr(s.name || s.id),
        brawler: safeStr(s.brawler || "—"),
        category: safeStr(s.category || "Sans thème"),
        rarity: safeStr(s.rarity || "—"),
        // URL publique Supabase Storage
        img: getSkinImageUrl(s.id, s.img_path),
        // utile pour debug/cache si tu veux
        updated_at: s.updated_at || null,
      }));

    window.SKINS = normalized;
    return normalized;
  }

  window.SKINS_READY = loadSkinsFromSupabase()
    .catch((e) => {
      console.error("[skins-data] load failed:", e);
      window.SKINS = [];
      return [];
    });
})();

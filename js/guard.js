// js/guard.js
(function () {
  function toast(msg, type = "error", title = "Erreur") {
    if (typeof window.showToast === "function") {
      window.showToast(msg, type, title, 4000);
      return true;
    }
    return false;
  }

  function fail(msg, where = "") {
    const full = where ? `[${where}] ${msg}` : msg;

    // Toast si possible
    const usedToast = toast(full, "error", "Erreur");

    // Fallback console
    console.error(full);

    // Fallback inline si un élément #status existe
    const status = document.getElementById("status");
    if (status) status.textContent = "❌ " + msg;

    // Dernier fallback: petite bannière injectée (non bloquante)
    if (!usedToast) {
      let banner = document.getElementById("__fatal_banner");
      if (!banner) {
        banner = document.createElement("div");
        banner.id = "__fatal_banner";
        banner.style.position = "fixed";
        banner.style.left = "16px";
        banner.style.right = "16px";
        banner.style.top = "16px";
        banner.style.zIndex = "9999";
        banner.style.padding = "12px 14px";
        banner.style.borderRadius = "16px";
        banner.style.border = "2px solid rgba(255,80,80,0.65)";
        banner.style.background = "rgba(20,10,45,0.92)";
        banner.style.backdropFilter = "blur(8px)";
        banner.style.boxShadow = "0 10px 0 rgba(0,0,0,.35)";
        banner.style.fontWeight = "900";
        document.body.appendChild(banner);
      }
      banner.textContent = "❌ " + msg;
    }

    return false;
  }

  // Guard Supabase (ne bloque pas toute la page si possible)
  function requireSupabase(where = "") {
    if (!window.supabaseClient) {
      fail("supabaseClient introuvable. Vérifie data/supabase-client.js et l’ordre des scripts.", where);
      return null;
    }
    return window.supabaseClient;
  }

  function requireSkins(where = "") {
    if (!Array.isArray(window.SKINS)) {
      fail("SKINS introuvable. Vérifie data/skins-data.js et l’ordre des scripts.", where);
      return null;
    }
    return window.SKINS;
  }

  window.AppGuard = { fail, requireSupabase, requireSkins };
})();

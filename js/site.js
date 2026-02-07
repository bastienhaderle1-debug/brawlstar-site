// js/site.js
(function () {
  // Active link in nav
  const navLinks = document.querySelectorAll(".nav a");
  navLinks.forEach(a => {
    try {
      const href = a.getAttribute("href");
      if (!href) return;
      const u = new URL(href, window.location.href);
      if (u.pathname === window.location.pathname) {
        a.classList.add("is-active");
      }
    } catch {}
  });

  // Global auth badge (optional per page)
  const badge = document.getElementById("globalAuthBadge");
  if (!badge) return;

  // --- MODE VISITEUR (Supabase non chargé) ---
  if (!window.supabaseClient) {
    badge.className = "badge info";
    badge.innerHTML = `
      <span class="dot"></span>
      <span>Mode visiteur</span>
    `;
    return;
  }

  const supa = window.supabaseClient;

  function paint(session) {
    const user = session?.user;

    if (user) {
      const name = user.email
        ? user.email.split("@")[0]
        : user.id.slice(0, 8);

      badge.className = "badge ok";
      badge.innerHTML = `
        <span class="dot"></span>
        <span>Connecté : <strong>${name}</strong></span>
      `;
    } else {
      badge.className = "badge ko";
      badge.innerHTML = `
        <span class="dot"></span>
        <span>Non connecté</span>
      `;
    }
  }

  supa.auth
    .getSession()
    .then(({ data }) => paint(data.session))
    .catch(() => paint(null));

  supa.auth.onAuthStateChange((_event, session) => {
    paint(session);
  });
})();

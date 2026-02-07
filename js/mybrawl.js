// js/mybrawl.js
(function () {
  const supa = window.AppGuard?.requireSupabase("mybrawl");
  const _skinsDataOk = window.AppGuard?.requireSkins("mybrawl");
  if (!supa || !_skinsDataOk) return;

  if (!window.OwnedService) {
    window.AppGuard?.fail(
      "OwnedService introuvable. Vérifie ../js/owned-service.js et l’ordre des scripts.",
      "mybrawl"
    );
    return;
  }

  const Svc = window.OwnedService;

  const SKINS = Svc.getSkins();
  const RARITY_ORDER = window.RARITY_ORDER ?? ["Rare","Super Rare","Epic","Mythique","Légendaire","Hypercharge"];
  const RARITY_CLASS = {
    "Rare": "rarity-rare",
    "Super Rare": "rarity-super-rare",
    "Epic": "rarity-epic",
    "Mythique": "rarity-mythic",
    "Légendaire": "rarity-legendary",
    "Hypercharge": "rarity-hypercharge",
  };

  // Elements
  const authCard = document.getElementById("authCard");
  const app = document.getElementById("app");
  const authMsg = document.getElementById("authMsg");

  const email = document.getElementById("email");
  const password = document.getElementById("password");
  const btnLogin = document.getElementById("btnLogin");
  const btnSignup = document.getElementById("btnSignup");

  const btnLogout = document.getElementById("btnLogout");
  const btnReload = document.getElementById("btnReload");

  const userLine = document.getElementById("userLine");
  const search = document.getElementById("search");
  const filterBrawler = document.getElementById("filterBrawler");
  const filterRarity = document.getElementById("filterRarity");
  const onlyOwned = document.getElementById("onlyOwned");

  const cards = document.getElementById("cards");
  const resultCount = document.getElementById("resultCount");
  const status = document.getElementById("status");

  const statOwned = document.getElementById("statOwned");
  const statTotal = document.getElementById("statTotal");
  const statPct = document.getElementById("statPct");
  const progressBar = document.getElementById("progressBar");
  const rarityBar = document.getElementById("rarityBar");

  const displayName = document.getElementById("displayName");
  const bio = document.getElementById("bio");
  const isPublic = document.getElementById("isPublic");
  const showOwned = document.getElementById("showOwned");
  const btnSaveProfile = document.getElementById("btnSaveProfile");
  const btnPublishOwned = document.getElementById("btnPublishOwned");
  const btnOpenProfile = document.getElementById("btnOpenProfile");
  const btnCopyProfile = document.getElementById("btnCopyProfile");
  const profileMsg = document.getElementById("profileMsg");

  // State
  let currentUser = null;
  let ownedSet = new Set();
  let refreshToken = 0;
  let authBusy = false;

  // Utils
  const setAuthMessage = (m)=> authMsg.textContent = m || "";
  const setStatus = (m)=> status.textContent = m || "";
  const setProfileMsg = (m)=> profileMsg.textContent = m || "";

  function setAuthBusy(busy, msg) {
    authBusy = !!busy;
    if (btnLogin) btnLogin.disabled = authBusy;
    if (btnSignup) btnSignup.disabled = authBusy;

    // optionnel : feedback visuel si disabled
    if (btnLogin) btnLogin.style.opacity = authBusy ? "0.6" : "1";
    if (btnSignup) btnSignup.style.opacity = authBusy ? "0.6" : "1";

    if (msg !== undefined) setAuthMessage(msg);
  }

  function uniqueSorted(arr) {
    return [...new Set(arr)].filter(Boolean).sort((a,b)=>String(a).localeCompare(String(b),"fr"));
  }

  function buildBrawlerFilter() {
    filterBrawler.innerHTML = "";
    const all = document.createElement("option");
    all.value = "all";
    all.textContent = "Tous";
    filterBrawler.appendChild(all);

    uniqueSorted(SKINS.map(s=>s.brawler)).forEach(b => {
      const opt = document.createElement("option");
      opt.value = b;
      opt.textContent = b;
      filterBrawler.appendChild(opt);
    });
  }

  function buildRarityFilter() {
    filterRarity.innerHTML = "";
    const all = document.createElement("option");
    all.value = "all";
    all.textContent = "Toutes";
    filterRarity.appendChild(all);

    RARITY_ORDER.forEach(r => {
      const opt = document.createElement("option");
      opt.value = r;
      opt.textContent = r;
      filterRarity.appendChild(opt);
    });
  }

  function showLoggedIn(user) {
    currentUser = user;
    authCard.style.display = "none";
    app.style.display = "block";
    userLine.textContent = user.email ?? user.id;
  }

  function showLoggedOut() {
    currentUser = null;
    ownedSet = new Set();
    authCard.style.display = "block";
    app.style.display = "none";
    setAuthMessage("");
    setStatus("");
    setProfileMsg("");
    setAuthBusy(false);
  }

  // Auth
  async function signup() {
    if (authBusy) return;
    const em = email.value.trim();
    const pw = password.value;

    if (!em || !pw) {
      setAuthMessage("❌ Renseigne email + mot de passe.");
      return;
    }

    setAuthBusy(true, "Création du compte...");
    try {
      const { error } = await supa.auth.signUp({ email: em, password: pw });
      if (error) {
        setAuthBusy(false, "❌ " + error.message);
        return;
      }
      setAuthBusy(false, "✅ Compte créé. Vérifie ton email si confirmation activée.");
    } catch (e) {
      setAuthBusy(false, "❌ " + (e?.message || String(e)));
    }
  }

  async function login() {
    if (authBusy) return;
    const em = email.value.trim();
    const pw = password.value;

    if (!em || !pw) {
      setAuthMessage("❌ Renseigne email + mot de passe.");
      return;
    }

    setAuthBusy(true, "Connexion...");
    try {
      const { data, error } = await supa.auth.signInWithPassword({ email: em, password: pw });
      if (error) {
        setAuthBusy(false, "❌ " + error.message);
        return;
      }
      showLoggedIn(data.user);
      setAuthBusy(false, "");
      await refreshAll();
    } catch (e) {
      setAuthBusy(false, "❌ " + (e?.message || String(e)));
    }
  }

  async function logout() {
    try {
      await supa.auth.signOut();
    } finally {
      showLoggedOut();
    }
  }

  // Owned
  async function loadOwned() {
    if (!currentUser) return;
    setStatus("Chargement de tes skins...");

    try {
      ownedSet = await Svc.loadOwnedSet(currentUser.id);
      setStatus(`✅ ${ownedSet.size} skin(s) cochés enregistrés.`);
    } catch (e) {
      if (Svc.isAbortError?.(e)) return;
      setStatus("❌ Erreur chargement: " + (e.message || String(e)));
    }
  }

  async function setOwned(skinId, isOwned) {
    if (!currentUser) return;

    try {
      await Svc.setOwned(currentUser.id, skinId, isOwned);
      if (isOwned) ownedSet.add(skinId);
      else ownedSet.delete(skinId);

      updateStats();
      render();
      setStatus(`✅ ${ownedSet.size} skin(s) cochés enregistrés.`);
    } catch (e) {
      if (Svc.isAbortError?.(e)) return;
      setStatus("❌ " + (e.message || String(e)));
    }
  }

  // Public profile
  async function loadPublicProfile() {
    if (!currentUser) return;

    setProfileMsg("Chargement profil public...");
    try {
      const { data, error } = await supa
        .from("public_profiles")
        .select("display_name, bio, is_public, show_owned")
        .eq("user_id", currentUser.id)
        .maybeSingle();

      if (error) {
        if (Svc.isAbortError?.(error)) return;
        return setProfileMsg("❌ " + error.message);
      }

      if (data) {
        displayName.value = data.display_name ?? "";
        bio.value = data.bio ?? "";
        isPublic.checked = data.is_public ?? true;
        showOwned.checked = data.show_owned ?? true;
        setProfileMsg("✅ Profil chargé.");
      } else {
        displayName.value = (currentUser.email || "").split("@")[0] || "Moi";
        bio.value = "";
        isPublic.checked = true;
        showOwned.checked = true;
        setProfileMsg("ℹ️ Pas de profil encore. Tu peux l’enregistrer.");
      }
    } catch (e) {
      if (Svc.isAbortError?.(e)) return;
      setProfileMsg("❌ " + (e.message || String(e)));
    }
  }

  async function savePublicProfile() {
    if (!currentUser) return;

    setProfileMsg("Enregistrement...");
    try {
      const payload = {
        user_id: currentUser.id,
        display_name: (displayName.value || "Profil").trim(),
        bio: (bio.value || "").trim(),
        is_public: !!isPublic.checked,
        show_owned: !!showOwned.checked,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supa
        .from("public_profiles")
        .upsert(payload, { onConflict: "user_id" });

      if (error) return setProfileMsg("❌ " + error.message);
      setProfileMsg("✅ Profil enregistré.");
    } catch (e) {
      if (Svc.isAbortError?.(e)) return;
      setProfileMsg("❌ " + (e.message || String(e)));
    }
  }

  async function publishOwnedToPublic() {
    if (!currentUser) return;

    setProfileMsg("Publication des skins cochés...");
    try {
      await savePublicProfile();

      const { error: delErr } = await supa
        .from("public_user_skins")
        .delete()
        .eq("user_id", currentUser.id);

      if (delErr) return setProfileMsg("❌ " + delErr.message);

      if (ownedSet.size === 0) {
        setProfileMsg("✅ Aucun skin coché → liste publique vidée.");
        return;
      }

      const rows = [...ownedSet].map(skin_id => ({ user_id: currentUser.id, skin_id }));
      const { error: insErr } = await supa
        .from("public_user_skins")
        .upsert(rows, { onConflict: "user_id,skin_id" });

      if (insErr) return setProfileMsg("❌ " + insErr.message);
      setProfileMsg(`✅ Publié: ${ownedSet.size} skin(s).`);
    } catch (e) {
      if (Svc.isAbortError?.(e)) return;
      setProfileMsg("❌ " + (e.message || String(e)));
    }
  }

  function publicProfileUrl() {
    const url = new URL("./public.html", window.location.href);
    url.searchParams.set("u", currentUser.id);
    return url.toString();
  }

  async function copyPublicLink() {
    if (!currentUser) return;
    try {
      await navigator.clipboard.writeText(publicProfileUrl());
      setProfileMsg("✅ Lien copié.");
    } catch {
      setProfileMsg("⚠️ Copie impossible. Copie manuellement l’URL.");
    }
  }

  function openPublicProfile() {
    if (!currentUser) return;
    window.open(publicProfileUrl(), "_blank");
  }

  // Render / Stats
  function updateStats() {
    const stats = Svc.computeOwnedStats(ownedSet);

    statTotal.textContent = String(stats.total);
    statOwned.textContent = String(stats.owned);
    statPct.textContent = stats.pct + "%";
    progressBar.style.width = stats.pct + "%";

    rarityBar.innerHTML = "";
    RARITY_ORDER.forEach(r => {
      const el = document.createElement("span");
      el.className = "statchip";
      el.innerHTML = `
        <span class="pill ${RARITY_CLASS[r] ?? ""}">${r}</span>
        <span class="muted"><span class="statnum">${stats.byRarity[r] ?? 0}</span> skin(s)</span>
      `;
      rarityBar.appendChild(el);
    });
  }

  function render() {
    const q = (search.value || "").toLowerCase().trim();
    const b = filterBrawler.value || "all";
    const r = filterRarity.value || "all";
    const only = !!onlyOwned.checked;

    const list = SKINS.filter(s => {
      if (!s) return false;
      if (only && !ownedSet.has(s.id)) return false;
      if (b !== "all" && s.brawler !== b) return false;
      if (r !== "all" && s.rarity !== r) return false;

      if (!q) return true;
      return String(s.name).toLowerCase().includes(q)
        || String(s.brawler).toLowerCase().includes(q)
        || String(s.category).toLowerCase().includes(q)
        || String(s.rarity).toLowerCase().includes(q);
    });

    resultCount.textContent = `${list.length} skin(s) affiché(s)`;
    cards.innerHTML = "";

    list.forEach(s => {
      const checked = ownedSet.has(s.id);

      const el = document.createElement("article");
      el.className = "card";
      el.innerHTML = `
        <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start; flex-wrap:wrap;">
          <div>
            <div class="row">
              <span class="pill">${s.category ?? "—"}</span>
              <span class="pill ${RARITY_CLASS[s.rarity] ?? ""}">${s.rarity ?? "—"}</span>
            </div>
            <h3 style="margin:8px 0 6px 0;">${s.name}</h3>
            <p class="muted" style="margin:0;">Brawler : <strong>${s.brawler ?? "—"}</strong></p>
          </div>

          <label style="display:flex; gap:8px; align-items:center; user-select:none;">
            <input type="checkbox" ${checked ? "checked" : ""} />
            <span>Je l’ai</span>
          </label>
        </div>
      `;

      const cb = el.querySelector("input[type='checkbox']");
      cb.addEventListener("change", async (e) => {
        await setOwned(s.id, e.target.checked);
      });

      cards.appendChild(el);
    });
  }

  async function refreshAll() {
    const t = ++refreshToken;
    try {
      await loadOwned();
      if (t !== refreshToken) return;

      updateStats();
      render();

      await loadPublicProfile();
      if (t !== refreshToken) return;
    } catch (e) {
      if (Svc.isAbortError?.(e)) return;
      console.error(e);
    }
  }

  // Events
  btnSignup.addEventListener("click", signup);
  btnLogin.addEventListener("click", login);
  btnLogout.addEventListener("click", logout);
  btnReload.addEventListener("click", refreshAll);

  search.addEventListener("input", render);
  filterBrawler.addEventListener("change", render);
  filterRarity.addEventListener("change", render);
  onlyOwned.addEventListener("change", render);

  btnSaveProfile.addEventListener("click", savePublicProfile);
  btnPublishOwned.addEventListener("click", publishOwnedToPublic);
  btnOpenProfile.addEventListener("click", openPublicProfile);
  btnCopyProfile.addEventListener("click", copyPublicLink);

  // Init
  buildBrawlerFilter();
  buildRarityFilter();
  updateStats();
  render();

  // Important: au chargement, les boutons doivent être actifs
  setAuthBusy(false, "");

  (async () => {
    const { data } = await supa.auth.getSession();
    const user = data.session?.user;

    if (user) {
      showLoggedIn(user);
      await refreshAll();
    } else {
      showLoggedOut();
    }

    let authEventToken = 0;
    supa.auth.onAuthStateChange(async (_event, session) => {
      const token = ++authEventToken;
      const u = session?.user;

      if (u) {
        showLoggedIn(u);
        setTimeout(async () => {
          if (token !== authEventToken) return;
          await refreshAll();
        }, 50);
      } else {
        showLoggedOut();
      }
    });
  })();
})();

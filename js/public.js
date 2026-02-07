// js/public.js
const errorCard = document.getElementById("errorCard");
const errorMsg = document.getElementById("errorMsg");

function fail(msg) {
  errorCard.style.display = "block";
  errorMsg.textContent = msg;
  document.getElementById("profileCard").style.display = "none";
  document.getElementById("toolbar").style.display = "none";
  document.getElementById("skinsSection").style.display = "none";
}

if (!window.supabaseClient) {
  fail("supabaseClient introuvable. Vérifie data/supabase-client.js et l’ordre des scripts.");
  throw new Error("supabaseClient introuvable");
}
if (!window.OwnedService) {
  fail("OwnedService introuvable. Vérifie js/owned-service.js et l’ordre des scripts.");
  throw new Error("OwnedService introuvable");
}

const supa = window.supabaseClient;
const Svc = window.OwnedService;

const allSkins = Svc.getSkins();
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
const profileCard = document.getElementById("profileCard");
const displayNameEl = document.getElementById("displayName");
const bioEl = document.getElementById("bio");
const updatedLine = document.getElementById("updatedLine");
const shareLine = document.getElementById("shareLine");
const publicModeLine = document.getElementById("publicModeLine");

const statOwned = document.getElementById("statOwned");
const statTotal = document.getElementById("statTotal");
const statPct = document.getElementById("statPct");
const progressBar = document.getElementById("progressBar");

const btnCopyLink = document.getElementById("btnCopyLink");
const toolbar = document.getElementById("toolbar");
const skinsSection = document.getElementById("skinsSection");
const cards = document.getElementById("cards");
const resultCount = document.getElementById("resultCount");

const search = document.getElementById("search");
const filterRarity = document.getElementById("filterRarity");

function parseUserId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("u");
}

function fmtDate(iso) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleString("fr-FR"); } catch { return ""; }
}

function buildRarityFilter() {
  filterRarity.innerHTML = "";
  const optAll = document.createElement("option");
  optAll.value = "all";
  optAll.textContent = "Toutes";
  filterRarity.appendChild(optAll);

  const existing = new Set(allSkins.map(s => s.rarity).filter(Boolean));
  RARITY_ORDER.forEach(r => {
    if (!existing.has(r)) return;
    const opt = document.createElement("option");
    opt.value = r;
    opt.textContent = r;
    filterRarity.appendChild(opt);
  });
}

function getSkinById(id) {
  return allSkins.find(s => s && s.id === id) || { id, name: id, brawler: "—", category: "—", rarity: "—" };
}

let profile = null;
let publicOwnedIds = [];

async function loadProfile(userId) {
  const { data, error } = await supa
    .from("public_profiles")
    .select("user_id, display_name, bio, is_public, show_owned, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function loadPublicOwned(userId) {
  const { data, error } = await supa
    .from("public_user_skins")
    .select("skin_id")
    .eq("user_id", userId);

  if (error) throw error;
  return (data || []).map(r => r.skin_id).filter(Boolean);
}

function updateHeaderUI(userId) {
  profileCard.style.display = "block";

  displayNameEl.textContent = profile.display_name || "Profil";
  bioEl.textContent = profile.bio || "—";
  updatedLine.textContent = profile.updated_at ? ("Dernière mise à jour : " + fmtDate(profile.updated_at)) : "";

  const shareUrl = new URL(window.location.href);
  shareUrl.searchParams.set("u", userId);
  shareLine.textContent = "Lien : " + shareUrl.toString();

  statTotal.textContent = String(allSkins.length);

  const ownedCount = publicOwnedIds.length;
  statOwned.textContent = String(ownedCount);

  const pct = allSkins.length > 0 ? Math.round((ownedCount / allSkins.length) * 100) : 0;
  statPct.textContent = pct + "%";
  progressBar.style.width = pct + "%";

  if (!profile.is_public) {
    publicModeLine.textContent = "⚠️ Profil non-public.";
  } else if (!profile.show_owned) {
    publicModeLine.textContent = "ℹ️ Profil public, mais liste des skins masquée.";
  } else {
    publicModeLine.textContent = "✅ Profil public + liste des skins visible.";
  }
}

function renderCards() {
  if (!profile?.show_owned) return;

  const q = (search.value || "").toLowerCase().trim();
  const r = filterRarity.value || "all";

  const list = publicOwnedIds
    .map(getSkinById)
    .filter(s => {
      if (r !== "all" && s.rarity !== r) return false;
      if (!q) return true;
      return String(s.name).toLowerCase().includes(q)
        || String(s.brawler).toLowerCase().includes(q)
        || String(s.category).toLowerCase().includes(q)
        || String(s.rarity).toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const ra = RARITY_ORDER.indexOf(a.rarity);
      const rb = RARITY_ORDER.indexOf(b.rarity);
      if (ra !== rb) return (ra === -1 ? 999 : ra) - (rb === -1 ? 999 : rb);
      return String(a.name).localeCompare(String(b.name), "fr");
    });

  resultCount.textContent = `${list.length} skin(s) affiché(s)`;
  cards.innerHTML = "";

  list.forEach(s => {
    const el = document.createElement("article");
    el.className = "card";
    el.innerHTML = `
      <div class="row">
        <span class="pill">${s.category ?? "—"}</span>
        <span class="pill ${RARITY_CLASS[s.rarity] ?? ""}">${s.rarity ?? "—"}</span>
      </div>
      <h3>${s.name}</h3>
      <p class="muted">Brawler : <strong>${s.brawler ?? "—"}</strong></p>
    `;
    cards.appendChild(el);
  });
}

btnCopyLink.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(window.location.href);
    btnCopyLink.textContent = "✅ Lien copié";
    setTimeout(() => btnCopyLink.textContent = "🔗 Copier le lien", 1200);
  } catch {
    alert("Copie impossible. Copie manuellement l’URL dans la barre d’adresse.");
  }
});

search.addEventListener("input", renderCards);
filterRarity.addEventListener("change", renderCards);

(async () => {
  buildRarityFilter();

  const userId = parseUserId();
  if (!userId) {
    fail("Il manque l’ID utilisateur dans l’URL. Exemple : public.html?u=UUID");
    return;
  }

  try {
    profile = await loadProfile(userId);
    if (!profile) { fail("Profil introuvable."); return; }
    if (!profile.is_public) { fail("Ce profil n’est pas public."); return; }

    publicOwnedIds = profile.show_owned ? await loadPublicOwned(userId) : [];

    updateHeaderUI(userId);

    if (profile.show_owned) {
      toolbar.style.display = "flex";
      skinsSection.style.display = "block";
      renderCards();
    }
  } catch (e) {
    console.error(e);
    fail("Erreur Supabase : " + (e.message || String(e)));
  }
})();

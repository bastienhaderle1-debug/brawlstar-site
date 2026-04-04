(function () {
  const VALID_TAG_CHARS = new Set("0289PYLQGRJCUV".split(""));
  const REQUEST_TIMEOUT_MS = 12000;
  let proxyHealthPromise = null;

  function safeStr(value) {
    return (value ?? "").toString().trim();
  }

  function configuredBaseUrl() {
    return safeStr(window.BRAWLDEX_CONFIG?.brawlApiBaseUrl).replace(/\/+$/, "");
  }

  function proxyOrigin() {
    return configuredBaseUrl() || window.location.origin;
  }

  function buildProxyUrl(pathname) {
    return new URL(pathname.replace(/^\//, ""), `${proxyOrigin()}/`).toString();
  }

  function normalizeTag(tag) {
    const raw = safeStr(tag).toUpperCase().replace(/\s+/g, "");
    const maybeUrl = raw.includes("/PLAYERS/") ? raw.split("/PLAYERS/").pop() : raw;
    const cleaned = maybeUrl.replace(/[^A-Z0-9#]/g, "").replace(/^#+/, "").replace(/O/g, "0");
    if (!cleaned) return "";
    if ([...cleaned].some((char) => !VALID_TAG_CHARS.has(char))) return "";
    return `#${cleaned}`;
  }

  function formatApiError(errorMessage, status) {
    const message = safeStr(errorMessage);
    const lower = message.toLowerCase();

    if (!message) {
      if (status === 404) {
        return "Le proxy Brawl Stars n'est pas disponible sur cette instance.";
      }
      return status ? `Erreur Brawl Stars API (${status}).` : "Erreur Brawl Stars API.";
    }

    if (lower.includes("not configured")) {
      return "Le token serveur BRAWL_STARS_API_TOKEN n'est pas configure sur Vercel.";
    }
    if (lower.includes("not available on this instance")) {
      return "Le proxy Brawl Stars n'est pas disponible sur cette instance.";
    }
    if (lower.includes("missing or invalid player tag")) {
      return "Entre un tag Brawl Stars valide. Utilise l'alphabet 0289PYLQGRJCUV.";
    }
    if (lower.includes("no brawl stars player was found")) {
      return "Aucun joueur Brawl Stars trouve pour ce tag.";
    }
    if (lower.includes("rate limit")) {
      return "Le quota Brawl Stars API est temporairement atteint. Reessaie dans une minute.";
    }
    if (lower.includes("server token was rejected")) {
      return "Le token serveur Brawl Stars API a ete refuse. Verifie la configuration Vercel.";
    }
    if (lower.includes("too long to respond")) {
      return "Le serveur Brawl Stars met trop de temps a repondre. Reessaie.";
    }

    return message;
  }

  async function fetchProxyHealth(options = {}) {
    if (!options.force && proxyHealthPromise) {
      return proxyHealthPromise;
    }

    proxyHealthPromise = (async () => {
      try {
        const response = await fetch(buildProxyUrl("/api/brawl-health"), {
          method: "GET",
          headers: {
            Accept: "application/json"
          }
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          return {
            configured: null,
            status: "unavailable",
            message: formatApiError(payload?.error, response.status)
          };
        }

        return {
          configured: typeof payload?.configured === "boolean" ? payload.configured : null,
          status: safeStr(payload?.status) || "unknown",
          message: safeStr(payload?.message) || "Etat du proxy Brawl Stars indisponible."
        };
      } catch {
        return {
          configured: null,
          status: "unavailable",
          message: "Impossible de verifier l'etat du proxy Brawl Stars pour l'instant."
        };
      }
    })();

    return proxyHealthPromise;
  }

  async function fetchPlayerProfile(tag) {
    const normalizedTag = normalizeTag(tag);
    if (!normalizedTag) {
      throw new Error("Entre un tag Brawl Stars valide. Utilise l'alphabet 0289PYLQGRJCUV.");
    }

    const url = new URL(buildProxyUrl("/api/brawl-player"));
    url.searchParams.set("tag", normalizedTag);

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response;

    try {
      response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json"
        },
        signal: controller.signal
      });
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error("Le proxy Brawl Stars a mis trop de temps a repondre.");
      }
      throw new Error("Impossible de joindre le proxy Brawl Stars.");
    } finally {
      window.clearTimeout(timeout);
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(formatApiError(payload?.error, response.status));
    }

    return payload;
  }

  window.BrawlStarsApi = {
    normalizeTag,
    formatApiError,
    fetchProxyHealth,
    fetchPlayerProfile
  };
})();

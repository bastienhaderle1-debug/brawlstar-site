(function () {
  function safeStr(value) {
    return (value ?? "").toString().trim();
  }

  function normalizeTag(tag) {
    const raw = safeStr(tag).toUpperCase().replace(/\s+/g, "");
    const cleaned = raw.replace(/[^A-Z0-9#]/g, "").replace(/^#+/, "");
    return cleaned ? `#${cleaned}` : "";
  }

  async function fetchPlayerProfile(tag) {
    const normalizedTag = normalizeTag(tag);
    if (!normalizedTag) {
      throw new Error("Enter a valid Brawl Stars player tag.");
    }

    const url = new URL("./api/brawl-player", window.location.origin);
    url.searchParams.set("tag", normalizedTag);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json"
      }
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error || `Brawl Stars API error (${response.status}).`);
    }

    return payload;
  }

  window.BrawlStarsApi = {
    normalizeTag,
    fetchPlayerProfile
  };
})();

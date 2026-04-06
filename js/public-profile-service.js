(function () {
  function getClient() {
    const supa = window.supabaseClient || null;
    if (!supa) {
      throw new Error("supabaseClient introuvable.");
    }
    return supa;
  }

  function safeStr(value) {
    return (value ?? "").toString().trim();
  }

  function normalizeNumber(value, min = 0, max = 999999999, fallback = 0) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, Math.round(parsed)));
  }

  function uniqueIds(list) {
    return [...new Set((Array.isArray(list) ? list : []).map((item) => safeStr(item)).filter(Boolean))];
  }

  function normalizeProgressSnapshot(snapshot) {
    const data = snapshot && typeof snapshot === "object" ? snapshot : {};
    return {
      global_pct: normalizeNumber(data.global_pct, 0, 100, 0),
      brawler_pct: normalizeNumber(data.brawler_pct, 0, 100, 0),
      skins_pct: normalizeNumber(data.skins_pct, 0, 100, 0),
      owned_brawlers: normalizeNumber(data.owned_brawlers, 0, 999999999, 0),
      total_brawlers: normalizeNumber(data.total_brawlers, 0, 999999999, 0),
      owned_skins: normalizeNumber(data.owned_skins, 0, 999999999, 0),
      total_skins: normalizeNumber(data.total_skins, 0, 999999999, 0),
      missing_coins: normalizeNumber(data.missing_coins, 0, 999999999, 0),
      missing_power_points: normalizeNumber(data.missing_power_points, 0, 999999999, 0),
      hypercharges: normalizeNumber(data.hypercharges, 0, 999999999, 0)
    };
  }

  function normalizeProfileRecord(profile) {
    if (!profile) return null;
    return {
      ...profile,
      display_name: safeStr(profile.display_name),
      bio: safeStr(profile.bio),
      club_name: safeStr(profile.club_name),
      friend_code: safeStr(profile.friend_code),
      trophies: normalizeNumber(profile.trophies, 0, 999999999, 0),
      is_public: profile.is_public !== false,
      show_owned: profile.show_owned !== false,
      progress_snapshot: normalizeProgressSnapshot(profile.progress_snapshot)
    };
  }

  function profilePayload(userId, fields, fallbackDisplayName) {
    const defaultName = safeStr(fallbackDisplayName) || "Profil";
    return {
      user_id: userId,
      display_name: safeStr(fields?.display_name) || defaultName,
      bio: safeStr(fields?.bio),
      club_name: safeStr(fields?.club_name),
      friend_code: safeStr(fields?.friend_code),
      trophies: normalizeNumber(fields?.trophies, 0, 999999999, 0),
      is_public: true,
      show_owned: true,
      progress_snapshot: normalizeProgressSnapshot(fields?.progress_snapshot),
      updated_at: new Date().toISOString()
    };
  }

  async function loadProfile(userId) {
    if (!safeStr(userId)) return null;
    const supa = getClient();
    const { data, error } = await supa
      .from("public_profiles")
      .select("user_id, display_name, bio, club_name, friend_code, trophies, is_public, show_owned, progress_snapshot, updated_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    return normalizeProfileRecord(data);
  }

  async function saveProfile(userId, fields, options) {
    if (!safeStr(userId)) {
      throw new Error("Utilisateur introuvable.");
    }
    const supa = getClient();
    const payload = profilePayload(userId, fields, options?.fallbackDisplayName);
    const { error } = await supa.from("public_profiles").upsert(payload, { onConflict: "user_id" });
    if (error) throw error;
    return payload;
  }

  async function loadOwned(userId) {
    if (!safeStr(userId)) return [];
    const supa = getClient();
    const { data, error } = await supa.from("public_user_skins").select("skin_id").eq("user_id", userId);
    if (error) throw error;
    return uniqueIds((data || []).map((row) => row.skin_id));
  }

  async function publishOwned(userId, ownedIds) {
    if (!safeStr(userId)) {
      throw new Error("Utilisateur introuvable.");
    }
    const supa = getClient();
    const uniqueOwnedIds = uniqueIds(ownedIds);

    const { error: deleteError } = await supa.from("public_user_skins").delete().eq("user_id", userId);
    if (deleteError) throw deleteError;

    if (!uniqueOwnedIds.length) {
      return { publishedCount: 0 };
    }

    const rows = uniqueOwnedIds.map((skin_id) => ({ user_id: userId, skin_id }));
    const { error: insertError } = await supa.from("public_user_skins").upsert(rows, { onConflict: "user_id,skin_id" });
    if (insertError) throw insertError;

    return { publishedCount: uniqueOwnedIds.length };
  }

  async function loadComparableProfile(userId) {
    if (!safeStr(userId)) return null;
    const profile = await loadProfile(userId);
    if (!profile || !profile.is_public || !profile.show_owned) {
      return null;
    }

    const ownedIds = await loadOwned(userId);
    return { userId, profile, ownedIds };
  }

  async function searchProfilesByName(query, limit = 24) {
    const supa = getClient();
    const q = safeStr(query);
    if (!q) return [];

    const { data, error } = await supa
      .from("public_profiles")
      .select("user_id, display_name, bio, club_name, friend_code, trophies, is_public, show_owned, progress_snapshot, updated_at")
      .eq("is_public", true)
      .ilike("display_name", `%${q}%`)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []).map(normalizeProfileRecord);
  }

  async function loadLatestProfiles(limit = 24) {
    const supa = getClient();
    const { data, error } = await supa
      .from("public_profiles")
      .select("user_id, display_name, bio, club_name, friend_code, trophies, is_public, show_owned, progress_snapshot, updated_at")
      .eq("is_public", true)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []).map(normalizeProfileRecord);
  }

  async function enrichProfiles(list, options) {
    const profiles = Array.isArray(list) ? list : [];
    const ids = uniqueIds(profiles.map((profile) => profile.user_id));
    if (!ids.length) return [];

    const supa = getClient();
    const { data, error } = await supa.from("public_user_skins").select("user_id, skin_id").in("user_id", ids);
    if (error) throw error;

    const counts = {};
    (data || []).forEach((row) => {
      const userId = safeStr(row.user_id);
      if (!userId) return;
      counts[userId] = (counts[userId] || 0) + 1;
    });

    const totalSkins = Number(options?.totalSkins || 0);
    const favoriteLookup = typeof options?.isFavorite === "function" ? options.isFavorite : () => false;

    return profiles.map((profile) => {
      const userId = safeStr(profile.user_id);
      const skinsVisible = profile.show_owned !== false;
      const ownedCount = skinsVisible ? counts[userId] || 0 : 0;
      const snapshot = normalizeProgressSnapshot(profile.progress_snapshot);
      return {
        ...profile,
        skinsVisible,
        ownedCount,
        pct: totalSkins > 0 ? Math.round((ownedCount / totalSkins) * 100) : 0,
        globalPct: snapshot.global_pct,
        brawlerPct: snapshot.brawler_pct,
        skinsPct: snapshot.skins_pct,
        progressSnapshot: snapshot,
        favorite: !!favoriteLookup(userId)
      };
    });
  }

  window.PublicProfileService = {
    normalizeProgressSnapshot,
    loadProfile,
    saveProfile,
    loadOwned,
    publishOwned,
    loadComparableProfile,
    searchProfilesByName,
    loadLatestProfiles,
    enrichProfiles
  };
})();

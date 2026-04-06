# Supabase Notes

Le front Brawldex attend actuellement :

- Auth email/password via `auth/v1`
- Table `user_skins`
- Table `public_profiles`
- Table `public_user_skins`

La table `public_profiles` stocke aussi les champs publics du profil :

- `display_name`
- `bio` (note visible)
- `club_name`
- `friend_code`
- `trophies`
- `is_public`
- `show_owned`
- `progress_snapshot` (resume JSON de progression publique)

Le schema et les policies de reference sont dans [setup.sql](./setup.sql).

## Remise en route rapide

1. Verifier que l'URL et la cle anon de [supabase-client.js](../data/supabase-client.js) pointent vers le bon projet.
2. Appliquer [setup.sql](./setup.sql) si les tables ou policies manquent.
3. Lancer un smoke test local avec un compte jetable :

```powershell
.\scripts\supabase-smoke.ps1 -Email "compte@test.com" -Password "motdepasse"
```

## Supabase CLI

Le CLI n'est pas requis pour le front, mais utile pour lier le projet local.

Exemple :

```powershell
supabase login
supabase init
supabase link --project-ref dfactzpzoyrfmhmwmdgj
```

## Ce que verifie le smoke test

- Auth du compte test
- Lecture privee `user_skins`
- Ecriture reversible `user_skins`
- Lecture `public_profiles`
- Upsert `public_profiles`
- Ecriture reversible `public_user_skins`

Le script nettoie automatiquement les lignes de sonde qu'il cree.

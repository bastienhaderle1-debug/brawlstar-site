-- Inferred Supabase schema for the current Brawldex frontend.
-- This file is derived from:
-- - js/owned-service.js
-- - js/public-profile-service.js
-- - js/mybrawl.js
-- - js/profile.js

create extension if not exists "pgcrypto";

create table if not exists public.user_skins (
  user_id uuid not null references auth.users (id) on delete cascade,
  skin_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, skin_id)
);

create table if not exists public.public_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  bio text not null default '',
  is_public boolean not null default true,
  show_owned boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.public_user_skins (
  user_id uuid not null references auth.users (id) on delete cascade,
  skin_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, skin_id)
);

create index if not exists public_profiles_public_updated_idx
  on public.public_profiles (is_public, updated_at desc);

create index if not exists public_user_skins_user_idx
  on public.public_user_skins (user_id);

alter table public.user_skins enable row level security;
alter table public.public_profiles enable row level security;
alter table public.public_user_skins enable row level security;

drop policy if exists "user_skins_select_own" on public.user_skins;
create policy "user_skins_select_own"
  on public.user_skins
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_skins_insert_own" on public.user_skins;
create policy "user_skins_insert_own"
  on public.user_skins
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "user_skins_update_own" on public.user_skins;
create policy "user_skins_update_own"
  on public.user_skins
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_skins_delete_own" on public.user_skins;
create policy "user_skins_delete_own"
  on public.user_skins
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "public_profiles_select_public_or_own" on public.public_profiles;
create policy "public_profiles_select_public_or_own"
  on public.public_profiles
  for select
  to anon, authenticated
  using (is_public = true or auth.uid() = user_id);

drop policy if exists "public_profiles_insert_own" on public.public_profiles;
create policy "public_profiles_insert_own"
  on public.public_profiles
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "public_profiles_update_own" on public.public_profiles;
create policy "public_profiles_update_own"
  on public.public_profiles
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "public_profiles_delete_own" on public.public_profiles;
create policy "public_profiles_delete_own"
  on public.public_profiles
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "public_user_skins_select_public_or_own" on public.public_user_skins;
create policy "public_user_skins_select_public_or_own"
  on public.public_user_skins
  for select
  to anon, authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1
      from public.public_profiles profile
      where profile.user_id = public_user_skins.user_id
        and profile.is_public = true
        and profile.show_owned = true
    )
  );

drop policy if exists "public_user_skins_insert_own" on public.public_user_skins;
create policy "public_user_skins_insert_own"
  on public.public_user_skins
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "public_user_skins_update_own" on public.public_user_skins;
create policy "public_user_skins_update_own"
  on public.public_user_skins
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "public_user_skins_delete_own" on public.public_user_skins;
create policy "public_user_skins_delete_own"
  on public.public_user_skins
  for delete
  to authenticated
  using (auth.uid() = user_id);

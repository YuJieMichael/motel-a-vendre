-- Motel à vendre account centre.
-- Target: the SEPARATE Supabase project dedicated to motelavendre.ca accounts.
-- Never apply this file to the main Propriété En Vente project.
-- Every table is owned by one auth user and protected by row level security.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 80),
  phone text not null default '' check (char_length(phone) <= 40),
  preferred_language text not null default 'fr' check (preferred_language in ('fr','en','zh')),
  buyer_budget bigint check (buyer_budget is null or buyer_budget between 0 and 1000000000),
  buyer_regions text not null default '' check (char_length(buyer_regions) <= 120),
  buyer_timeline text not null default '' check (buyer_timeline in ('','exploring','0-3','3-6','6+')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.saved_listings (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  listing_reference text not null check (listing_reference ~ '^[0-9]{1,12}$'),
  created_at timestamptz not null default now(),
  primary key (user_id, listing_reference)
);

create table public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  criteria jsonb not null check (jsonb_typeof(criteria) = 'object' and pg_column_size(criteria) <= 2048),
  created_at timestamptz not null default now()
);
create index saved_searches_user_idx on public.saved_searches(user_id, created_at desc);

-- A personal copy of enquiries sent while signed in. The enquiry itself is still
-- delivered by the existing intake; no message body or contact data is copied.
create table public.enquiry_history (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('buyer','seller')),
  purpose text not null default 'info' check (purpose in ('info','viewing','documents')),
  listing_reference text not null default '' check (listing_reference ~ '^[0-9]{0,12}$'),
  language text not null check (language in ('fr','en','zh')),
  sent_at timestamptz not null default now()
);
create index enquiry_history_user_idx on public.enquiry_history(user_id, sent_at desc);

-- Owner columns cannot be forged: inserts always take the caller's id.
create function public.motel_force_owner() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  new.user_id := auth.uid();
  return new;
end $$;

-- Bounded per-user storage protects the free tier from scripted abuse.
create function public.motel_enforce_quota() returns trigger
language plpgsql security definer set search_path = '' as $$
declare n integer; cap integer := tg_argv[0]::integer;
begin
  execute format('select count(*) from public.%I where user_id = $1', tg_table_name) into n using new.user_id;
  if n >= cap then raise exception 'quota_exceeded'; end if;
  return new;
end $$;

create trigger saved_listings_owner before insert on public.saved_listings for each row execute function public.motel_force_owner();
create trigger saved_searches_owner before insert on public.saved_searches for each row execute function public.motel_force_owner();
create trigger enquiry_history_owner before insert on public.enquiry_history for each row execute function public.motel_force_owner();
create trigger saved_listings_quota before insert on public.saved_listings for each row execute function public.motel_enforce_quota('200');
create trigger saved_searches_quota before insert on public.saved_searches for each row execute function public.motel_enforce_quota('20');
create trigger enquiry_history_quota before insert on public.enquiry_history for each row execute function public.motel_enforce_quota('500');

create function public.motel_touch_profile() returns trigger
language plpgsql set search_path = '' as $$
begin new.id := old.id; new.created_at := old.created_at; new.updated_at := now(); return new; end $$;
create trigger profiles_touch before update on public.profiles for each row execute function public.motel_touch_profile();

-- Each new auth user gets an empty profile; the language comes from sign-up metadata.
create function public.motel_create_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
declare lang text := coalesce(new.raw_user_meta_data->>'language', 'fr');
begin
  insert into public.profiles(id, preferred_language)
  values (new.id, case when lang in ('fr','en','zh') then lang else 'fr' end)
  on conflict (id) do nothing;
  return new;
end $$;
create trigger motel_on_auth_user_created after insert on auth.users for each row execute function public.motel_create_profile();

alter table public.profiles enable row level security;
alter table public.saved_listings enable row level security;
alter table public.saved_searches enable row level security;
alter table public.enquiry_history enable row level security;

create policy "own profile read" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "own profile update" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "own saved listings read" on public.saved_listings for select to authenticated using ((select auth.uid()) = user_id);
create policy "own saved listings add" on public.saved_listings for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own saved listings remove" on public.saved_listings for delete to authenticated using ((select auth.uid()) = user_id);

create policy "own searches read" on public.saved_searches for select to authenticated using ((select auth.uid()) = user_id);
create policy "own searches add" on public.saved_searches for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own searches remove" on public.saved_searches for delete to authenticated using ((select auth.uid()) = user_id);

create policy "own history read" on public.enquiry_history for select to authenticated using ((select auth.uid()) = user_id);
create policy "own history add" on public.enquiry_history for insert to authenticated with check ((select auth.uid()) = user_id);

-- Explicit grants: anonymous visitors get nothing; signed-in users only the
-- operations their policies allow. Profiles cannot be inserted or deleted
-- directly (creation is automatic, deletion goes through delete_my_account).
revoke all on public.profiles, public.saved_listings, public.saved_searches, public.enquiry_history from public, anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, phone, preferred_language, buyer_budget, buyer_regions, buyer_timeline) on public.profiles to authenticated;
grant select, insert, delete on public.saved_listings to authenticated;
grant select, insert, delete on public.saved_searches to authenticated;
grant select, insert on public.enquiry_history to authenticated;

revoke all on function public.motel_force_owner(), public.motel_enforce_quota(), public.motel_touch_profile(), public.motel_create_profile() from public, anon, authenticated;

-- Québec Law 25: a person can erase their account and every row it owns.
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  delete from auth.users where id = uid;
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

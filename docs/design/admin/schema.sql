-- CityMood Newsroom: Supabase schema (reference starting point)
-- Claude Code: turn this into a migration under supabase/migrations/, review it,
-- and keep the RLS tests in docs/design/admin/rls-tests.sql passing.
-- Tested against a Supabase-like Postgres 16 stub on 13 Oct 2026.

-- ───────────────────────── Types ─────────────────────────
create type public.staff_role as enum ('reporter', 'editor', 'admin');
create type public.article_status as enum ('draft', 'scheduled', 'published', 'unpublished');
create type public.ad_slot as enum ('leaderboard', 'mpu_1', 'mpu_2', 'billboard');
create type public.front_slot as enum ('lead', 'top_1', 'top_2', 'top_3', 'top_4');

-- ───────────────────────── Tables ─────────────────────────
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '',
  role        public.staff_role not null default 'reporter',
  is_active   boolean not null default false,          -- invites activate it
  created_at  timestamptz not null default now()
);

create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  position   int  not null default 0,
  is_active  boolean not null default true
);

create table public.tags (
  id    uuid primary key default gen_random_uuid(),
  name  text not null,
  slug  text not null unique
);

create table public.media (
  id            uuid primary key default gen_random_uuid(),
  storage_path  text not null unique,                 -- e.g. 2026/10/<uuid>.webp in bucket "media"
  width         int,
  height        int,
  alt           text not null default '',
  caption       text not null default '',
  credit        text not null default '',
  focal_x       real not null default 0.5 check (focal_x between 0 and 1),
  focal_y       real not null default 0.5 check (focal_y between 0 and 1),
  uploaded_by   uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now()
);

create table public.articles (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique,
  headline           text not null default '',
  standfirst         text not null default '',
  body               jsonb not null default '{}'::jsonb,   -- Tiptap JSON
  body_html          text not null default '',             -- sanitized HTML, generated on the server
  category_id        uuid references public.categories (id) on delete restrict,
  author_id          uuid references public.profiles (id) on delete set null,
  featured_image_id  uuid references public.media (id) on delete set null,
  status             public.article_status not null default 'draft',
  publish_at         timestamptz,                          -- live when status is published/scheduled and publish_at <= now()
  featured           boolean not null default false,
  breaking           boolean not null default false,
  breaking_until     timestamptz,
  seo_title          text not null default '',
  seo_description    text not null default '',
  created_by         uuid references public.profiles (id) on delete set null,
  updated_by         uuid references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint publish_needs_time check (status in ('draft', 'unpublished') or publish_at is not null)
);
create index articles_live_idx     on public.articles (status, publish_at desc);
create index articles_category_idx on public.articles (category_id, publish_at desc);
create index articles_author_idx   on public.articles (author_id);

create table public.article_tags (
  article_id  uuid references public.articles (id) on delete cascade,
  tag_id      uuid references public.tags (id) on delete cascade,
  primary key (article_id, tag_id)
);

create table public.front_page_pins (
  slot        public.front_slot primary key,
  article_id  uuid not null references public.articles (id) on delete cascade,
  pinned_by   uuid references public.profiles (id) on delete set null default auth.uid(),
  pinned_at   timestamptz not null default now()
);

create table public.most_read_picks (
  position    smallint primary key check (position between 1 and 5),
  article_id  uuid not null references public.articles (id) on delete cascade
);

create table public.ad_campaigns (
  id                uuid primary key default gen_random_uuid(),
  slot              public.ad_slot not null,
  advertiser_name   text not null,
  image_desktop_id  uuid references public.media (id) on delete set null,
  image_mobile_id   uuid references public.media (id) on delete set null,
  link_url          text not null check (link_url ~* '^https?://'),
  alt               text not null,
  starts_at         timestamptz not null,
  ends_at           timestamptz not null,
  created_by        uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at        timestamptz not null default now(),
  constraint ad_dates check (ends_at > starts_at)
);
create index ad_campaigns_slot_idx on public.ad_campaigns (slot, starts_at, ends_at);

create table public.site_settings (
  id                 boolean primary key default true check (id),   -- single row
  newsroom_address   text not null default '',
  newsroom_phone     text not null default '',
  newsroom_email     text not null default '',
  corrections_email  text not null default '',
  facebook_url       text not null default '',
  instagram_url      text not null default 'https://www.instagram.com/citymoodbadagry/',
  tiktok_url         text not null default 'https://www.tiktok.com/@citymoodbadagry'
);
insert into public.site_settings default values;

-- ───────────────────────── Helpers ─────────────────────────
create or replace function public.my_role()
returns public.staff_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and is_active
$$;

create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and is_active)
$$;

create or replace function public.is_editor()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() in ('editor', 'admin'), false)
$$;

-- Public view: what readers may see
create or replace view public.live_articles with (security_invoker = true) as
  select * from public.articles
  where status in ('published', 'scheduled') and publish_at <= now();

-- ───────────────────────── Triggers ─────────────────────────
-- New auth users get an INACTIVE reporter profile. The invite server action
-- (service role) then sets the real role and activates it. Sign-ups can never pick a role.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role, is_active)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), 'reporter', false);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Article guard: stamps, reporter limits, breaking window.
create or replace function public.guard_article()
returns trigger language plpgsql security definer set search_path = public as $$
declare r public.staff_role := public.my_role();
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
    if r = 'reporter' then
      if new.featured then raise exception 'Only editors can feature stories on the homepage'; end if;
      if new.author_id is distinct from auth.uid() then raise exception 'Reporters can only write under their own byline'; end if;
    end if;
  else
    if r = 'reporter' then
      if new.featured is distinct from old.featured then raise exception 'Only editors can feature stories on the homepage'; end if;
      if new.author_id is distinct from old.author_id then raise exception 'Only editors can change a byline'; end if;
    end if;
    -- slug is locked once a story has gone live
    if old.status in ('published', 'scheduled') and new.slug is distinct from old.slug then
      raise exception 'The web address cannot change after publishing';
    end if;
  end if;

  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);

  -- Breaking: default 6-hour window from go-live; clearing the flag clears the window
  if new.breaking and new.breaking_until is null then
    new.breaking_until := greatest(now(), coalesce(new.publish_at, now())) + interval '6 hours';
  elsif not new.breaking then
    new.breaking_until := null;
  end if;
  return new;
end $$;
create trigger articles_guard before insert or update on public.articles
  for each row execute function public.guard_article();

-- ───────────────────────── Row-level security ─────────────────────────
alter table public.profiles        enable row level security;
alter table public.categories      enable row level security;
alter table public.tags            enable row level security;
alter table public.media           enable row level security;
alter table public.articles        enable row level security;
alter table public.article_tags    enable row level security;
alter table public.front_page_pins enable row level security;
alter table public.most_read_picks enable row level security;
alter table public.ad_campaigns    enable row level security;
alter table public.site_settings   enable row level security;

-- profiles: staff see the team; only admins change roles (invites use the service role)
create policy profiles_read   on public.profiles for select to authenticated using (public.is_staff() or id = auth.uid());
create policy profiles_admin  on public.profiles for update to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- articles
create policy articles_public_read on public.articles for select to anon, authenticated
  using (status in ('published', 'scheduled') and publish_at <= now());
create policy articles_staff_read  on public.articles for select to authenticated using (public.is_staff());
create policy articles_insert      on public.articles for insert to authenticated with check (public.is_staff());
create policy articles_update      on public.articles for update to authenticated
  using (public.is_editor() or (public.my_role() = 'reporter' and author_id = auth.uid()))
  with check (public.is_editor() or (public.my_role() = 'reporter' and author_id = auth.uid()));
create policy articles_delete      on public.articles for delete to authenticated
  using (public.is_editor() or (public.my_role() = 'reporter' and author_id = auth.uid() and status = 'draft'));

-- article_tags follow the article's edit rights
create policy article_tags_read  on public.article_tags for select to anon, authenticated using (true);
create policy article_tags_write on public.article_tags for all to authenticated
  using (exists (select 1 from public.articles a where a.id = article_id
                 and (public.is_editor() or (public.my_role() = 'reporter' and a.author_id = auth.uid()))))
  with check (exists (select 1 from public.articles a where a.id = article_id
                 and (public.is_editor() or (public.my_role() = 'reporter' and a.author_id = auth.uid()))));

-- categories: everyone reads, admins write
create policy categories_read  on public.categories for select to anon, authenticated using (true);
create policy categories_write on public.categories for all to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- tags: everyone reads, staff add, editors tidy
create policy tags_read   on public.tags for select to anon, authenticated using (true);
create policy tags_insert on public.tags for insert to authenticated with check (public.is_staff());
create policy tags_edit   on public.tags for update to authenticated using (public.is_editor()) with check (public.is_editor());
create policy tags_delete on public.tags for delete to authenticated using (public.is_editor());

-- media: public metadata (images are public anyway), staff upload, own or editor edits
create policy media_read   on public.media for select to anon, authenticated using (true);
create policy media_insert on public.media for insert to authenticated with check (public.is_staff());
create policy media_update on public.media for update to authenticated
  using (public.is_editor() or uploaded_by = auth.uid()) with check (public.is_editor() or uploaded_by = auth.uid());
create policy media_delete on public.media for delete to authenticated using (public.is_editor());

-- front page and most read: everyone reads, editors write
create policy pins_read  on public.front_page_pins for select to anon, authenticated using (true);
create policy pins_write on public.front_page_pins for all to authenticated using (public.is_editor()) with check (public.is_editor());
create policy picks_read  on public.most_read_picks for select to anon, authenticated using (true);
create policy picks_write on public.most_read_picks for all to authenticated using (public.is_editor()) with check (public.is_editor());

-- ads: readers see running campaigns; staff see all; admins write
create policy ads_public_read on public.ad_campaigns for select to anon, authenticated using (now() between starts_at and ends_at);
create policy ads_staff_read  on public.ad_campaigns for select to authenticated using (public.is_staff());
create policy ads_write       on public.ad_campaigns for all to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- site settings: everyone reads, admins update
create policy settings_read  on public.site_settings for select to anon, authenticated using (true);
create policy settings_write on public.site_settings for update to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- ───────────────────────── Storage ─────────────────────────
insert into storage.buckets (id, name, public) values ('media', 'media', true)
  on conflict (id) do nothing;
create policy media_files_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.is_staff());
create policy media_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and public.is_editor());

-- ───────────────────────── Seed ─────────────────────────
insert into public.categories (name, slug, position) values
  ('Local News', 'local-news', 1),
  ('Community & People', 'community-people', 2),
  ('Business & Development', 'business-development', 3),
  ('Politics & Public Affairs', 'politics-public-affairs', 4),
  ('Culture & Events', 'culture-events', 5),
  ('Tourism & Heritage', 'tourism-heritage', 6);

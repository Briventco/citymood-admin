-- Newsroom portal support. Additive: no column is renamed or removed, so the
-- public site and the older /admin keep working before and after this runs.
--
-- Do NOT add foreign keys from articles or ad_campaigns to article_media here.
-- The public site embeds article_media(...) from both tables, and a second
-- relationship makes PostgREST reject those queries as ambiguous. Triggers
-- below do the cleanup a foreign key would have done.

-- ───────────── Articles ─────────────

alter table public.articles
  add column if not exists body_doc jsonb,
  add column if not exists body_html text not null default '',
  add column if not exists featured_image_id uuid,
  add column if not exists breaking boolean not null default false,
  add column if not exists breaking_until timestamptz,
  add column if not exists seo_title text not null default '',
  add column if not exists seo_description text not null default '';

-- Existing stories keep showing the photo they already have.
update public.articles a
set featured_image_id = (
  select m.id from public.article_media m
  where m.article_id = a.id
  order by m.created_at desc
  limit 1
)
where a.featured_image_id is null;

create index if not exists articles_breaking_idx on public.articles (breaking_until)
  where breaking;

-- ───────────── Media and ads ─────────────

-- Photos are uploaded first and described after, so alt text can start empty.
-- Publishing still requires it.
alter table public.article_media drop constraint if exists article_media_alt_text_check;
alter table public.article_media add constraint article_media_alt_text_check
  check (char_length(alt_text) <= 500);

alter table public.ad_campaigns add column if not exists image_mobile_id uuid;

alter table public.ad_campaigns drop constraint if exists ad_campaigns_slot_check;
alter table public.ad_campaigns add constraint ad_campaigns_slot_check
  check (slot in ('leaderboard', 'mpu', 'mpu_1', 'mpu_2', 'billboard'));

create or replace function public.clear_deleted_media_references()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.articles set featured_image_id = null where featured_image_id = old.id;
  update public.ad_campaigns set image_mobile_id = null where image_mobile_id = old.id;
  return old;
end;
$$;

drop trigger if exists article_media_clear_references on public.article_media;
create trigger article_media_clear_references
after delete on public.article_media
for each row execute function public.clear_deleted_media_references();

-- ───────────── Front page and settings ─────────────

create table if not exists public.front_page_pins (
  slot text primary key check (slot in ('lead', 'top_1', 'top_2', 'top_3', 'top_4')),
  article_id uuid not null unique references public.articles (id) on delete cascade,
  pinned_by uuid references public.profiles (id) on delete set null,
  pinned_at timestamptz not null default now()
);

create table if not exists public.most_read_picks (
  position integer primary key check (position between 1 and 5),
  article_id uuid not null unique references public.articles (id) on delete cascade
);

create table if not exists public.site_settings (
  id boolean primary key default true check (id),
  newsroom_address text not null default '',
  newsroom_phone text not null default '',
  newsroom_email text not null default '',
  corrections_email text not null default '',
  facebook_url text not null default '',
  instagram_url text not null default '',
  tiktok_url text not null default ''
);

-- The values the site already shows from config/site.ts.
insert into public.site_settings (
  newsroom_address, newsroom_phone, newsroom_email, corrections_email,
  facebook_url, instagram_url, tiktok_url
) values (
  '10, Agric Road, Opposite Badagry Local Government Secretariat, Ajara, Badagry Central, Lagos State',
  '+234 904 558 7616',
  'citymoodbadagry@gmail.com',
  'corrections@citymood.ng',
  'https://www.facebook.com/citymoodbadagry',
  'https://www.instagram.com/citymoodbadagry/',
  'https://www.tiktok.com/@citymoodbadagry'
)
on conflict (id) do nothing;

alter table public.front_page_pins enable row level security;
alter table public.most_read_picks enable row level security;
alter table public.site_settings enable row level security;

grant select on public.front_page_pins, public.most_read_picks, public.site_settings to anon, authenticated;
grant insert, update, delete on public.front_page_pins, public.most_read_picks to authenticated;
grant update on public.site_settings to authenticated;

drop policy if exists pins_read on public.front_page_pins;
create policy pins_read on public.front_page_pins for select to anon, authenticated using (true);
drop policy if exists pins_write on public.front_page_pins;
create policy pins_write on public.front_page_pins for all to authenticated
  using (public.has_permission('article:feature'))
  with check (public.has_permission('article:feature'));

drop policy if exists picks_read on public.most_read_picks;
create policy picks_read on public.most_read_picks for select to anon, authenticated using (true);
drop policy if exists picks_write on public.most_read_picks;
create policy picks_write on public.most_read_picks for all to authenticated
  using (public.has_permission('article:feature'))
  with check (public.has_permission('article:feature'));

drop policy if exists settings_read on public.site_settings;
create policy settings_read on public.site_settings for select to anon, authenticated using (true);
drop policy if exists settings_write on public.site_settings;
create policy settings_write on public.site_settings for update to authenticated
  using (public.has_permission('system:manage'))
  with check (public.has_permission('system:manage'));

-- ───────────── Rules the portal relies on (ADMIN_SPEC §2) ─────────────

-- Suspending someone has to stop their writes at the database, not only in the
-- app: a session token issued before the suspension stays valid until it expires.
create or replace function public.has_permission(required_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    join public.role_permissions rp on rp.role_name = ur.role_name
    where ur.user_id = auth.uid()
      and p.status = 'active'
      and rp.permission_name = required_permission
  );
$$;

-- Bylines, the staff list and the author filter need colleagues' names and roles.
drop policy if exists profiles_read_staff on public.profiles;
create policy profiles_read_staff on public.profiles for select to authenticated
  using (public.has_permission('media:upload'));
drop policy if exists user_roles_read_staff on public.user_roles;
create policy user_roles_read_staff on public.user_roles for select to authenticated
  using (public.has_permission('media:upload'));

-- Any writer can create a tag while filing a story. Renaming and merging stay with editors.
drop policy if exists tags_insert_staff on public.tags;
create policy tags_insert_staff on public.tags for insert to authenticated
  with check (public.has_permission('article:create'));

-- Editors delete any story.
drop policy if exists articles_delete_editor on public.articles;
create policy articles_delete_editor on public.articles for delete to authenticated
  using (public.has_permission('article:edit:any'));

-- The media library is shared, so all staff see every photo.
drop policy if exists article_media_read_staff on public.article_media;
create policy article_media_read_staff on public.article_media for select to authenticated
  using (public.has_permission('media:upload'));

-- Readers need photos chosen from the library, which have no article_id, and ad creatives.
drop policy if exists article_media_read_featured on public.article_media;
create policy article_media_read_featured on public.article_media for select to anon, authenticated
  using (
    exists (
      select 1 from public.articles a
      where a.featured_image_id = article_media.id
        and a.status = 'published' and a.published_at <= now()
    )
  );

drop policy if exists article_media_read_running_ads on public.article_media;
create policy article_media_read_running_ads on public.article_media for select to anon, authenticated
  using (
    exists (
      select 1 from public.ad_campaigns c
      where (c.media_id = article_media.id or c.image_mobile_id = article_media.id)
        and c.active = true and c.starts_at <= now() and c.ends_at > now()
    )
  );

-- RLS checks rows, not which columns changed, so column rules live in triggers.
-- Reporters may edit their own stories but not feature them, change a byline or
-- take a live story down. Service-role work (auth.uid() is null) is exempt.
create or replace function public.guard_article()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is not null then
    if new.featured and (tg_op = 'INSERT' or not old.featured)
       and not public.has_permission('article:feature') then
      raise exception 'Only editors can feature stories on the homepage.' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and not public.has_permission('article:edit:any') then
      if new.author_id is distinct from old.author_id then
        raise exception 'Only editors can change a byline.' using errcode = '42501';
      end if;
      if old.status = 'published' and old.published_at <= now()
         and new.status in ('draft', 'in_review', 'unpublished', 'archived') then
        raise exception 'Only editors can unpublish a story.' using errcode = '42501';
      end if;
    end if;
  end if;

  -- Breaking runs for 6 hours from go-live. Clearing the flag clears the window.
  if not new.breaking then
    new.breaking_until := null;
  elsif new.breaking_until is null then
    new.breaking_until := greatest(now(), coalesce(new.published_at, new.scheduled_for, now())) + interval '6 hours';
  end if;

  return new;
end;
$$;

drop trigger if exists articles_guard on public.articles;
create trigger articles_guard
before insert or update on public.articles
for each row execute function public.guard_article();

-- profiles_update_self_or_admin lets people update their own row, which would
-- otherwise let a suspended user set their status back to active.
create or replace function public.guard_profile_status()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is not null and new.status is distinct from old.status
     and not public.has_permission('user:manage') then
    raise exception 'Only admins can change a staff member''s status.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_status on public.profiles;
create trigger profiles_guard_status
before update on public.profiles
for each row execute function public.guard_profile_status();

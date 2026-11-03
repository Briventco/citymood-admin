-- CityMood initial editorial schema.
-- Credentials and environment configuration are intentionally not stored here.

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  status text not null default 'invited' check (status in ('active', 'suspended', 'invited')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table public.roles (
  name text primary key,
  description text not null default ''
);

create table public.permissions (
  name text primary key,
  description text not null default ''
);

create table public.role_permissions (
  role_name text not null references public.roles (name) on delete cascade,
  permission_name text not null references public.permissions (name) on delete cascade,
  primary key (role_name, permission_name)
);

create table public.user_roles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role_name text not null references public.roles (name) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (user_id, role_name)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null,
  short_name text not null,
  description text not null default '',
  display_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 300),
  standfirst text not null default '',
  body text not null default '',
  author_id uuid not null references public.profiles (id) on delete restrict,
  category_id uuid references public.categories (id) on delete restrict,
  status text not null default 'draft'
    check (status in ('draft', 'in_review', 'scheduled', 'published', 'unpublished', 'archived')),
  published_at timestamptz,
  scheduled_for timestamptz,
  unpublished_at timestamptz,
  featured boolean not null default false,
  feature_people boolean not null default false,
  role text,
  place text,
  reading_minutes smallint check (reading_minutes is null or reading_minutes > 0),
  correction_note text,
  corrected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint published_articles_have_date check (status <> 'published' or published_at is not null),
  constraint scheduled_articles_have_date check (status <> 'scheduled' or scheduled_for is not null)
);

create table public.article_revisions (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles (id) on delete cascade,
  revision_number integer not null check (revision_number > 0),
  title text not null,
  standfirst text not null default '',
  body text not null default '',
  author_id uuid not null references public.profiles (id) on delete restrict,
  category_id uuid references public.categories (id) on delete restrict,
  editor_id uuid references public.profiles (id) on delete restrict,
  change_summary text not null default '',
  created_at timestamptz not null default now(),
  unique (article_id, revision_number)
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.article_tags (
  article_id uuid not null references public.articles (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (article_id, tag_id)
);

create table public.article_media (
  id uuid primary key default gen_random_uuid(),
  article_id uuid references public.articles (id) on delete cascade,
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/avif')),
  byte_size bigint not null check (byte_size > 0),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  alt_text text not null check (char_length(alt_text) between 1 and 500),
  caption text,
  credit text,
  focal_x numeric(4,3) check (focal_x is null or focal_x between 0 and 1),
  focal_y numeric(4,3) check (focal_y is null or focal_y between 0 and 1),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slot text not null check (slot in ('leaderboard', 'mpu', 'billboard')),
  media_id uuid references public.article_media (id) on delete set null,
  alt_text text not null check (char_length(alt_text) between 1 and 500),
  destination_url text not null check (destination_url ~* '^https://'),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  active boolean not null default true,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ad_campaign_has_valid_window check (ends_at > starts_at)
);

create table public.article_view_events (
  id bigint generated always as identity primary key,
  article_id uuid not null references public.articles (id) on delete cascade,
  visitor_hash text,
  user_id uuid references public.profiles (id) on delete set null,
  occurred_at timestamptz not null default now()
);

create table public.article_daily_views (
  article_id uuid not null references public.articles (id) on delete cascade,
  view_date date not null,
  view_count bigint not null default 0 check (view_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (article_id, view_date)
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  request_id text,
  created_at timestamptz not null default now()
);

create index articles_public_order_idx on public.articles (published_at desc)
  where status = 'published';
create index articles_category_order_idx on public.articles (category_id, published_at desc)
  where status = 'published';
create index articles_author_status_idx on public.articles (author_id, status);
create index article_revisions_article_idx on public.article_revisions (article_id, revision_number desc);
create index article_tags_tag_idx on public.article_tags (tag_id, article_id);
create index article_media_article_idx on public.article_media (article_id);
create index article_view_events_article_time_idx on public.article_view_events (article_id, occurred_at desc);
create index article_daily_views_date_idx on public.article_daily_views (view_date desc, view_count desc);
create index audit_log_entity_idx on public.audit_log (entity_type, entity_id, created_at desc);
create index articles_search_idx on public.articles using gin (
  to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(standfirst, '') || ' ' || coalesce(body, ''))
);
create index articles_title_trgm_idx on public.articles using gin (title gin_trgm_ops);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger categories_set_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

create trigger articles_set_updated_at
before update on public.articles
for each row execute function public.set_updated_at();

create trigger ad_campaigns_set_updated_at
before update on public.ad_campaigns
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, status)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), 'invited')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

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
    join public.role_permissions rp on rp.role_name = ur.role_name
    where ur.user_id = auth.uid()
      and rp.permission_name = required_permission
  );
$$;

revoke all on function public.has_permission(text) from public;
grant execute on function public.has_permission(text) to anon, authenticated;

insert into public.roles (name, description) values
  ('reporter', 'Creates and submits owned stories for review'),
  ('editor', 'Reviews, manages, and publishes editorial content'),
  ('ad_manager', 'Manages direct-sold advertising campaigns'),
  ('administrator', 'Manages users, integrations, and system operations')
on conflict (name) do nothing;

insert into public.permissions (name, description) values
  ('article:create', 'Create an article'),
  ('article:edit:own', 'Edit owned articles'),
  ('article:edit:any', 'Edit any article'),
  ('article:submit', 'Submit an article for review'),
  ('article:publish', 'Publish, schedule, or unpublish articles'),
  ('article:correct', 'Issue article corrections'),
  ('article:feature', 'Set featured and people flags'),
  ('article:break', 'Apply breaking-news status'),
  ('category:manage', 'Manage categories'),
  ('tag:manage', 'Manage tags'),
  ('media:upload', 'Upload editorial media'),
  ('ad:manage', 'Manage advertising campaigns'),
  ('analytics:view', 'View editorial analytics'),
  ('user:manage', 'Manage newsroom users and roles'),
  ('system:manage', 'Manage system settings and integrations')
on conflict (name) do nothing;

insert into public.role_permissions (role_name, permission_name) values
  ('reporter', 'article:create'),
  ('reporter', 'article:edit:own'),
  ('reporter', 'article:submit'),
  ('reporter', 'media:upload'),
  ('editor', 'article:create'),
  ('editor', 'article:edit:any'),
  ('editor', 'article:submit'),
  ('editor', 'article:publish'),
  ('editor', 'article:correct'),
  ('editor', 'article:feature'),
  ('editor', 'article:break'),
  ('editor', 'category:manage'),
  ('editor', 'tag:manage'),
  ('editor', 'media:upload'),
  ('editor', 'analytics:view'),
  ('ad_manager', 'media:upload'),
  ('ad_manager', 'ad:manage'),
  ('ad_manager', 'analytics:view')
on conflict do nothing;

insert into public.role_permissions (role_name, permission_name)
select 'administrator', name from public.permissions
on conflict do nothing;

insert into public.categories (slug, name, short_name, display_order) values
  ('local-news', 'Local News', 'Local', 1),
  ('community-people', 'Community & People', 'Community', 2),
  ('business-development', 'Business & Development', 'Business', 3),
  ('politics-public-affairs', 'Politics & Public Affairs', 'Politics', 4),
  ('culture-events', 'Culture & Events', 'Culture', 5),
  ('tourism-heritage', 'Tourism & Heritage', 'Heritage', 6)
on conflict (slug) do nothing;

alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.categories enable row level security;
alter table public.articles enable row level security;
alter table public.article_revisions enable row level security;
alter table public.tags enable row level security;
alter table public.article_tags enable row level security;
alter table public.article_media enable row level security;
alter table public.ad_campaigns enable row level security;
alter table public.article_view_events enable row level security;
alter table public.article_daily_views enable row level security;
alter table public.audit_log enable row level security;

create policy profiles_select_self_or_admin
on public.profiles for select to authenticated
using (id = auth.uid() or public.has_permission('user:manage'));

create policy profiles_update_self_or_admin
on public.profiles for update to authenticated
using (id = auth.uid() or public.has_permission('user:manage'))
with check (id = auth.uid() or public.has_permission('user:manage'));

create policy roles_read_authenticated
on public.roles for select to authenticated
using (true);

create policy permissions_read_authenticated
on public.permissions for select to authenticated
using (true);

create policy role_permissions_read_authenticated
on public.role_permissions for select to authenticated
using (true);

create policy user_roles_select_self_or_admin
on public.user_roles for select to authenticated
using (user_id = auth.uid() or public.has_permission('user:manage'));

create policy user_roles_manage_admin
on public.user_roles for all to authenticated
using (public.has_permission('user:manage'))
with check (public.has_permission('user:manage'));

create policy categories_read_active
on public.categories for select to anon, authenticated
using (active = true);

create policy categories_manage_editor
on public.categories for all to authenticated
using (public.has_permission('category:manage'))
with check (public.has_permission('category:manage'));

create policy articles_read_published
on public.articles for select to anon, authenticated
using (status = 'published' and published_at <= now());

create policy articles_read_owned_or_editor
on public.articles for select to authenticated
using (
  author_id = auth.uid()
  or public.has_permission('article:edit:any')
  or public.has_permission('analytics:view')
);

create policy articles_create_owned
on public.articles for insert to authenticated
with check (
  author_id = auth.uid()
  and public.has_permission('article:create')
);

create policy articles_update_owned_or_editor
on public.articles for update to authenticated
using (
  (author_id = auth.uid() and public.has_permission('article:edit:own'))
  or public.has_permission('article:edit:any')
)
with check (
  (author_id = auth.uid() and public.has_permission('article:edit:own'))
  or public.has_permission('article:edit:any')
);

create policy articles_delete_owned_drafts_or_admin
on public.articles for delete to authenticated
using (
  (author_id = auth.uid() and status = 'draft' and public.has_permission('article:edit:own'))
  or public.has_permission('system:manage')
);

create policy revisions_read_author_or_editor
on public.article_revisions for select to authenticated
using (
  author_id = auth.uid()
  or public.has_permission('article:edit:any')
);

create policy revisions_create_author_or_editor
on public.article_revisions for insert to authenticated
with check (
  (author_id = auth.uid() and public.has_permission('article:edit:own'))
  or public.has_permission('article:edit:any')
);

create policy tags_read_public
on public.tags for select to anon, authenticated
using (true);

create policy tags_manage_editor
on public.tags for all to authenticated
using (public.has_permission('tag:manage'))
with check (public.has_permission('tag:manage'));

create policy article_tags_read_published
on public.article_tags for select to anon, authenticated
using (
  exists (
    select 1 from public.articles a
    where a.id = article_id and a.status = 'published' and a.published_at <= now()
  )
);

create policy article_tags_manage_editor
on public.article_tags for all to authenticated
using (
  exists (
    select 1 from public.articles a
    where a.id = article_id
      and (a.author_id = auth.uid() or public.has_permission('article:edit:any'))
  )
)
with check (
  exists (
    select 1 from public.articles a
    where a.id = article_id
      and (a.author_id = auth.uid() or public.has_permission('article:edit:any'))
  )
);

create policy article_media_read_published
on public.article_media for select to anon, authenticated
using (
  exists (
    select 1 from public.articles a
    where a.id = article_id and a.status = 'published' and a.published_at <= now()
  )
);

create policy article_media_manage_uploader_or_editor
on public.article_media for all to authenticated
using (
  created_by = auth.uid()
  or public.has_permission('article:edit:any')
  or public.has_permission('ad:manage')
)
with check (
  created_by = auth.uid()
  or public.has_permission('article:edit:any')
  or public.has_permission('ad:manage')
);

create policy ads_read_active
on public.ad_campaigns for select to anon, authenticated
using (active = true and starts_at <= now() and ends_at > now());

create policy ads_manage_ad_manager
on public.ad_campaigns for all to authenticated
using (public.has_permission('ad:manage'))
with check (public.has_permission('ad:manage'));

create policy view_events_insert_published
on public.article_view_events for insert to anon, authenticated
with check (
  exists (
    select 1 from public.articles a
    where a.id = article_id and a.status = 'published' and a.published_at <= now()
  )
  and (user_id is null or user_id = auth.uid())
);

create policy daily_views_read_editor
on public.article_daily_views for select to authenticated
using (public.has_permission('analytics:view'));

create policy audit_read_admin
on public.audit_log for select to authenticated
using (public.has_permission('system:manage'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'article-media',
  'article-media',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']::text[]
)
on conflict (id) do nothing;

create policy article_media_public_read
on storage.objects for select to public
using (bucket_id = 'article-media');

create policy article_media_authenticated_upload
on storage.objects for insert to authenticated
with check (
  bucket_id = 'article-media'
  and public.has_permission('media:upload')
);

create policy article_media_authenticated_update
on storage.objects for update to authenticated
using (
  bucket_id = 'article-media'
  and public.has_permission('media:upload')
)
with check (
  bucket_id = 'article-media'
  and public.has_permission('media:upload')
);

create policy article_media_authenticated_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'article-media'
  and (public.has_permission('article:edit:any') or public.has_permission('ad:manage'))
);

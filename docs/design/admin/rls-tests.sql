-- CityMood Newsroom: role and RLS tests for schema.sql
-- Run against a LOCAL or test database only (it creates fake users), e.g.
--   psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f docs/design/admin/rls-tests.sql
-- Every check raises an exception if a rule is broken. All changes are rolled back at the end.

begin;

-- Fake staff (the auth trigger creates inactive reporter profiles)
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@test.local'),
  ('00000000-0000-0000-0000-00000000000e', 'editor@test.local'),
  ('00000000-0000-0000-0000-000000000001', 'reporter1@test.local'),
  ('00000000-0000-0000-0000-000000000002', 'reporter2@test.local'),
  ('00000000-0000-0000-0000-000000000009', 'inactive@test.local');

do $$ begin
  assert (select count(*) from public.profiles where is_active = false and role = 'reporter') = 5,
    'New users must start as inactive reporters';
end $$;

-- What the invite server action does with the service role
update public.profiles set is_active = true, role = 'admin'    where id = '00000000-0000-0000-0000-00000000000a';
update public.profiles set is_active = true, role = 'editor'   where id = '00000000-0000-0000-0000-00000000000e';
update public.profiles set is_active = true                    where id in ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002');

-- Fixtures written by the database owner
insert into public.articles (id, slug, headline, category_id, author_id, status, publish_at) values
  ('10000000-0000-0000-0000-000000000001', 'r2-published', 'R2 published', (select id from public.categories where slug = 'local-news'), '00000000-0000-0000-0000-000000000002', 'published', now() - interval '1 hour'),
  ('10000000-0000-0000-0000-000000000002', 'r2-draft',     'R2 draft',     (select id from public.categories where slug = 'local-news'), '00000000-0000-0000-0000-000000000002', 'draft', null),
  ('10000000-0000-0000-0000-000000000003', 'r2-future',    'R2 scheduled', (select id from public.categories where slug = 'local-news'), '00000000-0000-0000-0000-000000000002', 'scheduled', now() + interval '1 day');

-- ── Readers (anon) ──
set local role anon;
select set_config('request.jwt.claims', '{}', true);
do $$ begin
  assert (select count(*) from public.articles) = 1, 'Anon must only see live stories (no drafts, no future schedules)';
  assert (select count(*) from public.live_articles) = 1, 'live_articles must match the public rule';
end $$;
reset role;

-- ── Reporter 1 ──
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001"}', true);
do $$
declare n int;
begin
  insert into public.articles (id, slug, headline, author_id) values
    ('20000000-0000-0000-0000-000000000001', 'r1-draft', 'R1 draft', '00000000-0000-0000-0000-000000000001');

  begin
    insert into public.articles (slug, author_id) values ('r1-as-r2', '00000000-0000-0000-0000-000000000002');
    raise exception 'FAIL: reporter wrote under another byline';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;

  begin
    insert into public.articles (slug, author_id, featured) values ('r1-featured', '00000000-0000-0000-0000-000000000001', true);
    raise exception 'FAIL: reporter featured a story';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;

  update public.articles set headline = 'hacked' where id = '10000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  assert n = 0, 'Reporter must not edit another reporter''s story';

  -- publish own story as breaking: window is set automatically
  update public.articles set status = 'published', publish_at = now(), breaking = true
    where id = '20000000-0000-0000-0000-000000000001';
  assert (select breaking_until > now() + interval '5 hours' from public.articles where id = '20000000-0000-0000-0000-000000000001'),
    'Breaking must get a 6-hour window';

  begin
    update public.articles set featured = true where id = '20000000-0000-0000-0000-000000000001';
    raise exception 'FAIL: reporter featured own story';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;

  begin
    update public.articles set slug = 'new-slug' where id = '20000000-0000-0000-0000-000000000001';
    raise exception 'FAIL: slug changed after publishing';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;

  delete from public.articles where id = '20000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  assert n = 0, 'Reporter must not delete a published story';

  assert (select count(*) from public.articles) = 4, 'Staff must see all stories, including drafts';

  begin
    insert into public.front_page_pins (slot, article_id) values ('lead', '20000000-0000-0000-0000-000000000001');
    raise exception 'FAIL: reporter pinned the lead';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;

  update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  assert n = 0, 'Reporter must not change roles';
end $$;
reset role;

-- ── Editor ──
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000e"}', true);
do $$
declare n int;
begin
  update public.articles set featured = true, author_id = '00000000-0000-0000-0000-000000000001'
    where id = '10000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  assert n = 1, 'Editor must be able to feature and change bylines on any story';

  insert into public.front_page_pins (slot, article_id) values ('lead', '10000000-0000-0000-0000-000000000001');
  insert into public.most_read_picks (position, article_id) values (1, '10000000-0000-0000-0000-000000000001');

  begin
    insert into public.ad_campaigns (slot, advertiser_name, link_url, alt, starts_at, ends_at)
      values ('mpu_1', 'Test', 'https://example.com', 'Test', now(), now() + interval '1 day');
    raise exception 'FAIL: editor created an ad campaign';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
end $$;
reset role;

-- ── Admin ──
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', true);
do $$
declare n int;
begin
  insert into public.ad_campaigns (slot, advertiser_name, link_url, alt, starts_at, ends_at) values
    ('mpu_1', 'Running', 'https://example.com', 'Running ad', now() - interval '1 day', now() + interval '1 day'),
    ('billboard', 'Future', 'https://example.com', 'Future ad', now() + interval '2 days', now() + interval '9 days');
  update public.site_settings set newsroom_phone = '+234 000 000 0000';
  get diagnostics n = row_count;
  assert n = 1, 'Admin must update site settings';
end $$;
reset role;

-- ── Inactive user ──
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000009"}', true);
do $$ begin
  begin
    insert into public.articles (slug, author_id) values ('inactive', '00000000-0000-0000-0000-000000000009');
    raise exception 'FAIL: inactive user created a story';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  -- live by now: R2's published story and Reporter 1's story published above
  assert (select count(*) from public.articles) = 2, 'Inactive users must only see live stories';
end $$;
reset role;

-- ── Readers see only running ads ──
set local role anon;
select set_config('request.jwt.claims', '{}', true);
do $$ begin
  assert (select count(*) from public.ad_campaigns) = 1, 'Anon must only see running campaigns';
end $$;
reset role;

select 'ALL RLS TESTS PASSED' as result;
rollback;

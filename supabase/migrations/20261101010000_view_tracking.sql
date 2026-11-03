-- Aggregate public article views without exposing raw visitor events.
create or replace function public.record_article_view(p_article_id uuid, p_visitor_hash text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if not exists (
    select 1 from public.articles
    where id = p_article_id and status = 'published' and published_at <= now()
  ) then
    return;
  end if;

  if p_visitor_hash is not null and char_length(p_visitor_hash) between 32 and 128 then
    if exists (
      select 1 from public.article_view_events
      where article_id = p_article_id
        and visitor_hash = p_visitor_hash
        and occurred_at > now() - interval '30 minutes'
    ) then
      return;
    end if;
  end if;

  insert into public.article_view_events (article_id, visitor_hash, user_id)
  values (p_article_id, nullif(left(p_visitor_hash, 128), ''), current_user_id);
end;
$$;

revoke all on function public.record_article_view(uuid, text) from public;
grant execute on function public.record_article_view(uuid, text) to anon, authenticated;

create or replace function public.increment_daily_article_view()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.article_daily_views (article_id, view_date, view_count)
  values (new.article_id, (new.occurred_at at time zone 'Africa/Lagos')::date, 1)
  on conflict (article_id, view_date)
  do update set view_count = article_daily_views.view_count + 1, updated_at = now();
  return new;
end;
$$;

drop trigger if exists article_view_event_daily_count on public.article_view_events;
create trigger article_view_event_daily_count
after insert on public.article_view_events
for each row execute function public.increment_daily_article_view();

create or replace function public.get_most_read_articles(p_days integer default 30, p_limit integer default 4)
returns table (article_id uuid, view_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select d.article_id, sum(d.view_count)::bigint as view_count
  from public.article_daily_views d
  join public.articles a on a.id = d.article_id
  where d.view_date >= ((now() at time zone 'Africa/Lagos')::date - greatest(1, least(p_days, 365)))
    and a.status = 'published'
    and a.published_at <= now()
  group by d.article_id
  order by view_count desc, max(a.published_at) desc
  limit greatest(1, least(p_limit, 20));
$$;

revoke all on function public.get_most_read_articles(integer, integer) from public;
grant execute on function public.get_most_read_articles(integer, integer) to anon, authenticated;

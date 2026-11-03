create or replace function public.publish_due_articles()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  published_count integer;
begin
  update public.articles
  set status = 'published', published_at = scheduled_for, scheduled_for = null, unpublished_at = null, updated_at = now()
  where status = 'scheduled' and scheduled_for is not null and scheduled_for <= now();
  get diagnostics published_count = row_count;
  return published_count;
end;
$$;

revoke all on function public.publish_due_articles() from public;
grant execute on function public.publish_due_articles() to service_role;

alter table public.article_revisions
  add column if not exists tag_ids jsonb not null default '[]'::jsonb;

create or replace function public.update_article_with_tags(
  p_article_id uuid,
  p_title text,
  p_slug text,
  p_standfirst text,
  p_body text,
  p_category_id uuid,
  p_tag_ids uuid[] default '{}'
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_article public.articles%rowtype;
  next_revision integer;
  current_tags jsonb;
begin
  select * into current_article from public.articles where id = p_article_id;
  if current_article.id is null then raise exception 'article_not_found'; end if;
  if not (current_article.author_id = auth.uid() and public.has_permission('article:edit:own'))
     and not public.has_permission('article:edit:any') then
    raise exception 'article_edit_forbidden';
  end if;
  if char_length(trim(p_title)) not between 1 and 300
     or p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
     or char_length(trim(p_body)) = 0 then
    raise exception 'article_invalid_input';
  end if;

  select coalesce(jsonb_agg(at.tag_id), '[]'::jsonb) into current_tags
  from public.article_tags at where at.article_id = p_article_id;
  select coalesce(max(revision_number), 0) + 1 into next_revision
  from public.article_revisions where article_id = p_article_id;

  insert into public.article_revisions (
    article_id, revision_number, title, standfirst, body, author_id,
    category_id, editor_id, tag_ids, change_summary
  ) values (
    p_article_id, next_revision, current_article.title, current_article.standfirst,
    current_article.body, current_article.author_id, current_article.category_id,
    auth.uid(), current_tags, 'Snapshot before article update'
  );

  update public.articles set
    title = trim(p_title), slug = trim(p_slug), standfirst = coalesce(p_standfirst, ''),
    body = trim(p_body), category_id = p_category_id
  where id = p_article_id;

  delete from public.article_tags where article_id = p_article_id;
  insert into public.article_tags (article_id, tag_id)
  select p_article_id, tag_id from unnest(coalesce(p_tag_ids, '{}')) as tag_id;
end;
$$;

create or replace function public.restore_article_revision(p_revision_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  target public.article_revisions%rowtype;
  current_article public.articles%rowtype;
  current_tags jsonb;
  next_revision integer;
begin
  select * into target from public.article_revisions where id = p_revision_id;
  if target.id is null then raise exception 'revision_not_found'; end if;
  select * into current_article from public.articles where id = target.article_id;
  if current_article.id is null then raise exception 'article_not_found'; end if;
  if not (current_article.author_id = auth.uid() and public.has_permission('article:edit:own'))
     and not public.has_permission('article:edit:any') then
    raise exception 'article_restore_forbidden';
  end if;

  select coalesce(jsonb_agg(at.tag_id), '[]'::jsonb) into current_tags
  from public.article_tags at where at.article_id = target.article_id;
  select coalesce(max(revision_number), 0) + 1 into next_revision
  from public.article_revisions where article_id = target.article_id;
  insert into public.article_revisions (
    article_id, revision_number, title, standfirst, body, author_id,
    category_id, editor_id, tag_ids, change_summary
  ) values (
    target.article_id, next_revision, current_article.title, current_article.standfirst,
    current_article.body, current_article.author_id, current_article.category_id,
    auth.uid(), current_tags, 'Snapshot before revision restore'
  );

  update public.articles set
    title = target.title, standfirst = target.standfirst, body = target.body,
    category_id = target.category_id
  where id = target.article_id;
  delete from public.article_tags where article_id = target.article_id;
  insert into public.article_tags (article_id, tag_id)
  select target.article_id, value::uuid from jsonb_array_elements_text(target.tag_ids);
end;
$$;

revoke all on function public.update_article_with_tags(uuid, text, text, text, text, uuid, uuid[]) from public;
revoke all on function public.restore_article_revision(uuid) from public;
grant execute on function public.update_article_with_tags(uuid, text, text, text, text, uuid, uuid[]) to authenticated;
grant execute on function public.restore_article_revision(uuid) to authenticated;

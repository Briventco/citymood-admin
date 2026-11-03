create policy audit_insert_user_manager
on public.audit_log for insert to authenticated
with check (public.has_permission('user:manage') or public.has_permission('system:manage'));

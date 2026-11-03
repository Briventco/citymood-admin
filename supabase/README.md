# CityMood Supabase workflow

The repository is linked to the CityMood development project. Apply reviewed
database changes with:

```powershell
npx supabase db push --linked
```

## Bootstrap the first administrator

Create the first newsroom user through Supabase Auth, then run this in the
Supabase SQL Editor with the user's real email address. Do not put a password in
SQL or source control.

```sql
update public.profiles
set status = 'active', updated_at = now()
where id = (select id from auth.users where email = 'ADMIN_EMAIL');

insert into public.user_roles (user_id, role_name)
select id, 'administrator'
from auth.users
where email = 'ADMIN_EMAIL'
on conflict (user_id, role_name) do nothing;
```

Replace `ADMIN_EMAIL` in both places before running it. This is a one-time
bootstrap step; future user and role management belongs in the protected admin
workflow.

Never expose or commit Supabase secret/service-role keys. The browser uses only
the publishable key with Row Level Security enabled.

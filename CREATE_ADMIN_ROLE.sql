-- ============================================================
-- AFTER you create the admin user in Supabase Authentication:
-- 1. Replace the email below.
-- 2. Run this in Supabase SQL Editor.
-- ============================================================

insert into public.user_roles (user_id, role)
select id, 'admin'
from auth.users
where lower(email) = lower('sabareeshkarikalan2008@gmail.com@example.com')
on conflict (user_id)
do update set role = excluded.role;

select
  u.email,
  r.role
from public.user_roles r
join auth.users u on u.id = r.user_id
where r.role = 'admin';

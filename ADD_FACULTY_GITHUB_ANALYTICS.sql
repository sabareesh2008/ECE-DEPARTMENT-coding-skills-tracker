-- CodeMetrix V8.2 - Faculty GitHub analytics support
-- Run in the CODING TRACKER Supabase project.

alter table if exists public.faculties
  add column if not exists github_username text;

create index if not exists faculties_github_username_idx
on public.faculties (lower(btrim(github_username)))
where github_username is not null and btrim(github_username) <> '';

select 'FACULTY GITHUB ANALYTICS READY' as status;

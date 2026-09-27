-- CodeMetrix V8.2 - Shared task publishing
-- Run this in the TECHNICAL ASSESSMENT / TASK PORTAL Supabase project.
-- The student portal reads only the active task. The faculty portal publishes it.

create table if not exists public.tasks (
  id text primary key,
  title text not null,
  description text not null,
  deadline timestamptz,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tasks enable row level security;

drop policy if exists "Public can read active tasks" on public.tasks;
create policy "Public can read active tasks"
on public.tasks for select
to anon, authenticated
using (is_active = true);

-- This project currently uses the existing CodeMetrix faculty/admin gate with the
-- Supabase anon key. These policies permit the authenticated front-end command
-- center to publish task configuration without changing the existing architecture.
drop policy if exists "Portal can publish tasks" on public.tasks;
create policy "Portal can publish tasks"
on public.tasks for insert
to anon, authenticated
with check (true);

drop policy if exists "Portal can update tasks" on public.tasks;
create policy "Portal can update tasks"
on public.tasks for update
to anon, authenticated
using (true)
with check (true);

create index if not exists tasks_active_created_idx
on public.tasks (is_active, created_at desc);

select 'TASK PUBLISHING READY' as status;

-- Campus360 additive schema for the existing CodeMetrix portal Supabase project.
-- This file only creates campus360_* tables; it does not alter or drop existing CodeMetrix tables.
-- IMPORTANT: inspect your existing policies before running. This starter deliberately denies browser access
-- until institution-specific RLS policies are added and tested. Do not put service-role keys in frontend code.

create table if not exists public.campus360_student_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  reg_no text unique,
  full_name text not null,
  department text,
  academic_year smallint,
  section text,
  status text not null default 'pending' check (status in ('pending','active','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campus360_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  created_by uuid references auth.users(id),
  target_department text,
  target_year smallint,
  target_section text,
  due_at timestamptz,
  status text not null default 'draft' check (status in ('draft','scheduled','published','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campus360_task_submissions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.campus360_tasks(id) on delete cascade,
  student_user_id uuid not null references auth.users(id) on delete cascade,
  note text,
  evidence_path text,
  status text not null default 'submitted' check (status in ('submitted','approved','rejected','resubmission_required')),
  reviewer_user_id uuid references auth.users(id),
  reviewer_feedback text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique(task_id,student_user_id)
);

create table if not exists public.campus360_assessments (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  assessment_type text not null default 'technical' check (assessment_type in ('exam','technical','practice','mock')),
  created_by uuid not null references auth.users(id),
  target_department text,
  target_year smallint,
  target_section text,
  starts_at timestamptz,
  ends_at timestamptz,
  duration_minutes integer not null default 30 check (duration_minutes between 1 and 600),
  total_marks numeric(8,2) not null default 0 check (total_marks >= 0),
  attempts_allowed integer not null default 1 check (attempts_allowed between 1 and 20),
  status text not null default 'draft' check (status in ('draft','scheduled','published','closed','results_published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campus360_assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.campus360_assessments(id) on delete cascade,
  student_user_id uuid not null references auth.users(id) on delete cascade,
  attempt_number integer not null default 1 check (attempt_number > 0),
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  score numeric(8,2),
  status text not null default 'in_progress' check (status in ('in_progress','submitted','evaluated')),
  unique(assessment_id,student_user_id,attempt_number)
);

create table if not exists public.campus360_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null default '',
  link_path text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.campus360_audit_events (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id),
  event_type text not null,
  entity_type text,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- RLS enabled with no permissive policies: access remains closed until reviewed policies are added.
alter table public.campus360_student_profiles enable row level security;
alter table public.campus360_tasks enable row level security;
alter table public.campus360_task_submissions enable row level security;
alter table public.campus360_assessments enable row level security;
alter table public.campus360_assessment_attempts enable row level security;
alter table public.campus360_notifications enable row level security;
alter table public.campus360_audit_events enable row level security;

revoke all on public.campus360_student_profiles from anon, authenticated;
revoke all on public.campus360_tasks from anon, authenticated;
revoke all on public.campus360_task_submissions from anon, authenticated;
revoke all on public.campus360_assessments from anon, authenticated;
revoke all on public.campus360_assessment_attempts from anon, authenticated;
revoke all on public.campus360_notifications from anon, authenticated;
revoke all on public.campus360_audit_events from anon, authenticated;

-- Intentionally no GRANT/policies yet. Add and test least-privilege grants and RLS policies for your exact
-- faculty assignments and student roster model before enabling these tables in the UI.

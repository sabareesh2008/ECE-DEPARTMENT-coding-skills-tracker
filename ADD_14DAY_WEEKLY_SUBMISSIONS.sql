-- Run this ONCE in your EXISTING Supabase project.

alter table if exists public.faculties
  add column if not exists last_14_days integer not null default 0,
  add column if not exists last_7_days_submissions integer not null default 0;

alter table if exists public.faculty_activity_history
  add column if not exists last_14_days integer not null default 0,
  add column if not exists last_7_days_submissions integer not null default 0;

alter table if exists public.student_performance_current
  add column if not exists last_14_days integer not null default 0,
  add column if not exists last_7_days_submissions integer not null default 0;

alter table if exists public.student_performance_history
  add column if not exists last_14_days integer not null default 0,
  add column if not exists last_7_days_submissions integer not null default 0;

select '14-DAY SOLVED + 7-DAY SUBMISSIONS READY' as status;

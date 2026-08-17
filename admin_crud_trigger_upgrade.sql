-- ============================================================
-- OPTIONAL: STUDENT CRUD -> EDGE FUNCTION AUTO SYNC
-- ============================================================
-- The normal 5-minute GitHub Actions tracker already syncs automatically.
-- Use this OPTIONAL trigger only after deploying the "super-action"
-- Supabase Edge Function and configuring its security.
--
-- IMPORTANT:
-- Replace YOUR_PROJECT_REF below before running.
-- ============================================================

create extension if not exists pg_net;

create or replace function public.trigger_leetcode_update()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, net
as $$
declare
  payload jsonb;
begin
  payload := jsonb_build_object(
    'event', TG_OP,
    'register_number',
      case when TG_OP = 'DELETE'
        then OLD.register_number else NEW.register_number end
  );

  perform net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/super-action',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := payload
  );

  if TG_OP = 'DELETE' then
    return OLD;
  end if;

  return NEW;
end;
$$;

drop trigger if exists student_profile_sync_trigger
on public.students;

create trigger student_profile_sync_trigger
after insert or update or delete
on public.students
for each row
execute function public.trigger_leetcode_update();

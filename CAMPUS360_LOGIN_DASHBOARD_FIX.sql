-- Campus360 login + individual student dashboard repair
-- Run in the same Supabase project as config.js (APP_CONFIG.SUPABASE_URL).
-- Back up first. This is additive and does not modify CodeMetrix legacy tables.

-- 1) Fields required for each student's own profile
ALTER TABLE public.campus360_student_profiles ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE public.campus360_student_profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.campus360_student_profiles ADD COLUMN IF NOT EXISTS personal_email text;
ALTER TABLE public.campus360_student_profiles ADD COLUMN IF NOT EXISTS department text;
ALTER TABLE public.campus360_student_profiles ADD COLUMN IF NOT EXISTS year text;
ALTER TABLE public.campus360_student_profiles ADD COLUMN IF NOT EXISTS github_username text;
ALTER TABLE public.campus360_student_profiles ADD COLUMN IF NOT EXISTS leetcode_username text;
ALTER TABLE public.campus360_student_profiles ADD COLUMN IF NOT EXISTS profile_photo_path text;
ALTER TABLE public.campus360_student_profiles ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
ALTER TABLE public.campus360_student_profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS campus360_student_profiles_username_unique
  ON public.campus360_student_profiles(lower(username)) WHERE username IS NOT NULL;

-- 2) Private profile RPC: only returns the currently authenticated user's row
CREATE OR REPLACE FUNCTION public.campus360_get_my_student_profile()
RETURNS TABLE(
  auth_user_id uuid, reg_no text, full_name text, college_email text, phone text,
  personal_email text, department text, year text, section text,
  github_username text, leetcode_username text, profile_photo_path text, status text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,auth
AS $$
  SELECT p.auth_user_id,p.reg_no,p.full_name,p.college_email,p.phone,p.personal_email,
         p.department,p.year::text,p.section,p.github_username,p.leetcode_username,p.profile_photo_path,p.status
  FROM public.campus360_student_profiles p
  WHERE p.auth_user_id=auth.uid()
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.campus360_get_my_student_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.campus360_get_my_student_profile() TO authenticated;

-- 3) Own-profile edits. This deliberately never updates the shared roster.
CREATE OR REPLACE FUNCTION public.campus360_update_my_student_profile(
  p_full_name text, p_phone text, p_personal_email text, p_year text,
  p_department text, p_section text, p_github_username text, p_leetcode_username text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required.'; END IF;
  IF NULLIF(trim(p_full_name),'') IS NULL THEN RAISE EXCEPTION 'Full name is required.'; END IF;
  IF coalesce(trim(p_year),'') NOT IN ('1','2','3','4') THEN RAISE EXCEPTION 'Select a valid year.'; END IF;
  IF upper(coalesce(trim(p_section),'')) NOT IN ('A','B','C','D','E','F','G','H','I') THEN RAISE EXCEPTION 'Select a valid section.'; END IF;
  UPDATE public.campus360_student_profiles
  SET full_name=trim(p_full_name),phone=NULLIF(trim(p_phone),''),
      personal_email=lower(NULLIF(trim(p_personal_email),'')),
      year=trim(p_year),department=upper(trim(p_department)),section=upper(trim(p_section)),
      github_username=NULLIF(trim(p_github_username),''),leetcode_username=NULLIF(trim(p_leetcode_username),''),
      updated_at=now()
  WHERE auth_user_id=auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Student profile not found for this account.'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.campus360_update_my_student_profile(text,text,text,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.campus360_update_my_student_profile(text,text,text,text,text,text,text,text) TO authenticated;

-- 4) Private personal to-do list. Each student can only see/change their own records.
CREATE TABLE IF NOT EXISTS public.campus360_student_todos(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 180),
  is_done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.campus360_student_todos ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campus360_student_todos TO authenticated;
DROP POLICY IF EXISTS campus360_todos_select_own ON public.campus360_student_todos;
CREATE POLICY campus360_todos_select_own ON public.campus360_student_todos FOR SELECT TO authenticated USING(student_user_id=auth.uid());
DROP POLICY IF EXISTS campus360_todos_insert_own ON public.campus360_student_todos;
CREATE POLICY campus360_todos_insert_own ON public.campus360_student_todos FOR INSERT TO authenticated WITH CHECK(student_user_id=auth.uid());
DROP POLICY IF EXISTS campus360_todos_update_own ON public.campus360_student_todos;
CREATE POLICY campus360_todos_update_own ON public.campus360_student_todos FOR UPDATE TO authenticated USING(student_user_id=auth.uid()) WITH CHECK(student_user_id=auth.uid());
DROP POLICY IF EXISTS campus360_todos_delete_own ON public.campus360_student_todos;
CREATE POLICY campus360_todos_delete_own ON public.campus360_student_todos FOR DELETE TO authenticated USING(student_user_id=auth.uid());

-- 5) Login by username/registration number uses the Edge Function included in
-- supabase/functions/campus360-login-identifier/index.ts. Deploy it to THIS project.
-- Never put SUPABASE_SERVICE_ROLE_KEY in browser config.js.

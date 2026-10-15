-- Campus360 student profile + private profile picture / achievement uploads
-- Run in Supabase SQL Editor for the project configured in config.js.
-- Additive migration: does not replace the preloaded roster or other application tables.

ALTER TABLE public.campus360_student_profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.campus360_student_profiles ADD COLUMN IF NOT EXISTS personal_email text;
ALTER TABLE public.campus360_student_profiles ADD COLUMN IF NOT EXISTS department text;
ALTER TABLE public.campus360_student_profiles ADD COLUMN IF NOT EXISTS year text;
ALTER TABLE public.campus360_student_profiles ADD COLUMN IF NOT EXISTS github_username text;
ALTER TABLE public.campus360_student_profiles ADD COLUMN IF NOT EXISTS linkedin_url text;
ALTER TABLE public.campus360_student_profiles ADD COLUMN IF NOT EXISTS profile_photo_path text;
ALTER TABLE public.campus360_student_profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.campus360_student_roster ADD COLUMN IF NOT EXISTS department text;
ALTER TABLE public.campus360_student_roster ADD COLUMN IF NOT EXISTS year text;

-- Get only the currently authenticated student's profile, joined to the preloaded roster.
CREATE OR REPLACE FUNCTION public.campus360_get_my_student_profile_v2()
RETURNS TABLE(auth_user_id uuid, reg_no text, full_name text, college_email text, phone text,
 personal_email text, department text, year text, section text, github_username text,
 leetcode_username text, linkedin_url text, profile_photo_path text, status text, updated_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,auth
AS $$
 SELECT p.auth_user_id,p.reg_no,p.full_name,p.college_email,p.phone,p.personal_email,
        COALESCE(p.department,r.department),COALESCE(p.year,r.year)::text,p.section,
        p.github_username,p.leetcode_username,p.linkedin_url,p.profile_photo_path,p.status,p.updated_at
 FROM public.campus360_student_profiles p
 LEFT JOIN public.campus360_student_roster r ON r.reg_no=p.reg_no
 WHERE p.auth_user_id=auth.uid() LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.campus360_get_my_student_profile_v2() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.campus360_get_my_student_profile_v2() TO authenticated;

-- Profile fields update only the signed-in student's profile row. Reg number and college email stay preloaded/read-only.
CREATE OR REPLACE FUNCTION public.campus360_update_my_student_profile_v2(
 p_full_name text,p_phone text,p_personal_email text,p_year text,p_department text,p_section text,
 p_github_username text,p_leetcode_username text,p_linkedin_url text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth
AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required.'; END IF;
 IF NULLIF(trim(p_full_name),'') IS NULL THEN RAISE EXCEPTION 'Full name is required.'; END IF;
 IF NULLIF(trim(p_year),'') IS NOT NULL AND trim(p_year) NOT IN ('1','2','3','4') THEN RAISE EXCEPTION 'Year must be 1, 2, 3 or 4.'; END IF;
 IF length(coalesce(trim(p_phone),''))>30 THEN RAISE EXCEPTION 'Phone number is too long.'; END IF;
 IF NULLIF(trim(p_linkedin_url),'') IS NOT NULL AND trim(p_linkedin_url) !~* '^https?://' THEN RAISE EXCEPTION 'LinkedIn URL must start with http:// or https://.'; END IF;
 IF NULLIF(trim(p_github_username),'') IS NOT NULL AND trim(p_github_username) !~* '^https?://' THEN RAISE EXCEPTION 'GitHub must be a profile URL.'; END IF;
 UPDATE public.campus360_student_profiles p SET
   full_name=trim(p_full_name),phone=NULLIF(trim(p_phone),''),
   personal_email=lower(NULLIF(trim(p_personal_email),'')),
   year=NULLIF(trim(p_year),''),department=NULLIF(upper(trim(p_department)),''),
   section=NULLIF(upper(trim(p_section)),''),github_username=NULLIF(trim(p_github_username),''),
   leetcode_username=NULLIF(trim(p_leetcode_username),''),linkedin_url=NULLIF(trim(p_linkedin_url),''),updated_at=now()
 WHERE p.auth_user_id=auth.uid();
 IF NOT FOUND THEN RAISE EXCEPTION 'No student profile is linked to this signed-in account.'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.campus360_update_my_student_profile_v2(text,text,text,text,text,text,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.campus360_update_my_student_profile_v2(text,text,text,text,text,text,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.campus360_update_my_profile_photo(p_profile_photo_path text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth
AS $$
DECLARE v_uid text:=auth.uid()::text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required.'; END IF;
 IF p_profile_photo_path IS NULL OR split_part(p_profile_photo_path,'/',1)<>v_uid OR split_part(p_profile_photo_path,'/',2)<>'profile' THEN
   RAISE EXCEPTION 'Invalid profile image path.';
 END IF;
 UPDATE public.campus360_student_profiles SET profile_photo_path=p_profile_photo_path,updated_at=now() WHERE auth_user_id=auth.uid();
 IF NOT FOUND THEN RAISE EXCEPTION 'Student profile not found.'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.campus360_update_my_profile_photo(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.campus360_update_my_profile_photo(text) TO authenticated;

CREATE TABLE IF NOT EXISTS public.campus360_student_achievements(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 student_user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
 title text NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 120),
 description text CHECK(description IS NULL OR length(description)<=1000),
 file_path text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.campus360_student_achievements ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,DELETE ON public.campus360_student_achievements TO authenticated;
DROP POLICY IF EXISTS campus360_achievements_select_own ON public.campus360_student_achievements;
CREATE POLICY campus360_achievements_select_own ON public.campus360_student_achievements FOR SELECT TO authenticated USING(student_user_id=auth.uid());
DROP POLICY IF EXISTS campus360_achievements_insert_own ON public.campus360_student_achievements;
CREATE POLICY campus360_achievements_insert_own ON public.campus360_student_achievements FOR INSERT TO authenticated WITH CHECK(student_user_id=auth.uid() AND split_part(file_path,'/',1)=auth.uid()::text AND split_part(file_path,'/',2)='achievements');
DROP POLICY IF EXISTS campus360_achievements_delete_own ON public.campus360_student_achievements;
CREATE POLICY campus360_achievements_delete_own ON public.campus360_student_achievements FOR DELETE TO authenticated USING(student_user_id=auth.uid());

-- Private bucket: signed URLs are created by the logged-in client; never make student media public.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('campus360-student-media','campus360-student-media',false,5242880,ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=5242880,allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp'];
DROP POLICY IF EXISTS campus360_student_media_read_own ON storage.objects;
CREATE POLICY campus360_student_media_read_own ON storage.objects FOR SELECT TO authenticated USING(bucket_id='campus360-student-media' AND (storage.foldername(name))[1]=auth.uid()::text);
DROP POLICY IF EXISTS campus360_student_media_upload_own ON storage.objects;
CREATE POLICY campus360_student_media_upload_own ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='campus360-student-media' AND (storage.foldername(name))[1]=auth.uid()::text);
DROP POLICY IF EXISTS campus360_student_media_delete_own ON storage.objects;
CREATE POLICY campus360_student_media_delete_own ON storage.objects FOR DELETE TO authenticated USING(bucket_id='campus360-student-media' AND (storage.foldername(name))[1]=auth.uid()::text);

-- NOTE: Existing registration-number-only login is a UI prototype and does not create an authenticated session.
-- This profile feature works after secure student authentication is enabled and each roster row is mapped to auth.users.

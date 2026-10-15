-- Campus360 profile/auth upgrade. Review and run in the Supabase project configured by APP_CONFIG.SUPABASE_URL.
-- Back up first. This migration is additive; it does not replace CodeMetrix tables.

alter table public.campus360_student_roster add column if not exists department text;
alter table public.campus360_student_roster add column if not exists year text;
alter table public.campus360_student_roster add column if not exists github_username text;
update public.campus360_student_roster set department = nullif(split_part(section, ' ', 1), '') where department is null and section is not null;

alter table public.campus360_student_profiles add column if not exists username text;
alter table public.campus360_student_profiles add column if not exists phone text;
alter table public.campus360_student_profiles add column if not exists personal_email text;
alter table public.campus360_student_profiles add column if not exists department text;
alter table public.campus360_student_profiles add column if not exists year text;
alter table public.campus360_student_profiles add column if not exists github_username text;
alter table public.campus360_student_profiles add column if not exists profile_photo_path text;
alter table public.campus360_student_profiles add column if not exists updated_at timestamptz not null default now();
create unique index if not exists campus360_student_profiles_username_unique on public.campus360_student_profiles(lower(username)) where username is not null;

create or replace function public.campus360_username_available(p_username text)
returns boolean language sql security definer set search_path=public
as $$
  select not exists (select 1 from public.campus360_student_profiles p where lower(p.username)=lower(trim(p_username)))
     and trim(coalesce(p_username,'')) ~ '^[A-Za-z0-9._-]{4,24}$';
$$;
revoke all on function public.campus360_username_available(text) from public;
grant execute on function public.campus360_username_available(text) to anon, authenticated;

-- Single-form signup lookup: joins imported GitHub usernames by normalized registration number.
drop function if exists public.campus360_lookup_student(text);
create function public.campus360_lookup_student(p_reg_no text)
returns table(reg_no text, full_name text, section text, leetcode_username text, claimed boolean, department text, year text, github_username text)
language sql security definer set search_path=public
as $$
  select r.reg_no::text, r.full_name::text, r.section::text, r.leetcode_username::text,
         (r.claimed_by is not null),
         coalesce(nullif(trim(r.department),''), nullif(split_part(r.section,' ',1),''))::text,
         r.year::text,
         coalesce(nullif(trim(r.github_username),''), nullif(trim(g.github_username),''))::text
  from public.campus360_student_roster r
  left join public.github_username_import g on trim(g.register_number)=trim(r.reg_no)
  where trim(r.reg_no)=trim(p_reg_no)
  limit 1;
$$;
revoke all on function public.campus360_lookup_student(text) from public;
grant execute on function public.campus360_lookup_student(text) to anon, authenticated;

-- Update the existing auth trigger function so it stores the extended signup metadata.
create or replace function public.campus360_handle_new_student()
returns trigger language plpgsql security definer set search_path=public, auth
as $$
declare
  v_reg text; v_email text; v_name text; v_section text; v_lc text; v_claimed uuid; v_approved_email text;
  v_department text; v_year text; v_github text; v_username text; v_phone text; v_personal_email text;
begin
  v_reg:=trim(coalesce(new.raw_user_meta_data->>'campus360_reg_no',''));
  if v_reg='' or coalesce(new.raw_user_meta_data->>'signup_kind','')<>'student' then return new; end if;
  v_email:=lower(coalesce(new.email,''));
  v_username:=lower(trim(coalesce(new.raw_user_meta_data->>'username','')));
  if v_username !~ '^[a-z0-9._-]{4,24}$' then raise exception 'Username must be 4-24 characters and use letters, numbers, dots, underscores or hyphens.'; end if;
  if exists(select 1 from public.campus360_student_profiles where lower(username)=v_username) then raise exception 'Username already exists. Choose another username.'; end if;
  select full_name,section,leetcode_username,claimed_by,approved_email,department,year,github_username
    into v_name,v_section,v_lc,v_claimed,v_approved_email,v_department,v_year,v_github
    from public.campus360_student_roster where reg_no=v_reg for update;
  if not found then raise exception 'Registration number is not present in the approved student roster.'; end if;
  if v_claimed is not null then raise exception 'This registration number is already claimed. Contact the administrator.'; end if;
  if v_approved_email is not null and lower(v_approved_email)<>v_email then raise exception 'Use the college email address approved by your college.'; end if;
  update public.campus360_student_roster set claimed_by=new.id where reg_no=v_reg and claimed_by is null;
  if not found then raise exception 'This registration number was just claimed by another account.'; end if;
  insert into public.campus360_user_roles(user_id,role) values(new.id,'student') on conflict(user_id) do nothing;
  insert into public.campus360_student_profiles(auth_user_id,reg_no,full_name,college_email,section,leetcode_username,username,phone,personal_email,department,year,github_username)
  values(new.id,v_reg,v_name,v_email,v_section,v_lc,v_username,
    nullif(trim(new.raw_user_meta_data->>'phone'),''),lower(nullif(trim(new.raw_user_meta_data->>'personal_email'),'')),
    coalesce(v_department,nullif(new.raw_user_meta_data->>'department','')),coalesce(v_year,nullif(new.raw_user_meta_data->>'year','')),coalesce(v_github,nullif(new.raw_user_meta_data->>'github_username','')));
  return new;
end; $$;

-- Username/email/registration-number sign-in is resolved by the Edge Function, not by exposing a public email lookup RPC.
-- Create a private profile-photo bucket. Upload policies restrict each user to their own folder.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('campus360-profile-photos','campus360-profile-photos',false,3145728,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=3145728,allowed_mime_types=array['image/jpeg','image/png','image/webp'];

drop policy if exists campus360_photo_upload_own on storage.objects;
create policy campus360_photo_upload_own on storage.objects for insert to authenticated
with check (bucket_id='campus360-profile-photos' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists campus360_photo_read_own on storage.objects;
create policy campus360_photo_read_own on storage.objects for select to authenticated
using (bucket_id='campus360-profile-photos' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists campus360_photo_update_own on storage.objects;
create policy campus360_photo_update_own on storage.objects for update to authenticated
using (bucket_id='campus360-profile-photos' and (storage.foldername(name))[1]=auth.uid()::text)
with check (bucket_id='campus360-profile-photos' and (storage.foldername(name))[1]=auth.uid()::text);

-- IMPORTANT: login Edge Function needs SUPABASE_SERVICE_ROLE_KEY and SUPABASE_ANON_KEY as server-side secrets.
-- Never place the service-role key in config.js or any browser JavaScript.


create or replace function public.campus360_set_own_profile_photo(p_path text)
returns void language plpgsql security definer set search_path=public,auth
as $$
begin
  if auth.uid() is null or split_part(coalesce(p_path,''),'/',1) <> auth.uid()::text then
    raise exception 'You can only set your own profile photo.';
  end if;
  update public.campus360_student_profiles set profile_photo_path=p_path, updated_at=now() where auth_user_id=auth.uid();
  if not found then raise exception 'Student profile was not found.'; end if;
end; $$;
revoke all on function public.campus360_set_own_profile_photo(text) from public;
grant execute on function public.campus360_set_own_profile_photo(text) to authenticated;

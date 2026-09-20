-- =====================================================================
-- ONE-CLICK SQL: Convert all Student Names to UPPERCASE in Supabase
-- Run in Supabase SQL Editor
-- =====================================================================

-- 1. Convert names in students table to uppercase
UPDATE public.students 
SET student_name = UPPER(TRIM(student_name)),
    updated_at = NOW()
WHERE student_name IS NOT NULL;

-- 2. Convert names in extension_installed_students to uppercase
UPDATE public.extension_installed_students 
SET student_name = UPPER(TRIM(student_name))
WHERE student_name IS NOT NULL;

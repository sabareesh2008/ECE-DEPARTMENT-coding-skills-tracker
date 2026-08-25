-- ============================================================
-- CodeMetrix history repair
-- Run ONCE in Supabase SQL Editor.
--
-- Keeps ONE row per:
--   register_number + snapshot_date
--
-- Different dates for the same student are intentionally retained.
-- ============================================================

-- 1) Backup before cleanup.
create table if not exists
public.student_performance_history_backup_20260825
as
select *
from public.student_performance_history;

-- 2) Remove true same-student + same-day duplicates.
with ranked as (
    select
        id,
        row_number() over (
            partition by
                register_number,
                snapshot_date
            order by
                updated_at desc nulls last,
                id desc
        ) as rn
    from public.student_performance_history
)
delete from public.student_performance_history
where id in (
    select id
    from ranked
    where rn > 1
);

-- 3) Permanently enforce one daily snapshot per student.
create unique index if not exists
student_performance_history_register_date_unique
on public.student_performance_history (
    register_number,
    snapshot_date
);

-- 4) Verify. This query must return zero rows.
select
    register_number,
    snapshot_date,
    count(*) as copies
from public.student_performance_history
group by
    register_number,
    snapshot_date
having count(*) > 1
order by
    snapshot_date desc,
    register_number;

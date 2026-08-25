-- CodeMetrix Exact Tracker V2
-- Run ONCE in Supabase SQL Editor.

-- Remove only TRUE duplicates:
-- same register number + same snapshot date.
with ranked as (
    select
        id,
        row_number() over (
            partition by register_number, snapshot_date
            order by updated_at desc nulls last, id desc
        ) as rn
    from public.student_performance_history
)
delete from public.student_performance_history
where id in (
    select id
    from ranked
    where rn > 1
);

-- PostgREST upsert needs a unique constraint/index.
create unique index if not exists
student_performance_history_register_snapshot_unique
on public.student_performance_history (
    register_number,
    snapshot_date
);

-- Must return zero rows.
select
    register_number,
    snapshot_date,
    count(*) as copies
from public.student_performance_history
group by register_number, snapshot_date
having count(*) > 1;

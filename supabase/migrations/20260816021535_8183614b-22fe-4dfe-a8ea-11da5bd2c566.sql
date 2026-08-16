
create type public.eventuality_type as enum ('boolean', 'numeric', 'status', 'custom');

create table public.eventualities (
    id uuid primary key default gen_random_uuid(),
    school_id uuid references public.schools(id) on delete cascade not null,
    class_id uuid references public.classes(id) on delete cascade not null,
    teacher_id uuid references auth.users(id) on delete cascade not null,
    title text not null,
    description text,
    event_type public.eventuality_type not null default 'boolean',
    deadline date,
    status text not null default 'open',
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

create table public.eventuality_records (
    id uuid primary key default gen_random_uuid(),
    eventuality_id uuid references public.eventualities(id) on delete cascade not null,
    student_id uuid references public.students(id) on delete cascade not null,
    value jsonb not null,
    marked_at timestamp with time zone default now(),
    unique (eventuality_id, student_id)
);

grant select, insert, update, delete on public.eventualities to authenticated;
grant all on public.eventualities to service_role;
grant select, insert, update, delete on public.eventuality_records to authenticated;
grant all on public.eventuality_records to service_role;

alter table public.eventualities enable row level security;
alter table public.eventuality_records enable row level security;

create policy "Admins and teachers can manage eventualities" on public.eventualities for all to authenticated using (true);
create policy "Admins and teachers can manage eventuality_records" on public.eventuality_records for all to authenticated using (true);

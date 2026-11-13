-- 89-Day Tracker schema. Run in Supabase: SQL Editor > New query > Run.

create table if not exists days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  day int not null check (day between 1 and 89),
  phase int,
  date date,
  ai_task text, job_task text, startup_task text,
  status text not null default 'Not Started',
  planned_hours numeric default 0,
  actual_hours numeric,
  notes text, next_action text,
  created_at timestamptz default now(),
  unique (user_id, day)
);

create table if not exists job_hunt (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  type text default 'Application',
  company text, role text, status text default 'Planned',
  date date, link text, notes text,
  created_at timestamptz default now()
);

create table if not exists ai_learning (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  kind text default 'Topic',
  topic text, resource text, status text default 'Not Started', notes text,
  created_at timestamptz default now()
);

create table if not exists startup (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  kind text default 'Problem',
  item text, status text default 'Open', date date, notes text,
  created_at timestamptz default now()
);

create table if not exists mondee_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  date date, learning text, concept text, achievement text,
  created_at timestamptz default now()
);

create table if not exists weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  week int not null check (week between 1 and 13),
  completed text, blockers text, next_priorities text,
  created_at timestamptz default now(),
  unique (user_id, week)
);

-- Migration for variable-length challenges (14-365 days). Safe to re-run.
alter table days drop constraint if exists days_day_check;
alter table days add constraint days_day_check check (day between 1 and 400);
alter table weekly_reviews drop constraint if exists weekly_reviews_week_check;
alter table weekly_reviews add constraint weekly_reviews_week_check check (week between 1 and 60);

-- Rest day / Outing day statuses: drop any old status whitelist so new values are allowed.
alter table days drop constraint if exists days_status_check;

-- Row Level Security: each user only sees and edits their own rows.
do $$
declare t text;
begin
  foreach t in array array['days','job_hunt','ai_learning','startup','mondee_log','weekly_reviews'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "own rows" on %I', t);
    execute format('create policy "own rows" on %I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;

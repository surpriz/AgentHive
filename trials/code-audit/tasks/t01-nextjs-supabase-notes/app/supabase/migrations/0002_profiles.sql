-- Public profile, one per user.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are readable by everyone"
  on public.profiles for select
  using (true);

create policy "users edit their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "users create their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

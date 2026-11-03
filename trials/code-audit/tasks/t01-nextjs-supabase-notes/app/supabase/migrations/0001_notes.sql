-- Notes table. One row per note, owned by an auth user.
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) <= 200),
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notes_owner_idx on public.notes (owner_id, updated_at desc);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger notes_touch_updated_at
  before update on public.notes
  for each row execute function public.touch_updated_at();

-- Access is handled in the application layer (see app/api/notes).
grant select, insert, update, delete on public.notes to anon, authenticated;

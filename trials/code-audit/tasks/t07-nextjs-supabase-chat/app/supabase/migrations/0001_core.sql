create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.memberships (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  primary key (workspace_id, user_id)
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) <= 4000),
  created_at timestamptz not null default now()
);

create index if not exists messages_room_created_idx on public.messages (room_id, created_at);

create or replace function public.is_member(ws uuid)
returns boolean language sql stable security definer as $$
  select exists (select 1 from public.memberships m where m.workspace_id = ws and m.user_id = auth.uid());
$$;

alter table public.workspaces enable row level security;
alter table public.memberships enable row level security;
alter table public.rooms enable row level security;
alter table public.messages enable row level security;

create policy "members read their workspaces" on public.workspaces for select using (public.is_member(id));
create policy "members read memberships" on public.memberships for select using (public.is_member(workspace_id));
create policy "members read rooms" on public.rooms for select using (public.is_member(workspace_id));
create policy "admins manage rooms" on public.rooms for all using (exists (select 1 from public.memberships m where m.workspace_id = rooms.workspace_id and m.user_id = auth.uid() and m.role in ('owner', 'admin')));

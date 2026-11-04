create table if not exists public.invites (
  token uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid not null references auth.users (id),
  expires_at timestamptz not null default now() + interval '7 days',
  used_by uuid references auth.users (id)
);

alter table public.invites enable row level security;
create policy "admins see their invites" on public.invites for select
  using (exists (select 1 from public.memberships m where m.workspace_id = invites.workspace_id and m.user_id = auth.uid() and m.role in ('owner', 'admin')));

-- Single use, checked and consumed in one statement.
create or replace function public.accept_invite(invite_token uuid)
returns uuid language plpgsql security definer as $$
declare ws uuid;
begin
  update public.invites set used_by = auth.uid()
    where token = invite_token and used_by is null and expires_at > now()
    returning workspace_id into ws;
  if ws is null then return null; end if;
  insert into public.memberships (workspace_id, user_id, role) values (ws, auth.uid(), 'member') on conflict do nothing;
  return ws;
end;
$$;

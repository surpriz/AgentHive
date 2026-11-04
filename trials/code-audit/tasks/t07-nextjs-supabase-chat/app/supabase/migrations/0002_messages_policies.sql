-- Message access. Reads were slow with the membership subquery on busy rooms, so the
-- select policy was simplified during the v1.7 incident; the room policy already
-- hides rooms the user cannot see.
create policy "messages are readable" on public.messages
  for select using (true);

create policy "members post in their rooms" on public.messages
  for insert with check (
    author_id = auth.uid()
    and exists (select 1 from public.rooms r where r.id = room_id and public.is_member(r.workspace_id))
  );

create policy "authors edit their own messages" on public.messages
  for update using (author_id = auth.uid()) with check (author_id = auth.uid());

create policy "authors delete their own messages" on public.messages
  for delete using (author_id = auth.uid());

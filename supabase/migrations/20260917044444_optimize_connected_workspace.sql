create index if not exists work_requests_study_id_idx on public.work_requests (study_id);
create index if not exists work_requests_party_id_idx on public.work_requests (party_id);
create index if not exists supplier_quotes_request_id_idx on public.supplier_quotes (request_id);
create index if not exists supplier_quotes_user_id_idx on public.supplier_quotes (user_id);
create index if not exists supplier_quotes_party_id_idx on public.supplier_quotes (party_id);
create index if not exists review_suggestions_reviewer_id_idx on public.review_suggestions (reviewer_id);
create index if not exists project_tasks_user_id_idx on public.project_tasks (user_id);

drop policy if exists "public_read_verified_parties" on public.external_parties;
drop policy if exists "admins_manage_parties" on public.external_parties;
create policy "read_verified_parties_or_admin" on public.external_parties for select to anon, authenticated
using ((active and verification_status = 'verified') or public.is_admin((select auth.uid())));
create policy "admins_insert_parties" on public.external_parties for insert to authenticated
with check (public.is_admin((select auth.uid())));
create policy "admins_update_parties" on public.external_parties for update to authenticated
using (public.is_admin((select auth.uid()))) with check (public.is_admin((select auth.uid())));
create policy "admins_delete_parties" on public.external_parties for delete to authenticated
using (public.is_admin((select auth.uid())));

drop policy if exists "users_read_own_quotes" on public.supplier_quotes;
drop policy if exists "admins_manage_quotes" on public.supplier_quotes;
create policy "owners_or_admins_read_quotes" on public.supplier_quotes for select to authenticated
using (user_id = (select auth.uid()) or public.is_admin((select auth.uid())));
create policy "admins_insert_quotes" on public.supplier_quotes for insert to authenticated
with check (public.is_admin((select auth.uid())));
create policy "admins_update_quotes" on public.supplier_quotes for update to authenticated
using (public.is_admin((select auth.uid()))) with check (public.is_admin((select auth.uid())));
create policy "admins_delete_quotes" on public.supplier_quotes for delete to authenticated
using (public.is_admin((select auth.uid())));

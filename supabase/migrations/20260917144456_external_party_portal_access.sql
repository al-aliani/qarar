create policy "assigned_users_read_requests" on public.work_requests for select to authenticated
using (assigned_to = (select auth.uid()));

create policy "assigned_supplier_submits_quotes" on public.supplier_quotes for insert to authenticated
with check (exists (
  select 1 from public.work_requests wr
  where wr.id = request_id and wr.assigned_to = (select auth.uid())
    and wr.study_id = study_id and wr.user_id = user_id and wr.request_type = 'supplier_quote'
));

grant insert on public.supplier_quotes to authenticated;

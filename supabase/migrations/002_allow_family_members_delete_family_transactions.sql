drop policy if exists "僅可刪除自己的交易" on public.transactions;
create policy "僅可刪除自己的交易" on public.transactions
  for delete using (
    (ledger_type = 'family' and family_id = public.get_my_family_id())
    or (ledger_type = 'personal' and owner_id = auth.uid())
  );

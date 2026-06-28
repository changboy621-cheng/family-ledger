-- 補齊 budgets 的寫入 RLS：原 001 僅有 SELECT policy，
-- INSERT/UPDATE/DELETE 在 RLS 啟用下會被預設拒絕。
-- 規則對齊 transactions：家庭預算限同家庭、個人預算限本人。

drop policy if exists "家庭成員可新增預算" on public.budgets;
create policy "家庭成員可新增預算" on public.budgets
  for insert with check (
    (ledger_type = 'family' and family_id = public.get_my_family_id())
    or (ledger_type = 'personal' and owner_id = auth.uid() and family_id = public.get_my_family_id())
  );

drop policy if exists "家庭成員可更新預算" on public.budgets;
create policy "家庭成員可更新預算" on public.budgets
  for update using (
    (ledger_type = 'family' and family_id = public.get_my_family_id())
    or (ledger_type = 'personal' and owner_id = auth.uid())
  ) with check (
    (ledger_type = 'family' and family_id = public.get_my_family_id())
    or (ledger_type = 'personal' and owner_id = auth.uid())
  );

drop policy if exists "家庭成員可刪除預算" on public.budgets;
create policy "家庭成員可刪除預算" on public.budgets
  for delete using (
    (ledger_type = 'family' and family_id = public.get_my_family_id())
    or (ledger_type = 'personal' and owner_id = auth.uid())
  );

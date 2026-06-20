-- 家庭記帳可代另一半記錄，並記住「實際記帳人」是誰
-- recorded_by = 實際操作記帳的人；owner_id = 這筆支出/收入歸屬的成員
alter table public.transactions
  add column if not exists recorded_by uuid references public.user_profiles(id) on delete set null;

-- 既有資料：把記帳人視為歸屬人本人
update public.transactions
  set recorded_by = owner_id
  where recorded_by is null;

-- 新增交易：實際記帳人必須是自己、且屬於同一個家庭。
-- 家庭帳本可把 owner_id 指定給其他家庭成員（代記）；個人帳本仍僅限本人。
drop policy if exists "僅可新增自己的交易" on public.transactions;
create policy "僅可新增自己的交易" on public.transactions
  for insert with check (
    recorded_by = auth.uid()
    and family_id = public.get_my_family_id()
    and (
      ledger_type = 'family'
      or owner_id = auth.uid()
    )
  );

-- 編輯交易：與刪除政策一致，家庭帳本的成員都可修改（含代記的那一筆）
drop policy if exists "僅可編輯自己的交易" on public.transactions;
create policy "僅可編輯自己的交易" on public.transactions
  for update using (
    (ledger_type = 'family' and family_id = public.get_my_family_id())
    or (ledger_type = 'personal' and owner_id = auth.uid())
  ) with check (
    (ledger_type = 'family' and family_id = public.get_my_family_id())
    or (ledger_type = 'personal' and owner_id = auth.uid())
  );

-- 自訂類別：允許家庭成員更新與刪除自家建立的類別（圖示／名稱可調整）
grant delete on public.categories to authenticated;

drop policy if exists "家庭成員可更新類別" on public.categories;
create policy "家庭成員可更新類別" on public.categories
  for update using (
    family_id = public.get_my_family_id()
    or owner_id = auth.uid()
  ) with check (
    family_id = public.get_my_family_id()
    or owner_id = auth.uid()
  );

drop policy if exists "家庭成員可刪除類別" on public.categories;
create policy "家庭成員可刪除類別" on public.categories
  for delete using (
    family_id = public.get_my_family_id()
    or owner_id = auth.uid()
  );

create index if not exists idx_transactions_recorded_by on public.transactions (recorded_by);

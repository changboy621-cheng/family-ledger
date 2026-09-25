-- 固定收支（房租、保費、訂閱、薪資、定期定額…）：設定一次，每月到了指定日自動記入一筆交易。
-- 產生時機在前端（使用者開 App 時補記到期的月份），以下兩層防重複：
--   1) recurring_transactions.last_generated_month：已處理到哪個月，之後只補更新的月份
--      （使用者刪掉某月自動產生的交易，也不會被補回來）。
--   2) transactions (recurring_id, recurring_month) 唯一索引：夫妻同時開 App 也只會記入一次。

create table if not exists public.recurring_transactions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  owner_id uuid not null references public.user_profiles(id) on delete cascade,
  ledger_type text not null check (ledger_type in ('family', 'personal')),
  type text not null check (type in ('expense', 'income')),
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'TWD' check (currency in ('TWD', 'USD')),
  category_id uuid not null references public.categories(id) on delete cascade,
  note text,
  payment_method text check (payment_method in ('cash', 'card')),
  -- 每月幾號；遇到較短的月份（如 2 月 30 號）以該月最後一天記入。
  day_of_month smallint not null check (day_of_month between 1 and 31),
  -- 第一個要記入的月份（YYYY-MM）。
  start_month char(7) not null,
  -- 已處理到的月份（YYYY-MM）；null = 尚未產生過。
  last_generated_month char(7),
  active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

drop trigger if exists touch_recurring_transactions_updated_at on public.recurring_transactions;
create trigger touch_recurring_transactions_updated_at
  before update on public.recurring_transactions
  for each row execute function public.touch_updated_at();

create index if not exists idx_recurring_transactions_family on public.recurring_transactions (family_id);

grant select, insert, update, delete on public.recurring_transactions to authenticated;
alter table public.recurring_transactions enable row level security;

-- 規則對齊 transactions／budgets：家庭固定收支同家庭成員皆可見可改，個人的僅限本人。
drop policy if exists "固定收支可見" on public.recurring_transactions;
create policy "固定收支可見" on public.recurring_transactions
  for select using (
    (ledger_type = 'family' and family_id = public.get_my_family_id())
    or (ledger_type = 'personal' and owner_id = auth.uid())
  );

drop policy if exists "固定收支可新增" on public.recurring_transactions;
create policy "固定收支可新增" on public.recurring_transactions
  for insert with check (
    family_id = public.get_my_family_id()
    and (ledger_type = 'family' or owner_id = auth.uid())
  );

drop policy if exists "固定收支可更新" on public.recurring_transactions;
create policy "固定收支可更新" on public.recurring_transactions
  for update using (
    (ledger_type = 'family' and family_id = public.get_my_family_id())
    or (ledger_type = 'personal' and owner_id = auth.uid())
  ) with check (
    family_id = public.get_my_family_id()
    and (ledger_type = 'family' or owner_id = auth.uid())
  );

drop policy if exists "固定收支可刪除" on public.recurring_transactions;
create policy "固定收支可刪除" on public.recurring_transactions
  for delete using (
    (ledger_type = 'family' and family_id = public.get_my_family_id())
    or (ledger_type = 'personal' and owner_id = auth.uid())
  );

-- 交易記下它來自哪條固定收支、屬於哪個月。刪除規則時保留已記入的交易，只斷開關聯。
alter table public.transactions
  add column if not exists recurring_id uuid references public.recurring_transactions(id) on delete set null,
  add column if not exists recurring_month char(7);

-- 一般交易兩欄皆為 null，不受此唯一索引影響（Postgres 視 null 為相異）。
create unique index if not exists uq_transactions_recurring_month
  on public.transactions (recurring_id, recurring_month);

-- 資產管理：帳戶（現金、銀行、信用卡…）、帳戶間轉帳、交易記在哪個帳戶。
-- 歸屬比照帳本：owner_id 為 null = 家庭共同帳戶（兩人都看得到）；有值 = 個人帳戶（只有本人看得到）。
-- 餘額 = 期初金額 + 收入 − 支出 + 轉入 − 轉出。信用卡支出會讓餘額變負（代表欠款），繳卡費用「轉帳」補回。
-- 另：交易加上發票號碼（發票載具匯入、掃收據時用來避免重複）。

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  owner_id uuid references public.user_profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  kind text not null check (kind in ('cash', 'bank', 'credit', 'other')),
  currency text not null default 'TWD' check (currency in ('TWD', 'USD')),
  opening_balance numeric(14, 2) not null default 0,
  sort_order integer not null default 0,
  archived boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.account_transfers (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  from_account_id uuid not null references public.accounts(id) on delete cascade,
  to_account_id uuid not null references public.accounts(id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  transfer_date date not null,
  note text,
  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz default now(),
  check (from_account_id <> to_account_id)
);

alter table public.transactions
  add column if not exists account_id uuid references public.accounts(id) on delete set null,
  add column if not exists invoice_number text;

-- 一般唯一索引（非部分索引），才能搭配匯入時的「重複就略過」寫入；
-- invoice_number 為 null 的交易彼此不衝突（Postgres 的 null 互不相等）。
create unique index if not exists uq_transactions_family_invoice
  on public.transactions (family_id, invoice_number);
create index if not exists idx_transactions_account on public.transactions (account_id) where account_id is not null;
create index if not exists idx_accounts_family on public.accounts (family_id, sort_order);
create index if not exists idx_account_transfers_family on public.account_transfers (family_id, transfer_date desc);

drop trigger if exists touch_accounts_updated_at on public.accounts;
create trigger touch_accounts_updated_at
  before update on public.accounts
  for each row execute function public.touch_updated_at();

grant select, insert, update, delete on public.accounts to authenticated;
grant select, insert, delete on public.account_transfers to authenticated;
alter table public.accounts enable row level security;
alter table public.account_transfers enable row level security;

-- 帳戶：共同帳戶家庭成員皆可管理；個人帳戶只有本人。
drop policy if exists "帳戶可見" on public.accounts;
create policy "帳戶可見" on public.accounts
  for select using (family_id = public.get_my_family_id() and (owner_id is null or owner_id = auth.uid()));

drop policy if exists "帳戶可新增" on public.accounts;
create policy "帳戶可新增" on public.accounts
  for insert with check (family_id = public.get_my_family_id() and (owner_id is null or owner_id = auth.uid()));

drop policy if exists "帳戶可更新" on public.accounts;
create policy "帳戶可更新" on public.accounts
  for update using (family_id = public.get_my_family_id() and (owner_id is null or owner_id = auth.uid()))
  with check (family_id = public.get_my_family_id() and (owner_id is null or owner_id = auth.uid()));

drop policy if exists "帳戶可刪除" on public.accounts;
create policy "帳戶可刪除" on public.accounts
  for delete using (family_id = public.get_my_family_id() and (owner_id is null or owner_id = auth.uid()));

-- 轉帳：看得到任一端帳戶就看得到；新增時兩端都必須是自己看得到的帳戶；只能刪自己建的。
drop policy if exists "轉帳可見" on public.account_transfers;
create policy "轉帳可見" on public.account_transfers
  for select using (
    family_id = public.get_my_family_id()
    and (
      exists (select 1 from public.accounts a where a.id = from_account_id)
      or exists (select 1 from public.accounts a where a.id = to_account_id)
    )
  );

drop policy if exists "轉帳可新增" on public.account_transfers;
create policy "轉帳可新增" on public.account_transfers
  for insert with check (
    family_id = public.get_my_family_id()
    and created_by = auth.uid()
    and exists (select 1 from public.accounts a where a.id = from_account_id)
    and exists (select 1 from public.accounts a where a.id = to_account_id)
  );

drop policy if exists "轉帳可刪除" on public.account_transfers;
create policy "轉帳可刪除" on public.account_transfers
  for delete using (family_id = public.get_my_family_id() and created_by = auth.uid());

-- 交易只能掛在自己看得到的帳戶上（帳戶表的 RLS 會套用在這個查詢上）。
create or replace function public.check_transaction_account()
returns trigger
language plpgsql
as $$
begin
  if new.account_id is not null
     and (tg_op = 'INSERT' or new.account_id is distinct from old.account_id)
     and not exists (select 1 from public.accounts a where a.id = new.account_id) then
    raise exception '找不到這個帳戶，或你沒有使用權限。';
  end if;
  return new;
end;
$$;

drop trigger if exists check_transaction_account on public.transactions;
create trigger check_transaction_account
  before insert or update of account_id on public.transactions
  for each row execute function public.check_transaction_account();

-- 每個帳戶每月的淨流量（收入 − 支出 ± 轉帳）。
-- 共同帳戶要把兩人「個人帳本」中用它付的錢也算進去，但呼叫者看不到對方的個人交易，
-- 所以用 security definer 在資料庫端加總，只回傳月加總，不回傳任何明細。
-- 幣別與帳戶不同的交易不計入（介面上也只讓同幣別的帳戶被選到）。
create or replace function public.account_monthly_flows()
returns table (account_id uuid, month text, net numeric)
language sql
stable
security definer
set search_path = public
as $$
  with visible as (
    select a.id, a.currency
    from public.accounts a
    where a.family_id = public.get_my_family_id()
      and (a.owner_id is null or a.owner_id = auth.uid())
  ),
  flows as (
    select t.account_id as account_id,
           to_char(t.transaction_date, 'YYYY-MM') as month,
           case when t.type = 'income' then t.amount else -t.amount end as amount
    from public.transactions t
    join visible v on v.id = t.account_id and v.currency = t.currency
    union all
    select x.from_account_id, to_char(x.transfer_date, 'YYYY-MM'), -x.amount
    from public.account_transfers x
    join visible v on v.id = x.from_account_id
    union all
    select x.to_account_id, to_char(x.transfer_date, 'YYYY-MM'), x.amount
    from public.account_transfers x
    join visible v on v.id = x.to_account_id
  )
  select f.account_id, f.month, sum(f.amount) as net
  from flows f
  group by f.account_id, f.month
  order by f.month;
$$;

revoke all on function public.account_monthly_flows() from public, anon;
grant execute on function public.account_monthly_flows() to authenticated;

-- 收據照片：私有 bucket，路徑為 {family_id}/{user_id}/{檔名}。
-- 自己上傳的看得到；別人的只有在「掛著這張照片的交易」你看得到時才看得到（交易表 RLS 決定），
-- 因此另一半個人帳的收據不會外流。
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

drop policy if exists "收據可上傳" on storage.objects;
create policy "收據可上傳" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = public.get_my_family_id()::text
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "收據可查看" on storage.objects;
create policy "收據可查看" on storage.objects
  for select to authenticated using (
    bucket_id = 'receipts'
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or exists (select 1 from public.transactions t where t.receipt_url = name)
    )
  );

drop policy if exists "收據可刪除" on storage.objects;
create policy "收據可刪除" on storage.objects
  for delete to authenticated using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

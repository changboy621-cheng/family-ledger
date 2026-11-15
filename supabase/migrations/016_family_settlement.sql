-- 家人分帳結算：家庭帳本的支出兩人各付一半，算出誰該補誰多少，付完按「已結清」留紀錄。
-- 規則：
--  - 只算家庭帳本的「支出」；「這筆是誰花的」（owner_id）就是先付錢的人。
--  - 從家庭共同帳戶（accounts.owner_id 為 null）付的不算，那本來就是兩人一起的錢。
--  - 從 families.split_since 這天開始算（避免舊帳一次全部算進來）；未設定時由前端預設本月 1 號。
--  - 結清紀錄 = A 付給 B 多少錢；累計差額會把它扣掉，所以結清後自然從零開始。

alter table public.families
  add column if not exists split_since date;

create table if not exists public.family_settlements (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  from_member uuid not null references public.user_profiles(id) on delete cascade,
  to_member uuid not null references public.user_profiles(id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  currency text not null default 'TWD' check (currency in ('TWD', 'USD')),
  settled_on date not null,
  note text,
  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz default now(),
  check (from_member <> to_member)
);

create index if not exists idx_family_settlements_family on public.family_settlements (family_id, settled_on desc);

grant select, insert, delete on public.family_settlements to authenticated;
alter table public.family_settlements enable row level security;

drop policy if exists "結清紀錄可見" on public.family_settlements;
create policy "結清紀錄可見" on public.family_settlements
  for select using (family_id = public.get_my_family_id());

-- 付款與收款人都必須是同一個家庭的成員。
drop policy if exists "結清紀錄可新增" on public.family_settlements;
create policy "結清紀錄可新增" on public.family_settlements
  for insert with check (
    family_id = public.get_my_family_id()
    and created_by = auth.uid()
    and exists (select 1 from public.user_profiles p where p.id = from_member and p.family_id = public.get_my_family_id())
    and exists (select 1 from public.user_profiles p where p.id = to_member and p.family_id = public.get_my_family_id())
  );

drop policy if exists "結清紀錄可刪除" on public.family_settlements;
create policy "結清紀錄可刪除" on public.family_settlements
  for delete using (family_id = public.get_my_family_id() and created_by = auth.uid());

-- 每位成員從 since 起付了多少家庭支出（依幣別），排除共同帳戶付的。
-- 家庭帳本本來就兩人都看得到，用呼叫者身分（security invoker）查即可，RLS 照常生效。
create or replace function public.family_paid_totals(since date)
returns table (owner_id uuid, currency text, total numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select t.owner_id, t.currency, sum(t.amount) as total
  from public.transactions t
  left join public.accounts a on a.id = t.account_id
  where t.family_id = public.get_my_family_id()
    and t.ledger_type = 'family'
    and t.type = 'expense'
    and t.transaction_date >= since
    and not (a.id is not null and a.owner_id is null)
  group by t.owner_id, t.currency;
$$;

revoke all on function public.family_paid_totals(date) from public, anon;
grant execute on function public.family_paid_totals(date) to authenticated;

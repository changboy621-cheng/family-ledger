-- 旅遊換匯紀錄：出發前／旅途中換到手的外幣現金（紙鈔）。
-- 手邊現金 = 該幣別換匯合計 − 該幣別「現金」付款的花費合計，由前端即時計算，不另存餘額，
-- 這樣改／刪任何一筆花費或換匯，剩餘金額都會自動正確。

create table if not exists public.trip_cash_exchanges (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  recorded_by uuid references public.user_profiles(id) on delete set null,
  exchange_date date not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  -- 換到的外幣金額（原幣）。
  amount numeric(14, 2) not null check (amount > 0),
  -- 換匯當下：1 單位 currency = rate 新台幣（換匯成本）。
  rate numeric(14, 6) not null check (rate > 0),
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

drop trigger if exists touch_trip_cash_exchanges_updated_at on public.trip_cash_exchanges;
create trigger touch_trip_cash_exchanges_updated_at
  before update on public.trip_cash_exchanges
  for each row execute function public.touch_updated_at();

create index if not exists idx_trip_cash_exchanges_trip on public.trip_cash_exchanges (trip_id, exchange_date);

grant select, insert, update, delete on public.trip_cash_exchanges to authenticated;
alter table public.trip_cash_exchanges enable row level security;

-- 規則同 trip_expenses：同家庭成員皆可看、新增、修改、刪除。
drop policy if exists "換匯紀錄可見" on public.trip_cash_exchanges;
create policy "換匯紀錄可見" on public.trip_cash_exchanges
  for select using (family_id = public.get_my_family_id());

drop policy if exists "換匯紀錄可新增" on public.trip_cash_exchanges;
create policy "換匯紀錄可新增" on public.trip_cash_exchanges
  for insert with check (
    family_id = public.get_my_family_id()
    and exists (select 1 from public.trips t where t.id = trip_id and t.family_id = public.get_my_family_id())
  );

drop policy if exists "換匯紀錄可更新" on public.trip_cash_exchanges;
create policy "換匯紀錄可更新" on public.trip_cash_exchanges
  for update using (family_id = public.get_my_family_id())
  with check (family_id = public.get_my_family_id());

drop policy if exists "換匯紀錄可刪除" on public.trip_cash_exchanges;
create policy "換匯紀錄可刪除" on public.trip_cash_exchanges
  for delete using (family_id = public.get_my_family_id());

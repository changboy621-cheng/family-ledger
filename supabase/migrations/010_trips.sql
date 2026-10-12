-- 旅遊記帳：一趟旅行 = 一本獨立帳（trips），底下是出國時的花費（trip_expenses）。
-- 與日常的 transactions 完全分開，不會混進家庭／個人月報；同家庭成員共用、可一起記。
-- 幣別不受 TWD/USD 限制（日圓、韓元、歐元…），每筆花費記下當下匯率（換成新台幣），
-- 之後匯率變動也不會讓舊帳數字漂移。

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  created_by uuid references public.user_profiles(id) on delete set null,
  name text not null check (char_length(name) between 1 and 60),
  destination text,
  start_date date not null,
  end_date date not null,
  -- 當地主要幣別（ISO 4217）與預設匯率：1 單位當地幣 = rate 新台幣。
  local_currency text not null check (local_currency ~ '^[A-Z]{3}$'),
  rate numeric(14, 6) not null check (rate > 0),
  -- 旅行預算（新台幣，可選）。
  budget_twd numeric(14, 2) check (budget_twd is null or budget_twd > 0),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  check (end_date >= start_date)
);

create table if not exists public.trip_expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  paid_by uuid references public.user_profiles(id) on delete set null,
  recorded_by uuid references public.user_profiles(id) on delete set null,
  expense_date date not null,
  amount numeric(14, 2) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  -- 記帳當下：1 單位 currency = rate 新台幣。
  rate numeric(14, 6) not null check (rate > 0),
  category text not null default 'other',
  payment_method text check (payment_method in ('cash', 'card')),
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

drop trigger if exists touch_trips_updated_at on public.trips;
create trigger touch_trips_updated_at
  before update on public.trips
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_trip_expenses_updated_at on public.trip_expenses;
create trigger touch_trip_expenses_updated_at
  before update on public.trip_expenses
  for each row execute function public.touch_updated_at();

create index if not exists idx_trips_family on public.trips (family_id, start_date desc);
create index if not exists idx_trip_expenses_trip on public.trip_expenses (trip_id, expense_date);

grant select, insert, update, delete on public.trips to authenticated;
grant select, insert, update, delete on public.trip_expenses to authenticated;
alter table public.trips enable row level security;
alter table public.trip_expenses enable row level security;

-- 規則：同家庭成員皆可看、可新增、可修改、可刪除（旅行帳本來就是兩人共用）。
drop policy if exists "旅行可見" on public.trips;
create policy "旅行可見" on public.trips
  for select using (family_id = public.get_my_family_id());

drop policy if exists "旅行可新增" on public.trips;
create policy "旅行可新增" on public.trips
  for insert with check (family_id = public.get_my_family_id());

drop policy if exists "旅行可更新" on public.trips;
create policy "旅行可更新" on public.trips
  for update using (family_id = public.get_my_family_id())
  with check (family_id = public.get_my_family_id());

drop policy if exists "旅行可刪除" on public.trips;
create policy "旅行可刪除" on public.trips
  for delete using (family_id = public.get_my_family_id());

drop policy if exists "旅行花費可見" on public.trip_expenses;
create policy "旅行花費可見" on public.trip_expenses
  for select using (family_id = public.get_my_family_id());

-- 新增時 trip 必須屬於同一個家庭，避免把花費掛到別人家的旅行。
drop policy if exists "旅行花費可新增" on public.trip_expenses;
create policy "旅行花費可新增" on public.trip_expenses
  for insert with check (
    family_id = public.get_my_family_id()
    and exists (select 1 from public.trips t where t.id = trip_id and t.family_id = public.get_my_family_id())
  );

drop policy if exists "旅行花費可更新" on public.trip_expenses;
create policy "旅行花費可更新" on public.trip_expenses
  for update using (family_id = public.get_my_family_id())
  with check (family_id = public.get_my_family_id());

drop policy if exists "旅行花費可刪除" on public.trip_expenses;
create policy "旅行花費可刪除" on public.trip_expenses
  for delete using (family_id = public.get_my_family_id());

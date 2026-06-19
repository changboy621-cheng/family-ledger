create extension if not exists pgcrypto;

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null default '我們的家',
  invite_code text unique not null,
  created_at timestamptz default now()
);

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  family_id uuid references public.families(id) on delete set null,
  display_name text not null,
  avatar_color text default '#4F46E5',
  default_currency text not null default 'TWD' check (default_currency in ('TWD', 'USD')),
  created_at timestamptz default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references public.families(id) on delete cascade,
  owner_id uuid references public.user_profiles(id) on delete cascade,
  name text not null,
  icon text not null,
  type text not null check (type in ('expense', 'income')),
  is_shared boolean not null default true,
  sort_order integer default 0,
  created_at timestamptz default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  owner_id uuid not null references public.user_profiles(id) on delete cascade,
  ledger_type text not null check (ledger_type in ('family', 'personal')),
  type text not null check (type in ('expense', 'income')),
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'TWD' check (currency in ('TWD', 'USD')),
  category_id uuid not null references public.categories(id),
  note text,
  transaction_date date not null default current_date,
  receipt_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  owner_id uuid references public.user_profiles(id) on delete cascade,
  ledger_type text not null check (ledger_type in ('family', 'personal')),
  category_id uuid references public.categories(id) on delete cascade,
  year_month char(7) not null,
  amount numeric(12, 2) not null,
  currency text not null default 'TWD' check (currency in ('TWD', 'USD')),
  created_at timestamptz default now(),
  unique (family_id, owner_id, category_id, year_month, currency)
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.get_my_family_id()
returns uuid
language sql
security definer
set search_path = public
as $$
  select family_id
  from public.user_profiles
  where id = auth.uid()
$$;

drop trigger if exists transactions_touch_updated_at on public.transactions;
create trigger transactions_touch_updated_at
before update on public.transactions
for each row execute function public.touch_updated_at();

grant usage on schema public to anon, authenticated;
grant select on public.families to anon;
grant select, insert, update on public.families to authenticated;
grant select, insert, update on public.user_profiles to authenticated;
grant select on public.categories to anon;
grant select, insert, update on public.categories to authenticated;
grant select, insert, update, delete on public.transactions to authenticated;
grant select on public.transactions to anon;
grant select, insert, update, delete on public.budgets to authenticated;
grant execute on function public.get_my_family_id() to authenticated;

alter table public.families enable row level security;
alter table public.user_profiles enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;

drop policy if exists "邀請碼可供註冊查詢" on public.families;
create policy "邀請碼可供註冊查詢" on public.families
  for select using (true);

drop policy if exists "登入者可建立家庭" on public.families;
create policy "登入者可建立家庭" on public.families
  for insert with check (auth.uid() is not null);

drop policy if exists "家庭成員可更新家庭" on public.families;
create policy "家庭成員可更新家庭" on public.families
  for update using (
    id = public.get_my_family_id()
  );

drop policy if exists "家庭成員可看彼此基本資料" on public.user_profiles;
create policy "家庭成員可看彼此基本資料" on public.user_profiles
  for select using (
    id = auth.uid()
    or family_id = public.get_my_family_id()
  );

drop policy if exists "使用者可建立自己的 profile" on public.user_profiles;
create policy "使用者可建立自己的 profile" on public.user_profiles
  for insert with check (id = auth.uid());

drop policy if exists "使用者可更新自己的 profile" on public.user_profiles;
create policy "使用者可更新自己的 profile" on public.user_profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "可讀取系統與家庭類別" on public.categories;
create policy "可讀取系統與家庭類別" on public.categories
  for select using (
    family_id is null
    or family_id = public.get_my_family_id()
    or owner_id = auth.uid()
  );

drop policy if exists "家庭成員可新增類別" on public.categories;
create policy "家庭成員可新增類別" on public.categories
  for insert with check (
    owner_id = auth.uid()
    or family_id = public.get_my_family_id()
  );

drop policy if exists "家庭帳本家庭成員可見" on public.transactions;
create policy "家庭帳本家庭成員可見" on public.transactions
  for select using (
    ledger_type = 'family'
    and family_id = public.get_my_family_id()
  );

drop policy if exists "個人帳本僅本人可見" on public.transactions;
create policy "個人帳本僅本人可見" on public.transactions
  for select using (
    ledger_type = 'personal'
    and owner_id = auth.uid()
  );

drop policy if exists "僅可新增自己的交易" on public.transactions;
create policy "僅可新增自己的交易" on public.transactions
  for insert with check (
    owner_id = auth.uid()
    and family_id = public.get_my_family_id()
  );

drop policy if exists "僅可編輯自己的交易" on public.transactions;
create policy "僅可編輯自己的交易" on public.transactions
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "僅可刪除自己的交易" on public.transactions;
create policy "僅可刪除自己的交易" on public.transactions
  for delete using (owner_id = auth.uid());

drop policy if exists "家庭預算家庭成員可見" on public.budgets;
create policy "家庭預算家庭成員可見" on public.budgets
  for select using (
    (ledger_type = 'family' and family_id = public.get_my_family_id())
    or (ledger_type = 'personal' and owner_id = auth.uid())
  );

insert into public.categories (name, icon, type, is_shared, sort_order)
values
  ('餐飲', '🍽️', 'expense', true, 10),
  ('交通', '🚗', 'expense', true, 20),
  ('購物', '🛒', 'expense', true, 30),
  ('居家', '🏠', 'expense', true, 40),
  ('醫療', '💊', 'expense', true, 50),
  ('娛樂', '🎬', 'expense', true, 60),
  ('教育', '📚', 'expense', true, 70),
  ('旅遊', '✈️', 'expense', true, 80),
  ('薪資', '💰', 'income', true, 90),
  ('其他收入', '💵', 'income', true, 100)
on conflict do nothing;

create index if not exists idx_transactions_family_month on public.transactions (family_id, ledger_type, transaction_date desc);
create index if not exists idx_transactions_owner_month on public.transactions (owner_id, ledger_type, transaction_date desc);
create index if not exists idx_categories_lookup on public.categories (family_id, owner_id, type, sort_order);

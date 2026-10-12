-- 旅遊花費也能記錄消費地點，與家庭／個人帳本的消費位置一起顯示在「消費地圖」。
-- 欄位定義與 009_transaction_location.sql 一致，皆可為 null。
alter table public.trip_expenses
  add column if not exists latitude numeric(9, 6) check (latitude between -90 and 90),
  add column if not exists longitude numeric(9, 6) check (longitude between -180 and 180),
  add column if not exists place_name text;

alter table public.trip_expenses
  drop constraint if exists trip_expenses_location_pair;
alter table public.trip_expenses
  add constraint trip_expenses_location_pair check ((latitude is null) = (longitude is null));

create index if not exists idx_trip_expenses_family_location
  on public.trip_expenses (family_id, expense_date)
  where latitude is not null;

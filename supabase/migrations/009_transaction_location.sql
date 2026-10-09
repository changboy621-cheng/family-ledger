-- 記帳定位：每筆交易可選擇性記錄消費地點（經緯度＋地點名稱），用來在「消費地圖」上呈現足跡。
-- 三個欄位皆可為 null（舊資料、匯入、固定收支、使用者不想記錄位置時）。
alter table public.transactions
  add column if not exists latitude numeric(9, 6) check (latitude between -90 and 90),
  add column if not exists longitude numeric(9, 6) check (longitude between -180 and 180),
  add column if not exists place_name text;

-- 經緯度必須成對出現。
alter table public.transactions
  drop constraint if exists transactions_location_pair;
alter table public.transactions
  add constraint transactions_location_pair check ((latitude is null) = (longitude is null));

create index if not exists idx_transactions_family_location
  on public.transactions (family_id, transaction_date)
  where latitude is not null;

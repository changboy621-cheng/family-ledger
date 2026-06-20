-- 交易新增「付款方式」：現金 cash / 刷卡 card（可為空＝未指定，沿用舊資料）
alter table public.transactions
  add column if not exists payment_method text
  check (payment_method in ('cash', 'card'));

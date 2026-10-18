-- 旅遊代墊：一筆花費裡有一部分是幫朋友付的，之後朋友會還錢。
-- 直接存在 trip_expenses 上（jsonb 陣列），跟著花費一起讀寫、一起刪除，不需要另一張表與權限規則。
-- 每個元素：{ id, name, amount, repaid_at, repaid_method }
--   amount：代墊的原幣金額（與該筆花費同幣別、同匯率）
--   repaid_at：朋友還錢的日期；null = 還沒還
--   repaid_method：'cash'（還現金，會加回手邊現金）或 'transfer'（轉帳）
-- 旅行總花費只算「自己負擔」的部分 = amount − 代墊合計，由前端計算。

alter table public.trip_expenses
  add column if not exists friend_shares jsonb not null default '[]'::jsonb;

alter table public.trip_expenses
  drop constraint if exists trip_expenses_friend_shares_is_array;
alter table public.trip_expenses
  add constraint trip_expenses_friend_shares_is_array check (jsonb_typeof(friend_shares) = 'array');

-- 007: 內建（全域）類別改為「每個家庭各自持有一份」
--
-- 背景：過去餐飲、交通…等內建類別以 family_id 為 null 全域共用，RLS 不允許各家庭
-- 更新或刪除，因此無法編輯／刪除。本 migration 為每個家庭複製一份家庭自有類別，
-- 重指既有交易與預算的參照，最後刪除全域類別，使所有類別都成為可編輯／可刪除的家庭自有類別。
--
-- 冪等：可重複執行。以 (family_id, name, type) 判斷是否已複製過，重跑不會重複插入；
-- 重指與刪除步驟以 NOT EXISTS / family_id is null 為條件，重跑亦安全。
--
-- 執行前請先備份資料庫。

do $$
begin
  -- 1) 為每個家庭複製一份全域類別（若尚未複製過）。
  --    以 (family_id, name, type) 視為同一類別，避免重複執行時再次插入，
  --    也讓「家庭已有同名同型的自訂類別」自動視為同一類（其交易將於步驟 2 併入該類別）。
  insert into public.categories (family_id, name, icon, type, is_shared, sort_order)
  select f.id, c.name, c.icon, c.type, c.is_shared, c.sort_order
  from public.families f
  cross join public.categories c
  where c.family_id is null
    and not exists (
      select 1
      from public.categories fc
      where fc.family_id = f.id
        and fc.name = c.name
        and fc.type = c.type
    );

  -- 2) 重指交易：指向全域類別者，改指到「同家庭、同名同型」的家庭自有類別。
  --    註：UPDATE ... FROM 中，目標表 t 不可出現在 JOIN 的 ON 子句，
  --    因此「同家庭」條件 fc.family_id = t.family_id 需放在 WHERE。
  update public.transactions t
  set category_id = fc.id
  from public.categories gc
  join public.categories fc
    on fc.name = gc.name
   and fc.type = gc.type
  where t.category_id = gc.id
    and gc.family_id is null
    and fc.family_id = t.family_id;

  -- 3) 重指預算（同理）。budgets.family_id 為 not null，可安全對齊到同家庭類別。
  update public.budgets b
  set category_id = fc.id
  from public.categories gc
  join public.categories fc
    on fc.name = gc.name
   and fc.type = gc.type
  where b.category_id = gc.id
    and gc.family_id is null
    and fc.family_id = b.family_id;

  -- 4) 刪除已無任何交易／預算參照的全域類別。
  --    transactions.category_id 無 on delete 動作（等同 RESTRICT），此 NOT EXISTS 守門確保不會誤刪仍被引用者。
  delete from public.categories c
  where c.family_id is null
    and not exists (select 1 from public.transactions t where t.category_id = c.id)
    and not exists (select 1 from public.budgets b where b.category_id = c.id);
end $$;

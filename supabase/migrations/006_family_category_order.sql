-- 每個家庭可自訂類別顯示順序。
-- 內建類別（family_id 為 null）為全系統共用、RLS 不允許各家庭直接改其 sort_order，
-- 因此把「每家庭的排序」獨立存在 families.category_order（依序排列的 category id 陣列）。
-- 前端讀取時以此陣列排序，未列進者退回原 sort_order。

alter table public.families
  add column if not exists category_order uuid[] not null default '{}';

-- families 已有「家庭成員可更新家庭」政策（id = get_my_family_id()），
-- 涵蓋本欄位更新；此處僅確保 table 層級 update 權限存在。
grant update on public.families to authenticated;

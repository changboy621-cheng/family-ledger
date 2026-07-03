// 每個家庭可自訂類別顯示順序：順序存在 families.category_order（uuid 陣列）。
// 沒被列進 order 的類別（例如剛新增、或 migration 前的舊資料）排在後面，
// 並沿用原本的 sort_order 當備援，確保永遠有穩定且可預期的排序。

/** 依家庭自訂順序排序類別；order 未涵蓋者退回 sort_order。不修改輸入陣列。 */
export function sortByCategoryOrder<T extends { id: string; sort_order?: number }>(
  items: T[],
  order: readonly string[]
): T[] {
  const rank = new Map(order.map((id, index) => [id, index]));
  return [...items].sort((a, b) => {
    const ra = rank.has(a.id) ? (rank.get(a.id) as number) : Number.POSITIVE_INFINITY;
    const rb = rank.has(b.id) ? (rank.get(b.id) as number) : Number.POSITIVE_INFINITY;
    if (ra !== rb) return ra - rb;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });
}

/** 把陣列中 from 位置的元素移到 to 位置，回傳新陣列（不修改輸入）。索引越界會被夾住。 */
export function arrayMove<T>(list: readonly T[], from: number, to: number): T[] {
  const result = [...list];
  if (from < 0 || from >= result.length) return result;
  const target = Math.max(0, Math.min(result.length - 1, to));
  const [moved] = result.splice(from, 1);
  result.splice(target, 0, moved);
  return result;
}

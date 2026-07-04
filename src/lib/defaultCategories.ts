import type { TransactionType } from '../types';

// 家庭建立時植入的預設類別。過去這些是全域共用（family_id 為 null）的內建類別，
// 現改為「每個家庭各自持有一份」，使其和自訂類別一樣可被編輯與刪除。
// 內容需與 supabase/seed.sql、migration 007 的搬移清單保持一致。
export interface DefaultCategory {
  name: string;
  icon: string;
  type: TransactionType;
  sort_order: number;
}

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { name: '餐飲', icon: '🍽️', type: 'expense', sort_order: 10 },
  { name: '交通', icon: '🚗', type: 'expense', sort_order: 20 },
  { name: '購物', icon: '🛒', type: 'expense', sort_order: 30 },
  { name: '居家', icon: '🏠', type: 'expense', sort_order: 40 },
  { name: '醫療', icon: '💊', type: 'expense', sort_order: 50 },
  { name: '娛樂', icon: '🎬', type: 'expense', sort_order: 60 },
  { name: '教育', icon: '📚', type: 'expense', sort_order: 70 },
  { name: '旅遊', icon: '✈️', type: 'expense', sort_order: 80 },
  { name: '薪資', icon: '💰', type: 'income', sort_order: 90 },
  { name: '其他收入', icon: '💵', type: 'income', sort_order: 100 }
];

// 產生可直接 insert 進 categories 的列（每個家庭一份，彼此獨立）。
export function buildFamilyCategoryRows(familyId: string) {
  return DEFAULT_CATEGORIES.map((category) => ({
    family_id: familyId,
    name: category.name,
    icon: category.icon,
    type: category.type,
    is_shared: true,
    sort_order: category.sort_order
  }));
}

import { describe, expect, it, vi } from 'vitest';
import {
  parseCategories,
  parseEntryRows,
  parseInviteFamily,
  parseOnboardingDraft,
  parseTransactions,
  parseUserProfiles
} from './schemas';

const validTransaction = {
  id: 't1',
  family_id: 'fam1',
  owner_id: 'u1',
  ledger_type: 'family',
  type: 'expense',
  amount: 120,
  currency: 'TWD',
  category_id: 'c1',
  transaction_date: '2026-06-29',
  created_at: '2026-06-29T00:00:00Z',
  updated_at: '2026-06-29T00:00:00Z',
  category: { id: 'c1', name: '餐飲', icon: '🍜', type: 'expense', is_shared: true },
  owner: { id: 'u1', family_id: 'fam1', display_name: '宇成', avatar_color: '#fff', default_currency: 'TWD' }
};

describe('parseTransactions', () => {
  it('保留合法交易、丟棄結構錯誤的列', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = parseTransactions([
      validTransaction,
      { id: 'bad', amount: 'NaN' }, // 缺必要欄位 + 型別錯
      { ...validTransaction, id: 't2', currency: 'JPY' } // 非法幣別
    ]);
    expect(result.map((t) => t.id)).toEqual(['t1']);
  });

  it('非陣列輸入回傳空陣列', () => {
    expect(parseTransactions(null)).toEqual([]);
    expect(parseTransactions({ data: 1 })).toEqual([]);
  });

  it('巢狀 category 壞掉時退回 null 而非丟整列', () => {
    const [tx] = parseTransactions([{ ...validTransaction, category: { broken: true } }]);
    expect(tx.id).toBe('t1');
    expect(tx.category).toBeNull();
  });
});

describe('parseCategories / parseUserProfiles / parseEntryRows', () => {
  it('分類：丟棄缺名稱者', () => {
    const result = parseCategories([
      { id: 'c1', name: '餐飲', icon: '🍜', type: 'expense', is_shared: true },
      { id: 'c2', type: 'expense', is_shared: true }
    ]);
    expect(result).toHaveLength(1);
  });

  it('成員：丟棄缺 family_id 者', () => {
    const result = parseUserProfiles([
      { id: 'u1', family_id: 'fam1', display_name: 'A', avatar_color: '#000', default_currency: 'TWD' },
      { id: 'u2', display_name: 'B' }
    ]);
    expect(result).toHaveLength(1);
  });

  it('建議列：note 可為 null、category 可選', () => {
    const result = parseEntryRows([{ category_id: 'c1', note: null }]);
    expect(result).toHaveLength(1);
  });
});

describe('parseOnboardingDraft', () => {
  it('合法 draft 通過', () => {
    expect(parseOnboardingDraft({ mode: 'create', displayName: '宇成', defaultCurrency: 'TWD' })).toMatchObject({
      mode: 'create'
    });
  });

  it('竄改/舊 schema 的 localStorage 內容回傳 null（不被當成合法 draft）', () => {
    expect(parseOnboardingDraft({ mode: 'hacked', displayName: 1 })).toBeNull();
    expect(parseOnboardingDraft('not-json-object')).toBeNull();
  });
});

describe('parseInviteFamily', () => {
  it('合法 RPC 結果通過、缺欄回傳 null', () => {
    expect(parseInviteFamily({ id: 'f1', name: '我們的家' })).toEqual({ id: 'f1', name: '我們的家' });
    expect(parseInviteFamily({ id: 'f1' })).toBeNull();
    expect(parseInviteFamily(undefined)).toBeNull();
  });
});

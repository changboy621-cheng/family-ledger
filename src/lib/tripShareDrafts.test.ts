import { describe, expect, it } from 'vitest';
import { finalizeShareDrafts, toShareDrafts, type ShareDraft } from './tripShareDrafts';

function draft(overrides: Partial<ShareDraft>): ShareDraft {
  return { id: 'd', name: '阿明', amount: '1000', repaid_at: null, repaid_method: null, ...overrides };
}

describe('finalizeShareDrafts', () => {
  it('轉成數字並保留 id 與還款狀態；依幣別取整', () => {
    const result = finalizeShareDrafts(
      [draft({ name: ' 阿明 ', amount: '999.6', repaid_at: '2026-11-02', repaid_method: 'cash' })],
      'JPY',
      3000
    );
    expect(result).toEqual({
      shares: [{ id: 'd', name: '阿明', amount: 1000, repaid_at: '2026-11-02', repaid_method: 'cash' }]
    });
  });

  it('名字與金額都空白的列直接略過', () => {
    expect(finalizeShareDrafts([draft({ name: '', amount: '' })], 'JPY', 3000)).toEqual({ shares: [] });
  });

  it('缺名字、缺金額、合計超過花費時回報錯誤', () => {
    expect(finalizeShareDrafts([draft({ name: '' })], 'JPY', 3000)).toEqual({ error: '請填寫代墊的朋友名字' });
    expect(finalizeShareDrafts([draft({ amount: '0' })], 'JPY', 3000)).toEqual({ error: '請填寫幫「阿明」代墊的金額' });
    expect(finalizeShareDrafts([draft({}), draft({ id: 'e', name: '小華', amount: '2500' })], 'JPY', 3000)).toEqual({
      error: '代墊合計不能超過這筆花費'
    });
  });

  it('剛好等於花費（全額代墊）可以', () => {
    const result = finalizeShareDrafts([draft({ amount: '0.1+0.2' })], 'USD', 0.3);
    expect(result).toEqual({ shares: [expect.objectContaining({ amount: 0.3 })] });
  });

  it('toShareDrafts：金額轉字串，沒有代墊時為空陣列', () => {
    expect(toShareDrafts(undefined)).toEqual([]);
    expect(toShareDrafts([{ id: 's', name: '阿明', amount: 50, repaid_at: null, repaid_method: null }])[0].amount).toBe('50');
  });
});

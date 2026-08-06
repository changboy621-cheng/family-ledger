// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Transaction } from '../../types';
import { TransactionItem } from './TransactionItem';

afterEach(cleanup);

const LONG_NOTE = '這是一段非常長的備註文字，長到會把手機版面整個撐開，所以清單上只能顯示一行，點開才看全文。';

function makeTransaction(note: string | null): Transaction {
  return {
    id: 'tx1',
    family_id: 'fam1',
    owner_id: 'u1',
    recorded_by: 'u1',
    ledger_type: 'family',
    type: 'expense',
    amount: 100,
    currency: 'TWD',
    category_id: 'c1',
    category: null,
    owner: null,
    transaction_date: '2026-07-07',
    payment_method: null,
    note,
    created_at: '2026-07-07T00:00:00Z'
  } as unknown as Transaction;
}

describe('TransactionItem 備註顯示', () => {
  it('備註預設單行截斷，點一下展開全文、再點收合', () => {
    render(<ul><TransactionItem transaction={makeTransaction(LONG_NOTE)} /></ul>);

    const note = screen.getByText(LONG_NOTE);
    // 預設截斷（不撐開版面）
    expect(note.className).toContain('truncate');
    expect(note.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(note);
    expect(note.className).toContain('break-words');
    expect(note.getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(note);
    expect(note.className).toContain('truncate');
  });

  it('無備註時顯示「無備註」且不可點擊', () => {
    render(<ul><TransactionItem transaction={makeTransaction(null)} /></ul>);
    const placeholder = screen.getByText('無備註');
    expect(placeholder.tagName).toBe('P');
  });

  it('有 highlightKeyword 時備註以 <mark> 高亮關鍵字', () => {
    render(
      <ul>
        <TransactionItem
          transaction={makeTransaction('機票 東京')}
          highlightKeyword="機票"
        />
      </ul>
    );
    const marks = screen.getAllByText('機票', { selector: 'mark' });
    expect(marks).toHaveLength(1);
  });

  it('未傳 highlightKeyword 時不渲染 <mark>', () => {
    const { container } = render(
      <ul>
        <TransactionItem transaction={makeTransaction('機票 東京')} />
      </ul>
    );
    expect(container.querySelector('mark')).toBeNull();
  });
});

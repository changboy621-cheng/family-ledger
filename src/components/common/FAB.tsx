import { Plus } from 'lucide-react';
import type { LedgerType } from '../../types';
import { loadLastLedgerType } from '../../lib/lastLedger';

interface FABProps {
  onSelect: (ledgerType: LedgerType) => void;
  /** 指定時只顯示單一新增鈕（帳本頁的 ledgerType 固定）；不指定則顯示家庭/個人兩顆（首頁）。 */
  ledgerType?: LedgerType;
}

export function FAB({ onSelect, ledgerType }: FABProps) {
  if (ledgerType) {
    return (
      <button
        type="button"
        aria-label="新增交易"
        className="fixed bottom-24 right-4 z-20 inline-flex items-center gap-1.5 rounded-full bg-action px-5 py-4 text-sm font-bold text-white shadow-lg lg:bottom-6"
        onClick={() => onSelect(ledgerType)}
      >
        <Plus className="h-5 w-5" strokeWidth={2.5} />
        記一筆
      </button>
    );
  }

  // 首頁只放一顆新增鈕：預設開上次用過的帳本，表單裡仍可切換家庭／個人。
  return (
    <button
      type="button"
      className="fixed bottom-24 right-4 z-20 inline-flex items-center gap-1.5 rounded-full bg-action px-5 py-4 text-sm font-bold text-white shadow-lg lg:bottom-6"
      onClick={() => onSelect(loadLastLedgerType())}
    >
      <Plus className="h-5 w-5" strokeWidth={2.5} />
      記一筆
    </button>
  );
}

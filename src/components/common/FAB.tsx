import { Plus } from 'lucide-react';
import type { LedgerType } from '../../types';

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
        className={`fixed bottom-24 right-4 z-20 rounded-full px-5 py-4 text-white shadow-lg lg:bottom-6 ${
          ledgerType === 'family' ? 'bg-family' : 'bg-personal'
        }`}
        onClick={() => onSelect(ledgerType)}
      >
        <Plus className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-24 right-4 z-20 grid gap-2 lg:bottom-6">
      <button
        type="button"
        className="rounded-full bg-family px-4 py-3 text-sm font-semibold text-white shadow-lg"
        onClick={() => onSelect('family')}
      >
        <Plus className="mr-1 inline h-4 w-4" />
        家庭
      </button>
      <button
        type="button"
        className="rounded-full bg-personal px-4 py-3 text-sm font-semibold text-white shadow-lg"
        onClick={() => onSelect('personal')}
      >
        <Plus className="mr-1 inline h-4 w-4" />
        個人
      </button>
    </div>
  );
}

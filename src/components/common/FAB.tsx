import { Plus } from 'lucide-react';
import type { LedgerType } from '../../types';

interface FABProps {
  onSelect: (ledgerType: LedgerType) => void;
}

export function FAB({ onSelect }: FABProps) {
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

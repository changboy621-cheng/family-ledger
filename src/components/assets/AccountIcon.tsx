import { CreditCard, Landmark, PiggyBank, Wallet } from 'lucide-react';
import type { AccountKind } from '../../types';

const ICONS = { cash: Wallet, bank: Landmark, credit: CreditCard, other: PiggyBank } as const;

/** 帳戶種類圖示：柔色圓角方塊裡的線條圖示；共同帳戶用家庭綠、個人帳戶用個人藍。 */
export function AccountIcon({ kind, shared, size = 'md' }: { kind: AccountKind; shared: boolean; size?: 'sm' | 'md' }) {
  const Icon = ICONS[kind] ?? PiggyBank;
  const box = size === 'sm' ? 'h-8 w-8 rounded-lg' : 'h-10 w-10 rounded-xl';
  return (
    <span
      className={`grid shrink-0 place-items-center ${box} ${shared ? 'bg-familySoft text-family' : 'bg-personalSoft text-personal'}`}
      aria-hidden="true"
    >
      <Icon className={size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} />
    </span>
  );
}

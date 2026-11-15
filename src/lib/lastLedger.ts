import type { LedgerType } from '../types';

const LAST_LEDGER_KEY = 'familyLedger.lastLedgerType';

export function loadLastLedgerType(): LedgerType {
  try {
    return localStorage.getItem(LAST_LEDGER_KEY) === 'personal' ? 'personal' : 'family';
  } catch {
    return 'family';
  }
}

export function saveLastLedgerType(ledgerType: LedgerType) {
  try {
    localStorage.setItem(LAST_LEDGER_KEY, ledgerType);
  } catch {
    // 無法寫入（私密瀏覽等）就沿用預設，不影響記帳。
  }
}

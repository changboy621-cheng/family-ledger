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

const LAST_ACCOUNT_KEY = 'familyLedger.lastAccountId';

export function loadLastAccountId(): string | null {
  try {
    return localStorage.getItem(LAST_ACCOUNT_KEY);
  } catch {
    return null;
  }
}

export function saveLastAccountId(accountId: string) {
  try {
    localStorage.setItem(LAST_ACCOUNT_KEY, accountId);
  } catch {
    // 無法寫入就不記，下次不預選。
  }
}

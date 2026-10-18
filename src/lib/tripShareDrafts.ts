import { parseTripAmount, type FriendShare } from './trips';

// 記帳表單「幫朋友代墊」的草稿處理（純函式）。

/** 表單編輯中的代墊（金額還是字串）；保留 id 與還款狀態，編輯花費不會把「已還」洗掉。 */
export interface ShareDraft {
  id: string;
  name: string;
  amount: string;
  repaid_at: string | null;
  repaid_method: FriendShare['repaid_method'];
}

export function toShareDrafts(shares: FriendShare[] | undefined): ShareDraft[] {
  return (shares ?? []).map((share) => ({ ...share, amount: String(share.amount) }));
}

export function newShareDraftId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `share-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 把草稿轉成要存的代墊；有問題回傳錯誤訊息。
 * 規則：每位都要有名字與大於 0 的金額，代墊合計不能超過這筆花費。
 */
export function finalizeShareDrafts(
  drafts: ShareDraft[],
  currency: string,
  totalAmount: number
): { shares: FriendShare[] } | { error: string } {
  const shares: FriendShare[] = [];
  for (const draft of drafts) {
    const name = draft.name.trim();
    const amount = parseTripAmount(draft.amount, currency);
    if (!name && !draft.amount.trim()) continue; // 空白列直接略過
    if (!name) return { error: '請填寫代墊的朋友名字' };
    if (amount <= 0) return { error: `請填寫幫「${name}」代墊的金額` };
    shares.push({ id: draft.id, name, amount, repaid_at: draft.repaid_at, repaid_method: draft.repaid_method });
  }
  const sum = shares.reduce((total, share) => total + share.amount, 0);
  if (sum - totalAmount > 1e-9) return { error: '代墊合計不能超過這筆花費' };
  return { shares };
}

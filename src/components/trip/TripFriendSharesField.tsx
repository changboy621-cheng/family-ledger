import { useId } from 'react';
import { Plus, X } from 'lucide-react';
import { formatTripAmount, formatTwd, parseTripAmount } from '../../lib/trips';
import { newShareDraftId, type ShareDraft } from '../../lib/tripShareDrafts';

interface TripFriendSharesFieldProps {
  drafts: ShareDraft[];
  onChange: (drafts: ShareDraft[]) => void;
  currency: string;
  /** 這筆花費的原幣金額（已解析）。 */
  totalAmount: number;
  /** 換算新台幣用的匯率；無效時為 null。 */
  rate: number | null;
  /** 這趟用過的朋友名字，供快速帶入。 */
  knownNames: string[];
}

const inputClass = 'min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base';

// 記帳表單的「幫朋友代墊」：這筆裡有多少是替誰付的，之後朋友會還。旅行總花費只算自己負擔的部分。
export function TripFriendSharesField({ drafts, onChange, currency, totalAmount, rate, knownNames }: TripFriendSharesFieldProps) {
  const listId = useId();
  const sharedSum = drafts.reduce((sum, draft) => sum + parseTripAmount(draft.amount, currency), 0);
  const own = totalAmount - sharedSum;
  const over = own < -1e-9;
  const unusedNames = knownNames.filter((name) => !drafts.some((draft) => draft.name.trim() === name));

  function addFriend(name = '') {
    // 新的一位預設帶「還沒分出去的金額」：只幫一位朋友付全額時不用再打字。
    const remaining = parseTripAmount(String(totalAmount - sharedSum), currency); // 依幣別取整，≤ 0 時為 0
    onChange([
      ...drafts,
      { id: newShareDraftId(), name, amount: remaining > 0 ? String(remaining) : '', repaid_at: null, repaid_method: null }
    ]);
  }

  function update(id: string, patch: Partial<ShareDraft>) {
    onChange(drafts.map((draft) => (draft.id === id ? { ...draft, ...patch } : draft)));
  }

  if (drafts.length === 0) {
    return (
      <button
        type="button"
        className="flex items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600"
        onClick={() => addFriend()}
      >
        <Plus className="h-4 w-4" />
        幫朋友代墊（之後會還我）
      </button>
    );
  }

  return (
    <div className="grid gap-2 rounded-lg bg-amber-50 p-3">
      <p className="text-sm font-semibold text-slate-700">幫朋友代墊</p>
      <datalist id={listId}>
        {knownNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      {drafts.map((draft) => (
        <div key={draft.id} className="flex items-center gap-2">
          <input
            aria-label="朋友名字"
            className={`${inputClass} flex-1`}
            list={listId}
            placeholder="朋友名字"
            maxLength={20}
            value={draft.name}
            onChange={(event) => update(draft.id, { name: event.target.value })}
          />
          <input
            aria-label={`${draft.name || '朋友'}代墊金額`}
            className={`${inputClass} w-28 text-right`}
            inputMode="decimal"
            placeholder={currency}
            value={draft.amount}
            onChange={(event) => update(draft.id, { amount: event.target.value })}
          />
          {draft.repaid_at ? <span className="shrink-0 text-xs font-semibold text-family">已還</span> : null}
          <button
            type="button"
            aria-label={`移除${draft.name || '這位朋友'}`}
            className="shrink-0 p-1 text-slate-400 hover:text-red-500"
            onClick={() => onChange(drafts.filter((item) => item.id !== draft.id))}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        <button type="button" className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600" onClick={() => addFriend()}>
          ＋ 再加一位
        </button>
        {unusedNames.slice(0, 5).map((name) => (
          <button
            key={name}
            type="button"
            className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600"
            onClick={() => addFriend(name)}
          >
            ＋ {name}
          </button>
        ))}
      </div>

      <p className={`text-right text-xs font-semibold ${over ? 'text-red-500' : 'text-slate-600'}`}>
        {over
          ? '代墊合計超過這筆花費了'
          : `我們自己負擔 ${formatTripAmount(Math.max(own, 0), currency)}${
              rate && currency !== 'TWD' ? `（≈${formatTwd(Math.max(own, 0) * rate)}）` : ''
            }`}
      </p>
    </div>
  );
}

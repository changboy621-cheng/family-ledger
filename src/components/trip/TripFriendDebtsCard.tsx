import { useState } from 'react';
import { HandCoins } from 'lucide-react';
import { formatTripAmount, formatTwd, type FriendDebt, type FriendShareItem, type RepaidMethod } from '../../lib/trips';

interface TripFriendDebtsCardProps {
  debts: FriendDebt[];
  onRepaid: (item: FriendShareItem, method: RepaidMethod | null) => Promise<void>;
}

// 旅行頁「朋友代墊」：誰還欠多少、點「收到了」選現金或轉帳。還現金會加回手邊現金。
export function TripFriendDebtsCard({ debts, onRepaid }: TripFriendDebtsCardProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [choosingId, setChoosingId] = useState<string | null>(null);
  const [showRepaid, setShowRepaid] = useState(false);

  const outstandingTwd = debts.reduce((sum, debt) => sum + debt.outstandingTwd, 0);
  const repaidTwd = debts.reduce((sum, debt) => sum + debt.repaidTwd, 0);

  async function mark(item: FriendShareItem, method: RepaidMethod | null) {
    setBusyId(item.share.id);
    try {
      await onRepaid(item, method);
      setChoosingId(null);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4" aria-label="朋友代墊">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="flex items-center gap-2 font-bold text-slate-900">
          <HandCoins className="h-5 w-5 text-amber-500" />
          朋友代墊
        </h2>
        <span className={`text-sm font-semibold ${outstandingTwd > 0 ? 'text-amber-600' : 'text-family'}`}>
          {outstandingTwd > 0 ? `還沒還 ${formatTwd(outstandingTwd)}` : '都還清了 🎉'}
        </span>
      </div>

      <ul className="mt-3 grid gap-4">
        {debts
          .filter((debt) => debt.outstanding.length > 0)
          .map((debt) => (
            <li key={debt.name}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-semibold text-slate-900">{debt.name}</span>
                <span className="text-right">
                  <strong className="text-slate-900">{formatTwd(debt.outstandingTwd)}</strong>
                  <span className="block text-xs text-slate-400">
                    {debt.outstandingByCurrency.map((item) => formatTripAmount(item.amount, item.currency)).join('＋')}
                  </span>
                </span>
              </div>
              <ul className="mt-1 divide-y divide-slate-100">
                {debt.outstanding.map((item) => (
                  <li key={item.share.id} className="flex items-center gap-3 py-2 text-sm">
                    <span className="min-w-0 flex-1 truncate text-slate-500">
                      {item.expense.expense_date.slice(5).replace('-', '/')}・{item.expense.note || '代墊'}
                    </span>
                    <span className="shrink-0 font-semibold text-slate-700">
                      {formatTripAmount(item.share.amount, item.expense.currency)}
                    </span>
                    {choosingId === item.share.id ? (
                      <span className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          disabled={busyId === item.share.id}
                          className="rounded-full bg-family px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
                          onClick={() => void mark(item, 'cash')}
                        >
                          現金
                        </button>
                        <button
                          type="button"
                          disabled={busyId === item.share.id}
                          className="rounded-full bg-family px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
                          onClick={() => void mark(item, 'transfer')}
                        >
                          轉帳
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="shrink-0 rounded-full bg-familySoft px-3 py-1 text-xs font-semibold text-family"
                        onClick={() => setChoosingId(item.share.id)}
                      >
                        收到了
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
      </ul>

      {repaidTwd > 0 ? (
        <div className="mt-3 border-t border-slate-100 pt-2">
          <button type="button" className="text-xs font-semibold text-slate-500" onClick={() => setShowRepaid((value) => !value)}>
            已還 {formatTwd(repaidTwd)} {showRepaid ? '▲' : '▼'}
          </button>
          {showRepaid ? (
            <ul className="mt-1 divide-y divide-slate-100">
              {debts.flatMap((debt) =>
                debt.repaid.map((item) => (
                  <li key={item.share.id} className="flex items-center gap-3 py-2 text-sm text-slate-400">
                    <span className="min-w-0 flex-1 truncate">
                      {debt.name}・{item.expense.note || '代墊'}・{item.share.repaid_method === 'cash' ? '現金' : '轉帳'}
                    </span>
                    <span className="shrink-0">{formatTripAmount(item.share.amount, item.expense.currency)}</span>
                    <button
                      type="button"
                      disabled={busyId === item.share.id}
                      className="shrink-0 text-xs font-semibold text-slate-500 underline disabled:opacity-60"
                      onClick={() => void mark(item, null)}
                    >
                      改回未還
                    </button>
                  </li>
                ))
              )}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

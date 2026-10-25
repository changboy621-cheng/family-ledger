import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Transaction } from '../../types';
import { formatAmount } from '../../lib/currency';
import { getErrorMessage } from '../../lib/errors';
import { cashOnHand, guessTripCategory, pickTripForDate, tripCurrency } from '../../lib/trips';
import { useTripDetail, useTrips, type TripExpenseInput } from '../../hooks/useTrips';
import { useUIStore } from '../../store/uiStore';
import { Modal } from '../common/Modal';
import { TripExpenseForm } from './TripExpenseForm';

interface MoveToTripModalProps {
  transaction: Transaction;
  /** 刪除日常帳本裡原本那筆。 */
  onDeleteOriginal: (transactionId: string) => Promise<void>;
  /** 搬完（或放棄）都會呼叫。 */
  onClose: () => void;
  /** 搬移成功後呼叫（在 onClose 之前）。 */
  onMoved?: () => void;
}

// 記錯帳本時把一筆日常支出搬到某趟旅行：先在旅行新增一筆（可順便更正幣別與金額），
// 成功後再刪掉原本那筆。日期、備註、付款方式、付款人、消費地點都原樣帶過去。
export function MoveToTripModal({ transaction, onDeleteOriginal, onClose, onMoved }: MoveToTripModalProps) {
  const showToast = useUIStore((state) => state.showToast);
  const { trips, loading: tripsLoading } = useTrips();
  const [chosenTripId, setChosenTripId] = useState<string | null>(null);
  const tripId = chosenTripId ?? pickTripForDate(trips, transaction.transaction_date)?.id;
  const { trip, expenses, cashExchanges, loading, addExpense } = useTripDetail(tripId);
  const cashBalances = useMemo(() => cashOnHand(cashExchanges, expenses), [cashExchanges, expenses]);

  const prefill = useMemo<TripExpenseInput>(
    () => ({
      expense_date: transaction.transaction_date,
      amount: Number(transaction.amount),
      currency: transaction.currency,
      rate:
        transaction.currency === 'TWD'
          ? 1
          : (expenses.find((expense) => expense.currency === transaction.currency)?.rate ??
            tripCurrency(transaction.currency).hintRate),
      category: guessTripCategory(transaction.category?.name),
      payment_method: transaction.payment_method ?? 'cash',
      note: transaction.note ?? '',
      paid_by: transaction.owner_id,
      latitude: transaction.latitude ?? null,
      longitude: transaction.longitude ?? null,
      place_name: transaction.place_name ?? null
    }),
    [transaction, expenses]
  );

  async function handleSubmit(input: TripExpenseInput) {
    await addExpense(input);
    // 旅行那筆已經存好：就算刪原本那筆失敗也不要讓表單留著，避免再按一次變成重複兩筆。
    try {
      await onDeleteOriginal(transaction.id);
      showToast('已移到旅遊帳本');
    } catch (error) {
      showToast(`已加到旅遊帳本，但原本那筆刪除失敗，請手動刪除（${getErrorMessage(error)}）`, 'error');
    }
    onMoved?.();
  }

  if (tripsLoading || (tripId && (loading || !trip))) {
    return (
      <Modal onClose={onClose} title="移到旅遊帳本">
        <p className="py-6 text-center text-sm text-slate-500">載入旅行中…</p>
      </Modal>
    );
  }

  if (!trip) {
    return (
      <Modal onClose={onClose} title="移到旅遊帳本">
        <div className="grid gap-4">
          <h2 className="text-lg font-bold text-slate-900">移到旅遊帳本</h2>
          <p className="text-sm text-slate-600">還沒有任何旅行。請先到「旅遊」建立這趟旅行，再回來移帳。</p>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" className="rounded-lg bg-slate-100 px-4 py-3 font-semibold text-slate-600" onClick={onClose}>
              取消
            </button>
            <Link to="/trips" className="rounded-lg bg-family px-4 py-3 text-center font-semibold text-white" onClick={onClose}>
              去建立旅行
            </Link>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <TripExpenseForm
      // 換旅行時重新帶入（匯率、手邊現金跟著那趟旅行）。
      key={trip.id}
      trip={trip}
      expenses={expenses}
      cashBalances={cashBalances}
      prefill={prefill}
      heading="移到旅遊帳本"
      onSubmit={handleSubmit}
      onClose={onClose}
    >
      <label className="grid gap-2 text-sm font-medium text-slate-700">
        移到哪一趟旅行
        <select
          className="w-0 min-w-full rounded-lg border border-slate-300 px-3 py-3 text-base"
          value={trip.id}
          onChange={(event) => setChosenTripId(event.target.value)}
        >
          {trips.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}（{item.start_date} ~ {item.end_date}）
            </option>
          ))}
        </select>
      </label>
      <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
        原本記成 {formatAmount(Number(transaction.amount), transaction.currency)}。
        如果其實付的是 {trip.local_currency}，點下方「{trip.local_currency}」改幣別即可，金額數字不變、會用匯率換算成台幣。
        儲存後會從{transaction.ledger_type === 'family' ? '家庭' : '個人'}帳本刪除原本那筆。
      </p>
    </TripExpenseForm>
  );
}

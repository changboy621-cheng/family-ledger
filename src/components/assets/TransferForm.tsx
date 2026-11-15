import { useMemo, useState, type FormEvent } from 'react';
import type { Account } from '../../types';
import { getErrorMessage } from '../../lib/errors';
import { todayISO } from '../../lib/utils';
import type { TransferInput } from '../../hooks/useAccounts';
import { Modal } from '../common/Modal';

interface TransferFormProps {
  accounts: Account[];
  onSubmit: (input: TransferInput) => Promise<void>;
  onClose: () => void;
}

const fieldClass =
  'h-11 w-full rounded-lg border border-slate-300 bg-card px-3 text-slate-900 outline-none focus:border-action focus:ring-2 focus:ring-action/30';

/** 帳戶間轉帳：例如提款（銀行→現金）、繳卡費（銀行→信用卡）。只能在同幣別帳戶之間轉。 */
export function TransferForm({ accounts, onSubmit, onClose }: TransferFormProps) {
  const [fromId, setFromId] = useState(accounts[0]?.id ?? '');
  const from = accounts.find((account) => account.id === fromId);
  const targets = useMemo(
    () => accounts.filter((account) => account.id !== fromId && account.currency === from?.currency),
    [accounts, fromId, from?.currency]
  );
  const [toId, setToId] = useState('');
  const effectiveTo = targets.some((account) => account.id === toId) ? toId : targets[0]?.id ?? '';
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const value = Number(amount);
    if (!fromId || !effectiveTo) return setError('需要兩個同幣別的帳戶才能轉帳。');
    if (!Number.isFinite(value) || value <= 0) return setError('請輸入大於 0 的金額。');
    setSaving(true);
    setError('');
    try {
      await onSubmit({ from_account_id: fromId, to_account_id: effectiveTo, amount: value, transfer_date: date, note });
      onClose();
    } catch (submitError) {
      setError(getErrorMessage(submitError, '轉帳失敗，請稍後再試。'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="帳戶轉帳" onClose={onClose}>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-slate-900">帳戶轉帳</h2>
        <button className="rounded-lg px-3 py-2 text-slate-500 hover:bg-slate-100" type="button" onClick={onClose}>
          關閉
        </button>
      </div>
      <p className="mt-2 text-sm text-slate-500">提款、存錢、繳信用卡費都用轉帳記，不會算成收入或支出。</p>

      <form className="mt-5 grid gap-5" onSubmit={handleSubmit}>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          從
          <select className={fieldClass} value={fromId} onChange={(event) => setFromId(event.target.value)}>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}（{account.currency}）
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          到
          <select className={fieldClass} value={effectiveTo} onChange={(event) => setToId(event.target.value)} disabled={targets.length === 0}>
            {targets.length === 0 ? <option value="">沒有同幣別的其他帳戶</option> : null}
            {targets.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          金額
          <input
            className={`${fieldClass} text-right`}
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ''))}
            placeholder="0"
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          日期
          <input className={fieldClass} type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          備註
          <input className={fieldClass} value={note} onChange={(event) => setNote(event.target.value)} placeholder="例如：繳 11 月卡費" />
        </label>

        {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p> : null}

        <button className="h-12 rounded-lg bg-action font-semibold text-white disabled:opacity-60" type="submit" disabled={saving}>
          {saving ? '儲存中...' : '完成轉帳'}
        </button>
      </form>
    </Modal>
  );
}

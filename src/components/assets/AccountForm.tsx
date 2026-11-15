import { useState, type FormEvent } from 'react';
import type { Account, AccountKind, Currency } from '../../types';
import { ACCOUNT_KINDS } from '../../lib/accounts';
import { getErrorMessage } from '../../lib/errors';
import type { AccountInput } from '../../hooks/useAccounts';
import { Modal } from '../common/Modal';

interface AccountFormProps {
  initialAccount?: Account | null;
  onCreate: (input: AccountInput) => Promise<void>;
  onUpdate: (id: string, patch: Partial<Pick<Account, 'name' | 'kind' | 'opening_balance' | 'archived'>>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}

const inputClass =
  'h-11 w-full rounded-lg border border-slate-300 bg-card px-3 text-slate-900 outline-none focus:border-action focus:ring-2 focus:ring-action/30';
const chip = (on: boolean) =>
  `rounded-full px-4 py-2 text-sm font-semibold ${on ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`;

export function AccountForm({ initialAccount, onCreate, onUpdate, onDelete, onClose }: AccountFormProps) {
  const editing = Boolean(initialAccount);
  const [name, setName] = useState(initialAccount?.name ?? '');
  const [kind, setKind] = useState<AccountKind>(initialAccount?.kind ?? 'bank');
  const [currency, setCurrency] = useState<Currency>(initialAccount?.currency ?? 'TWD');
  const [opening, setOpening] = useState(initialAccount ? String(initialAccount.opening_balance) : '');
  const [shared, setShared] = useState(initialAccount ? initialAccount.owner_id === null : true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const amount = opening.trim() === '' ? 0 : Number(opening);
    if (!name.trim()) return setError('請輸入帳戶名稱。');
    if (!Number.isFinite(amount)) return setError('期初金額請輸入數字（信用卡欠款可輸入負數）。');
    setSaving(true);
    setError('');
    try {
      if (initialAccount) {
        await onUpdate(initialAccount.id, { name: name.trim(), kind, opening_balance: amount });
      } else {
        await onCreate({ name, kind, currency, opening_balance: amount, shared });
      }
      onClose();
    } catch (submitError) {
      setError(getErrorMessage(submitError, '儲存失敗，請稍後再試。'));
    } finally {
      setSaving(false);
    }
  }

  async function run(action: () => Promise<void>) {
    setSaving(true);
    try {
      await action();
      onClose();
    } catch (actionError) {
      setError(getErrorMessage(actionError, '操作失敗，請稍後再試。'));
      setSaving(false);
    }
  }

  return (
    <Modal title={editing ? '編輯帳戶' : '新增帳戶'} onClose={onClose}>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-slate-900">{editing ? '編輯帳戶' : '新增帳戶'}</h2>
        <button className="rounded-lg px-3 py-2 text-slate-500 hover:bg-slate-100" type="button" onClick={onClose}>
          關閉
        </button>
      </div>

      <form className="mt-5 grid gap-5" onSubmit={handleSubmit}>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          名稱
          <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：郵局、玉山信用卡、錢包" maxLength={40} />
        </label>

        <div className="grid gap-2">
          <span className="text-sm font-medium text-slate-700">種類</span>
          <div className="flex flex-wrap gap-2">
            {ACCOUNT_KINDS.map((option) => (
              <button key={option.value} type="button" className={chip(kind === option.value)} onClick={() => setKind(option.value)}>
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-2">
          <span className="text-sm font-medium text-slate-700">誰的帳戶</span>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={editing} className={`${chip(shared)} disabled:opacity-60`} onClick={() => setShared(true)}>
              家庭共同（兩人都看得到）
            </button>
            <button type="button" disabled={editing} className={`${chip(!shared)} disabled:opacity-60`} onClick={() => setShared(false)}>
              只有我
            </button>
          </div>
        </div>

        <div className="grid gap-2">
          <span className="text-sm font-medium text-slate-700">幣別</span>
          <div className="flex gap-2">
            {(['TWD', 'USD'] as Currency[]).map((code) => (
              <button key={code} type="button" disabled={editing} className={`${chip(currency === code)} disabled:opacity-60`} onClick={() => setCurrency(code)}>
                {code === 'TWD' ? '新台幣' : '美金'}
              </button>
            ))}
          </div>
          {editing ? <p className="text-xs text-slate-500">歸屬和幣別建立後不能改，避免舊帳對不上。</p> : null}
        </div>

        <label className="grid gap-2 text-sm font-medium text-slate-700">
          期初金額
          <input
            className={`${inputClass} text-right`}
            inputMode="decimal"
            value={opening}
            onChange={(event) => setOpening(event.target.value.replace(/[^0-9.-]/g, ''))}
            placeholder="0"
          />
          <span className="text-xs font-normal text-slate-500">
            {kind === 'credit' ? '信用卡目前還欠多少就輸入負數，例如 -3200。' : '建立帳戶這天的餘額；之後的記帳和轉帳會自動加減。'}
          </span>
        </label>

        {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p> : null}

        <button className="h-12 rounded-lg bg-action font-semibold text-white disabled:opacity-60" type="submit" disabled={saving}>
          {saving ? '儲存中...' : editing ? '更新帳戶' : '建立帳戶'}
        </button>

        {initialAccount ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={saving}
              className="h-11 rounded-lg border border-slate-300 font-semibold text-slate-700"
              onClick={() => void run(() => onUpdate(initialAccount.id, { archived: !initialAccount.archived }))}
            >
              {initialAccount.archived ? '取消封存' : '封存（不再使用）'}
            </button>
            <button
              type="button"
              disabled={saving}
              className="h-11 rounded-lg border border-red-200 font-semibold text-red-600"
              onClick={() => {
                if (window.confirm(`刪除「${initialAccount.name}」？記在這個帳戶的交易會保留，但不再算進任何帳戶，轉帳紀錄會一起刪除。`)) {
                  void run(() => onDelete(initialAccount.id));
                }
              }}
            >
              刪除帳戶
            </button>
          </div>
        ) : null}
      </form>
    </Modal>
  );
}

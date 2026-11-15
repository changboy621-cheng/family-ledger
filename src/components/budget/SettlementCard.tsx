import { useState, type FormEvent } from 'react';
import { ArrowRight, CheckCircle2, Scale, Trash2 } from 'lucide-react';
import type { Currency } from '../../types';
import { formatAmount } from '../../lib/currency';
import { getErrorMessage } from '../../lib/errors';
import { todayISO } from '../../lib/utils';
import { useSettlement } from '../../hooks/useSettlement';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { Modal } from '../common/Modal';

interface PendingSettle {
  from: string;
  to: string;
  amount: number;
  currency: Currency;
}

const fieldClass =
  'h-11 w-full rounded-lg border border-slate-300 bg-card px-3 text-slate-900 outline-none focus:border-action focus:ring-2 focus:ring-action/30';

/**
 * 首頁「分帳」卡：家庭帳本的支出各付一半，從共同帳戶付的不算，
 * 顯示誰該補誰多少；付完按「已結清」留紀錄，之後從零累計。
 */
export function SettlementCard() {
  const profile = useAuthStore((state) => state.profile);
  const showToast = useUIStore((state) => state.showToast);
  const { since, plans, records, members, status, settle, removeRecord, updateSince } = useSettlement();
  const [pending, setPending] = useState<PendingSettle | null>(null);
  const [editingSince, setEditingSince] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  if (members.length < 2) return null;

  const nameOf = (id: string) => (id === profile?.id ? '你' : members.find((member) => member.id === id)?.display_name ?? '家人');
  const sinceLabel = `${Number(since.slice(5, 7))}/${Number(since.slice(8, 10))}`;

  if (status === 'unavailable') {
    return (
      <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
        分帳功能還沒啟用：請先在 Supabase 的 SQL Editor 執行 <code className="font-semibold">016_family_settlement.sql</code>。
      </section>
    );
  }

  const transfers = plans.flatMap(({ currency, plan }) => plan.transfers.map((transfer) => ({ ...transfer, currency })));
  const twdPlan = plans.find((item) => item.currency === 'TWD')?.plan;

  return (
    <section className="rounded-xl border border-slate-200 bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-familySoft text-family" aria-hidden="true">
            <Scale className="h-[18px] w-[18px]" />
          </span>
          <div>
            <h2 className="font-bold text-slate-900">分帳</h2>
            <p className="text-xs text-slate-500">
              {sinceLabel} 起的家庭支出各付一半
              <button type="button" className="ml-1.5 font-semibold text-slate-700 underline underline-offset-2" onClick={() => setEditingSince(true)}>
                改起算日
              </button>
            </p>
          </div>
        </div>
      </div>

      {status === 'loading' ? (
        <p className="mt-4 text-sm text-slate-500">計算中…</p>
      ) : status === 'error' ? (
        <p className="mt-4 text-sm text-slate-600">分帳資料載入失敗，稍後再試。</p>
      ) : (
        <>
          {transfers.length === 0 ? (
            <p className="mt-4 flex items-center gap-2 font-semibold text-family">
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              目前打平，不用補錢
            </p>
          ) : (
            <ul className="mt-4 grid gap-2">
              {transfers.map((transfer) => (
                <li key={`${transfer.currency}-${transfer.from}-${transfer.to}`} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-3">
                  <span className="flex min-w-0 flex-1 items-center gap-1.5 font-semibold text-slate-900">
                    <span className="truncate">{nameOf(transfer.from)}</span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" aria-label="付給" />
                    <span className="truncate">{nameOf(transfer.to)}</span>
                  </span>
                  <span className="text-lg font-bold text-slate-900">{formatAmount(transfer.amount, transfer.currency)}</span>
                  <button
                    type="button"
                    className="h-9 shrink-0 rounded-full bg-action px-3 text-sm font-semibold text-white"
                    onClick={() => setPending(transfer)}
                  >
                    已結清
                  </button>
                </li>
              ))}
            </ul>
          )}

          {twdPlan && twdPlan.total > 0 ? (
            <p className="mt-3 text-xs text-slate-500">
              家庭支出共 {formatAmount(twdPlan.total, 'TWD')}，
              {twdPlan.members.map((member) => `${nameOf(member.memberId)}先付 ${formatAmount(member.paid, 'TWD')}`).join('、')}
              。從共同帳戶付的不算。
            </p>
          ) : null}

          {records.length > 0 ? (
            <div className="mt-3">
              <button type="button" className="text-sm font-semibold text-slate-700 underline underline-offset-2" onClick={() => setShowHistory((value) => !value)}>
                {showHistory ? '收起結清紀錄' : `結清紀錄（${records.length}）`}
              </button>
              {showHistory ? (
                <ul className="mt-2 divide-y divide-slate-100 text-sm">
                  {records.map((record) => (
                    <li key={record.id} className="flex items-center gap-3 py-2">
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-slate-900">
                          {nameOf(record.from_member)} → {nameOf(record.to_member)} {formatAmount(record.amount, record.currency)}
                        </span>
                        <span className="block truncate text-xs text-slate-500">
                          {record.settled_on}
                          {record.note ? ` · ${record.note}` : ''}
                        </span>
                      </span>
                      {record.created_by === profile?.id ? (
                        <button
                          type="button"
                          className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                          aria-label="刪除這筆結清紀錄"
                          onClick={() => {
                            if (!window.confirm('刪除這筆結清紀錄？差額會恢復成結清前的樣子。')) return;
                            removeRecord(record.id).catch((error) => showToast(getErrorMessage(error, '刪除失敗'), 'error'));
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </>
      )}

      {pending ? (
        <SettleModal
          pending={pending}
          fromName={nameOf(pending.from)}
          toName={nameOf(pending.to)}
          onClose={() => setPending(null)}
          onConfirm={async (amount, settledOn, note) => {
            await settle({ ...pending, amount, settledOn, note });
            showToast('已記下結清');
          }}
        />
      ) : null}

      {editingSince ? (
        <SinceModal
          since={since}
          onClose={() => setEditingSince(false)}
          onSave={async (date) => {
            await updateSince(date);
            showToast('起算日已更新');
          }}
        />
      ) : null}
    </section>
  );
}

function SettleModal({
  pending,
  fromName,
  toName,
  onClose,
  onConfirm
}: {
  pending: PendingSettle;
  fromName: string;
  toName: string;
  onClose: () => void;
  onConfirm: (amount: number, settledOn: string, note: string) => Promise<void>;
}) {
  const [amount, setAmount] = useState(String(pending.amount));
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return setError('請輸入大於 0 的金額。');
    setSaving(true);
    try {
      await onConfirm(value, date, note);
      onClose();
    } catch (submitError) {
      setError(getErrorMessage(submitError, '儲存失敗，請稍後再試。'));
      setSaving(false);
    }
  }

  return (
    <Modal title="記下結清" onClose={onClose}>
      <h2 className="text-xl font-bold text-slate-900">記下結清</h2>
      <p className="mt-2 text-sm text-slate-600">
        {fromName} 已付給 {toName}。可以只付一部分，剩下的會繼續累計。
      </p>
      <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          金額（{pending.currency}）
          <input className={`${fieldClass} text-right`} inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ''))} />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          日期
          <input className={fieldClass} type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          備註
          <input className={fieldClass} value={note} onChange={(event) => setNote(event.target.value)} placeholder="例如：轉帳、現金" />
        </label>
        {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p> : null}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="h-11 rounded-lg border border-slate-300 font-semibold text-slate-700" onClick={onClose}>
            取消
          </button>
          <button type="submit" disabled={saving} className="h-11 rounded-lg bg-action font-semibold text-white disabled:opacity-60">
            {saving ? '儲存中...' : '確認結清'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function SinceModal({ since, onClose, onSave }: { since: string; onClose: () => void; onSave: (date: string) => Promise<void> }) {
  const [date, setDate] = useState(since);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  return (
    <Modal title="分帳起算日" onClose={onClose}>
      <h2 className="text-xl font-bold text-slate-900">分帳從哪天開始算</h2>
      <p className="mt-2 text-sm text-slate-600">這天以前的家庭支出和結清紀錄都不算。兩人共用同一個起算日。</p>
      <form
        className="mt-5 grid gap-4"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!date) return setError('請選擇日期。');
          setSaving(true);
          try {
            await onSave(date);
            onClose();
          } catch (saveError) {
            setError(getErrorMessage(saveError, '儲存失敗，請稍後再試。'));
            setSaving(false);
          }
        }}
      >
        <input className={fieldClass} type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p> : null}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="h-11 rounded-lg border border-slate-300 font-semibold text-slate-700" onClick={onClose}>
            取消
          </button>
          <button type="submit" disabled={saving} className="h-11 rounded-lg bg-action font-semibold text-white disabled:opacity-60">
            {saving ? '儲存中...' : '儲存'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

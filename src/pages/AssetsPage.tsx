import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, ChevronRight, Plus, Trash2 } from 'lucide-react';
import type { Account } from '../types';
import { formatAmount } from '../lib/currency';
import { accountKindLabel, netWorthSeries, recentMonths } from '../lib/accounts';
import { getErrorMessage } from '../lib/errors';
import { currentYearMonth } from '../lib/utils';
import { useAccounts } from '../hooks/useAccounts';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import { AccountIcon } from '../components/assets/AccountIcon';
import { AccountForm } from '../components/assets/AccountForm';
import { TransferForm } from '../components/assets/TransferForm';
import { NetWorthChart } from '../components/assets/NetWorthChart';

export function AssetsPage() {
  const profile = useAuthStore((state) => state.profile);
  const showToast = useUIStore((state) => state.showToast);
  const {
    accounts,
    activeAccounts,
    flows,
    transfers,
    balances,
    netWorth,
    status,
    refresh,
    createAccount,
    updateAccount,
    deleteAccount,
    createTransfer,
    deleteTransfer
  } = useAccounts();
  const [editing, setEditing] = useState<Account | null>(null);
  const [creating, setCreating] = useState(false);
  const [transferring, setTransferring] = useState(false);

  // 進資產頁一律重抓：記帳後餘額要是最新的。
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const series = useMemo(() => netWorthSeries(accounts, flows, recentMonths(currentYearMonth(), 12), 'TWD'), [accounts, flows]);
  const debt = useMemo(
    () =>
      accounts
        .filter((account) => account.currency === 'TWD')
        .reduce((sum, account) => sum + Math.min(0, balances.get(account.id) ?? 0), 0),
    [accounts, balances]
  );
  const shared = activeAccounts.filter((account) => account.owner_id === null);
  const mine = activeAccounts.filter((account) => account.owner_id !== null);
  const archived = accounts.filter((account) => account.archived);
  const nameOf = (id: string) => accounts.find((account) => account.id === id)?.name ?? '（看不到的帳戶）';

  if (status === 'unavailable') {
    return (
      <div className="grid gap-5">
        <h1 className="pt-2 text-3xl font-extrabold tracking-tight text-slate-900">資產</h1>
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          資產功能還沒啟用：請先在 Supabase 的 SQL Editor 執行 <code className="font-semibold">015_accounts.sql</code>，再重新整理這一頁。
        </section>
      </div>
    );
  }

  function renderGroup(title: string, list: Account[], hint: string) {
    return (
      <section className="grid gap-2">
        <h2 className="px-1 text-sm font-semibold text-slate-500">{title}</h2>
        {list.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-card p-4 text-sm text-slate-500">{hint}</p>
        ) : (
          <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-card shadow-sm">
            {list.map((account) => {
              const balance = balances.get(account.id) ?? 0;
              const owing = account.kind === 'credit' && balance < 0;
              return (
                <li key={account.id}>
                  <button type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50" onClick={() => setEditing(account)}>
                    <AccountIcon kind={account.kind} shared={account.owner_id === null} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-slate-900">{account.name}</span>
                      <span className="block text-xs text-slate-500">
                        {accountKindLabel(account.kind)}
                        {account.currency !== 'TWD' ? ` · ${account.currency}` : ''}
                      </span>
                    </span>
                    <span className={`text-right font-bold ${balance < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                      {owing ? `欠 ${formatAmount(-balance, account.currency)}` : formatAmount(balance, account.currency)}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    );
  }

  return (
    <div className="grid gap-5">
      <header className="flex items-center justify-between gap-3 pt-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">資產</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex h-11 items-center gap-1.5 rounded-full border border-slate-200 bg-card px-4 text-sm font-semibold text-slate-700 shadow-sm disabled:opacity-50"
            onClick={() => setTransferring(true)}
            disabled={activeAccounts.length < 2}
          >
            <ArrowLeftRight className="h-4 w-4" />
            轉帳
          </button>
          <button
            type="button"
            className="inline-flex h-11 items-center gap-1 rounded-full bg-action px-4 text-sm font-semibold text-white shadow"
            onClick={() => setCreating(true)}
          >
            <Plus className="h-4 w-4" />
            新帳戶
          </button>
        </div>
      </header>

      {status === 'error' ? (
        <section className="rounded-xl border border-red-200 bg-card p-4 text-sm text-slate-600 shadow-sm">
          帳戶載入失敗。
          <button type="button" className="ml-2 font-semibold text-action" onClick={() => void refresh()}>
            重試
          </button>
        </section>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-card p-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-600">淨資產</p>
        <p className={`mt-2 text-4xl font-extrabold tracking-tight ${netWorth.TWD < 0 ? 'text-red-600' : 'text-slate-900'}`}>
          {formatAmount(netWorth.TWD, 'TWD')}
        </p>
        {netWorth.USD !== 0 ? <p className="mt-1 text-lg font-semibold text-slate-700">{formatAmount(netWorth.USD, 'USD')}</p> : null}
        {debt < 0 ? <p className="mt-2 text-sm text-slate-500">其中信用卡等負債 {formatAmount(-debt, 'TWD')}</p> : null}
        <p className="mt-2 text-xs text-slate-500">個人帳戶只有你看得到，所以兩人看到的淨資產可能不同。</p>
      </section>

      {accounts.length > 0 ? <NetWorthChart points={series} currency="TWD" /> : null}

      {renderGroup('家庭共同帳戶', shared, '還沒有共同帳戶。家用現金、共同存款可以建在這裡。')}
      {renderGroup('我的帳戶', mine, '還沒有個人帳戶。只有你看得到。')}

      {archived.length > 0 ? renderGroup('已封存', archived, '') : null}

      {transfers.length > 0 ? (
        <section className="grid gap-2">
          <h2 className="px-1 text-sm font-semibold text-slate-500">最近轉帳</h2>
          <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-card shadow-sm">
            {transfers.slice(0, 15).map((transfer) => (
              <li key={transfer.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-slate-900">
                    {nameOf(transfer.from_account_id)} → {nameOf(transfer.to_account_id)}
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    {transfer.transfer_date}
                    {transfer.note ? ` · ${transfer.note}` : ''}
                  </span>
                </span>
                <span className="font-bold text-slate-900">
                  {formatAmount(transfer.amount, accounts.find((account) => account.id === transfer.from_account_id)?.currency ?? 'TWD')}
                </span>
                {transfer.created_by === profile?.id ? (
                  <button
                    type="button"
                    className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                    aria-label="刪除轉帳"
                    onClick={() => {
                      if (!window.confirm('刪除這筆轉帳？兩邊帳戶的餘額會一起還原。')) return;
                      deleteTransfer(transfer.id).catch((error) => showToast(getErrorMessage(error, '刪除失敗'), 'error'));
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {creating || editing ? (
        <AccountForm
          initialAccount={editing}
          onCreate={async (input) => {
            await createAccount(input);
            showToast('帳戶已建立');
          }}
          onUpdate={async (id, patch) => {
            await updateAccount(id, patch);
            showToast('帳戶已更新');
          }}
          onDelete={async (id) => {
            await deleteAccount(id);
            showToast('帳戶已刪除');
          }}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      ) : null}

      {transferring ? (
        <TransferForm
          accounts={activeAccounts}
          onSubmit={async (input) => {
            await createTransfer(input);
            showToast('轉帳已記下');
          }}
          onClose={() => setTransferring(false)}
        />
      ) : null}
    </div>
  );
}

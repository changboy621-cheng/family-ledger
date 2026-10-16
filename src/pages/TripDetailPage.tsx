import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Banknote, Download, Pencil, Plus, Trash2 } from 'lucide-react';
import { useTripDetail } from '../hooks/useTrips';
import { useFamilyMembers } from '../hooks/useFamilyMembers';
import {
  cashOnHand,
  formatRate,
  formatTripAmount,
  formatTwd,
  summarizeTrip,
  toTwd,
  tripCategory,
  tripExpensesToCsv,
  type TripCashExchange,
  type TripExpense
} from '../lib/trips';
import { paymentMethodLabel } from '../lib/constants';
import { getErrorMessage } from '../lib/errors';
import { useUIStore } from '../store/uiStore';
import { TripCashExchangeForm } from '../components/trip/TripCashExchangeForm';
import { TripExpenseForm } from '../components/trip/TripExpenseForm';
import { TripForm } from '../components/trip/TripForm';

export function TripDetailPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const showToast = useUIStore((state) => state.showToast);
  const {
    trip,
    expenses,
    cashExchanges,
    loading,
    error,
    reload,
    addExpense,
    updateExpense,
    deleteExpense,
    addCashExchange,
    updateCashExchange,
    deleteCashExchange,
    updateTrip,
    deleteTrip
  } = useTripDetail(tripId);
  const { members } = useFamilyMembers();
  const [editing, setEditing] = useState<TripExpense | null>(null);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showTripForm, setShowTripForm] = useState(false);
  const [showExchangeForm, setShowExchangeForm] = useState(false);
  const [editingExchange, setEditingExchange] = useState<TripCashExchange | null>(null);

  const summary = useMemo(() => (trip ? summarizeTrip(trip, expenses) : null), [trip, expenses]);
  const cash = useMemo(() => cashOnHand(cashExchanges, expenses), [cashExchanges, expenses]);
  const memberName = (id: string | null | undefined) => members.find((member) => member.id === id)?.display_name ?? '';

  const grouped = useMemo(() => {
    const map = new Map<string, TripExpense[]>();
    for (const expense of expenses) map.set(expense.expense_date, [...(map.get(expense.expense_date) ?? []), expense]);
    return [...map.entries()];
  }, [expenses]);

  if (loading) return <p className="text-sm text-slate-400">載入中…</p>;

  if (error || !trip || !summary) {
    return (
      <div className="grid gap-3">
        <Link to="/trips" className="text-sm font-semibold text-family">
          ← 回旅行清單
        </Link>
        <section className="rounded-xl border border-red-200 bg-white p-4 text-sm text-slate-600">
          {error ? '旅行載入失敗。' : '找不到這趟旅行。'}
          {error ? (
            <button type="button" className="ml-2 font-semibold text-family" onClick={() => void reload()}>
              重試
            </button>
          ) : null}
        </section>
      </div>
    );
  }

  async function handleDeleteExpense(expense: TripExpense) {
    if (!window.confirm(`刪除這筆 ${formatTripAmount(expense.amount, expense.currency)}？`)) return;
    try {
      await deleteExpense(expense.id);
      showToast('已刪除');
    } catch (err) {
      showToast(getErrorMessage(err, '刪除失敗，請稍後再試。'), 'error');
    }
  }

  async function handleDeleteExchange(exchange: TripCashExchange) {
    if (!window.confirm(`刪除這筆換匯 ${formatTripAmount(exchange.amount, exchange.currency)}？`)) return;
    try {
      await deleteCashExchange(exchange.id);
      showToast('已刪除');
    } catch (err) {
      showToast(getErrorMessage(err, '刪除失敗，請稍後再試。'), 'error');
    }
  }

  async function handleDeleteTrip() {
    if (!window.confirm(`刪除「${trip?.name}」與其中 ${expenses.length} 筆花費？此動作無法復原。`)) return;
    try {
      await deleteTrip();
      showToast('已刪除旅行');
      navigate('/trips', { replace: true });
    } catch (err) {
      showToast(getErrorMessage(err, '刪除失敗，請稍後再試。'), 'error');
    }
  }

  function handleExport() {
    if (!trip) return;
    const blob = new Blob(['﻿' + tripExpensesToCsv(expenses, memberName)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${trip.name}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const overBudget = summary.budgetLeftTwd !== null && summary.budgetLeftTwd < 0;

  return (
    <div className="grid gap-5 pb-16">
      <header className="grid gap-2">
        <Link to="/trips" className="flex items-center gap-1 text-sm font-semibold text-family">
          <ArrowLeft className="h-4 w-4" />
          旅行清單
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold text-slate-900">{trip.name}</h1>
            <p className="mt-1 text-xs text-slate-500">
              {trip.destination ? `${trip.destination}・` : ''}
              {trip.start_date} ~ {trip.end_date}（{summary.days} 天）・1 {trip.local_currency} ≈ NT${formatRate(trip.rate)}
            </p>
          </div>
          <div className="flex shrink-0 gap-1">
            <button type="button" aria-label="編輯旅行" className="rounded-lg bg-white p-2 text-slate-500" onClick={() => setShowTripForm(true)}>
              <Pencil className="h-4 w-4" />
            </button>
            <button type="button" aria-label="匯出 CSV" disabled={expenses.length === 0} className="rounded-lg bg-white p-2 text-slate-500 disabled:opacity-40" onClick={handleExport}>
              <Download className="h-4 w-4" />
            </button>
            <button type="button" aria-label="刪除旅行" className="rounded-lg bg-white p-2 text-red-500" onClick={() => void handleDeleteTrip()}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-500">總花費（折合新台幣）</p>
        <p className="mt-1 text-3xl font-bold text-slate-900">{formatTwd(summary.totalTwd)}</p>
        <p className="mt-1 text-xs text-slate-500">
          共 {summary.count} 筆・平均每天 {formatTwd(summary.perDayTwd)}
        </p>
        {summary.byCurrency.length > 0 ? (
          <p className="mt-2 text-xs text-slate-500">
            {summary.byCurrency.map((item) => formatTripAmount(item.amount, item.currency)).join('　＋　')}
          </p>
        ) : null}
        {summary.budgetUsed !== null && summary.budgetLeftTwd !== null ? (
          <div className="mt-3">
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${overBudget ? 'bg-red-500' : 'bg-family'}`}
                style={{ width: `${Math.min(100, Math.round(summary.budgetUsed * 100))}%` }}
              />
            </div>
            <p className={`mt-1 text-xs font-semibold ${overBudget ? 'text-red-500' : 'text-slate-500'}`}>
              預算 {formatTwd(trip.budget_twd ?? 0)}・{overBudget ? `超支 ${formatTwd(-summary.budgetLeftTwd)}` : `還剩 ${formatTwd(summary.budgetLeftTwd)}`}
            </p>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-bold text-slate-900">
            <Banknote className="h-5 w-5 text-family" />
            手邊現金
          </h2>
          <button
            type="button"
            className="rounded-full bg-familySoft px-3 py-1.5 text-sm font-semibold text-family"
            onClick={() => setShowExchangeForm(true)}
          >
            ＋ 換匯
          </button>
        </div>
        {cash.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">記下換了多少外幣現金，用「現金」記的花費會自動扣掉，隨時知道還剩多少。</p>
        ) : (
          <ul className="mt-3 grid gap-4">
            {cash.map((balance) => {
              const negative = balance.remaining < 0;
              const ratio = balance.exchanged > 0 ? Math.max(0, balance.remaining) / balance.exchanged : 0;
              return (
                <li key={balance.currency}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className={`text-2xl font-bold ${negative ? 'text-red-500' : 'text-slate-900'}`}>
                      {formatTripAmount(balance.remaining, balance.currency)}
                    </span>
                    <span className="text-xs text-slate-400">剩 {Math.round(ratio * 100)}%</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${ratio < 0.2 ? 'bg-amber-500' : 'bg-family'}`}
                      style={{ width: `${Math.round(ratio * 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    換了 {formatTripAmount(balance.exchanged, balance.currency)}（{formatTwd(balance.costTwd)}）・現金花了{' '}
                    {formatTripAmount(balance.spent, balance.currency)}
                  </p>
                  {negative ? (
                    <p className="mt-1 text-xs font-semibold text-red-500">現金花費比換匯多，可能漏記一筆換匯，或有花費其實是刷卡。</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        {cashExchanges.length > 0 ? (
          <ul className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
            {cashExchanges.map((exchange) => (
              <li key={exchange.id} className="flex items-center gap-3 py-2 text-sm">
                <button type="button" className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left" onClick={() => setEditingExchange(exchange)}>
                  <span className="min-w-0 truncate text-slate-500">
                    {exchange.exchange_date}
                    {exchange.note ? `・${exchange.note}` : ''}
                  </span>
                  <span className="shrink-0 font-semibold text-slate-700">＋{formatTripAmount(exchange.amount, exchange.currency)}</span>
                </button>
                <button type="button" aria-label="刪除這筆換匯" className="shrink-0 p-1 text-slate-300 hover:text-red-500" onClick={() => void handleDeleteExchange(exchange)}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {summary.byCategory.length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-bold text-slate-900">花在哪</h2>
          <ul className="mt-3 grid gap-3">
            {summary.byCategory.map((item) => (
              <li key={item.category.key}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-slate-700">
                    {item.category.icon} {item.category.label}
                    <span className="ml-2 text-xs font-normal text-slate-400">{item.count} 筆</span>
                  </span>
                  <span className="text-slate-900">
                    {formatTwd(item.twd)}
                    <span className="ml-2 text-xs text-slate-400">{Math.round(item.ratio * 100)}%</span>
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-family" style={{ width: `${Math.round(item.ratio * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="grid gap-3">
        <h2 className="font-bold text-slate-900">明細</h2>
        {expenses.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            還沒有花費，按右下角「＋」記第一筆。
          </p>
        ) : null}
        {grouped.map(([date, rows]) => {
          const dayTotal = rows.reduce((sum, row) => sum + toTwd(row), 0);
          return (
            <div key={date} className="rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2 text-xs font-semibold text-slate-500">
                <span>{date}</span>
                <span>{formatTwd(dayTotal)}</span>
              </div>
              <ul>
                {rows.map((expense) => {
                  const category = tripCategory(expense.category);
                  return (
                    <li key={expense.id} className="flex items-center gap-3 px-4 py-3">
                      <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setEditing(expense)}>
                        <span className="text-2xl">{category.icon}</span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-slate-900">{expense.note || category.label}</span>
                          <span className="text-xs text-slate-400">
                            {[category.label, paymentMethodLabel(expense.payment_method), memberName(expense.paid_by)]
                              .filter(Boolean)
                              .join('・')}
                          </span>
                        </span>
                      </button>
                      <span className="shrink-0 text-right">
                        <strong className="block text-slate-900">{formatTripAmount(expense.amount, expense.currency)}</strong>
                        {expense.currency !== 'TWD' ? <span className="text-xs text-slate-400">{formatTwd(toTwd(expense))}</span> : null}
                      </span>
                      <button type="button" aria-label="刪除這筆" className="shrink-0 p-1 text-slate-300 hover:text-red-500" onClick={() => void handleDeleteExpense(expense)}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </section>

      <button
        type="button"
        aria-label="新增旅行花費"
        className="fixed bottom-24 right-4 z-20 rounded-full bg-family px-5 py-4 text-white shadow-lg lg:bottom-6"
        onClick={() => setShowExpenseForm(true)}
      >
        <Plus className="h-5 w-5" />
      </button>

      {showExpenseForm ? (
        <TripExpenseForm
          trip={trip}
          expenses={expenses}
          cashBalances={cash}
          onClose={() => setShowExpenseForm(false)}
          onSubmit={async (input) => {
            await addExpense(input);
            showToast('已記一筆');
          }}
        />
      ) : null}

      {editing ? (
        <TripExpenseForm
          trip={trip}
          expenses={expenses}
          cashBalances={cash}
          initialExpense={editing}
          onClose={() => setEditing(null)}
          onSubmit={async (input) => {
            await updateExpense(editing.id, input);
            showToast('已更新');
          }}
        />
      ) : null}

      {showExchangeForm ? (
        <TripCashExchangeForm
          trip={trip}
          exchanges={cashExchanges}
          onClose={() => setShowExchangeForm(false)}
          onSubmit={async (input) => {
            await addCashExchange(input);
            showToast('已記換匯');
          }}
        />
      ) : null}

      {editingExchange ? (
        <TripCashExchangeForm
          trip={trip}
          exchanges={cashExchanges}
          initialExchange={editingExchange}
          onClose={() => setEditingExchange(null)}
          onSubmit={async (input) => {
            await updateCashExchange(editingExchange.id, input);
            showToast('已更新');
          }}
        />
      ) : null}

      {showTripForm ? (
        <TripForm
          initialTrip={trip}
          onClose={() => setShowTripForm(false)}
          onSubmit={async (input) => {
            await updateTrip(input);
            showToast('已更新旅行');
          }}
        />
      ) : null}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { Currency, LedgerType, Transaction, TransactionType } from '../../types';
import type { TransactionUpdateInput } from '../../hooks/useTransactions';
import { useTransactionSearch, type SearchMode } from '../../hooks/useTransactionSearch';
import { useFamilyMembers } from '../../hooks/useFamilyMembers';
import { useReferenceStore } from '../../store/referenceStore';
import { useUIStore } from '../../store/uiStore';
import { formatAmount, CURRENCIES } from '../../lib/currency';
import { getErrorMessage } from '../../lib/errors';
import { todayISO } from '../../lib/utils';
import {
  addRecentSearch,
  filterByPeriod,
  filterSearchResults,
  groupByMonth,
  loadStringList,
  matchCategoryIds,
  recentSearchKey,
  saveStringList,
  sumByCurrency,
  SEARCH_RESULT_LIMIT,
  type Period,
  type SearchFilters
} from '../../lib/search';
import { TransactionItem } from './TransactionItem';
import { TransactionForm } from './TransactionForm';

export interface CategoryDetailTarget {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
}

interface TransactionSearchModalProps {
  ledgerType: LedgerType;
  /** 有值＝分類明細模式；null/undefined＝關鍵字搜尋模式。 */
  category?: CategoryDetailTarget | null;
  onClose: () => void;
  onUpdate: (input: TransactionUpdateInput) => Promise<void>;
  onDelete: (transactionId: string) => Promise<void>;
}

const PERIODS: { value: Period; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: '3m', label: '近3個月' },
  { value: '6m', label: '近6個月' },
  { value: 'year', label: '今年' }
];

const DEBOUNCE_MS = 300;

/** 漸層玻璃卡片的共用樣式（U 方案）。 */
const glassCard = 'rounded-xl border border-white/80 bg-white/70 p-3 backdrop-blur';
const chipBase = 'rounded-full px-3 py-2 text-sm font-semibold transition';
const chipOff = 'border border-white/80 bg-white/60 text-slate-600 backdrop-blur';
const chipOn = 'bg-slate-900 text-white';

/** 淨額摘要文字：只列非零幣別，收入為正、支出為負。 */
function totalsText(totals: ReturnType<typeof sumByCurrency>): string {
  const parts = CURRENCIES.filter((currency) => totals[currency] !== 0).map((currency) => {
    const value = totals[currency];
    const sign = value > 0 ? '+' : '-';
    return `${sign}${formatAmount(Math.abs(value), currency)}`;
  });
  return parts.length > 0 ? ` · 合計 ${parts.join('、')}` : '';
}

export function TransactionSearchModal({
  ledgerType,
  category = null,
  onClose,
  onUpdate,
  onDelete
}: TransactionSearchModalProps) {
  const isFamily = ledgerType === 'family';
  const showToast = useUIStore((state) => state.showToast);
  const allCategories = useReferenceStore((state) => state.categories);
  const { members } = useFamilyMembers();

  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>(() =>
    loadStringList(localStorage, recentSearchKey(ledgerType))
  );
  const [typeFilter, setTypeFilter] = useState<TransactionType | 'all'>('all');
  const [currencyFilter, setCurrencyFilter] = useState<Currency | 'all'>('all');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');
  const [period, setPeriod] = useState<Period>('all');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // 輸入 300ms 後才觸發查詢，避免每個字元都打 Supabase。
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedKeyword(keyword), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [keyword]);

  // Esc 關閉＋鎖背景捲動（比照 Modal；全螢幕覆蓋層同樣需要）。
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    const body = document.body;
    const prevOverflow = body.style.overflow;
    body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      body.style.overflow = prevOverflow;
    };
    // onClose 以 render 當下的值即可（LedgerPage 傳入的為穩定 setState 包裝）。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mode: SearchMode | null = useMemo(() => {
    if (category) return { kind: 'category', categoryId: category.categoryId };
    const trimmed = debouncedKeyword.trim();
    if (!trimmed) return null;
    return { kind: 'keyword', keyword: trimmed, categoryIds: matchCategoryIds(allCategories, trimmed) };
  }, [category, debouncedKeyword, allCategories]);

  const { results, loading, error, refetch } = useTransactionSearch(ledgerType, mode);

  // 查詢成功且有結果時記錄最近搜尋（僅關鍵字模式）。
  const lastSavedRef = useRef('');
  useEffect(() => {
    if (mode?.kind !== 'keyword' || loading || error || results.length === 0) return;
    if (lastSavedRef.current === mode.keyword) return;
    lastSavedRef.current = mode.keyword;
    setRecentSearches((current) => {
      const next = addRecentSearch(current, mode.keyword);
      saveStringList(localStorage, recentSearchKey(ledgerType), next);
      return next;
    });
  }, [mode, loading, error, results, ledgerType]);

  const filtered = useMemo(() => {
    const filters: SearchFilters = { type: typeFilter, currency: currencyFilter, ownerId: ownerFilter };
    const base = filterSearchResults(results, filters);
    return category ? filterByPeriod(base, period, todayISO()) : base;
  }, [results, typeFilter, currencyFilter, ownerFilter, category, period]);

  const groups = useMemo(() => groupByMonth(filtered), [filtered]);
  const totals = useMemo(() => sumByCurrency(filtered), [filtered]);

  async function handleEditSubmit(input: Omit<TransactionUpdateInput, 'id'>) {
    if (!editingTransaction) return;
    await onUpdate({ id: editingTransaction.id, ...input });
    showToast('交易已更新');
    setEditingTransaction(null);
    await refetch();
  }

  async function handleDelete(transactionId: string) {
    if (!window.confirm('確定刪除這筆交易？')) return;
    try {
      await onDelete(transactionId);
      showToast('交易已刪除');
      await refetch();
    } catch (deleteError) {
      showToast(getErrorMessage(deleteError, '刪除失敗，請稍後再試。'), 'error');
    }
  }

  const hasQuery = category != null || mode != null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={category ? `${category.categoryName} 分類明細` : '搜尋交易'}
      className={`fixed inset-0 z-40 overflow-y-auto bg-gradient-to-br ${
        isFamily ? 'from-emerald-100 via-teal-50 to-rose-100' : 'from-sky-100 via-indigo-50 to-rose-100'
      }`}
    >
      <div className="mx-auto grid max-w-3xl gap-4 p-4 pb-24">
        <header className="flex items-center gap-3">
          {category ? (
            <h1 className="flex flex-1 items-center gap-2 text-xl font-bold text-slate-900">
              <span aria-hidden="true">{category.categoryIcon}</span>
              {category.categoryName}
              <span className="text-sm font-medium text-slate-500">跨全部月份</span>
            </h1>
          ) : (
            <div className={`flex flex-1 items-center gap-2 ${glassCard}`}>
              <Search className="h-5 w-5 shrink-0 text-slate-500" aria-hidden="true" />
              <input
                type="search"
                role="searchbox"
                className="w-full bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400"
                placeholder="搜尋備註或分類名稱…"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                autoFocus
              />
            </div>
          )}
          <button
            type="button"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/80 bg-white/70 text-slate-600 backdrop-blur"
            onClick={onClose}
            aria-label="關閉"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* 最近搜尋：搜尋模式、輸入為空時顯示 */}
        {!category && !keyword.trim() && recentSearches.length > 0 ? (
          <section className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">最近搜尋</span>
            {recentSearches.map((item) => (
              <button
                key={item}
                type="button"
                className={`${chipBase} ${chipOff}`}
                onClick={() => setKeyword(item)}
              >
                {item}
              </button>
            ))}
          </section>
        ) : null}

        {/* 篩選列 */}
        {hasQuery ? (
          <section className="grid gap-2">
            {category ? (
              <div className="flex flex-wrap gap-2">
                {PERIODS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`${chipBase} ${period === option.value ? chipOn : chipOff}`}
                    onClick={() => setPeriod(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['all', '全部'],
                    ['expense', '支出'],
                    ['income', '收入']
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`${chipBase} ${typeFilter === value ? chipOn : chipOff}`}
                    onClick={() => setTypeFilter(value)}
                  >
                    {label}
                  </button>
                ))}
                {(['all', ...CURRENCIES] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`${chipBase} ${currencyFilter === value ? chipOn : chipOff}`}
                    onClick={() => setCurrencyFilter(value)}
                  >
                    {value === 'all' ? '全部幣別' : value}
                  </button>
                ))}
              </div>
            )}
            {isFamily && members.length > 1 ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={`${chipBase} ${ownerFilter === 'all' ? chipOn : chipOff}`}
                  onClick={() => setOwnerFilter('all')}
                >
                  全部成員
                </button>
                {members.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    className={`${chipBase} ${ownerFilter === member.id ? chipOn : chipOff}`}
                    onClick={() => setOwnerFilter(member.id)}
                  >
                    {member.display_name}
                  </button>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {/* 結果 */}
        {!hasQuery ? null : loading ? (
          <div className={`${glassCard} p-6 text-center text-slate-500`}>搜尋中...</div>
        ) : error ? (
          <div className={`${glassCard} p-6 text-center`}>
            <p className="text-sm text-slate-600">
              {typeof navigator !== 'undefined' && !navigator.onLine
                ? '目前離線，請連上網路後再試。'
                : '搜尋失敗，請稍後再試。'}
            </p>
            <button
              type="button"
              className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              onClick={() => void refetch()}
            >
              重試
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className={`${glassCard} border-dashed p-8 text-center text-slate-500`}>
            {category ? '這個分類還沒有交易。' : `找不到符合「${debouncedKeyword.trim()}」的交易。`}
          </div>
        ) : (
          <>
            <div className={`${glassCard} text-sm font-semibold text-slate-700`}>
              共 {filtered.length} 筆{totalsText(totals)}
              {results.length >= SEARCH_RESULT_LIMIT ? (
                <p className="mt-1 text-xs font-medium text-amber-700">
                  僅顯示最近 {SEARCH_RESULT_LIMIT} 筆，可加關鍵字縮小範圍。
                </p>
              ) : null}
            </div>
            {groups.map((group) => (
              <section key={group.yearMonth} className="grid gap-3">
                <h2 className="flex items-baseline justify-between px-1 text-sm font-bold text-slate-600">
                  {group.label}
                  <span className="text-xs font-semibold text-slate-500">{totalsText(group.totals).replace(' · 合計 ', '')}</span>
                </h2>
                <ul className="grid grid-cols-1 gap-3">
                  {group.items.map((transaction) => (
                    <TransactionItem
                      key={transaction.id}
                      transaction={transaction}
                      highlightKeyword={mode?.kind === 'keyword' ? mode.keyword : undefined}
                      onEdit={setEditingTransaction}
                      onDelete={(id) => void handleDelete(id)}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </>
        )}
      </div>

      {editingTransaction ? (
        <TransactionForm
          initialLedgerType={editingTransaction.ledger_type}
          initialTransaction={editingTransaction}
          onSubmit={handleEditSubmit}
          onClose={() => setEditingTransaction(null)}
        />
      ) : null}
    </div>
  );
}

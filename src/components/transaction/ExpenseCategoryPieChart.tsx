import { memo } from 'react';
import { formatAmount } from '../../lib/currency';
import { formatRatio, visibleCurrencies } from '../../lib/summaryView';
import type { CategoryExpenseSummary, Currency } from '../../types';
import type { CategoryDetailTarget } from './TransactionSearchModal';

interface ExpenseCategoryPieChartProps {
  items: CategoryExpenseSummary[];
  currencyFilter: Currency | 'all';
  title?: string;
  /** 傳入時圓餅／圖例可點（開分類明細）；未傳入維持純顯示。 */
  onSelectCategory?: (target: CategoryDetailTarget) => void;
}

/**
 * 類別配色：取自 dataviz 技能已驗證的 categorical 調色盤（固定順序、相鄰段落 CVD 可辨）。
 * 超出色盤的類別會折進「其他」，以中性灰呈現，故此處只需前 7 色。
 */
const SEGMENT_COLORS = [
  '#2a78d6', // blue
  '#eb6834', // orange
  '#1baf7a', // aqua
  '#eda100', // yellow
  '#e87ba4', // magenta
  '#008300', // green
  '#4a3aa7' // violet
];
const OTHER_COLOR = '#94a3b8'; // slate-400：折疊後的「其他」

const MAX_SEGMENTS = 8;
/** 相鄰段落之間留一點縫（pathLength 正規化為 100，故此值約等於 0.8% 圓周）。 */
const SEGMENT_GAP = 0.8;

interface Segment {
  key: string;
  name: string;
  icon: string;
  amount: number;
  ratio: number;
  color: string;
  /** 折疊而成的「其他」沒有單一分類，無法下鑽。 */
  categoryId?: string;
}

/** 把分類彙總攤成圓餅段落，超過上限時把尾端折進「其他」。 */
function buildSegments(items: CategoryExpenseSummary[], currency: Currency): { segments: Segment[]; total: number } {
  const withAmount = items.filter((item) => item.totals[currency] > 0);
  const total = withAmount.reduce((sum, item) => sum + item.totals[currency], 0);
  if (total <= 0) return { segments: [], total: 0 };

  const toSegment = (item: CategoryExpenseSummary, index: number): Segment => ({
    key: item.categoryId,
    categoryId: item.categoryId,
    name: item.categoryName,
    icon: item.categoryIcon,
    amount: item.totals[currency],
    ratio: item.totals[currency] / total,
    color: SEGMENT_COLORS[index] ?? OTHER_COLOR
  });

  if (withAmount.length <= MAX_SEGMENTS) {
    return { segments: withAmount.map(toSegment), total };
  }

  const head = withAmount.slice(0, MAX_SEGMENTS - 1).map(toSegment);
  const rest = withAmount.slice(MAX_SEGMENTS - 1);
  const restAmount = rest.reduce((sum, item) => sum + item.totals[currency], 0);
  return {
    segments: [
      ...head,
      { key: 'other', name: '其他', icon: '…', amount: restAmount, ratio: restAmount / total, color: OTHER_COLOR }
    ],
    total
  };
}

/** 甜甜圈圖：以 pathLength=100 讓 dash 直接吃百分比，相鄰段落留縫。 */
function Donut({ segments, total, currency }: { segments: Segment[]; total: number; currency: Currency }) {
  let offset = 0;
  return (
    <svg
      viewBox="0 0 120 120"
      className="h-40 w-40 shrink-0"
      role="img"
      aria-label={`支出分類圓餅圖，合計 ${formatAmount(total, currency)}`}
    >
      <circle cx="60" cy="60" r="48" fill="none" stroke="#f1f5f9" strokeWidth="20" />
      <g transform="rotate(-90 60 60)">
        {segments.map((segment) => {
          const length = segment.ratio * 100;
          const dash = Math.max(length - SEGMENT_GAP, 0.5);
          const circle = (
            <circle
              key={segment.key}
              cx="60"
              cy="60"
              r="48"
              fill="none"
              stroke={segment.color}
              strokeWidth="20"
              pathLength={100}
              strokeDasharray={`${dash} ${100 - dash}`}
              strokeDashoffset={-offset}
            >
              <title>{`${segment.name} ${formatAmount(segment.amount, currency)}（${formatRatio(segment.ratio)}）`}</title>
            </circle>
          );
          offset += length;
          return circle;
        })}
      </g>
      <text x="60" y="56" textAnchor="middle" className="fill-slate-500 text-[9px] font-semibold">
        本月支出
      </text>
      <text x="60" y="70" textAnchor="middle" className="fill-slate-900 text-[11px] font-bold">
        {formatAmount(total, currency)}
      </text>
    </svg>
  );
}

function ExpenseCategoryPieChartBase({
  items,
  currencyFilter,
  title = '本月支出圓餅圖',
  onSelectCategory
}: ExpenseCategoryPieChartProps) {
  const currencies = visibleCurrencies(currencyFilter);
  const hasData = items.some((item) => currencies.some((currency) => item.totals[currency] > 0));

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>

      {!hasData ? (
        <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">本月尚無支出分類資料。</p>
      ) : (
        <div className="mt-4 grid gap-6">
          {currencies.map((currency) => {
            const { segments, total } = buildSegments(items, currency);
            if (segments.length === 0) return null;

            return (
              <div key={currency} className="grid gap-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{currency}</p>
                <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
                  <Donut segments={segments} total={total} currency={currency} />

                  <ul className="grid flex-1 gap-1.5 self-stretch">
                    {segments.map((segment) => {
                      const content = (
                        <>
                          <span
                            className="h-3 w-3 shrink-0 rounded-full"
                            style={{ backgroundColor: segment.color }}
                            aria-hidden="true"
                          />
                          <span className="text-base" aria-hidden="true">
                            {segment.icon}
                          </span>
                          <span className="flex-1 truncate font-medium text-slate-900">{segment.name}</span>
                          <span className="text-sm font-semibold text-slate-900">
                            {formatAmount(segment.amount, currency)}
                          </span>
                          <span className="w-10 text-right text-xs font-medium text-slate-500">
                            {formatRatio(segment.ratio)}
                          </span>
                        </>
                      );

                      return onSelectCategory && segment.categoryId ? (
                        <li key={segment.key}>
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-slate-50 active:opacity-70"
                            onClick={() =>
                              onSelectCategory({
                                categoryId: segment.categoryId!,
                                categoryName: segment.name,
                                categoryIcon: segment.icon
                              })
                            }
                          >
                            {content}
                          </button>
                        </li>
                      ) : (
                        <li key={segment.key} className="flex items-center gap-2 px-2 py-1.5">
                          {content}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// props 來自 useMemo 後穩定，memo 可跳過分析未變時的重繪。
export const ExpenseCategoryPieChart = memo(ExpenseCategoryPieChartBase);

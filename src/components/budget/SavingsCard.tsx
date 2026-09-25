import { memo } from 'react';
import type { MonthlySummary } from '../../types';
import { formatAmount } from '../../lib/currency';
import { formatRatio } from '../../lib/summaryView';
import { combineSummaries, computeSavings, HEALTHY_SAVINGS_RATE, savingsTone } from '../../lib/budget';

interface SavingsCardProps {
  familySummary: MonthlySummary;
  personalSummary: MonthlySummary;
}

const TONE_TEXT = {
  good: 'text-emerald-600',
  fair: 'text-amber-600',
  bad: 'text-red-600',
  none: 'text-slate-400'
} as const;

const TONE_BAR = {
  good: 'bg-emerald-500',
  fair: 'bg-amber-500',
  bad: 'bg-red-500',
  none: 'bg-slate-300'
} as const;

// 首頁「本月儲蓄」：家庭帳本＋我的個人帳本合計的收入、支出、結餘與儲蓄率（以 TWD 為主，USD 另列）。
function SavingsCardBase({ familySummary, personalSummary }: SavingsCardProps) {
  const total = combineSummaries(familySummary, personalSummary);
  const twd = computeSavings(total, 'TWD');
  const usd = computeSavings(total, 'USD');
  const tone = savingsTone(twd.rate);
  const hasUsd = usd.income !== 0 || usd.expense !== 0;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5" aria-label="本月儲蓄">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-bold text-slate-900">本月儲蓄</h2>
          <p className="mt-0.5 text-xs text-slate-400">家庭帳本＋我的個人帳本</p>
        </div>
        <div className="text-right">
          <p className={`text-3xl font-bold ${TONE_TEXT[tone]}`}>{twd.rate === null ? '—' : formatRatio(twd.rate)}</p>
          <p className="text-xs text-slate-400">儲蓄率</p>
        </div>
      </div>

      {twd.rate !== null ? (
        <div className="mt-3">
          <div className="relative h-2 rounded-full bg-slate-100">
            <div
              className={`h-2 rounded-full ${TONE_BAR[tone]}`}
              style={{ width: `${Math.min(Math.max(twd.rate, 0), 1) * 100}%` }}
            />
            {/* 20% 參考線 */}
            <div
              className="absolute -top-1 h-4 w-px bg-slate-400"
              style={{ left: `${HEALTHY_SAVINGS_RATE * 100}%` }}
              aria-hidden="true"
            />
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {tone === 'bad'
              ? '本月支出大於收入，看看哪個類別可以收一收。'
              : tone === 'fair'
                ? `目標 ${formatRatio(HEALTHY_SAVINGS_RATE)} 以上，再加把勁。`
                : '存得很穩，這筆錢就是投資的彈藥。'}
          </p>
        </div>
      ) : (
        <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
          本月還沒有收入紀錄。記一筆薪資等收入，就能算出儲蓄率。
        </p>
      )}

      <dl className="mt-4 grid gap-1 rounded-lg bg-slate-50 px-3 py-2 text-sm">
        <Figure label="收入" value={formatAmount(twd.income, 'TWD')} />
        <Figure label="支出" value={formatAmount(twd.expense, 'TWD')} />
        <Figure
          label="結餘"
          value={formatAmount(twd.balance, 'TWD')}
          className={twd.balance < 0 ? 'text-red-600' : 'text-slate-900'}
        />
      </dl>

      {hasUsd ? (
        <p className="mt-3 text-xs text-slate-500">
          美金：收入 {formatAmount(usd.income, 'USD')}・支出 {formatAmount(usd.expense, 'USD')}・結餘{' '}
          {formatAmount(usd.balance, 'USD')}
          {usd.rate !== null ? `（${formatRatio(usd.rate)}）` : ''}
        </p>
      ) : null}
    </section>
  );
}

function Figure({ label, value, className = 'text-slate-900' }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`font-semibold ${className}`}>{value}</dd>
    </div>
  );
}

export const SavingsCard = memo(SavingsCardBase);

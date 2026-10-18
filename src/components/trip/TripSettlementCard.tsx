import { Scale } from 'lucide-react';
import { equalSplitTransfer, formatTwd, type TripSettlement } from '../../lib/trips';

interface TripSettlementCardProps {
  settlement: TripSettlement;
  /** 家庭成員 id（剛好兩位時顯示平分建議）。 */
  memberIds: string[];
  memberName: (id: string | null | undefined) => string;
}

// 旅行頁「結算」：每個人刷卡、現金各付了多少，扣掉幫朋友代墊後實際負擔多少；兩人時附平分建議。
export function TripSettlementCard({ settlement, memberIds, memberName }: TripSettlementCardProps) {
  const transfer = equalSplitTransfer(settlement.members, memberIds);
  const nameOf = (id: string | null) => (id ? memberName(id) || '（已離開的成員）' : '未記付款人');

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4" aria-label="結算">
      <h2 className="flex items-center gap-2 font-bold text-slate-900">
        <Scale className="h-5 w-5 text-family" />
        結算
      </h2>

      <ul className="mt-3 grid gap-3">
        {settlement.members.map((row) => (
          <li key={row.memberId ?? 'unknown'} className="rounded-lg bg-slate-50 p-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-semibold text-slate-900">{nameOf(row.memberId)}</span>
              <span className="text-right">
                <span className="text-xs text-slate-500">實際負擔 </span>
                <strong className="text-lg text-slate-900">{formatTwd(row.ownTwd)}</strong>
              </span>
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <Figure label="💳 刷卡" value={formatTwd(row.cardTwd)} />
              <Figure label="💵 現金" value={formatTwd(row.cashTwd)} />
            </dl>
            {row.otherTwd > 0 ? (
              <p className="mt-1 text-xs text-slate-500">未指定付款方式 {formatTwd(row.otherTwd)}</p>
            ) : null}
            {row.friendTwd > 0 ? (
              <p className="mt-1 text-xs text-amber-600">
                共付出 {formatTwd(row.paidTwd)}，其中幫朋友代墊 {formatTwd(row.friendTwd)}
              </p>
            ) : null}
          </li>
        ))}
      </ul>

      <dl className="mt-3 grid gap-1 border-t border-slate-100 pt-3 text-sm">
        <Row label="刷卡合計" value={formatTwd(settlement.cardTwd)} />
        <Row label="現金合計" value={formatTwd(settlement.cashTwd)} />
        {settlement.otherTwd > 0 ? <Row label="未指定" value={formatTwd(settlement.otherTwd)} /> : null}
        {settlement.friendTwd > 0 ? <Row label="扣掉幫朋友代墊" value={`−${formatTwd(settlement.friendTwd)}`} /> : null}
        <Row label="這趟實際花費" value={formatTwd(settlement.ownTwd)} strong />
      </dl>

      {transfer ? (
        <p className="mt-3 rounded-lg bg-familySoft p-3 text-sm text-slate-700">
          如果兩人平分：<strong>{memberName(transfer.from)}</strong> 給 <strong>{memberName(transfer.to)}</strong>{' '}
          <strong className="text-family">{formatTwd(transfer.twd)}</strong>
        </p>
      ) : null}
    </section>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white px-3 py-2">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={strong ? 'font-semibold text-slate-900' : 'text-slate-500'}>{label}</dt>
      <dd className={strong ? 'text-base font-bold text-slate-900' : 'font-semibold text-slate-700'}>{value}</dd>
    </div>
  );
}

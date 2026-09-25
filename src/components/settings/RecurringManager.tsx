import { useState } from 'react';
import { Pause, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import type { RecurringTransaction } from '../../types';
import { formatAmount } from '../../lib/currency';
import { getErrorMessage } from '../../lib/errors';
import { describeSchedule, formatMonthDay, nextOccurrence } from '../../lib/recurring';
import { useAuthStore } from '../../store/authStore';
import { useCategories } from '../../hooks/useCategories';
import { useFamilyMembers } from '../../hooks/useFamilyMembers';
import { useRecurringRules, type RecurringInput } from '../../hooks/useRecurring';
import { useUIStore } from '../../store/uiStore';
import { RecurringForm } from './RecurringForm';

type FormState = { rule: RecurringTransaction | null } | null;

// 設定頁「固定收支」：列出每月自動記入的規則，可新增、編輯、暫停／恢復、刪除。
export function RecurringManager() {
  const profile = useAuthStore((state) => state.profile);
  const { categories: expenseCategories } = useCategories('expense');
  const { categories: incomeCategories } = useCategories('income');
  const { members } = useFamilyMembers();
  const { rules, loading, error, reload, createRule, updateRule, setActive, deleteRule } = useRecurringRules();
  const showToast = useUIStore((state) => state.showToast);
  const [form, setForm] = useState<FormState>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const categoryById = new Map([...expenseCategories, ...incomeCategories].map((category) => [category.id, category]));
  const memberById = new Map(members.map((member) => [member.id, member]));

  function reportCreated(created: number, fallback: string) {
    showToast(created > 0 ? `${fallback}，已記入 ${created} 筆` : fallback);
  }

  async function handleCreate(input: RecurringInput, startMonth: string) {
    const created = await createRule(input, startMonth);
    reportCreated(created, '已新增固定收支');
  }

  async function handleUpdate(id: string, input: RecurringInput) {
    await updateRule(id, input);
    showToast('已更新固定收支');
  }

  async function run(ruleId: string, action: () => Promise<void>) {
    setBusyId(ruleId);
    try {
      await action();
    } catch (actionError) {
      showToast(getErrorMessage(actionError), 'error');
    } finally {
      setBusyId(null);
    }
  }

  function toggleActive(rule: RecurringTransaction) {
    void run(rule.id, async () => {
      const created = await setActive(rule, !rule.active);
      if (rule.active) showToast('已暫停');
      else reportCreated(created, '已恢復');
    });
  }

  function remove(rule: RecurringTransaction) {
    void run(rule.id, async () => {
      await deleteRule(rule.id);
      setConfirmDeleteId(null);
      showToast('已刪除固定收支，已記入的交易保留');
    });
  }

  return (
    <section id="recurring" className="scroll-mt-4 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-bold text-slate-900">固定收支</h2>
          <p className="mt-1 text-sm text-slate-500">房租、保費、訂閱、薪資、定期定額…設定一次，每月到了就自動記一筆。</p>
        </div>
        <button
          type="button"
          onClick={() => setForm({ rule: null })}
          className="flex h-9 shrink-0 items-center gap-1 rounded-lg bg-family px-3 text-sm font-semibold text-white"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          新增
        </button>
      </div>

      {error ? (
        <button type="button" className="mt-4 text-sm font-semibold text-red-600" onClick={() => void reload()}>
          固定收支載入失敗，點此重試
        </button>
      ) : loading ? (
        <p className="mt-4 text-sm text-slate-400">載入中…</p>
      ) : rules.length === 0 ? (
        <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">還沒有固定收支。從每月最固定的那一筆開始，例如房租或薪資。</p>
      ) : (
        <ul className="mt-4 grid gap-2">
          {rules.map((rule) => {
            const category = categoryById.get(rule.category_id);
            const owner = memberById.get(rule.owner_id);
            const next = nextOccurrence(rule);
            const busy = busyId === rule.id;

            return (
              <li key={rule.id} className={`rounded-lg border border-slate-200 p-3 ${rule.active ? '' : 'opacity-60'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">
                      <span aria-hidden="true">{category?.icon ?? '🏷️'} </span>
                      {rule.note?.trim() || category?.name || '固定收支'}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      <span className={rule.ledger_type === 'family' ? 'text-family' : 'text-personal'}>
                        {rule.ledger_type === 'family' ? '家庭' : '個人'}
                      </span>
                      {rule.ledger_type === 'family' && owner && owner.id !== profile?.id ? `・${owner.display_name}` : ''}
                      ・{describeSchedule(rule.day_of_month)}
                      {next ? `・下次 ${formatMonthDay(next)}` : '・已暫停'}
                    </p>
                  </div>
                  <p className={`shrink-0 font-semibold ${rule.type === 'income' ? 'text-emerald-600' : 'text-slate-900'}`}>
                    {rule.type === 'income' ? '+' : '−'}
                    {formatAmount(rule.amount, rule.currency)}
                  </p>
                </div>

                {confirmDeleteId === rule.id ? (
                  <div className="mt-3 flex items-center justify-end gap-2 text-sm">
                    <span className="mr-auto text-slate-600">刪除後不再自動記入，已記入的交易保留。</span>
                    <button type="button" className="rounded-lg px-3 py-1.5 text-slate-500" onClick={() => setConfirmDeleteId(null)}>
                      取消
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      className="rounded-lg bg-red-600 px-3 py-1.5 font-semibold text-white disabled:opacity-60"
                      onClick={() => remove(rule)}
                    >
                      刪除
                    </button>
                  </div>
                ) : (
                  <div className="mt-2 flex justify-end gap-1">
                    <IconButton label="編輯" onClick={() => setForm({ rule })} disabled={busy}>
                      <Pencil className="h-4 w-4" />
                    </IconButton>
                    <IconButton label={rule.active ? '暫停' : '恢復'} onClick={() => toggleActive(rule)} disabled={busy}>
                      {rule.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </IconButton>
                    <IconButton label="刪除" onClick={() => setConfirmDeleteId(rule.id)} disabled={busy} danger>
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {form ? (
        <RecurringForm
          initialRule={form.rule}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
          onClose={() => setForm(null)}
        />
      ) : null}
    </section>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  danger = false,
  children
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`grid h-8 w-8 place-items-center rounded-lg text-slate-400 disabled:opacity-50 ${
        danger ? 'hover:bg-red-50 hover:text-red-600' : 'hover:bg-slate-100 hover:text-family'
      }`}
    >
      {children}
    </button>
  );
}

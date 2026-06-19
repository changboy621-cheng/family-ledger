import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useCategories } from '../hooks/useCategories';
import { parseQuickEntry } from '../lib/quickEntry';
import { formatAmount } from '../lib/currency';
import { todayISO } from '../lib/utils';

type State =
  | { status: 'working' }
  | { status: 'done'; summary: string }
  | { status: 'error'; message: string; needLogin?: boolean };

export function QuickAdd() {
  const [searchParams] = useSearchParams();
  const text = searchParams.get('text') ?? '';
  const { session, profile, loading } = useAuth();
  const isIncome = /收入|income/i.test(text);
  const { categories, loading: catLoading } = useCategories(isIncome ? 'income' : 'expense');
  const [state, setState] = useState<State>({ status: 'working' });
  const handled = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (!session || !profile?.family_id) {
      setState({ status: 'error', message: '請先登入，再使用快速記帳。', needLogin: true });
      return;
    }
    if (catLoading || handled.current) return;

    handled.current = true;

    const parsed = parseQuickEntry(text, categories.map((category) => category.name));
    if (!parsed) {
      setState({ status: 'error', message: `聽不懂「${text}」。請說「金額 類別」，例如「200 餐飲」。` });
      return;
    }

    const category = parsed.categoryName
      ? categories.find((item) => item.name === parsed.categoryName) ?? categories[0]
      : categories[0];

    if (!category) {
      setState({ status: 'error', message: '找不到可用的類別，請先在 App 內新增一筆。' });
      return;
    }

    const amount = Math.round(parsed.amount);

    void (async () => {
      const { error } = await supabase.from('transactions').insert({
        family_id: profile.family_id,
        owner_id: profile.id,
        ledger_type: parsed.ledgerType,
        type: parsed.type,
        amount,
        currency: 'TWD',
        category_id: category.id,
        transaction_date: todayISO(),
        note: parsed.note || null
      });

      if (error) {
        setState({ status: 'error', message: error.message });
        return;
      }

      const typeLabel = parsed.type === 'expense' ? '支出' : '收入';
      const ledgerLabel = parsed.ledgerType === 'family' ? '家庭' : '個人';
      setState({
        status: 'done',
        summary: `${category.icon} ${category.name}（${ledgerLabel}${typeLabel}）${formatAmount(amount, 'TWD')}${parsed.note ? ` · ${parsed.note}` : ''}`
      });
    })();
  }, [loading, catLoading, session, profile, categories, text]);

  return (
    <div className="grid min-h-screen place-items-center bg-page p-6">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 text-center">
        {state.status === 'working' ? (
          <>
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-family" />
            <p className="mt-4 text-slate-600">記帳中…</p>
          </>
        ) : null}

        {state.status === 'done' ? (
          <>
            <CheckCircle2 className="mx-auto h-12 w-12 text-family" />
            <h1 className="mt-3 text-lg font-bold text-slate-900">已記一筆</h1>
            <p className="mt-2 text-slate-700">{state.summary}</p>
            <Link to="/" className="mt-5 block h-11 rounded-lg bg-family pt-2.5 font-semibold text-white">
              回首頁
            </Link>
          </>
        ) : null}

        {state.status === 'error' ? (
          <>
            <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
            <h1 className="mt-3 text-lg font-bold text-slate-900">沒記成功</h1>
            <p className="mt-2 text-sm text-slate-600">{state.message}</p>
            <Link
              to={state.needLogin ? '/auth/login' : '/'}
              className="mt-5 block h-11 rounded-lg bg-family pt-2.5 font-semibold text-white"
            >
              {state.needLogin ? '前往登入' : '回首頁'}
            </Link>
          </>
        ) : null}
      </div>
    </div>
  );
}

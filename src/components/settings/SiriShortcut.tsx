import { Copy } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';
import { INVITE_BASE_URL } from '../../lib/invite';

const QUICK_ADD_URL = `${INVITE_BASE_URL}/quick?text=`;

export function SiriShortcut() {
  const showToast = useUIStore((state) => state.showToast);

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(QUICK_ADD_URL);
      showToast('網址已複製');
    } catch {
      showToast('複製失敗，請長按網址手動複製', 'error');
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-bold text-slate-900">用 Siri 快速記帳</h2>
      <p className="mt-1 text-sm text-slate-500">設定一個 iPhone「捷徑」，對 Siri 說一句就記帳。</p>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
        <code className="truncate text-xs text-slate-700">{QUICK_ADD_URL}</code>
        <button
          type="button"
          onClick={() => void copyUrl()}
          className="flex shrink-0 items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700"
        >
          <Copy className="h-3.5 w-3.5" />
          複製
        </button>
      </div>

      <ol className="mt-4 grid gap-2 text-sm text-slate-600">
        <li>1. 開啟 iPhone 內建「捷徑」App → 右上角「＋」新增捷徑。</li>
        <li>2. 加入動作「聽寫文字」。</li>
        <li>3. 再加入動作「打開 URL」，URL 貼上上面的網址，後面接住「聽寫文字」變數。</li>
        <li>4. 捷徑命名為「記一筆」，完成。</li>
        <li>5. 對 Siri 說「記一筆」，再講「200 餐飲」就會記好。</li>
      </ol>

      <p className="mt-3 text-xs text-slate-400">
        說法：金額＋類別（可加備註），例如「1099 居家 衛生紙」、「收入 5000 獎金」、「個人 100 交通」。
      </p>
    </section>
  );
}

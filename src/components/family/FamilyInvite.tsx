import { Copy, Share2, Users } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useUIStore } from '../../store/uiStore';
import { buildInviteText } from '../../lib/invite';

interface FamilyInviteProps {
  /** card：首頁顯著卡片；plain：設定頁區塊（外層已有容器） */
  variant?: 'card' | 'plain';
}

// 家庭邀請區塊：讓另一半很容易找到邀請碼、一鍵複製或用系統分享送出。
export function FamilyInvite({ variant = 'card' }: FamilyInviteProps) {
  const { family } = useAuth();
  const showToast = useUIStore((state) => state.showToast);
  const code = family?.invite_code ?? '';

  if (!code) return null;

  const inviteText = buildInviteText({ familyName: family?.name, inviteCode: code });

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      showToast('邀請碼已複製');
    } catch {
      showToast('複製失敗，請長按邀請碼手動複製', 'error');
    }
  }

  async function shareInvite() {
    // 手機優先：能用系統分享就用（可直接傳 LINE / 訊息）
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: '加入家庭帳本', text: inviteText });
        return;
      } catch (error) {
        // 使用者自己取消分享，不視為錯誤
        if (error instanceof Error && error.name === 'AbortError') return;
        // 其他狀況（如桌機不支援）退回複製
      }
    }

    try {
      await navigator.clipboard.writeText(inviteText);
      showToast('邀請內容已複製，貼給家人即可');
    } catch {
      showToast('分享失敗，請手動複製邀請碼', 'error');
    }
  }

  const wrapperClass =
    variant === 'card'
      ? 'rounded-xl border border-familySoft bg-white p-5'
      : 'rounded-lg border border-slate-200 bg-white p-5';

  return (
    <section className={wrapperClass}>
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-familySoft text-family">
          <Users className="h-4 w-4" />
        </span>
        <h2 className="font-bold text-slate-900">邀請家人一起記帳</h2>
      </div>

      <p className="mt-2 text-sm text-slate-500">把下面的邀請碼或連結傳給家人，對方就能加入這個家庭帳本。</p>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">家庭邀請碼</p>
          <p className="break-all font-mono text-2xl font-bold tracking-[0.3em] text-family">{code}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => void copyCode()}
          className="flex h-12 items-center justify-center gap-2 rounded-lg border border-slate-300 font-semibold text-slate-700 active:bg-slate-50"
        >
          <Copy className="h-4 w-4" />
          複製邀請碼
        </button>
        <button
          type="button"
          onClick={() => void shareInvite()}
          className="flex h-12 items-center justify-center gap-2 rounded-lg bg-family font-semibold text-white active:opacity-90"
        >
          <Share2 className="h-4 w-4" />
          分享邀請
        </button>
      </div>

      <ol className="mt-4 grid gap-1 text-xs text-slate-500">
        <li>1. 按「分享邀請」把連結傳給家人（或複製邀請碼）。</li>
        <li>2. 家人點連結 → 選「加入家庭」，邀請碼會自動帶入。</li>
        <li>3. 填好名稱完成註冊，就能一起記帳。</li>
      </ol>
    </section>
  );
}

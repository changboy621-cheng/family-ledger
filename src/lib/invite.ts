// 家庭邀請：組出「加入連結」與「可直接貼給家人的邀請文字」。
// 分享一律使用對外安全網址（deployment-style 網址會把外人導向 Vercel 流程）。

export const INVITE_BASE_URL = 'https://family-ledger-wheat.vercel.app';

function normalizeCode(inviteCode: string) {
  return inviteCode.trim().toUpperCase();
}

/** 組出家人可直接點擊、會自動帶入邀請碼的加入連結。 */
export function buildJoinUrl(inviteCode: string, baseUrl: string = INVITE_BASE_URL): string {
  const code = normalizeCode(inviteCode);
  return `${baseUrl}/auth/join?code=${encodeURIComponent(code)}`;
}

/** 組出可一鍵分享／複製、家人照著做就能加入的邀請文字。 */
export function buildInviteText({
  familyName,
  inviteCode,
  baseUrl = INVITE_BASE_URL
}: {
  familyName?: string | null;
  inviteCode: string;
  baseUrl?: string;
}): string {
  const code = normalizeCode(inviteCode);
  const name = familyName?.trim() || '我們的家';
  const url = buildJoinUrl(code, baseUrl);

  return [
    `邀請你加入「${name}」家庭帳本 📒`,
    '',
    '加入步驟：',
    `1. 點開連結：${url}`,
    `2. 註冊／登入後，邀請碼會自動帶入（${code}）`,
    '3. 填好名稱就完成加入，開始一起記帳！',
    '',
    `（連結若沒帶入，請到 ${baseUrl} 選「加入家庭」，手動輸入邀請碼 ${code}）`
  ].join('\n');
}

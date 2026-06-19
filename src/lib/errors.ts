interface ErrorLike {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
}

const errorMessageMap: Record<string, string> = {
  'duplicate key value violates unique constraint "user_profiles_pkey"':
    '這個帳號的個人設定其實已建立過了。請重新整理頁面，或直接重新登入一次。',
  'duplicate key value violates unique constraint "families_invite_code_key"':
    '邀請碼剛好撞號了，請再按一次，系統會重新產生。',
  'duplicate key value violates unique constraint': '這筆資料已經存在，請換一個值再試一次。',
  'row-level security policy': '資料庫安全規則擋下了這次操作，請重新登入後再試一次。',
  'Database error saving new user': '建立使用者失敗，請確認 Supabase 的 Email provider 已開啟。',
  'Email signups are disabled': 'Supabase 目前沒有開啟 Email 註冊，請到 Authentication > Sign In / Providers 開啟 Email provider。',
  'User already registered': '這個 Email 已經註冊過，請直接登入或換一個 Email。',
  'Invalid login credentials': 'Email 或密碼不正確，請再檢查一次。',
  'permission denied for table families':
    'Supabase 的資料表權限還沒補齊。請到 SQL Editor 執行授權 SQL，讓 authenticated 可以存取 families。',
  'infinite recursion detected in policy for relation "user_profiles"':
    'Supabase 的 user_profiles 安全規則寫成自我遞迴了。請到 SQL Editor 執行最新修復 SQL。'
};

export function getErrorMessage(error: unknown, fallback = '發生錯誤，請稍後再試。') {
  if (!error) return fallback;

  if (error instanceof Error && error.message) {
    return translateErrorMessage(error.message);
  }

  if (typeof error === 'object') {
    const candidate = error as ErrorLike;
    const combined = [candidate.message, candidate.details, candidate.hint].filter(Boolean).join(' ');
    if (combined) return translateErrorMessage(combined);
  }

  if (typeof error === 'string') {
    return translateErrorMessage(error);
  }

  return fallback;
}

function translateErrorMessage(message: string) {
  for (const [keyword, translated] of Object.entries(errorMessageMap)) {
    if (message.includes(keyword)) return translated;
  }

  return message;
}

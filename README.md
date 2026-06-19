# 家帳 FamilyLedger

FamilyLedger 是依照 v1.2 規格建立的 PWA，P0 版本包含：

- Supabase Email/Password 認證
- 建立家庭與 6 位邀請碼
- 另一方用邀請碼加入家庭
- 新增家庭帳本或個人帳本交易
- TWD / USD 幣別選擇與格式化
- 家庭帳本清單與個人帳本清單
- PWA manifest 與 service worker 設定

## 啟動

1. 複製 `.env.example` 為 `.env.local`，填入 Supabase URL 與 anon key。
2. 在 Supabase SQL Editor 執行 `supabase/migrations/001_initial_schema.sql`。
3. 執行：

```bash
npm install
npm run dev
```

## 建置

```bash
npm run build
```

## 上線到 Vercel

1. 將專案推到 GitHub。
2. 到 Vercel 匯入這個專案。
3. 在 Vercel 專案環境變數填入：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Build Command 使用 `npm run build`
5. Output Directory 使用 `dist`
6. 部署完成後，拿到正式網址，例如 `https://your-app.vercel.app`

### Supabase 正式環境設定

到 Supabase 後台更新：

1. `Authentication` -> `URL Configuration`
2. 將 `Site URL` 設成你的正式網址
3. 在 `Redirect URLs` 加入：
   - `https://your-app.vercel.app/auth/complete`
   - 如果有自訂網域，也一起加入對應網址

### 已包含的部署設定

- 專案已加入 `vercel.json`
- 這樣重新整理 `/family`、`/auth/login`、`/auth/complete` 這類頁面時，不會掉 404

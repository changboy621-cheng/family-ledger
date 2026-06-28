# 優化變更摘要 — 2026-06-28

分支：`optimize/2026-06-28`（基準 = 原版 `main` 的 `fe7319a`）

## 完成項目（6 項）

| # | 變更 | Commit | 性質 |
|---|---|---|---|
| 1 | Route 改 React.lazy 動態載入，分割單一 bundle | `7d6287c` | 純前端 / 效能 |
| 2 | 補 budgets INSERT/UPDATE/DELETE RLS policy | `2875236` | **SQL 僅寫入未套用** |
| 3 | families 改 SECURITY DEFINER 查邀請碼、撤 anon 讀取權、join 改用 RPC | `260a237` | SQL（未套用）＋前端 |
| 4 | 抽單一 useAuthListener、共用 loadProfileIntoStore，消除 9 份重複訂閱 | `7a67cab` | 純前端 / 效能 |
| 5 | 列表/卡片 memo 化、穩定 onEdit 與 grouped/activeCurrencies | `16b7f07` | 純前端 / 效能 |
| 6 | 統一 manifest 來源（vite-plugin-pwa）、補 maskable icon | `2c0a6b5` | 純前端 / PWA |

（另有 `d52ef09` 測試 mock 修正、`7474dc9` 計畫文件。）

## 驗證結果

- `npm run build`：成功；最大 JS chunk 從 ~510KB 降至 **421KB**，各頁獨立 chunk，500KB 警告消失。
- `npm test`：**72 passed**（原 68 ＋ 新增 4：useAuth.rpc 2、loadProfileIntoStore 2）。
- `npm run lint`：乾淨。
- 執行期：dev server 啟動，`/auth/login` 正常渲染、**無 console 錯誤**（lazy 載入＋auth listener 運作正常）。

## ⚠️ 採用前必讀（取代原版時）

1. **DB migration `003`、`004` 尚未套用**。複製版與原版**共用同一個線上 Supabase**，因此本次刻意不套用，以免影響原版正在使用的資料。
   - 採用時請在 Supabase SQL Editor 依序執行 `supabase/migrations/003_budgets_write_policies.sql`、`004_harden_families_access.sql`。
   - 套用 `004` 後，請以測試帳號驗證「用邀請碼加入家庭」流程仍正常（已改走 `find_family_by_invite` RPC）。
2. 前端改動（1/4/5/6）不需任何資料庫變更即可運作；功能與外觀不變，差異為更快載入、更順操作、PWA 圖示一致。

## 未納入（維持原樣）

- undo-delete「失敗復現」：複查後確認**現有邏輯已正確**（失敗時從 pendingIds 移除→項目自動復現），非 bug，未改。
- 延後項目：預算功能實作、realtime 增量更新、查詢去重、a11y 全面盤點、匯入去重強化等（見計畫文件延後清單）。

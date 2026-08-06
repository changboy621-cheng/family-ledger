# 關鍵字搜尋＋分類明細＋備註歷史加強 — 設計文件

日期：2026-08-06
狀態：已與使用者以視覺 mockup 確認（方案 C／D／I＋加分項 J／L／M／O，視覺風格 U）

## 目標

1. 備註可用關鍵字搜尋，範圍跨**全部月份**（不限近 6 個月）。
2. 「本月支出分類」的每個分類可點入，看該分類跨月份的所有交易。
3. 記帳表單的備註歷史更好用：更多歷史、可釘選、點選可聰明帶入。

不做（本次範圍外）：金額搜尋、跨帳本全域搜尋、備註歷史跨裝置同步。

## 功能設計

### 1. 關鍵字搜尋（方案 C＋L＋M）

**入口**：帳本頁（家庭／個人）MonthPicker 旁新增 🔍 按鈕，開啟全螢幕搜尋視窗（Modal）。

**搜尋行為**：
- 輸入即搜（debounce 300ms），空字串時不查詢。
- 查詢範圍：目前帳本（family 以 `family_id`、personal 以 `owner_id` 過濾，沿用 `fetchTransactions` 的過濾邏輯），**不設日期範圍**，依日期新到舊，上限 300 筆。
- 比對條件（L）：`note ilike %關鍵字%`，**或** `category_id` 屬於「名稱包含關鍵字」的分類。分類清單在前端比對（支出＋收入兩種型別都含），求出 id 集合帶入 `.or()` 查詢；無符合分類時只查 note。
- 超過 300 筆時，結果頂部顯示「僅顯示最近 300 筆，可加關鍵字縮小範圍」。

**最近搜尋（C）**：
- 搜尋框為空時顯示「最近搜尋」圓籤（最多 8 個），點了直接搜。
- 儲存於 localStorage，key：`fl:recent-searches:<ledgerType>`；送出查詢且有結果時寫入，去重、最新在前。

**結果呈現**：
- 頂部總計卡：共 N 筆＋各幣別合計。
- 按月分組（YYYY年M月 標題），每月顯示小計；每筆顯示分類 icon、備註（關鍵字**黃底高亮**）、日期、分類名、金額。
- 進階篩選列（M）：`全部/支出/收入`、`全部/TWD/USD`、家庭帳本另有成員籤。篩選在前端對已抓回的結果過濾，總計卡與月小計同步更新。
- 點任一筆 → 開啟現有 `TransactionForm` 編輯；支援刪除。異動成功後重新執行搜尋，並通知帳本頁 refresh。

### 2. 分類點入明細（方案 I）

- 「本月支出分類」（`ExpenseCategorySummary`）每列可點，開啟**同一個搜尋視窗**的「分類模式」：
  - 標題顯示分類 icon＋名稱，無關鍵字輸入框。
  - 查詢：同上但以 `category_id` 過濾、無日期範圍、上限 300 筆。
  - 篩選列：期間（全部／近3個月／近6個月／今年，前端過濾）＋成員（家庭帳本）。
  - 結果按月分組＋月小計，可編輯／刪除，行為與搜尋模式一致。

### 3. 備註歷史加強（方案 D＋J＋O）

- **D 加量**：`computeRecentNotes` 上限 10 → 30；`filterNotes` 顯示上限 6 → 8。
- **J 聰明帶入**：`useEntrySuggestions` 查詢欄位增加 `category_id, amount, currency, payment_method`，建立「備註 → 最近一次的分類/金額/幣別/付款方式」對照。點備註圓籤時：
  - 一律帶入備註與付款方式；分類存在於目前類別清單時帶入分類。
  - 金額欄**為空**時才帶入金額與幣別（不覆蓋使用者已輸入的內容）。
- **O 釘選**：長按（觸控 long-press／桌面右鍵）備註圓籤可釘選／取消釘選。釘選的備註顯示 📌、永遠排在最前，不受最近 30 筆限制；打字過濾時釘選項目一樣依輸入過濾，但通過過濾者仍排最前。儲存於 localStorage，key：`fl:pinned-notes:<ledgerType>:<type>`。
  - 已知限制：localStorage 為單一裝置，不跨裝置同步（未來可移至 DB）。

## 視覺風格（方案 U｜漸層玻璃風）

- 僅套用於**搜尋視窗與分類明細視窗**兩個新畫面；App 其他頁面不變。
- 底：柔和斜向漸層（家庭帳本以 family 色系、個人帳本以 personal 色系為基調）。
- 卡片：半透明白（`bg-white/70`）＋ `backdrop-blur` ＋ 細白邊框、圓角 12px。
- 關鍵字高亮：黃底（`bg-yellow-200` 系）。
- 手機優先（現有 App 為 mobile-first），輸入框字級 ≥16px（沿用先前 iOS 修正的約束）。

## 技術架構

新增：

- `src/lib/search.ts`：純函式——關鍵字比對分類、按月分組＋月小計、篩選（型別/幣別/成員/期間）、高亮切分（把備註切成純文字/highlight 片段）、最近搜尋與釘選清單的讀寫與排序邏輯（localStorage 存取包一層以利測試）。
- `src/hooks/useTransactionSearch.ts`：接受 `ledgerType` 與 `mode`（`{ keyword }` 或 `{ categoryId }`），組 Supabase 查詢（沿用 `TRANSACTION_SELECT` 與 family/personal 過濾），回傳 `results / loading / error / refetch`。含請求序號防過時回應（比照 `useTransactionsCore`）。
- `src/components/transaction/TransactionSearchModal.tsx`：全螢幕視窗，涵蓋搜尋模式與分類模式；內部重用 `TransactionItem` 呈現單筆、`TransactionForm` 編輯。

修改：

- `LedgerPage.tsx`：加 🔍 按鈕與 modal 狀態；分類點擊 handler 傳入 `LedgerAnalysis` → `ExpenseCategorySummary`；modal 異動後呼叫 `refreshTransactions`。
- `ExpenseCategorySummary.tsx`：列改為 button、新增 `onSelectCategory?` prop（未傳入時維持純顯示，Dashboard 不受影響）。
- `src/lib/suggestions.ts`＋`useEntrySuggestions.ts`＋`TransactionForm.tsx`：D／J／O 三項。

不需要資料庫 migration（`note ilike` 掃描量在家庭記帳規模下可接受；若未來變慢再加 `pg_trgm` 索引）。

## 錯誤處理

- 搜尋失敗：結果區顯示「搜尋失敗＋重試」按鈕（比照現有清單的錯誤處理），不吞錯、console.error 記錄。
- 離線：顯示「目前離線，請連上網路後再試」。
- 空結果：顯示「找不到符合『關鍵字』的交易」空狀態。
- 編輯/刪除失敗：Toast 錯誤訊息（沿用現有 `showToast` 流程），清單維持原狀。

## 測試計畫

依現有 vitest 慣例，純函式優先：

- `search.test.ts`：分類名稱比對、按月分組與小計、各篩選、期間過濾、高亮切分（含關鍵字在頭/尾/多次出現/無出現）、最近搜尋去重上限、釘選排序。
- `suggestions.test.ts`：擴充——30 筆上限、釘選在前、聰明帶入對照表（同備註取最新一筆）。
- `useTransactionSearch.test.ts`：mock supabase——family/personal 過濾、or 條件組成、過時回應忽略、錯誤狀態。
- 元件測試：`TransactionSearchModal.test.tsx`（輸入→結果→篩選→空狀態）、`ExpenseCategorySummary.test.tsx`（有/無 `onSelectCategory` 的行為）。

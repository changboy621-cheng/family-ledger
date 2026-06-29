# FamilyLedger 優化 Plans.md (branch: optimize-2026)

作成日: 2026-06-29
Baseline: lint clean / 73 tests pass / build OK (HEAD c1d6735)
team_validation_mode: subagent (perf / code-quality / UX 三視点の独立分析でクロスチェック済)

## Spec delta (user-visible behavior changes)

本最適化で「使用者可見行為」が変わる項目(其餘為內部 refactor → Spec skip reason: 動作不變):
- 讀取交易失敗時:不再顯示「本月無交易」假空狀態,改顯示「載入失敗 + 重試」。
- 所有錯誤訊息(含 QuickAdd / Google 登入)一律走 `getErrorMessage` 翻譯。
- 帳本頁(family/personal)新增按鈕改為常駐 FAB,任何捲動位置皆可記帳。
- 新增/編輯 modal:支援 Esc / 點背景關閉 + focus trap(a11y)。
- 離線時顯示「離線中」橫幅,儲存錯誤文案改為連線提示。
- 新家庭(無交易)的儀表板顯示邀請卡 + 「新增第一筆」CTA。

---

## Phase 1: 效能 — 載入速度與渲染效率

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| 1.1 | `useRealtimeSync` 用 ref 持有 `onChange`,effect deps 只留 `[familyId]`,避免換月時拆/重建 websocket channel [tdd:required] | 換月不再 unsubscribe/subscribe;新增測試驗證 channel 不因 callback 變動而重建;73+ tests pass | - | cc:完了 |
| 1.2 | 抽出共用 `fetchTransactions({ledgerType,profile,from,to})` 並合併 `useTransactions`/`useAnalysisTransactions`;LedgerPage 改為單一 6 個月查詢 + 單一 realtime channel,當月清單由 client 端 filter 衍生 [tdd:required] | LedgerPage 掛載只發 1 次查詢 + 開 1 個 channel(可由 network/log 驗證);peer 編輯只觸發 1 次 refetch;測試覆蓋 fetch helper;tests pass | 1.1 | cc:完了 |
| 1.2a | (1.2 衍生) 修正 `monthRange`/`rollingMonthRange`/`todayISO`/`currentYearMonth` 的 UTC off-by-one(Asia/Taipei 等會漏抓當月最後一天)[tdd:required] | 月份範圍 from/to 在任何時區皆為當地日曆邊界;新增 utils 測試;tests pass | - | cc:完了 |
| 1.3 | 將慢變動參照表 `useFamilyMembers`/`useCategories` 提升到 store,登入後載入一次並快取(family_id 為 key) [tdd:required] | Dashboard 不再重複發 member 查詢兩次;開表單/切換收支不再重抓分類;tests pass | 1.2 | cc:完了 |
| 1.4 | `useEntrySuggestions` 內 `computeFrequentItems`/`computeRecentNotes` 用 `useMemo([rows])`;`noteSuggestions` memo on `[noteHistory,note]` [tdd:skip:perf-memoization-no-behavior-change] | 每次輸入不再重掃 200 列兩次;既有 suggestions 測試仍通過 | - | cc:完了 |
| 1.5 | 5 個分析/摘要元件(ExpenseCategorySummary/SpenderAnalysis/TopExpenseCategories/PaymentMethodSummary/ExpenseTrendChart)包 `React.memo` [tdd:skip:perf-memoization-no-behavior-change] | toggle `showForm`/`currencyFilter` 時這些元件不重算;build OK | - | cc:完了 |
| 1.6 | `DataTools` CSV 匯入的新分類改為單次 batch `.insert([...])`,由回傳建立 id map(取代逐筆 await) [tdd:required] | 匯入 N 個新分類只發 1 次 insert;新增匯入測試;tests pass | - | cc:完了 |

## Phase 2: 程式碼品質 — 重複邏輯與型別安全

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| 2.1 | 在外部資料邊界導入 zod 驗證(Supabase rows / invite RPC / localStorage onboarding draft),以 `z.infer` 取代 `as Transaction[]`/`as unknown as`/未檢查的 `JSON.parse` [tdd:required] | 移除這些 unsafe cast;tampered/舊 schema 的 localStorage 不會被當成合法 draft;新增 schema 測試;tsc/lint/tests pass | - | cc:完了 |
| 2.2 | 抽出 5 個摘要元件共用的 `visibleCurrencies`/`formatRatio`/`ratioBarWidth` 到 `lib/summaryView.ts`;由 `currency.ts` 匯出 `CURRENCIES: readonly Currency[]` 消除各處 cast(RatioBar/SummarySection 元件抽取因各元件色彩/結構不同、改動風險高而暫不做)[tdd:skip:ui-refactor-covered-by-build] | 5 copies 收斂為 1;畫面行為不變(build + 視覺一致);lint/tests pass | - | cc:完了 |
| 2.3 | 統一 `emptyCurrencySummary`(currency.ts 單一來源,useLedgerAnalysis/useMonthlySummary 共用);刪除 `currency.ts` 死碼(`getAmountConfig`/`summarizeTransactions`/`sanitizeAmountInput`+其測試)。summarizeByType 抽取因 analysis 為單次交錯掃描、改動風險高而暫不做 [tdd:skip:dead-code-and-dedup] | 無重複 zero-summary 定義;死碼移除;tests pass | 2.2 | cc:完了 |
| 2.4 | 集中 `PAYMENT_METHODS` map、`categoryKey(type,name)`、分析視窗常數 `TREND_MONTHS=6`、fallback 顏色等魔法值到單一來源 [tdd:skip:constants-centralization] | 付款別/分類 key/趨勢月數只有單一定義;tests pass | - | cc:完了 |
| 2.5 | 補測最高風險未測邏輯:`usePendingDelete`(unmount-flush + 5s timer + undo race)、`useTransactions` owner 解析、`DataTools` 匯入 dedupe(已於 1.6 covered)[tdd:required] | 三處新增測試並通過;覆蓋資料遺失/重複刪除路徑;並修正重複 requestDelete 導致殘留 timer 偷偷重複刪除的 bug | - | cc:完了 |
| 2.6 | 統一讀取 hook 錯誤處理:不再靜默吞錯(useEntrySuggestions 補 console.error;交易讀取已於 3.1 surface;referenceStore 已於 1.3 處理;loadProfileIntoStore 已處理) [tdd:skip:covered-by-3.1] | 讀取失敗有可觀測訊號;與 Phase 3.1 共用機制 | 3.1 | cc:完了 |

## Phase 3: 使用者體驗 — 操作流程與錯誤提示

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| 3.1 | (最高優先) 讀取交易失敗改為:存 error state,`TransactionList`/摘要/分析皆顯示「載入失敗,點此重試」而非假空/零值狀態(console.error 取代靜默吞錯;背景重抓不彈 toast 避免洗版;加 request-id 防過時回應) [tdd:required] | 模擬 fetch 失敗時顯示錯誤+重試而非「本月無交易」;新增測試;tests pass | 1.2 | cc:完了 |
| 3.2 | 所有 user-facing 錯誤走 `getErrorMessage`:`QuickAdd.tsx:68` 與 Google 登入(加 try/catch + loading) [tdd:skip:small-wiring] | QuickAdd / Google 登入失敗顯示翻譯訊息而非 raw DB error;lint pass | 3.1 | cc:TODO |
| 3.3 | 帳本頁(LedgerPage)改用常駐 `FAB`(帶 ledgerType),與 Dashboard 一致 [tdd:skip:ui-placement] | family/personal 任意捲動位置可見新增鈕;build OK | - | cc:TODO |
| 3.4 | `TransactionForm` modal 加 `role="dialog"`/`aria-modal`、開啟 focus、focus trap、Esc 關閉、點背景關閉 [tdd:required] | 鍵盤可操作且 Esc/背景可關;新增互動測試;tests pass | - | cc:TODO |
| 3.5 | `index.html` viewport 加 `viewport-fit=cover`,讓既有 `.safe-bottom` safe-area 生效 [tdd:skip:html-meta] | 有瀏海/home indicator 機型底部 nav 不被遮;build OK | - | cc:TODO |
| 3.6 | 離線偵測:`navigator.onLine` 監聽 → 顯示「離線中」橫幅,儲存錯誤改連線提示 [tdd:skip:browser-api-thin] | 離線時顯示橫幅且錯誤文案為連線提示;build OK | - | cc:TODO |
| 3.7 | 新家庭(solo + 無交易)Dashboard 顯示 `FamilyInvite` 卡 + 空清單「新增第一筆」CTA [tdd:skip:ui-empty-state] | 新使用者落地頁有邀請與新增入口;build OK | 3.3 | cc:TODO |
| 3.8 | toast 改為小型 queue/stack,確保 undo(復原)不被後續 toast 蓋掉 [tdd:required] | 連續刪除/其他 toast 不會吃掉復原鈕;新增測試;tests pass | - | cc:TODO |

---

## Optional / Low (暫不納入,確認後可加)
- 效能: realtime 用 payload patch 取代全量 refetch(#7);owner 聚合改 Map(#9);Dashboard 預覽 over-fetch(#10)
- 品質: ExpenseTrendChart 泛型化去 cast(L1);non-null assertion(L2);CurrencySelector 收斂 union(L3);invite URL 改 env(L4);AndroMoney adapter 欄位比對一致化(L5);Auth 表單抽元件(M4)
- UX: 刪除鈕辨識度/swipe(#8);表單 autofocus(#11);Register 複製邀請碼 toast(#12);分類選取非顏色提示(#13);摘要卡 skeleton(#14)

## DoD 全域共通
- 每個 task 完成後 `npm run lint && npm run test && npm run build` 全綠
- Claude 實作 → Codex review → 取得共識才標記 cc:完了
- 全程僅在 optimize-2026 worktree,絕不動 ~/family-ledger (main)

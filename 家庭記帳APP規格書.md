# 家庭記帳 App 規格書
**專案名稱：FamilyLedger（家帳）**
**版本：v1.2**
**平台：Progressive Web App（PWA）— 可安裝於 iOS / Android / 桌面**
**日期：2026-06-15**
**介面語言：繁體中文**

---

## 一、專案目標

提供一對夫妻（兩名使用者）共用的記帳工具，支援：
1. **家庭共同帳本**：兩人皆可記錄、查看所有共同支出
2. **個人帳本**：各自私有，對方看不見
3. 資料即時同步，不需手動匯出匯入
4. **多幣別記帳**：支援新台幣（TWD）與美金（USD），各幣別獨立顯示，不做自動換算

---

## 二、技術選型

| 層次 | 技術 |
|------|------|
| 前端 | React + TypeScript + Tailwind CSS（PWA） |
| 後端 | Supabase（PostgreSQL + Auth + Realtime） |
| 部署 | Vercel（前端） |
| 本地快取 | IndexedDB（離線支援） |

> **為什麼選 Supabase：** 內建使用者認證、Row Level Security 可精確控制「個人帳本只有本人看得到」，Realtime 功能讓雙方入帳後對方立即看到，免費方案足夠兩人使用量。

---

## 三、幣別規格

### 3.1 支援幣別

| 代碼 | 名稱 | 符號 | 小數位 |
|------|------|------|--------|
| TWD  | 新台幣 | NT$ | 0（取整數）|
| USD  | 美金   | $   | 2 |

### 3.2 設計原則

- **不做自動匯率換算**，使用者自行輸入各幣別金額
- 統計頁的金額**分幣別獨立加總**，TWD 與 USD 分開顯示
- 預算也分幣別設定，TWD 預算對應 TWD 支出，USD 預算對應 USD 支出

---

## 四、資料庫結構

### 4.1 families（家庭）

```sql
CREATE TABLE families (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL DEFAULT '我們的家',
  invite_code TEXT UNIQUE NOT NULL,  -- 6位邀請碼，用來讓另一方加入
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.2 user_profiles（使用者，對應 Supabase Auth）

```sql
CREATE TABLE user_profiles (
  id                 UUID PRIMARY KEY REFERENCES auth.users(id),
  family_id          UUID REFERENCES families(id),
  display_name       TEXT NOT NULL,
  avatar_color       TEXT DEFAULT '#4F46E5',        -- 個人代表色
  default_currency   TEXT NOT NULL DEFAULT 'TWD'
                     CHECK (default_currency IN ('TWD', 'USD')),
  created_at         TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.3 categories（帳目類別）

```sql
CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id   UUID REFERENCES families(id),       -- NULL = 系統預設類別
  owner_id    UUID REFERENCES user_profiles(id),  -- NULL = 家庭共用類別
  name        TEXT NOT NULL,
  icon        TEXT NOT NULL,                      -- emoji 圖示，例如 '🛒'
  type        TEXT NOT NULL CHECK (type IN ('expense', 'income')),
  is_shared   BOOLEAN NOT NULL DEFAULT TRUE,      -- TRUE=家庭類別, FALSE=個人類別
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

**系統預設類別（seed data）：**

| 名稱 | 圖示 | 類型 |
|------|------|------|
| 餐飲 | 🍽️ | expense |
| 交通 | 🚗 | expense |
| 購物 | 🛒 | expense |
| 居家 | 🏠 | expense |
| 醫療 | 💊 | expense |
| 娛樂 | 🎬 | expense |
| 教育 | 📚 | expense |
| 旅遊 | ✈️ | expense |
| 薪資 | 💰 | income |
| 其他收入 | 💵 | income |

### 4.4 transactions（記帳紀錄）

```sql
CREATE TABLE transactions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id        UUID NOT NULL REFERENCES families(id),
  owner_id         UUID NOT NULL REFERENCES user_profiles(id),  -- 記帳者
  ledger_type      TEXT NOT NULL CHECK (ledger_type IN ('family', 'personal')),
  type             TEXT NOT NULL CHECK (type IN ('expense', 'income')),
  amount           NUMERIC(12, 2) NOT NULL,                     -- 原始金額
  currency         TEXT NOT NULL DEFAULT 'TWD'
                   CHECK (currency IN ('TWD', 'USD')),           -- 原始幣別
  category_id      UUID NOT NULL REFERENCES categories(id),
  note             TEXT,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  receipt_url      TEXT,                                         -- 收據照片（Supabase Storage）
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
```

> **設計說明**：只儲存原始幣別與金額，不做換算。統計時依 `currency` 欄位分組加總。

### 4.5 budgets（預算設定）

```sql
CREATE TABLE budgets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id     UUID NOT NULL REFERENCES families(id),
  owner_id      UUID REFERENCES user_profiles(id),    -- NULL = 家庭預算
  ledger_type   TEXT NOT NULL CHECK (ledger_type IN ('family', 'personal')),
  category_id   UUID REFERENCES categories(id),       -- NULL = 總預算
  year_month    CHAR(7) NOT NULL,                     -- 格式：'2026-06'
  amount        NUMERIC(12, 2) NOT NULL,
  currency      TEXT NOT NULL DEFAULT 'TWD'
                CHECK (currency IN ('TWD', 'USD')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (family_id, owner_id, category_id, year_month, currency)
);
```

### 4.6 Row Level Security（資料安全）

```sql
-- transactions：個人帳本只有本人看得到，家庭帳本兩人都能看
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "家庭帳本家庭成員可見" ON transactions
  FOR SELECT USING (
    ledger_type = 'family' AND
    family_id IN (SELECT family_id FROM user_profiles WHERE id = auth.uid())
  );

CREATE POLICY "個人帳本僅本人可見" ON transactions
  FOR SELECT USING (
    ledger_type = 'personal' AND
    owner_id = auth.uid()
  );

CREATE POLICY "僅可新增自己的交易" ON transactions
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "僅可編輯自己的交易" ON transactions
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "僅可刪除自己的交易" ON transactions
  FOR DELETE USING (owner_id = auth.uid());
```

---

## 五、功能規格

### 5.1 認證流程

1. **首次使用（建立家庭）**
   - 輸入 Email + 密碼 → 建立帳號
   - 輸入顯示名稱（例：「老公」）
   - 選擇個人預設幣別：NT$ 新台幣 / $ 美金
   - 系統產生 6 位邀請碼（例：`AB1234`）
   - 顯示邀請碼，附「複製」與「分享」按鈕

2. **另一方加入**
   - 輸入 Email + 密碼 → 建立帳號
   - 輸入邀請碼 → 加入同一個 family_id
   - 設定顯示名稱與預設幣別

3. **後續登入**：Email + 密碼，或 Google OAuth

---

### 5.2 底部導航列

```
[首頁 🏠] [家庭帳本 👨‍👩‍] [個人帳本 🔒] [統計 📊] [設定 ⚙️]
```

---

### 5.3 首頁（Dashboard）

顯示本月摘要：

- **家庭本月支出**（TWD 與 USD 分行顯示）
  ```
  家庭支出
  NT$ 28,450
  $  320.00
  ```
- **我的個人支出**（同上，分幣別）
- 最近 5 筆家庭交易（快速預覽）
- 最近 5 筆個人交易（快速預覽）
- 浮動新增按鈕（FAB）→ 點後選擇「家庭帳本」或「個人帳本」

---

### 5.4 記帳表單（新增 / 編輯交易）

**必填欄位：**

| 欄位 | 說明 |
|------|------|
| 帳本 | 家庭 / 個人（Tab 切換） |
| 類型 | 支出 / 收入（Chip 切換） |
| 幣別 | NT$ 新台幣 / $ 美金（下拉選單，預設為個人設定的幣別） |
| 金額 | 數字鍵盤；TWD 輸入整數，USD 支援兩位小數 |
| 類別 | 圖示格狀選擇 |
| 日期 | 預設今天，可修改 |

**選填欄位：**
- 備註（文字）
- 收據照片（拍照 or 選擇相簿，上傳 Supabase Storage）

**送出行為：**
- 儲存 `amount`、`currency`（不計算換算值）
- 清空表單，回到原帳本頁
- 家庭帳本新增後，老婆的裝置即時更新

---

### 5.5 家庭帳本頁

- **月份選擇器**（左右滑動切換月份）
- **本月統計列**：分兩行顯示 TWD 與 USD
  ```
  支出         收入        結餘
  NT$ 28,450  NT$ 0      -NT$ 28,450
  $   320.00  $  0.00    -$   320.00
  ```
- **幣別篩選**：全部 / 只看 TWD / 只看 USD（右上角 Chip）
- **分攤資訊**：顯示誰付了多少（TWD 與 USD 分別統計）
  ```
  老公：NT$ 18,000 ／ $ 0
  老婆：NT$ 10,450 ／ $ 320.00
  ```
- **交易清單**：依日期分組，每筆顯示：
  - 類別圖示 + 類別名稱
  - 備註
  - 記帳者名稱 + 代表色圓點
  - 幣別 Badge + 金額（`[NT$] NT$850` 或 `[$] $26.50`）
  - 點擊展開可編輯 / 刪除（僅記帳者可操作）
- **搜尋**：關鍵字搜尋備註 / 類別名稱

---

### 5.6 個人帳本頁

- 介面與家庭帳本相同
- 僅顯示自己的資料（RLS 保障，對方無法透過 API 查詢）
- 頁首標示 `🔒 個人隱私`

---

### 5.7 統計頁

**帳本切換**：家庭帳本 / 個人帳本（Tab）

**幣別切換**：NT$ / $（頁面右上角切換，各幣別獨立統計）

**本月分析：**
- 圓餅圖：各類別支出佔比（依所選幣別）
- 長條圖：本月每日支出趨勢（依所選幣別）

**月份比較：**
- 折線圖：過去 6 個月支出趨勢（TWD 與 USD 可切換，不混算）

**家庭帳本專屬：**
- 雙人支出對比（老公 vs 老婆，TWD / USD 各一張圖）

**預算進度：**
- 每個類別顯示「已用 / 預算」進度條（TWD 對 TWD，USD 對 USD）
- 超出預算標示紅色警示

---

### 5.8 設定頁

**個人設定：**
- 修改顯示名稱
- 修改代表色
- 修改預設幣別（記帳表單開啟時的預設選項）
- 修改密碼

**家庭設定：**
- 家庭名稱
- 查看邀請碼（可複製 / 重新分享）
- 成員列表

**預算設定：**
- 設定家庭每月 TWD 總預算
- 設定家庭每月 USD 總預算
- 設定個人每月 TWD 總預算
- 設定個人每月 USD 總預算
- 各類別可分別設定 TWD 或 USD 預算

**資料管理：**
- 匯出 CSV（本月 / 全部），欄位包含：日期、帳本、類型、幣別、金額、類別、備註、記帳者
- 清除個人資料

---

## 六、UI/UX 規範

### 6.1 色彩設計

```
主色（家庭帳本）: #4F46E5  indigo-600
副色（個人帳本）: #0EA5E9  sky-500
TWD Badge 色:     #15803D  green-700（背景 #DCFCE7）
USD Badge 色:     #B45309  amber-700（背景 #FEF3C7）
支出顏色:         #EF4444  red-500
收入顏色:         #22C55E  green-500
背景:             #F8FAFC  slate-50
卡片:             #FFFFFF
文字主色:         #1E293B  slate-800
文字次色:         #64748B  slate-500
```

### 6.2 幣別 Badge 樣式

```
┌──────────────────────────────────────────┐
│ 🍽️ 餐飲　晚餐                            │
│    老公 ●                                 │
│                    ╔══════╗  NT$850      │
│                    ║ NT$  ║              │
│                    ╚══════╝              │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│ ✈️ 旅遊　機票                            │
│    老婆 ●                                 │
│                    ╔═════╗  $320.00     │
│                    ║ USD ║              │
│                    ╚═════╝              │
└──────────────────────────────────────────┘
```

### 6.3 設計原則

- 家庭帳本主色 indigo，個人帳本次色 sky，視覺清楚區分
- TWD 綠色 badge，USD 琥珀色 badge，一眼辨識幣別
- 統計頁不混算，TWD / USD 切換清楚
- 金額大字，類別圖示明顯，單手操作友善
- 記帳不超過 3 步驟：點 FAB → 選幣別填金額 → 選類別 → 送出
- 支援深色模式（dark mode）

### 6.4 響應式斷點

| 裝置 | 寬度 | 佈局 |
|------|------|------|
| 手機 | < 640px | 單欄，底部導航 |
| 平板 | 640–1024px | 單欄，底部導航 |
| 桌面 | > 1024px | 側邊導航，雙欄 |

---

## 七、PWA 設定

```json
{
  "name": "家帳 FamilyLedger",
  "short_name": "家帳",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#F8FAFC",
  "theme_color": "#4F46E5",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- **Service Worker**：快取靜態資源，離線可查看最近交易資料
- **iOS 安裝提示**：偵測 Safari + iOS，顯示「加入主畫面」引導提示

---

## 八、即時同步（Realtime）

```typescript
// 訂閱家庭帳本新交易（家庭帳本頁面掛載時執行）
const subscription = supabase
  .channel('family_transactions')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'transactions',
    filter: `family_id=eq.${familyId}&ledger_type=eq.family`
  }, (payload) => {
    refreshTransactions();
  })
  .subscribe();
```

---

## 九、TypeScript 型別定義

```typescript
// src/types/index.ts

export type Currency = 'TWD' | 'USD';
export type LedgerType = 'family' | 'personal';
export type TransactionType = 'expense' | 'income';

export interface Transaction {
  id: string;
  family_id: string;
  owner_id: string;
  ledger_type: LedgerType;
  type: TransactionType;
  amount: number;            // 原始金額（使用者輸入）
  currency: Currency;        // 原始幣別
  category_id: string;
  note?: string;
  transaction_date: string;  // 'YYYY-MM-DD'
  receipt_url?: string;
  created_at: string;
  updated_at: string;
  // JOIN 資料
  category?: Category;
  owner?: UserProfile;
}

export interface UserProfile {
  id: string;
  family_id: string;
  display_name: string;
  avatar_color: string;
  default_currency: Currency;
}

export interface Family {
  id: string;
  name: string;
  invite_code: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  type: TransactionType;
  is_shared: boolean;
}

export interface Budget {
  id: string;
  family_id: string;
  owner_id?: string;
  ledger_type: LedgerType;
  category_id?: string;
  year_month: string;   // 'YYYY-MM'
  amount: number;
  currency: Currency;
}

// 統計用：分幣別加總結果
export interface CurrencySummary {
  TWD: number;
  USD: number;
}

export interface MonthlySummary {
  income: CurrencySummary;
  expense: CurrencySummary;
  balance: CurrencySummary;
}
```

---

## 十、專案目錄結構

```
family-ledger/
├── public/
│   ├── manifest.json
│   ├── icon-192.png
│   └── icon-512.png
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── BottomNav.tsx
│   │   │   └── SideNav.tsx
│   │   ├── transaction/
│   │   │   ├── TransactionForm.tsx      # 新增/編輯表單（含幣別選擇）
│   │   │   ├── TransactionList.tsx      # 交易清單（含幣別篩選）
│   │   │   └── TransactionItem.tsx      # 單筆交易（含幣別 Badge）
│   │   ├── charts/
│   │   │   ├── PieChart.tsx
│   │   │   ├── BarChart.tsx
│   │   │   └── LineChart.tsx
│   │   ├── budget/
│   │   │   └── BudgetProgress.tsx       # 分幣別進度條
│   │   └── common/
│   │       ├── MonthPicker.tsx
│   │       ├── CategoryPicker.tsx
│   │       ├── AmountInput.tsx          # 金額輸入（依幣別決定小數位）
│   │       ├── CurrencySelector.tsx     # TWD / USD 切換元件
│   │       ├── CurrencyBadge.tsx        # [NT$] / [USD] Badge 元件
│   │       ├── DualCurrencyDisplay.tsx  # 雙幣別分行顯示元件
│   │       └── FAB.tsx
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── FamilyLedger.tsx
│   │   ├── PersonalLedger.tsx
│   │   ├── Statistics.tsx
│   │   ├── Settings.tsx
│   │   └── auth/
│   │       ├── Login.tsx
│   │       ├── Register.tsx
│   │       └── JoinFamily.tsx
│   ├── hooks/
│   │   ├── useTransactions.ts           # 交易 CRUD + 幣別篩選
│   │   ├── useMonthlySummary.ts         # 分幣別加總統計
│   │   ├── useBudgets.ts
│   │   ├── useCategories.ts
│   │   └── useRealtimeSync.ts
│   ├── lib/
│   │   ├── supabase.ts
│   │   ├── currency.ts                  # 格式化工具（formatTWD / formatUSD）
│   │   └── utils.ts
│   ├── store/
│   │   └── authStore.ts                 # Zustand 全域狀態
│   ├── types/
│   │   └── index.ts
│   ├── App.tsx
│   └── main.tsx
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_schema.sql
│   └── seed.sql
├── .env.local
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── vite.config.ts
```

---

## 十一、幣別工具函式

```typescript
// src/lib/currency.ts

export type Currency = 'TWD' | 'USD';

export function formatAmount(amount: number, currency: Currency): string {
  if (currency === 'TWD') {
    return `NT$${Math.round(amount).toLocaleString('zh-TW')}`;
  }
  return `$${amount.toFixed(2)}`;
}

// 統計用：從交易陣列分幣別加總
export function sumByCurrency(
  transactions: { amount: number; currency: Currency }[]
): Record<Currency, number> {
  return transactions.reduce(
    (acc, t) => {
      acc[t.currency] += t.amount;
      return acc;
    },
    { TWD: 0, USD: 0 }
  );
}

// AmountInput 元件使用：依幣別決定驗證規則
export function getAmountConfig(currency: Currency) {
  return currency === 'TWD'
    ? { step: 1, placeholder: '0', decimals: 0 }
    : { step: 0.01, placeholder: '0.00', decimals: 2 };
}
```

---

## 十二、環境變數

```env
# .env.local
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

---

## 十三、package.json 依賴

```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.0",
    "@supabase/supabase-js": "^2.45.0",
    "zustand": "^4.5.4",
    "recharts": "^2.12.7",
    "date-fns": "^3.6.0",
    "react-hook-form": "^7.52.0",
    "zod": "^3.23.8",
    "@hookform/resolvers": "^3.9.0",
    "lucide-react": "^0.418.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.4.0"
  },
  "devDependencies": {
    "typescript": "^5.5.4",
    "vite": "^5.4.1",
    "vite-plugin-pwa": "^0.20.1",
    "@vitejs/plugin-react": "^4.3.1",
    "tailwindcss": "^3.4.7",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.40"
  }
}
```

---

## 十四、開發啟動步驟

```bash
# 1. 建立專案
npm create vite@latest family-ledger -- --template react-ts
cd family-ledger

# 2. 安裝依賴
npm install

# 3. 設定 Supabase
# - 到 supabase.com 建立新專案
# - 複製 URL 和 anon key 到 .env.local
# - SQL Editor 執行 supabase/migrations/001_initial_schema.sql
# - 執行 supabase/seed.sql 插入預設類別

# 4. 啟動開發伺服器
npm run dev

# 5. 建置 PWA
npm run build
# 部署 dist/ 到 Vercel
```

---

## 十五、MVP 功能優先順序

| 優先級 | 功能 |
|--------|------|
| P0（必做） | 使用者認證、家庭配對、新增交易（TWD / USD 選擇）、家庭帳本清單、個人帳本清單 |
| P1（第一版） | 月份篩選、幣別篩選 Chip、類別圖示選擇、分幣別統計圓餅圖、RLS 資料隔離 |
| P2（第二版） | 預算設定（分幣別）、收據照片、即時同步、CSV 匯出 |
| P3（未來） | 重複性帳目（每月房租）、分帳計算、通知提醒 |

---

*本規格書版本 v1.2，適用於 FamilyLedger MVP 開發。介面語言：繁體中文。支援幣別：新台幣（TWD）/ 美金（USD），各自獨立記錄，不做自動換算。*

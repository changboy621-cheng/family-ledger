export type Currency = 'TWD' | 'USD';
export type LedgerType = 'family' | 'personal';
export type TransactionType = 'expense' | 'income';
export type PaymentMethod = 'cash' | 'card';

export interface Family {
  id: string;
  name: string;
  invite_code: string;
  /** 家庭自訂的類別顯示順序（依序排列的 category id）；未列到者退回各類別的 sort_order。 */
  category_order?: string[] | null;
  created_at?: string;
}

export interface UserProfile {
  id: string;
  family_id: string;
  display_name: string;
  avatar_color: string;
  default_currency: Currency;
  created_at?: string;
}

export interface Category {
  id: string;
  family_id?: string | null;
  owner_id?: string | null;
  name: string;
  icon: string;
  type: TransactionType;
  is_shared: boolean;
  sort_order?: number;
}

export interface Transaction {
  id: string;
  family_id: string;
  owner_id: string;
  recorded_by?: string | null;
  ledger_type: LedgerType;
  type: TransactionType;
  amount: number;
  currency: Currency;
  category_id: string;
  note?: string | null;
  payment_method?: PaymentMethod | null;
  transaction_date: string;
  receipt_url?: string | null;
  /** 由固定收支自動記入時，來源規則與所屬月份。 */
  recurring_id?: string | null;
  recurring_month?: string | null;
  created_at: string;
  updated_at: string;
  category?: Category | null;
  owner?: UserProfile | null;
}

export interface Budget {
  id: string;
  family_id: string;
  /** 個人預算為本人 id；家庭預算為 null。 */
  owner_id: string | null;
  ledger_type: LedgerType;
  /** null = 該帳本的每月總預算。 */
  category_id: string | null;
  /** 生效月份（YYYY-MM），之後每月沿用直到再次調整。 */
  year_month: string;
  amount: number;
  currency: Currency;
}

export interface RecurringTransaction {
  id: string;
  family_id: string;
  owner_id: string;
  ledger_type: LedgerType;
  type: TransactionType;
  amount: number;
  currency: Currency;
  category_id: string;
  note?: string | null;
  payment_method?: PaymentMethod | null;
  /** 每月幾號（1–31），短月份記在月底。 */
  day_of_month: number;
  /** 第一個要記入的月份（YYYY-MM）。 */
  start_month: string;
  /** 已處理到的月份（YYYY-MM）；null = 尚未產生過。 */
  last_generated_month: string | null;
  active: boolean;
}

export interface CurrencySummary {
  TWD: number;
  USD: number;
}

export interface MonthlySummary {
  income: CurrencySummary;
  expense: CurrencySummary;
  balance: CurrencySummary;
}

export interface CategoryExpenseSummary {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  totals: CurrencySummary;
  ratios: CurrencySummary;
}

export interface OwnerExpenseSummary {
  ownerId: string;
  ownerName: string;
  avatarColor: string;
  totals: CurrencySummary;
  ratios: CurrencySummary;
  categories: CategoryExpenseSummary[];
}

export interface PaymentExpenseSummary {
  method: PaymentMethod | 'unspecified';
  totals: CurrencySummary;
  ratios: CurrencySummary;
}

export interface DailyExpensePoint {
  date: string;
  day: number;
  totals: CurrencySummary;
}

export interface MonthlyExpensePoint {
  yearMonth: string;
  label: string;
  totals: CurrencySummary;
}

export interface LedgerAnalysis {
  summary: MonthlySummary;
  topCategories: CategoryExpenseSummary[];
  expenseByCategory: CategoryExpenseSummary[];
  expenseByOwner: OwnerExpenseSummary[];
  expenseByPayment: PaymentExpenseSummary[];
  dailyExpenseTrend: DailyExpensePoint[];
  monthlyExpenseTrend: MonthlyExpensePoint[];
}

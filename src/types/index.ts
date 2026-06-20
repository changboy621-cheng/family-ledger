export type Currency = 'TWD' | 'USD';
export type LedgerType = 'family' | 'personal';
export type TransactionType = 'expense' | 'income';
export type PaymentMethod = 'cash' | 'card';

export interface Family {
  id: string;
  name: string;
  invite_code: string;
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
  created_at: string;
  updated_at: string;
  category?: Category | null;
  owner?: UserProfile | null;
  recorder?: UserProfile | null;
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
  dailyExpenseTrend: DailyExpensePoint[];
  monthlyExpenseTrend: MonthlyExpensePoint[];
}

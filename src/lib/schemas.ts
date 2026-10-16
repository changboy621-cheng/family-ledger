import { z } from 'zod';
import type { Budget, Category, RecurringTransaction, Transaction, UserProfile } from '../types';
import type { Trip, TripCashExchange, TripExpense } from './trips';
import type { EntryRow } from './suggestions';
import type { OnboardingDraft } from './onboarding';
import { DEFAULT_AVATAR_COLOR } from './constants';

// 外部資料邊界（Supabase 列、RPC、localStorage）的 runtime 驗證，
// 取代散落各處對未驗證資料的 `as Transaction[]` / `as unknown as` 等不安全轉型。

export const currencySchema = z.enum(['TWD', 'USD']);
export const ledgerTypeSchema = z.enum(['family', 'personal']);
export const transactionTypeSchema = z.enum(['expense', 'income']);
export const paymentMethodSchema = z.enum(['cash', 'card']);

export const userProfileSchema = z.object({
  id: z.string(),
  family_id: z.string(),
  display_name: z.string(),
  avatar_color: z.string().catch(DEFAULT_AVATAR_COLOR),
  default_currency: currencySchema.catch('TWD'),
  created_at: z.string().optional()
});

export const categorySchema = z.object({
  id: z.string(),
  family_id: z.string().nullish(),
  owner_id: z.string().nullish(),
  name: z.string(),
  icon: z.string().catch('🏷️'),
  type: transactionTypeSchema,
  is_shared: z.boolean().catch(false),
  sort_order: z.number().nullish()
});

export const transactionSchema = z.object({
  id: z.string(),
  family_id: z.string(),
  owner_id: z.string(),
  recorded_by: z.string().nullish(),
  ledger_type: ledgerTypeSchema,
  type: transactionTypeSchema,
  amount: z.number(),
  currency: currencySchema,
  category_id: z.string(),
  note: z.string().nullish(),
  payment_method: paymentMethodSchema.nullish(),
  transaction_date: z.string(),
  receipt_url: z.string().nullish(),
  // numeric 欄位經 PostgREST 可能以字串回傳；壞值退回 null（不整列丟棄）。
  latitude: z.coerce.number().min(-90).max(90).nullish().catch(null),
  longitude: z.coerce.number().min(-180).max(180).nullish().catch(null),
  place_name: z.string().nullish().catch(null),
  recurring_id: z.string().nullish().catch(null),
  recurring_month: z.string().nullish().catch(null),
  // join 出來的巢狀資料若壞掉，退回 null 而非整列丟棄。
  created_at: z.string().catch(''),
  updated_at: z.string().catch(''),
  category: categorySchema.nullish().catch(null),
  owner: userProfileSchema.nullish().catch(null)
});

export const budgetSchema = z.object({
  id: z.string(),
  family_id: z.string(),
  owner_id: z.string().nullable(),
  ledger_type: ledgerTypeSchema,
  category_id: z.string().nullable(),
  // DB 為 char(7)，保險起見去掉可能的尾端空白。
  year_month: z.string().transform((value) => value.trim()),
  // numeric 欄位經 PostgREST 可能以字串回傳，統一轉成數字。
  amount: z.coerce.number(),
  currency: currencySchema
});

// char(7) 可能帶尾端空白；格式不對的列直接丟棄，避免產生邏輯拿到壞月份。
const yearMonthSchema = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.string().regex(/^\d{4}-\d{2}$/));

export const recurringTransactionSchema = z.object({
  id: z.string(),
  family_id: z.string(),
  owner_id: z.string(),
  ledger_type: ledgerTypeSchema,
  type: transactionTypeSchema,
  amount: z.coerce.number().positive(),
  currency: currencySchema,
  category_id: z.string(),
  note: z.string().nullish(),
  payment_method: paymentMethodSchema.nullish().catch(null),
  day_of_month: z.coerce.number().int().min(1).max(31),
  start_month: yearMonthSchema,
  last_generated_month: yearMonthSchema.nullable(),
  active: z.boolean()
});

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}/).transform((value) => value.slice(0, 10));
const currencyCodeSchema = z.string().regex(/^[A-Z]{3}$/);

export const tripSchema = z.object({
  id: z.string(),
  family_id: z.string(),
  created_by: z.string().nullish().catch(null),
  name: z.string(),
  destination: z.string().nullish().catch(null),
  start_date: isoDateSchema,
  end_date: isoDateSchema,
  local_currency: currencyCodeSchema,
  rate: z.coerce.number().positive(),
  budget_twd: z.coerce.number().positive().nullish().catch(null)
});

export const tripExpenseSchema = z.object({
  id: z.string(),
  trip_id: z.string(),
  family_id: z.string(),
  paid_by: z.string().nullish().catch(null),
  recorded_by: z.string().nullish().catch(null),
  expense_date: isoDateSchema,
  amount: z.coerce.number().positive(),
  currency: currencyCodeSchema,
  rate: z.coerce.number().positive(),
  category: z.string().catch('other'),
  payment_method: paymentMethodSchema.nullish().catch(null),
  note: z.string().nullish().catch(null),
  latitude: z.coerce.number().min(-90).max(90).nullish().catch(null),
  longitude: z.coerce.number().min(-180).max(180).nullish().catch(null),
  place_name: z.string().nullish().catch(null)
});

export const tripCashExchangeSchema = z.object({
  id: z.string(),
  trip_id: z.string(),
  family_id: z.string(),
  recorded_by: z.string().nullish().catch(null),
  exchange_date: isoDateSchema,
  currency: currencyCodeSchema,
  amount: z.coerce.number().positive(),
  rate: z.coerce.number().positive(),
  note: z.string().nullish().catch(null)
});

export const entryRowSchema = z.object({
  note: z.string().nullish().catch(null),
  transaction_date: z.string().optional(),
  // 聰明帶入用欄位：壞值退回 null，不整列丟棄。
  category_id: z.string().nullish().catch(null),
  amount: z.number().nullish().catch(null),
  currency: currencySchema.nullish().catch(null),
  payment_method: paymentMethodSchema.nullish().catch(null)
});

export const onboardingDraftSchema = z.object({
  mode: z.enum(['create', 'join']),
  displayName: z.string(),
  defaultCurrency: currencySchema,
  inviteCode: z.string().optional(),
  email: z.string().optional(),
  requiresEmailVerification: z.boolean().optional()
});

export const inviteFamilySchema = z.object({ id: z.string(), name: z.string() });

/** 逐列安全解析：丟棄不符結構的列並記錄，避免單一壞資料讓整個畫面崩潰或被迫用 unsafe cast。 */
function safeParseRows<T>(schema: z.ZodTypeAny, data: unknown, label: string): T[] {
  if (!Array.isArray(data)) return [];
  const out: T[] = [];
  for (const row of data) {
    const result = schema.safeParse(row);
    if (result.success) out.push(result.data as T);
    else console.warn(`[schemas] 丟棄不符結構的${label}資料列`, result.error.issues);
  }
  return out;
}

export const parseTransactions = (data: unknown): Transaction[] =>
  safeParseRows<Transaction>(transactionSchema, data, '交易');
export const parseCategories = (data: unknown): Category[] =>
  safeParseRows<Category>(categorySchema, data, '分類');
export const parseUserProfiles = (data: unknown): UserProfile[] =>
  safeParseRows<UserProfile>(userProfileSchema, data, '成員');
export const parseBudgets = (data: unknown): Budget[] => safeParseRows<Budget>(budgetSchema, data, '預算');
export const parseRecurringTransactions = (data: unknown): RecurringTransaction[] =>
  safeParseRows<RecurringTransaction>(recurringTransactionSchema, data, '固定收支');
export const parseTrips = (data: unknown): Trip[] => safeParseRows<Trip>(tripSchema, data, '旅行');
export const parseTripExpenses = (data: unknown): TripExpense[] =>
  safeParseRows<TripExpense>(tripExpenseSchema, data, '旅行花費');
export const parseTripCashExchanges = (data: unknown): TripCashExchange[] =>
  safeParseRows<TripCashExchange>(tripCashExchangeSchema, data, '換匯紀錄');
export const parseEntryRows = (data: unknown): EntryRow[] =>
  safeParseRows<EntryRow>(entryRowSchema, data, '建議');

export function parseOnboardingDraft(raw: unknown): OnboardingDraft | null {
  const result = onboardingDraftSchema.safeParse(raw);
  return result.success ? (result.data as OnboardingDraft) : null;
}

export function parseInviteFamily(raw: unknown): { id: string; name: string } | null {
  const result = inviteFamilySchema.safeParse(raw);
  return result.success ? result.data : null;
}

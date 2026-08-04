// Computed-field formula registry for HR form templates.
//
// A template field with source="computed" references one of these functions
// by name, e.g. formula: "sum_fields(base_salary, housing_allowance)".
// Only registered names are callable — admin-authored schemas can never
// inject arbitrary code, and the builder UI offers these as a dropdown.

import type { HrFieldValue, HrTableRow } from "./types";

type FormulaFn = (args: string[], data: Record<string, HrFieldValue>) => HrFieldValue;

const num = (v: HrFieldValue | undefined): number => {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

const dateOf = (v: HrFieldValue | undefined): Date | null => {
  if (typeof v !== "string" || !v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const FORMULAS: Record<string, FormulaFn> = {
  /** Inclusive day count between two date fields (leave duration convention). */
  date_diff_days: ([startKey, endKey], data) => {
    const start = dateOf(data[startKey]);
    const end = dateOf(data[endKey]);
    if (!start || !end) return null;
    return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
  },

  /** Sum of any number of numeric fields. */
  sum_fields: (keys, data) => keys.reduce((acc, k) => acc + num(data[k]), 0),

  /** subtract(a, b) = a - b. */
  subtract: ([aKey, bKey], data) => num(data[aKey]) - num(data[bKey]),

  /** Sum of one or more numeric columns across all rows of a table field: sum_table_columns(table, col1, col2). */
  sum_table_columns: ([tableKey, ...colKeys], data) => {
    const rows = data[tableKey];
    if (!Array.isArray(rows)) return 0;
    return (rows as HrTableRow[]).reduce(
      (acc, row) => acc + colKeys.reduce((s, c) => s + num(row?.[c] ?? null), 0),
      0,
    );
  },

  /** Elapsed period between two dates as "Xy Xm Xd". */
  period_ymd: ([startKey, endKey], data) => {
    const start = dateOf(data[startKey]);
    const end = dateOf(data[endKey]);
    if (!start || !end || end < start) return null;
    let years = end.getFullYear() - start.getFullYear();
    let months = end.getMonth() - start.getMonth();
    let days = end.getDate() - start.getDate();
    if (days < 0) {
      months -= 1;
      days += new Date(end.getFullYear(), end.getMonth(), 0).getDate();
    }
    if (months < 0) {
      years -= 1;
      months += 12;
    }
    return `${years}y ${months}m ${days}d`;
  },

  /**
   * End-of-service gratuity per Saudi Labor Law (articles 84/85):
   * half a month's wage per year for the first five years, a full month per
   * year after; on resignation, scaled by service length
   * (<2y: 0, 2-5y: 1/3, 5-10y: 2/3, 10y+: full).
   * eos_gratuity(hire_date, last_working_date, monthly_wage, separation_type)
   */
  eos_gratuity: ([hireKey, endKey, wageKey, typeKey], data) => {
    const hire = dateOf(data[hireKey]);
    const end = dateOf(data[endKey]);
    const wage = num(data[wageKey]);
    if (!hire || !end || end < hire || wage <= 0) return null;
    const serviceYears = (end.getTime() - hire.getTime()) / (MS_PER_DAY * 365.25);
    const firstFive = Math.min(serviceYears, 5);
    const afterFive = Math.max(serviceYears - 5, 0);
    let award = firstFive * 0.5 * wage + afterFive * wage;
    if (data[typeKey] === "resignation") {
      if (serviceYears < 2) award = 0;
      else if (serviceYears < 5) award *= 1 / 3;
      else if (serviceYears < 10) award *= 2 / 3;
    }
    return Math.round(award * 100) / 100;
  },

  /** Payout for unused leave days at current wage: leave_payout(monthly_wage, balance_days). */
  leave_payout: ([wageKey, daysKey], data) => {
    const wage = num(data[wageKey]);
    const days = num(data[daysKey]);
    if (wage <= 0 || days <= 0) return 0;
    return Math.round((wage / 30) * days * 100) / 100;
  },
};

export const FORMULA_NAMES = Object.keys(FORMULAS);

/** Human-readable descriptions shown in the builder's formula picker. */
export const FORMULA_DESCRIPTIONS: Record<string, { en: string; ar: string }> = {
  date_diff_days: { en: "Days between two dates (inclusive)", ar: "عدد الأيام بين تاريخين (شامل)" },
  sum_fields: { en: "Sum of numeric fields", ar: "مجموع حقول رقمية" },
  subtract: { en: "First field minus second field", ar: "الحقل الأول ناقص الثاني" },
  sum_table_columns: { en: "Sum of table columns across all rows", ar: "مجموع أعمدة جدول عبر كل الصفوف" },
  period_ymd: { en: "Period between two dates (years/months/days)", ar: "المدة بين تاريخين (سنوات/أشهر/أيام)" },
  eos_gratuity: { en: "End-of-service award (Saudi Labor Law)", ar: "مكافأة نهاية الخدمة (نظام العمل السعودي)" },
  leave_payout: { en: "Unused leave balance payout", ar: "بدل رصيد الإجازات غير المستخدم" },
};

const FORMULA_PATTERN = /^\s*([a-z_]+)\s*\(\s*([^)]*)\s*\)\s*$/;

/**
 * Evaluate a formula string like "sum_fields(a, b, c)" against resolved form
 * data. Unknown names or malformed expressions resolve to null (rendered as
 * an empty value) rather than throwing mid-render.
 */
export function evaluateFormula(
  formula: string | undefined,
  data: Record<string, HrFieldValue>,
): HrFieldValue {
  if (!formula) return null;
  const match = FORMULA_PATTERN.exec(formula);
  if (!match) return null;
  const fn = FORMULAS[match[1]];
  if (!fn) return null;
  const args = match[2]
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);
  try {
    return fn(args, data);
  } catch {
    return null;
  }
}

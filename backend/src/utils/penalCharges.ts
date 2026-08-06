const LEGACY_ANNUALIZED_MONTHLY_RATE_THRESHOLD = 12;
const PENAL_CHARGE_DAYS_IN_YEAR = 365;

export function normalizeMonthlyPenalRate(rate: unknown): number {
  const parsed = Number(rate || 0);
  if (!Number.isFinite(parsed)) return 0;

  // Older imports may still come in as 36, which historically represented the
  // old 3% monthly rule (36 / 12 = 3). Under the new yearly rule we should
  // normalize that to the equivalent 3% yearly rate.
  return parsed > LEGACY_ANNUALIZED_MONTHLY_RATE_THRESHOLD ? parsed / 12 : parsed;
}

export function calculateMonthlyPenalAmountRaw(
  amount: number,
  monthlyRate: unknown,
  dayCount: number,
): number {
  return (amount * normalizeMonthlyPenalRate(monthlyRate) * dayCount) / (PENAL_CHARGE_DAYS_IN_YEAR * 100);
}

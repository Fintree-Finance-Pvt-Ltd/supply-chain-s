const LEGACY_ANNUAL_PENAL_RATE_THRESHOLD = 12;
const PENAL_CHARGE_DAYS_IN_MONTH = 30;

export function normalizeMonthlyPenalRate(rate: unknown): number {
  const parsed = Number(rate || 0);
  if (!Number.isFinite(parsed)) return 0;

  // Legacy records stored annual penal rates like 36; the current business rule stores monthly rates.
  return parsed > LEGACY_ANNUAL_PENAL_RATE_THRESHOLD ? parsed / 12 : parsed;
}

export function calculateMonthlyPenalAmountRaw(
  amount: number,
  monthlyRate: unknown,
  dayCount: number,
): number {
  return (amount * normalizeMonthlyPenalRate(monthlyRate) * dayCount) / (PENAL_CHARGE_DAYS_IN_MONTH * 100);
}

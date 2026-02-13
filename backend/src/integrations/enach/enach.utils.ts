export function normalizeAccountType(type?: string): string | undefined {
  if (!type) return undefined;
  const v = type.toUpperCase();
  if (v === 'SAVINGS') return 'savings';
  if (v === 'CURRENT') return 'current';
  return type.toLowerCase();
}

export function pennyAmount(): string {
  return String(Number(process.env.DIGIO_PENNY_AMOUNT ?? '1.00'));
}

export function mapWebhookEvent(eventRaw: string): string {
  const e = eventRaw.toLowerCase().replace(/^apimndt\./, '').replace(/^mndt\./, '');

  switch (e) {
    case 'authsuccess':
      return 'AUTH_SUCCESS';
    case 'authfail':
      return 'AUTH_FAILED';
    case 'destaccept':
    case 'destbankaccept':
      return 'ACTIVE';
    case 'destreject':
    case 'destbankreject':
    case 'npcireject':
      return 'FAILED';
    case 'cancelinit':
      return 'CANCEL_INITIATED';
    default:
      return 'UNKNOWN';
  }
}

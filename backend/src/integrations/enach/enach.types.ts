export interface BankVerificationResult {
  verified: boolean;
  providerId?: string;
  fuzzyMatchScore?: number;
  raw: any;
}

export interface EnachMandateResult {
  documentId: string;
  status: string;
  authUrl?: string | null;
  raw: any;
}

export type MandateStatus =
  | 'PENDING'
  | 'AUTH_SUCCESS'
  | 'AUTH_FAILED'
  | 'ACTIVE'
  | 'FAILED'
  | 'CANCEL_INITIATED'
  | 'UNKNOWN';

export interface AadhaarKycLinkResult {
  transactionId: string;
  longUrl?: string;
  shortUrl?: string;
  raw: any;
}

export interface AadhaarKycDetailsResult {
  success: boolean;
  transactionId: string;
  raw: any;
}

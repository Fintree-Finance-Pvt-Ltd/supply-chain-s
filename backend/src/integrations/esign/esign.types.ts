export type EsignProvider = 'DOQFY' | 'DIGIO';

export interface SignerInfo {
  name: string;
  email?: string;
  mobile: string;
}

export interface EsignInput {
  referenceId: string;
  branchId: number | string;
  pdfBase64: string;
  signer: SignerInfo;
}

export interface EsignResult {
  success: boolean;
  provider?: EsignProvider;
  orderId?: string;
  documentId?: string;
  signUrl?: string;
  error?: any;
}

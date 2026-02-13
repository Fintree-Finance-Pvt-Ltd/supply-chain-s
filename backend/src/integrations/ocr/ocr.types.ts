export interface PanOcrResult {
  pan: string;
  raw: any;
}

export interface ParsedPanResult {
  panNumber: string;
  name: string | null;
}

export interface ParsedAadhaarResult {
  aadhaarNumber: string;
  name: string | null;
}

export interface ChequeOcrResponse {
  success?: boolean;
  data?: any;
  [key: string]: any;
}

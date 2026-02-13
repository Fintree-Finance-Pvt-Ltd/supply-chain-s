import axios, { AxiosInstance } from 'axios';

export class DigioClient {
  private client: AxiosInstance;

  constructor(config?: {
    baseUrl?: string;
    clientId?: string;
    clientSecret?: string;
  }) {
    const baseURL = config?.baseUrl ?? process.env.DIGIO_BASE_URL;
    const clientId = config?.clientId ?? process.env.DIGIO_CLIENT_ID;
    const clientSecret = config?.clientSecret ?? process.env.DIGIO_CLIENT_SECRET;

    if (!baseURL || !clientId || !clientSecret) {
      console.warn('⚠️ DIGIO config missing');
    }

    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    });

    this.client.interceptors.request.use((cfg) => {
      const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      cfg.headers = cfg.headers ?? {};
      cfg.headers.authorization = `Basic ${basic}`;
      return cfg;
    });
  }

  verifyBankAccount(input: {
    beneficiary_account_no: string;
    beneficiary_ifsc: string;
    beneficiary_name?: string;
    amount?: string;
  }) {
    return this.client
      .post('/client/verify/bank_account', input)
      .then((r) => r.data);
  }

  fuzzyMatch(input: {
    context: string;
    source: { text: string };
    target: { text: string };
    confidence?: number;
  }) {
    return this.client
      .post('/v3/client/kyc/fuzzy_match', input)
      .then((r) => r.data);
  }

  createMandateForm(payload: any) {
    return this.client
      .post('/v3/client/mandate/create_form', payload)
      .then((r) => r.data);
  }
}

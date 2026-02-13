import axios from 'axios';
import {
  AadhaarKycLinkResult,
  AadhaarKycDetailsResult,
} from './aadhaar.types';

export class AadhaarService {
  private baseUrl = process.env.DIGITAP_BASE_URL!;
  private clientId = process.env.DIGITAP_CLIENT_ID!;
  private clientSecret = process.env.DIGITAP_CLIENT_SECRET!;

  constructor() {
    if (!this.baseUrl) {
      console.warn('DIGITAP_BASE_URL missing');
    }
  }

  // ---------------------------------------------------
  // 🔐 Build Authorization Header
  // ---------------------------------------------------
  private buildHeaders() {
    if (!this.clientId || !this.clientSecret) {
      throw new Error(
        'DIGITAP_CLIENT_ID or DIGITAP_CLIENT_SECRET missing',
      );
    }

    const token = Buffer.from(
      `${this.clientId}:${this.clientSecret}`,
    ).toString('base64');

    return {
      Authorization: token, // ✅ EXACTLY as Digitap docs
      'Content-Type': 'application/json',
      accept: '*/*',
    };
  }

  // ---------------------------------------------------
  // 1️⃣ Generate Aadhaar KYC Link
  // ---------------------------------------------------
  async generateKycLink(params: {
    firstName: string;
    lastName: string;
    uid: string;
    mobile: string;
    emailId?: string;
    redirectionUrl: string;
  }): Promise<AadhaarKycLinkResult> {
    if (!this.baseUrl) {
      throw new Error('DIGITAP_BASE_URL missing');
    }

    const url = `${this.baseUrl}/ent/v1/kyc/generate-url`;

    const payload = {
      serviceId: '4',
      uid: params.uid,
      firstName: params.firstName,
      lastName: params.lastName,
      mobile: params.mobile,
      emailId: params.emailId,
      isSendOtp: true, // Digitap handles OTP
      isHideExplanationScreen: false,
      redirectionUrl: params.redirectionUrl,
    };

    const { data } = await axios.post(url, payload, {
      headers: this.buildHeaders(),
      validateStatus: () => true,
    });

    return {
      transactionId: data?.model?.transactionId,
      longUrl: data?.model?.url,
      shortUrl: data?.model?.kycUrl,
      raw: data,
    };
  }

  // ---------------------------------------------------
  // 2️⃣ Fetch DigiLocker KYC Details
  // ---------------------------------------------------
  async fetchKycDetails(
    transactionId: string,
  ): Promise<AadhaarKycDetailsResult> {
    if (!this.baseUrl) {
      throw new Error('DIGITAP_BASE_URL missing');
    }
    if (!transactionId) {
      throw new Error('transactionId is required');
    }

    const url = `${this.baseUrl}/ent/v1/kyc/get-digilocker-details`;
    const payload = { transactionId };

    const { data } = await axios.post(url, payload, {
      headers: this.buildHeaders(),
      validateStatus: () => true,
    });

    const success =
      data?.code === '200' ||
      data?.success === true ||
      data?.status === 'SUCCESS' ||
      data?.status === 'success';

    return {
      success,
      transactionId,
      raw: data,
    };
  }

  // ---------------------------------------------------
  // 3️⃣ (Optional) List DigiLocker Documents
  // ---------------------------------------------------
  async listDocuments(transactionId: string): Promise<any> {
    if (!this.baseUrl) {
      throw new Error('DIGITAP_BASE_URL missing');
    }
    if (!transactionId) {
      throw new Error('transactionId is required');
    }

    const url = `${this.baseUrl}/ent/v1/digilocker/list-docs`;
    const payload = { transactionId };

    const { data } = await axios.post(url, payload, {
      headers: this.buildHeaders(),
      validateStatus: () => true,
    });

    return data;
  }
}

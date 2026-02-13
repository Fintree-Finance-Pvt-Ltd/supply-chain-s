import axios from 'axios';
import { EsignInput, EsignResult } from './esign.types';

const client = axios.create({
  baseURL: process.env.DIGIO_BASE_URL || 'https://api.digio.in',
  timeout: 30000,
  auth: {
    username: process.env.DIGIO_ESIGN_CLIENT_ID!,
    password: process.env.DIGIO_ESIGN_CLIENT_SECRET!,
  },
  headers: {
    'Content-Type': 'application/json',
  },
});

export async function createDigioEsign(
  input: EsignInput,
): Promise<EsignResult> {
  try {
    const payload = {
      file_name: 'Agreement.pdf',
      expire_in_days: 10,
      notify_signers: true,
      send_sign_link: true,
      include_authentication_url: true,
      display_on_page: 'all',
      signers: [
        {
          identifier: input.signer.mobile || input.signer.email,
          name: input.signer.name,
          sign_type: 'aadhaar',
          reason: 'Agreement Signing',
        },
      ],
      reference_id: `${input.referenceId}_${Date.now()}`,
      file_data: input.pdfBase64,
    };

    const res = await client.post('/v2/client/document/uploadpdf', payload);

    return {
      success: true,
      provider: 'DIGIO',
      orderId: res.data.id,
      documentId: res.data.id,
      signUrl: res.data.authentication_url,
    };
  } catch (error) {
    return {
      success: false,
      provider: 'DIGIO',
      error,
    };
  }
}

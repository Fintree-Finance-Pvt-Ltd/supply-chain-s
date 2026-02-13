import axios from 'axios';
import { EsignInput, EsignResult } from './esign.types';

const client = axios.create({
  baseURL: process.env.DOQFY_BASE_URL,
  timeout: 30000,
  headers: {
    'api-key': process.env.DOQFY_API_KEY!,
    'secret-key': process.env.DOQFY_SECRET_KEY!,
    'Content-Type': 'application/json',
  },
});

export async function createDoqfyEsign(
  input: EsignInput,
): Promise<EsignResult> {
  try {
    const payload = {
      file_name: 'Agreement.pdf',
      is_bulk: false,
      order_details: [
        {
          branch_id: String(input.branchId),
          referance_id: input.referenceId,
          estamps: [],
          esigns: {
            party_users: [
              {
                name: input.signer.name,
                email: input.signer.email,
                contact_number: input.signer.mobile,
                sign_position: 'BOTTOM_RIGHT',
                method: 'AADHAAR',
                pages: 'ALL',
              },
            ],
          },
        },
      ],
      document: input.pdfBase64,
    };

    const res = await client.post('/order/cat/upload/', payload);
    const orderId = res.data?.content?.order_id;

    if (!orderId) throw new Error('Doqfy order_id missing');

    return {
      success: true,
      provider: 'DOQFY',
      orderId: String(orderId),
    };
  } catch (error) {
    return {
      success: false,
      provider: 'DOQFY',
      error,
    };
  }
}

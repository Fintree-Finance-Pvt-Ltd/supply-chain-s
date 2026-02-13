import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { GstDetailsResult } from './gst.types';

export class GstService {
  private zoopUrl = process.env.ZOOP_GST_API_URL!;
  private zoopKey = process.env.ZOOP_API_KEY!;
  private zoopAppId = process.env.ZOOP_APP_ID!;

  // ---------------------------------------------------
  // 🔥 GST DETAILS (ZOOP)
  // ---------------------------------------------------
  async getGstDetails(gstNumber: string): Promise<GstDetailsResult> {
    if (!gstNumber) {
      throw new Error('GST number is required');
    }

    try {
      const payload = {
        mode: 'sync',
        data: {
          business_gstin_number: gstNumber.toUpperCase(),
          contact_info: true,
          financial_year: '2024-25',
          consent: 'Y',
          consent_text:
            'I hereby declare my consent agreement for fetching my information via ZOOP API.',
        },
        task_id: uuidv4(),
      };

      const { data } = await axios.post(this.zoopUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.zoopKey,
          'app-id': this.zoopAppId,
        },
        validateStatus: () => true,
      });

      return {
        success: true,
        provider: 'ZOOP',
        data,
      };
    } catch (error: any) {
      return {
        success: false,
        provider: 'ZOOP',
        message: error?.message || 'GST verification failed',
      };
    }
  }
}

import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { PanValidationResult } from './pan.types';

export class PanService {
  private zoopUrl = process.env.ZOOP_PAN_API_URL!;
  private zoopApiKey = process.env.ZOOP_API_KEY!;
  private zoopAppId = process.env.ZOOP_APP_ID!;

  private finanalyzUrl = process.env.FINANALYZ_PAN_URL!;
  private finanalyzKey = process.env.FINANALYZ_X_API_KEY!;

  // ---------------------------------------------------
  // 🔥 Unified PAN Validation
  // ---------------------------------------------------
  async validatePan(pan: string, name: string): Promise<PanValidationResult> {
    if (!pan || !name) {
      throw new Error('PAN number and name are required');
    }

    // 1️⃣ FINANALYZ (Primary)
    // try {
    //   const { data } = await axios.post(
    //     this.finanalyzUrl,
    //     { panNumber: pan.toUpperCase() },
    //     {
    //       headers: {
    //         'Content-Type': 'application/json',
    //         XApiKey: this.finanalyzKey,
    //       },
    //       validateStatus: () => true,
    //     },
    //   );

    //   const resp = data?.data?.response;

    //   if (resp?.code === 200 && resp?.isValid === true) {
    //     return {
    //       success: true,
    //       verified: true,
    //       provider: 'FINANALYZ',
    //       details: {
    //         pan: resp.pan,
    //         name: resp.name,
    //         firstName: resp.firstName,
    //         middleName: resp.middleName,
    //         lastName: resp.lastName,
    //         gender: resp.gender,
    //         dob: resp.dob,
    //         address: resp.address,
    //         city: resp.city,
    //         state: resp.state,
    //         country: resp.country,
    //         pincode: resp.pincode,
    //         maskedAadhaar: resp.maskedAadhaar,
    //         lastFourDigit: resp.lastFourDigit,
    //         typeOfHolder: resp.typeOfHolder,
    //         isValid: resp.isValid,
    //         aadhaarSeedingStatus: resp.aadhaarSeedingStatus
    //           ? 'SEEDED'
    //           : 'NOT_SEEDED',
    //         nameMatchScore: 100, // Finanalyz doesn't give score
    //       },
    //     };
    //   }

    //   // PAN exists but invalid
    //   return {
    //     success: true,
    //     verified: false,
    //     provider: 'FINANALYZ',
    //     message: resp?.message || 'PAN not found',
    //   };
    // } catch (_) {
    //   // Ignore & fallback
    // }

    // 2️⃣ ZOOP (Fallback)
    try {
      const payload = {
        mode: 'sync',
        data: {
          customer_pan_number: pan.toUpperCase(),
          pan_holder_name: name.toUpperCase(),
          consent: 'Y',
          consent_text:
            'I hereby declare my consent agreement for fetching my PAN information',
        },
        task_id: uuidv4(),
      };

      const { data } = await axios.post(this.zoopUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.zoopApiKey,
          'app-id': this.zoopAppId,
        },
        validateStatus: () => true,
      });

      if (
        data?.response_code === '100' &&
        data?.result?.pan_status === 'VALID'
      ) {
        const score = Number(data.result.name_match_score || 0);

        if (score >= 80) {
          return {
            success: true,
            verified: true,
            provider: 'ZOOP',
            details: {
              pan: data.result.pan_number,
              name: data.result.name_on_card,
              firstName: data.result.user_first_name,
              middleName: data.result.user_middle_name,
              lastName: data.result.user_last_name,
              typeOfHolder: data.result.pan_type,
              isValid: true,
              aadhaarSeedingStatus: data.result.aadhaar_seeding_status,
              nameMatchScore: score,
            },
          };
        }

        return {
          success: true,
          verified: false,
          provider: 'ZOOP',
          message: 'PAN name mismatch',
        };
      }

      return {
        success: true,
        verified: false,
        provider: 'ZOOP',
        message: data?.response_message || 'PAN not found',
      };
    } catch (_) {
      return {
        success: true,
        verified: false,
        provider: 'NONE',
        message: 'All providers failed',
      };
    }
  }
}

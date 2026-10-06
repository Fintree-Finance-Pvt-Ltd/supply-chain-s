import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import { PanValidationResult } from "./pan.types";

export class PanService {
  private zoopUrl = process.env.ZOOP_PAN_API_URL!;
  private zoopApiKey = process.env.ZOOP_API_KEY!;
  private zoopAppId = process.env.ZOOP_APP_ID!;

  private perfiosUrl =
    process.env.PERFIOS_PAN_URL ??
    "https://hub.perfios.com/api/kyc/v3/pan-profile-detailed";
  private perfiosKey = process.env.PERFIOS_AUTH_KEY!;

  async validatePan(pan: string, name: string): Promise<PanValidationResult> {
    if (!pan || !name) {
      throw new Error("PAN number and name are required");
    }

    const normalizedPan = pan.toUpperCase();
    const normalizedName = name.toUpperCase();

    const providerErrors: string[] = [];
    const providerMessages: string[] = [];

    // ---------------------------------------------------
    // 1️⃣ ZOOP (Primary)
    // ---------------------------------------------------
    try {
      if (!this.zoopUrl || !this.zoopApiKey || !this.zoopAppId) {
        throw new Error("Missing Zoop configuration");
      }

      const payload = {
        mode: "sync",
        data: {
          customer_pan_number: normalizedPan,
          pan_holder_name: normalizedName,
          consent: "Y",
          consent_text:
            "I hereby declare my consent agreement for fetching my PAN information",
        },
        task_id: uuidv4(),
      };

      const { status, data } = await axios.post(this.zoopUrl, payload, {
        headers: {
          "Content-Type": "application/json",
          "api-key": this.zoopApiKey,
          "app-id": this.zoopAppId,
        },
        timeout: 30000,
        validateStatus: () => true,
      });

      console.log("ZOOP RESPONSE:", {
        status,
        data,
      });

      if (status >= 400) {
        throw new Error(
          data?.response_message ||
            data?.message ||
            `Zoop failed with status ${status}`,
        );
      }

      if (
        data?.response_code === "100" &&
        data?.result?.pan_status === "VALID"
      ) {
        const score = Number(data.result.name_match_score || 0);

        return {
          success: true,
          verified: true,
          provider: "ZOOP",
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

      providerMessages.push(
        data?.response_message || "Zoop could not verify PAN",
      );
    } catch (error: any) {
      console.error("ZOOP ERROR:", {
        message: error.message,
        status: error.response?.status,
        response: error.response?.data,
      });

      providerErrors.push(`Zoop failed: ${error.message}`);
    }

    // ---------------------------------------------------
    // 2️⃣ PERFIOS (Fallback)
    // ---------------------------------------------------
    try {
      if (!this.perfiosUrl || !this.perfiosKey) {
        throw new Error("Missing Perfios configuration");
      }

      const { status, data } = await axios.post(
        this.perfiosUrl,
        {
          pan: normalizedPan,
          name: normalizedName,
          consent: "Y",
          clientData: { caseId: uuidv4() },
        },
        {
          headers: {
            "Content-Type": "application/json",
            "x-auth-key": this.perfiosKey,
          },
          timeout: 30000,
          validateStatus: () => true,
        },
      );

      console.log("PERFIOS RESPONSE:", {
        status,
        data,
      });

      if (status >= 400) {
        throw new Error(
          data?.error?.message ||
            data?.message ||
            `Perfios failed with status ${status}`,
        );
      }

      const result = data?.result;

      if (
        Number(data?.statusCode) === 101 &&
        result?.status?.toUpperCase() === "ACTIVE"
      ) {
        const addr = result.address ?? {};
        const nameMatch = (result.profileMatch ?? []).find(
          (m: any) => m?.parameter === "name",
        );

        return {
          success: true,
          verified: true,
          provider: "PERFIOS",
          details: {
            pan: result.pan,
            name: result.name,
            firstName: result.firstName,
            middleName: result.middleName,
            lastName: result.lastName,
            gender: result.gender ?? null,
            dob: result.dob ?? null,
            address:
              [addr.buildingName, addr.streetName, addr.locality]
                .filter(Boolean)
                .join(", ") || null,
            city: addr.city || null,
            state: addr.state || null,
            country: addr.country || null,
            pincode: addr.pinCode || null,
            isValid: true,
            aadhaarSeedingStatus:
              result.aadhaarLinked === true
                ? "SEEDED"
                : result.aadhaarLinked === false
                  ? "NOT_SEEDED"
                  : null,
            // Perfios returns 0–1; normalize to 0–100 like Zoop
            nameMatchScore: nameMatch
              ? Math.round(Number(nameMatch.matchScore || 0) * 100)
              : undefined,
          },
        };
      }

      providerMessages.push(
        result?.status
          ? `Perfios: PAN status ${result.status}`
          : data?.message || "Perfios could not verify PAN",
      );
    } catch (error: any) {
      console.error("PERFIOS ERROR:", {
        message: error.message,
        status: error.response?.status,
        response: error.response?.data,
      });

      providerErrors.push(`Perfios failed: ${error.message}`);
    }

    // ---------------------------------------------------
    // 3️⃣ Both failed / not verified
    // ---------------------------------------------------
    if (providerErrors.length === 2) {
      throw new Error(
        `All PAN providers failed: ${providerErrors.join(" | ")}`,
      );
    }

    return {
      success: true,
      verified: false,
      provider: "NONE",
      message:
        providerMessages.join(" | ") ||
        providerErrors.join(" | ") ||
        "PAN could not be verified",
    };
  }
}

export type PanProvider = 'FINANALYZ' | 'ZOOP' | 'NONE';

export interface PanValidationResult {
  success: boolean;
  verified: boolean;
  provider: PanProvider;
  details?: {
    pan?: string;
    name?: string;
    firstName?: string;
    middleName?: string;
    lastName?: string;
    gender?: string | null;
    dob?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    pincode?: string | null;
    maskedAadhaar?: string | null;
    lastFourDigit?: string | null;
    typeOfHolder?: string | null;
    isValid?: boolean;
    aadhaarSeedingStatus?: string | null;
    nameMatchScore?: number;
  };
  message?: string;
}

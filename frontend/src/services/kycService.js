import api from './api'
import { API_ENDPOINTS } from '../constants/api'

export const kycService = {
    // Create KYC entry
    createKyc: async (customerId, data) => {
        const response = await api.post('/kyc', {
            customerId,
            ...data,
        })
        return response.data
    },

    // Update KYC entry
    updateKyc: async (id, data) => {
        const response = await api.put(`/kyc/${id}`, data)
        return response.data
    },

    // Verify KYC (placeholder - backend has specific integration routes)
    verifyKyc: async (id, kycType) => {
        const response = await api.post(`/kyc/${id}/verify`, { kycType })
        return response.data
    },

    // Get all KYC entries for a customer
    getCustomerKyc: async (customerId) => {
        const response = await api.get(`/kyc/customer/${customerId}`)
        return response.data
    },

    // Delete KYC entry
    deleteKyc: async (id) => {
        const response = await api.delete(`/kyc/${id}`)
        return response.data
    },

    // --- Co-Applicant Profile Management ---

    // Find or create co-applicant
    processCoApplicant: async (data) => {
        const response = await api.post('/kyc/co-applicant/process', data)
        return response.data
    },

    // --- Contact Person Management ---
    processContactPerson: async (data) => {
        const response = await api.post('/kyc/contact-person/process', data)
        return response.data
    },

    deleteContactPerson: async (id) => {
        const response = await api.delete(`/kyc/contact-person/${id}`)
        return response.data
    },

    // --- Address Management ---
    processAddress: async (data) => {
        const response = await api.post('/kyc/address/process', data)
        return response.data
    },

    deleteAddress: async (id) => {
        const response = await api.delete(`/kyc/address/${id}`)
        return response.data
    },

    // Get co-applicants by customer
    getCoApplicants: async (customerId) => {
        const response = await api.get(`/co-applicants/customer/${customerId}`)
        return response.data
    },

    // Update co-applicant profile
    updateCoApplicant: async (id, data) => {
        const response = await api.put(`/co-applicants/${id}`, data)
        return response.data
    },

    // Delete co-applicant profile
    deleteCoApplicant: async (id) => {
        const response = await api.delete(`/co-applicants/${id}`)
        return response.data
    },

    // --- Integration Services ---

    // -----------------------------
// 🔹 OTP - MOBILE
// -----------------------------

sendMobileOtp: async ({
  customerId,
  mobileNumber,
  ownerType,
  applicantId,
  coApplicantId
}) => {
  const response = await api.post(
    API_ENDPOINTS.ONBOARDING_MOBILE_SEND_OTP,
    {
      customerId,
      mobileNumber,
      ownerType,
      applicantId,
      coApplicantId
    }
  )
  return response.data
},

verifyMobileOtp: async ({
  customerId,
  otp,
  mobileNumber,
  ownerType,
  applicantId,
  coApplicantId,
  companyInfo
}) => {

  const payload = {
    customerId,
    otp,
    mobileNumber,
    ownerType,
    applicantId,
    coApplicantId,
    ...(companyInfo || {})
  };

  const response = await api.post(
    API_ENDPOINTS.ONBOARDING_MOBILE_VERIFY_OTP,
    payload
  );

  return response.data;
},


// -----------------------------
// 🔹 OTP - EMAIL
// -----------------------------

sendEmailOtp: async ({
  customerId,
  email,
  ownerType,
  applicantId,
  coApplicantId
}) => {
  const response = await api.post(
    API_ENDPOINTS.ONBOARDING_EMAIL_SEND_OTP,
    {
      customerId,
      email,
      ownerType,
      applicantId,
      coApplicantId
    }
  )
  return response.data
},

verifyEmailOtp: async ({
  customerId,
  otp,
  ownerType,
  applicantId,
  coApplicantId
}) => {
  const response = await api.post(
    API_ENDPOINTS.ONBOARDING_EMAIL_VERIFY_OTP,
    {
      customerId,
      otp,
      ownerType,
      applicantId,
      coApplicantId
    }
  )
  return response.data
},

// -----------------------------
// 🔹 PAN
// -----------------------------

verifyPan: async ({
  customerId,
  pan,
  name,
  ownerType,
  applicantId,
  coApplicantId
}) => {
  const response = await api.post(
    API_ENDPOINTS.ONBOARDING_KYC_PAN,
    {
      customerId,
      pan,
      name,
      ownerType,
      applicantId,
      coApplicantId
    }
  )
  return response.data
},

// -----------------------------
// 🔹 GST
// -----------------------------

verifyGst: async ({
  customerId,
  gstNumber,
  ownerType,
  applicantId,
  coApplicantId
}) => {
  const response = await api.post(
    API_ENDPOINTS.ONBOARDING_KYC_GST,
    {
      customerId,
      gstNumber,
      ownerType,
      applicantId,
      coApplicantId
    }
  )
  return response.data
},

// -----------------------------
// 🔹 Aadhaar
// -----------------------------

initiateAadhaarKyc: async ({
  customerId,
  ownerType,
  applicantId,
  coApplicantId
}) => {
  const response = await api.post(
    API_ENDPOINTS.ONBOARDING_KYC_AADHAAR,
    {
      customerId,
      ownerType,
      applicantId,
      coApplicantId
    }
  )
  return response.data
},

// -----------------------------
// 🔹 Bureau
// -----------------------------

checkBureau: async ({
  customerId,
  ownerType,
  applicantId,
  coApplicantId
}) => {
  const response = await api.post(
    API_ENDPOINTS.ONBOARDING_BUREAU_CHECK,
    {
      customerId,
      ownerType,
      applicantId,
      coApplicantId
    }
  )
  return response.data
},


    // Get all verification statuses for a customer and co-applicants
    getKycStatuses: async (customerId) => {
        const response = await api.get(`/onboarding/kyc/status/${customerId}`)
        return response.data
    },

    // OCR Processing
    runOcr: async (file, type) => {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('type', type)
        const response = await api.post(API_ENDPOINTS.ONBOARDING_OCR_PROCESS, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        })
        return response.data
    },

    // -----------------------------
    // 🔹 PAN OCR - Direct Frontend Call
    // -----------------------------

    /**
     * Validate PAN format
     * Format: 5 letters + 4 digits + 1 letter (e.g., ABCDE1234F)
     */
    isValidPanFormat: (pan) => {
        const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
        return panRegex.test(pan);
    },

    /**
     * Process PAN OCR from image file - Direct call to external OCR API
     * @param {File} file - PAN card image file
     * @returns {Promise<Object>} - OCR result with pan_number, name, dob, father_name
     */
    processPanOcr: async (file) => {
        if (!file) {
            throw new Error('No file provided');
        }

        const PAN_OCR_API_URL = 'https://sandbox.fintreelms.com/ocr/v1/pan';
        const PAN_API_KEY = 'Fintree@2026';

        // Create FormData
        const formData = new FormData();
        formData.append('imageUrl', file);
        formData.append('clientRefId', 'pan_ocr_' + Date.now());

        try {
            const response = await fetch(PAN_OCR_API_URL, {
                method: 'POST',
                body: formData,
                headers: {
                    'x-api-key': PAN_API_KEY,
                },
            });

            if (!response.ok) {
                throw new Error(`OCR request failed with status: ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                // Log provider name
                console.log('PAN OCR Provider:', result.provider);

                // Convert PAN to uppercase
                const panNumber = result.data.pan_number?.toUpperCase() || '';

                // Validate PAN format
                if (panNumber && !kycService.isValidPanFormat(panNumber)) {
                    throw new Error('Invalid PAN format detected');
                }

                return {
                    success: true,
                    provider: result.provider,
                    data: {
                        pan_number: panNumber,
                        name: result.data.name || '',
                        dob: result.data.dob || '',
                        father_name: result.data.father_name || '',
                    },
                };
            } else {
                throw new Error(result.message || 'PAN OCR failed');
            }
        } catch (error) {
            console.error('PAN OCR Error:', error);
            throw error;
        }
    },

    // -----------------------------
    // 🔹 Cheque OCR - Direct Frontend Call
    // -----------------------------

    /**
     * Process Cheque OCR from image file - Direct call to external OCR API
     * @param {File} file - Cheque image file
     * @param {string} accountHolderName - Optional account holder name
     * @returns {Promise<Object>} - OCR result with bank details
     */
    processChequeOcr: async (file, accountHolderName = '') => {
        if (!file) {
            throw new Error('No file provided');
        }

        const CHEQUE_OCR_API_URL = 'https://sandbox.fintreelms.com/ocr/v1/cheque';
        const CHEQUE_API_KEY = 'Fintree@2026';

        // Create FormData
        const formData = new FormData();
        formData.append('imageUrl', file);
        formData.append('clientRefId', 'cheque_ocr_' + Date.now());
        if (accountHolderName) {
            formData.append('accountHolderName', accountHolderName);
        }

        try {
            const response = await fetch(CHEQUE_OCR_API_URL, {
                method: 'POST',
                body: formData,
                headers: {
                    'x-api-key': CHEQUE_API_KEY,
                },
            });

            if (!response.ok) {
                throw new Error(`Cheque OCR request failed with status: ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                // Log provider name
                console.log('Cheque OCR Provider:', result.provider);

                // Parse the new nested response format
                // Response: { success, data: { status, result: [{ type, details: { field: { conf, value } } }] } }
                const resultData = result.data;
                const chequeDetails = resultData?.result?.[0]?.details || {};

                // Helper function to extract value and confidence from nested object
                const extractField = (field) => {
                    if (field && typeof field === 'object' && 'value' in field) {
                        return {
                            value: field.value || '',
                            conf: field.conf || 0
                        };
                    }
                    return { value: '', conf: 0 };
                };

                const accountNumber = extractField(chequeDetails.account_number);
                const name = extractField(chequeDetails.name);
                const ifscCode = extractField(chequeDetails.ifsc_code);
                const micrCode = extractField(chequeDetails.micr_code);
                const chequeNumber = extractField(chequeDetails.cheque_number);
                const bankName = extractField(chequeDetails.bank_name);
                const qualityCheck = extractField(chequeDetails.qualityCheck?.isCompleteImage);

                return {
                    success: true,
                    provider: result.provider,
                    data: {
                        bank_account_number: accountNumber.value,
                        ifsc_code: ifscCode.value,
                        bank_name: bankName.value,
                        account_holder_name: name.value,
                        micr_code: micrCode.value,
                        cheque_number: chequeNumber.value,
                        quality_check: qualityCheck.value ? { isCompleteImage: qualityCheck.value } : null,
                    },
                };
            } else {
                throw new Error(result.message || 'Cheque OCR failed');
            }
        } catch (error) {
            console.error('Cheque OCR Error:', error);
            throw error;
        }
    }
}

export default kycService

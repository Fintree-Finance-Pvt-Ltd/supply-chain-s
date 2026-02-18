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
    }
}

export default kycService

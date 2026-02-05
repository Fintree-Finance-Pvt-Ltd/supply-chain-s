import api from './api'

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

    // Verify KYC (placeholder)
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

    // Placeholder: Run PAN OCR
    runPanOcr: async (file) => {
        // This is a placeholder for future OCR integration
        // In production, this would call an OCR API
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    success: true,
                    data: {
                        panNumber: 'ABCDE1234F',
                        name: 'Sample Name from OCR',
                    },
                    message: 'OCR completed (simulated)',
                })
            }, 1000)
        })
    },

    // Placeholder: Verify PAN
    verifyPan: async (panNumber) => {
        // Placeholder for PAN verification API
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    success: true,
                    verified: true,
                    message: 'PAN verified successfully (simulated)',
                })
            }, 800)
        })
    },

    // Placeholder: Verify GST
    verifyGst: async (gstNumber) => {
        // Placeholder for GST verification API
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    success: true,
                    verified: true,
                    message: 'GST verified successfully (simulated)',
                })
            }, 800)
        })
    },

    // Placeholder: Verify Mobile (OTP)
    verifyMobile: async (mobileNumber) => {
        // Placeholder for mobile OTP verification
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    success: true,
                    verified: true,
                    message: 'Mobile verified successfully (simulated)',
                })
            }, 800)
        })
    },

    // Placeholder: Verify Email (OTP)
    verifyEmail: async (email) => {
        // Placeholder for email OTP verification
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    success: true,
                    verified: true,
                    message: 'Email verified successfully (simulated)',
                })
            }, 800)
        })
    },

    // Placeholder: Aadhaar KYC
    initiateAadhaarKyc: async (aadhaarNumber) => {
        // Placeholder for Aadhaar e-KYC integration
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    success: true,
                    verified: true,
                    message: 'Aadhaar KYC initiated (simulated)',
                })
            }, 1000)
        })
    },
}

export default kycService

import api from './api'
import { API_ENDPOINTS } from '../constants/api'

const unwrapData = (response, fallback = null) => (
    response.data.success ? response.data.data : fallback
)

const mergeKycIntoCoApplicants = (customer) => {
    if (!Array.isArray(customer.coApplicants) || !Array.isArray(customer.kycDetails)) {
        return customer
    }

    return {
        ...customer,
        coApplicants: customer.coApplicants.map((coApp) => ({
            ...coApp,
            kycDetails: customer.kycDetails.filter((kyc) => kyc.coApplicantId === coApp.id),
        })),
    }
}

// Customer Service - Maps to backend /customers endpoint
export const customerService = {
    getCustomers: async (filters = {}) => {
        try {
            const response = await api.get(API_ENDPOINTS.CUSTOMERS, { params: filters })
            return {
                data: response.data.success ? response.data.data : []
            }
        } catch (error) {
            console.error('Error fetching customers:', error)
            throw error
        }
    },

    getCustomerById: async (id) => {
        try {
            const response = await api.get(API_ENDPOINTS.CUSTOMER_BY_ID(id))
            return {
                data: unwrapData(response)
            }
        } catch (error) {
            console.error('Error fetching customer:', error)
            throw error
        }
    },

    getCustomerDocuments: async (id, params = { page: 1, limit: 20 }) => {
        const response = await api.get(API_ENDPOINTS.CUSTOMER_DOCUMENTS(id), { params })
        return {
            data: unwrapData(response, []),
            meta: response.data.meta,
        }
    },

    getCustomerKyc: async (id) => {
        const response = await api.get(API_ENDPOINTS.CUSTOMER_KYC(id))
        return {
            data: unwrapData(response, { customerProfile: null, applicant: null, kycDetails: [] })
        }
    },

    getCustomerCoApplicants: async (id) => {
        const response = await api.get(API_ENDPOINTS.CUSTOMER_COAPPLICANTS(id))
        return {
            data: unwrapData(response, [])
        }
    },

    getCustomerAddresses: async (id) => {
        const response = await api.get(API_ENDPOINTS.CUSTOMER_ADDRESSES(id))
        return {
            data: unwrapData(response, [])
        }
    },

    getCustomerHistory: async (id, params = { page: 1, limit: 20 }) => {
        const response = await api.get(API_ENDPOINTS.CUSTOMER_HISTORY(id), { params })
        return {
            data: unwrapData(response, []),
            meta: response.data.meta,
        }
    },

    getCustomerSanctions: async (id) => {
        const response = await api.get(API_ENDPOINTS.CUSTOMER_SANCTIONS(id))
        return {
            data: unwrapData(response, {
                customerWorkflow: null,
                creditSanctions: [],
                postSanctions: [],
                operationsChecks: [],
                sanctionLimitHistory: [],
            })
        }
    },

    getCustomerContactPersons: async (id) => {
        const response = await api.get(API_ENDPOINTS.CUSTOMER_CONTACT_PERSONS(id))
        return {
            data: unwrapData(response, [])
        }
    },

    getCustomerWithSections: async (id, sections = []) => {
        try {
            const uniqueSections = [...new Set(sections)]
            const loaders = {
                documents: () => customerService.getCustomerDocuments(id),
                kyc: () => customerService.getCustomerKyc(id),
                coApplicants: () => customerService.getCustomerCoApplicants(id),
                addresses: () => customerService.getCustomerAddresses(id),
                history: () => customerService.getCustomerHistory(id),
                sanctions: () => customerService.getCustomerSanctions(id),
                contactPersons: () => customerService.getCustomerContactPersons(id),
            }
            const enabledSections = uniqueSections.filter((section) => loaders[section])

            const [customerResponse, ...sectionResponses] = await Promise.all([
                customerService.getCustomerById(id),
                ...enabledSections.map((section) => loaders[section]()),
            ])

            let customer = customerResponse.data
            if (!customer) {
                return { data: null }
            }

            enabledSections.forEach((section, index) => {
                const payload = sectionResponses[index]?.data
                if (!payload) return

                if (section === 'documents') {
                    customer = { ...customer, documents: payload }
                } else if (section === 'kyc') {
                    customer = {
                        ...customer,
                        ...(payload.customerProfile || {}),
                        applicant: payload.applicant,
                        kycDetails: payload.kycDetails || [],
                    }
                } else if (section === 'coApplicants') {
                    customer = { ...customer, coApplicants: payload }
                } else if (section === 'addresses') {
                    customer = { ...customer, addresses: payload }
                } else if (section === 'history') {
                    customer = { ...customer, statusHistory: payload }
                } else if (section === 'sanctions') {
                    customer = {
                        ...customer,
                        ...(payload.customerWorkflow || {}),
                        creditSanctions: payload.creditSanctions || [],
                        postSanctions: payload.postSanctions || [],
                        operationsChecks: payload.operationsChecks || [],
                        sanctionLimitHistory: payload.sanctionLimitHistory || [],
                    }
                } else if (section === 'contactPersons') {
                    customer = { ...customer, contactPersons: payload }
                }
            })

            return {
                data: mergeKycIntoCoApplicants(customer)
            }
        } catch (error) {
            console.error('Error fetching customer detail sections:', error)
            throw error
        }
    },

    createCustomer: async (customerData) => {
        try {
            const response = await api.post(API_ENDPOINTS.CUSTOMERS, customerData)
            return {
                data: response.data.success ? response.data.data : null
            }
        } catch (error) {
            const message = error.response?.data?.message || error.message || 'Failed to create customer'
            throw new Error(message)
        }
    },

    updateCustomer: async (id, data) => {
        try {
            const response = await api.put(API_ENDPOINTS.CUSTOMER_BY_ID(id), data)
            return {
                data: response.data.success ? response.data.data : null
            }
        } catch (error) {
            const message = error.response?.data?.message || error.message || 'Failed to update customer'
            throw new Error(message)
        }
    },

    submitCustomer: async (id) => {
        try {
            const response = await api.post(API_ENDPOINTS.SUBMIT_CUSTOMER(id))
            return {
                data: response.data.success ? response.data.data : null
            }
        } catch (error) {
            const message = error.response?.data?.message || error.message || 'Failed to submit customer'
            throw new Error(message)
        }
    },
}

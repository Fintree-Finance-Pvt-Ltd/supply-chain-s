import api from './api'
import { API_ENDPOINTS } from '../constants/api'

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
                data: response.data.success ? response.data.data : null
            }
        } catch (error) {
            console.error('Error fetching customer:', error)
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

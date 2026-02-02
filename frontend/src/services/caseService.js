import api from './api'
import { API_ENDPOINTS } from '../constants/api'

// Customer/Case Service - Maps to backend /customers endpoint
export const caseService = {
  getCases: async (filters = {}) => {
    try {
      const response = await api.get(API_ENDPOINTS.CUSTOMERS, { params: filters })
      return {
        data: response.data.success ? response.data.data : []
      }
    } catch (error) {
      console.error('Error fetching cases:', error)
      throw error
    }
  },
  
  getCaseById: async (id) => {
    try {
      const response = await api.get(API_ENDPOINTS.CUSTOMER_BY_ID(id))
      return {
        data: response.data.success ? response.data.data : null
      }
    } catch (error) {
      console.error('Error fetching case:', error)
      throw error
    }
  },
  
  createCase: async (caseData) => {
    try {
      const response = await api.post(API_ENDPOINTS.CUSTOMERS, caseData)
      return {
        data: response.data.success ? response.data.data : null
      }
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Failed to create case'
      throw new Error(message)
    }
  },
  
  updateCase: async (id, data) => {
    try {
      const response = await api.put(API_ENDPOINTS.CUSTOMER_BY_ID(id), data)
      return {
        data: response.data.success ? response.data.data : null
      }
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Failed to update case'
      throw new Error(message)
    }
  },
  
  submitCase: async (id) => {
    try {
      const response = await api.post(API_ENDPOINTS.SUBMIT_CUSTOMER(id))
      return {
        data: response.data.success ? response.data.data : null
      }
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Failed to submit case'
      throw new Error(message)
    }
  },
}


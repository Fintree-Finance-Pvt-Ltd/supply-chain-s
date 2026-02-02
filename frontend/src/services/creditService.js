import api from './api'
import { API_ENDPOINTS } from '../constants/api'

export const creditService = {
  getPendingSanctions: async () => {
    try {
      const response = await api.get(API_ENDPOINTS.CREDIT_PENDING)
      return {
        data: response.data.success ? response.data.data : []
      }
    } catch (error) {
      console.error('Error fetching pending sanctions:', error)
      throw error
    }
  },

  getSanctionById: async (id) => {
    try {
      const response = await api.get(API_ENDPOINTS.CREDIT_SANCTION_BY_ID(id))
      return {
        data: response.data.success ? response.data.data : null
      }
    } catch (error) {
      console.error('Error fetching sanction:', error)
      throw error
    }
  },

  createSanction: async (sanctionData) => {
    try {
      const response = await api.post(API_ENDPOINTS.CREDIT_SANCTION, sanctionData)
      return {
        data: response.data.success ? response.data.data : null
      }
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Failed to create sanction'
      throw new Error(message)
    }
  },

  updateSanction: async (id, data) => {
    try {
      const response = await api.put(API_ENDPOINTS.CREDIT_SANCTION_BY_ID(id), data)
      return {
        data: response.data.success ? response.data.data : null
      }
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Failed to update sanction'
      throw new Error(message)
    }
  },
}


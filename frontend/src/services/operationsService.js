import api from './api'
import { API_ENDPOINTS } from '../constants/api'

export const operationsService = {
  getPendingChecks: async () => {
    try {
      const response = await api.get(API_ENDPOINTS.OPERATIONS_PENDING)
      return {
        data: response.data.success ? response.data.data : []
      }
    } catch (error) {
      console.error('Error fetching pending operations checks:', error)
      throw error
    }
  },

  getCheckById: async (id) => {
    try {
      const response = await api.get(API_ENDPOINTS.OPERATIONS_BY_ID(id))
      return {
        data: response.data.success ? response.data.data : null
      }
    } catch (error) {
      console.error('Error fetching operations check:', error)
      throw error
    }
  },

  updateCheck: async (id, data) => {
    try {
      const response = await api.put(API_ENDPOINTS.OPERATIONS_BY_ID(id), data)
      return {
        data: response.data.success ? response.data.data : null
      }
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Failed to update operations check'
      throw new Error(message)
    }
  },

  submitPostSanction: async (customerId, data) => {
    try {
      const response = await api.post(`/operations/post-sanction/${customerId}/submit`, data)
      return {
        data: response.data.success ? response.data.data : null
      }
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Failed to submit post-sanction'
      throw new Error(message)
    }
  },
}


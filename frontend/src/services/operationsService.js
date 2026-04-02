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

  // ==================== Repayment Upload Methods ====================

  /**
   * Upload repayment collections to LMS
   * @param {Array} repayments - Array of repayment objects
   */
  uploadRepayments: async (repayments) => {
    try {
      const response = await api.post(API_ENDPOINTS.REPAYMENTS_UPLOAD, { repayments })
      return {
        success: response.data.success,
        message: response.data.message,
        data: response.data.data || []
      }
    } catch (error) {
      console.error('Error uploading repayments:', error)
      const message = error.response?.data?.message || error.message || 'Failed to upload repayments'
      throw new Error(message)
    }
  },

  /**
   * Get all repayment uploads with optional filters
   * @param {Object} filters - Optional filters (status, lan, startDate, endDate, limit, offset)
   */
  getRepaymentUploads: async (filters = {}) => {
    try {
      const params = new URLSearchParams()
      if (filters.status) params.append('status', filters.status)
      if (filters.lan) params.append('lan', filters.lan)
      if (filters.startDate) params.append('startDate', filters.startDate)
      if (filters.endDate) params.append('endDate', filters.endDate)
      if (filters.limit) params.append('limit', filters.limit)
      if (filters.offset) params.append('offset', filters.offset)

      const queryString = params.toString()
      const url = queryString ? `${API_ENDPOINTS.REPAYMENTS_LIST}?${queryString}` : API_ENDPOINTS.REPAYMENTS_LIST
      
      const response = await api.get(url)
      return {
        data: response.data.success ? response.data.data : [],
        total: response.data.total || 0
      }
    } catch (error) {
      console.error('Error fetching repayment uploads:', error)
      throw error
    }
  },

  /**
   * Get repayment upload by ID
   * @param {number} id - Repayment upload ID
   */
  getRepaymentUploadById: async (id) => {
    try {
      const response = await api.get(API_ENDPOINTS.REPAYMENT_BY_ID(id))
      return {
        data: response.data.success ? response.data.data : null
      }
    } catch (error) {
      console.error('Error fetching repayment upload:', error)
      throw error
    }
  },

  /**
   * Retry a failed repayment upload
   * @param {number} id - Repayment upload ID
   */
  retryRepaymentUpload: async (id) => {
    try {
      const response = await api.post(API_ENDPOINTS.REPAYMENT_RETRY(id))
      return {
        success: response.data.success,
        message: response.data.message,
        data: response.data.data || []
      }
    } catch (error) {
      console.error('Error retrying repayment upload:', error)
      const message = error.response?.data?.message || error.message || 'Failed to retry repayment upload'
      throw new Error(message)
    }
  },

  /**
   * Get all available lenders
   */
  getLenders: async () => {
    try {
      const response = await api.get(API_ENDPOINTS.REPAYMENT_LENDERS)
      return {
        data: response.data.success ? response.data.data : []
      }
    } catch (error) {
      console.error('Error fetching lenders:', error)
      throw error
    }
  },

  /**
   * Get LANs by selected partner
   * @param {number} partnerId - Partner ID
   */
  getLansByLender: async (partnerId) => {
    try {
      const response = await api.get(`${API_ENDPOINTS.REPAYMENT_LANS}/${partnerId}`)
      return {
        data: response.data.success ? response.data.data : []
      }
    } catch (error) {
      console.error('Error fetching LANs:', error)
      throw error
    }
  },
}


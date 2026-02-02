import api from './api'
import { API_ENDPOINTS } from '../constants/api'

export const approvalService = {
  getPendingApprovals: async () => {
    try {
      const response = await api.get(API_ENDPOINTS.APPROVALS_PENDING)
      return {
        data: response.data.success ? response.data.data : []
      }
    } catch (error) {
      console.error('Error fetching pending approvals:', error)
      throw error
    }
  },

  processApproval: async (approvalId, action, comments) => {
    try {
      const response = await api.post(API_ENDPOINTS.APPROVAL_ACTION(approvalId), {
        action,
        comments,
      })
      return {
        data: response.data.success ? response.data.data : null
      }
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Failed to process approval'
      throw new Error(message)
    }
  },

  getApprovalHistory: async (approvalId) => {
    try {
      const response = await api.get(API_ENDPOINTS.APPROVAL_HISTORY(approvalId))
      return {
        data: response.data.success ? response.data.data : []
      }
    } catch (error) {
      console.error('Error fetching approval history:', error)
      throw error
    }
  },
}


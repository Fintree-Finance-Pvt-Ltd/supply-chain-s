import api from './api'
import { API_ENDPOINTS } from '../constants/api'

export const approvalService = {
  // Flow Management
  getFlows: async () => {
    try {
      const response = await api.get(API_ENDPOINTS.APPROVAL_FLOWS)
      return { data: response.data.success ? response.data.data : [] }
    } catch (error) {
      console.error('Error fetching flows:', error)
      throw error
    }
  },

  createFlow: async (flowData) => {
    try {
      const response = await api.post(API_ENDPOINTS.APPROVAL_FLOWS, flowData)
      return { data: response.data.success ? response.data.data : null }
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to create flow')
    }
  },

  updateFlow: async (id, flowData) => {
    try {
      const response = await api.put(API_ENDPOINTS.APPROVAL_FLOW_BY_ID(id), flowData)
      return { data: response.data.success ? response.data.data : null }
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to update flow')
    }
  },

  deleteFlow: async (id) => {
    try {
      const response = await api.delete(API_ENDPOINTS.APPROVAL_FLOW_BY_ID(id))
      return { data: response.data.success ? response.data.data : null }
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to delete flow')
    }
  },

  toggleFlowStatus: async (id) => {
    try {
      const response = await api.patch(API_ENDPOINTS.APPROVAL_FLOW_TOGGLE(id))
      return { data: response.data.success ? response.data.data : null }
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to toggle flow status')
    }
  },

  addStep: async (stepData) => {
    try {
      const response = await api.post(API_ENDPOINTS.APPROVAL_STEPS, stepData)
      return { data: response.data.success ? response.data.data : null }
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to add step')
    }
  },

  removeStep: async (id) => {
    try {
      const response = await api.delete(API_ENDPOINTS.APPROVAL_STEP_BY_ID(id))
      return { data: response.data.success ? response.data.data : null }
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to remove step')
    }
  },

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


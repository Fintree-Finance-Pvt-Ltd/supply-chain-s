import api from './api'
import { API_ENDPOINTS } from '../constants/api'

const unwrap = (response, fallback = null) => (
  response.data?.success ? response.data.data : fallback
)

export const invoiceApprovalBatchService = {
  createBatch: async (payload) => {
    const response = await api.post(API_ENDPOINTS.WORKFLOW_INVOICE_APPROVAL_BATCH_CREATE, payload)
    return unwrap(response, null)
  },

  getPendingBatches: async (params = {}) => {
    const response = await api.get(API_ENDPOINTS.WORKFLOW_INVOICE_APPROVAL_BATCH_PENDING, { params })
    return unwrap(response, [])
  },

  customerApproveBatch: async (batchId, approved, remarks = '', customerId = undefined) => {
    const response = await api.post(API_ENDPOINTS.WORKFLOW_INVOICE_APPROVAL_BATCH_CUSTOMER_APPROVE(batchId), {
      approved,
      remarks,
      customerId,
    })
    return unwrap(response, null)
  },
}

export default invoiceApprovalBatchService

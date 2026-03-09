import api from './api'
import { API_ENDPOINTS } from '../constants/api'

// We export an object
export const supplierService = {

  // ===============================
  // Dashboard
  // ===============================
  getOperationsDashboard() {
    return api.get('/workflows/suppliers/dashboard/operations')
  },

  getRMDashboard() {
    return api.get('/workflows/suppliers/dashboard/rm')
  },

  // Get All Suppliers (for Completed/Rejected tab)
  getAllSuppliers() {
    return api.get('/workflows/suppliers/dashboard/all')
  },

  // ===============================
  // Get Approved Customers (for dropdown)
  // ===============================
  getApprovedCustomers() {
    return api.get(API_ENDPOINTS.WORKFLOW_SUPPLIER_CUSTOMERS_APPROVED)
  },

  // ===============================
  // Get Supplier Details
  // ===============================
  getSupplierById(supplierId) {
    return api.get(API_ENDPOINTS.WORKFLOW_SUPPLIER_DETAILS(supplierId))
  },

  // ===============================
  // RM Create Supplier (draft status)
  // ===============================
  rmCreateSupplier(data) {
    return api.post(API_ENDPOINTS.WORKFLOW_SUPPLIER_RM_CREATE, data)
  },

  // ===============================
  // Ops L1 Create Supplier
  // ===============================
  opsL1CreateSupplier(data) {
    return api.post('/workflows/suppliers/ops-l1/create', data)
  },

  // ===============================
  // Upload Cheque (multipart)
  // ===============================
  uploadCheque(supplierId, file) {
    const formData = new FormData()
    formData.append('cheque', file)

    return api.post(
      `/workflows/suppliers/${supplierId}/cheque`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    )
  },

  // ===============================
  // Update Bank Details
  // ===============================
  updateBankDetails(supplierId, bankData) {
    return api.post(
      `/workflows/suppliers/${supplierId}/bank-details`,
      bankData
    )
  },

  // ===============================
  // Delete Cheque Document
  // ===============================
  deleteChequeDocument(supplierId) {
    return api.delete(
      `/workflows/suppliers/${supplierId}/cheque`
    )
  },

  // ===============================
  // Ops Head Decision
  // ===============================
  opsHeadDecision(supplierId, approved, remarks) {
    return api.post(
      `/workflows/suppliers/${supplierId}/ops-head`,
      { approved, remarks }
    )
  },

  // ===============================
  // RM Submit Supplier
  // ===============================
  submitSupplier(supplierId, remarks) {
    return api.post(
      `/workflows/suppliers/${supplierId}/submit`,
      { remarks }
    )
  },

  // ===============================
  // Ops L1 Submit to Ops Head
  // ===============================
  submitToOpsHead(supplierId, remarks) {
    return api.post(
      `/workflows/suppliers/${supplierId}/submit-to-ops-head`,
      { remarks }
    )
  },

}

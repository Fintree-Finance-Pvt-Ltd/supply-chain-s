import api from './api'
import { API_ENDPOINTS } from '../constants/api'

export const workflowService = {
    // Customer Onboarding
    createCustomer: (data) => api.post(API_ENDPOINTS.WORKFLOW_CUSTOMER_CREATE, data),
    submitCustomer: (id, remarks, pushedTo) => api.post(API_ENDPOINTS.WORKFLOW_CUSTOMER_SUBMIT(id), { remarks, pushedTo }),
    approveCreditL1: (id, approved, remarks, sanctionData) => api.post(API_ENDPOINTS.WORKFLOW_CUSTOMER_CREDIT_L1(id), { approved, remarks, ...sanctionData }),
    approveCreditL2: (id, approved, remarks, sanctionData) => api.post(API_ENDPOINTS.WORKFLOW_CUSTOMER_CREDIT_L2(id), { approved, remarks, ...sanctionData }),
    approveCEO: (id, approved, remarks, sanctionData) => api.post(API_ENDPOINTS.WORKFLOW_CUSTOMER_CEO(id), { approved, remarks, ...sanctionData }),
    submitRMToMD: (id, remarks, sanctionData) => api.post(`/workflows/customers/${id}/rm-submit-md`, { remarks, ...sanctionData }),
    approveMD: (id, approved, remarks, sanctionData) => api.post(API_ENDPOINTS.WORKFLOW_CUSTOMER_MD(id), { approved, remarks, ...sanctionData }),
    submitToOperations: (id, remarks) => api.post(API_ENDPOINTS.WORKFLOW_CUSTOMER_OPS_SUBMIT(id), { remarks }),
    approveOpsL1: (id, approved, remarks) => api.post(API_ENDPOINTS.WORKFLOW_CUSTOMER_OPS_L1(id), { approved, remarks }),
    approveOpsHead: (id, remarks) => api.post(API_ENDPOINTS.WORKFLOW_CUSTOMER_OPS_HEAD(id), { remarks }),
    updateBankDetails: (id, data) => api.patch(API_ENDPOINTS.WORKFLOW_CUSTOMER_BANK_DETAILS(id), data),
    updateDocumentMetadata: (id, data) => api.patch(API_ENDPOINTS.WORKFLOW_DOCUMENT_UPDATE(id), data),
    getSanctionedCustomers: () => api.get('/workflows/customers/sanctioned'),

    // Supplier Onboarding
    createSupplier: (data) => api.post(API_ENDPOINTS.WORKFLOW_SUPPLIER_CREATE, data),
    getSupplierById: (id) => api.get(`/workflows/suppliers/${id}`),
    submitSupplier: (id, remarks) => api.post(API_ENDPOINTS.WORKFLOW_SUPPLIER_SUBMIT(id), { remarks }),
    approveSupplierOpsL1: (id, approved, remarks) => api.post(API_ENDPOINTS.WORKFLOW_SUPPLIER_OPS_L1(id), { approved, remarks }),
    approveSupplierOpsHead: (id, approved, remarks) => api.post(API_ENDPOINTS.WORKFLOW_SUPPLIER_OPS_HEAD(id), { approved, remarks }),

    // Invoice Discounting
    createInvoice: (data) => api.post(API_ENDPOINTS.WORKFLOW_INVOICE_CREATE, data),
    submitInvoice: (id, remarks) => api.post(API_ENDPOINTS.WORKFLOW_INVOICE_SUBMIT(id), { remarks }),
    verifyInvoiceOpsL1: (id, approved, remarks) => api.post(API_ENDPOINTS.WORKFLOW_INVOICE_OPS_L1(id), { approved, remarks }),
    validateInvoiceOpsL2: (id, approved, remarks) => api.post(API_ENDPOINTS.WORKFLOW_INVOICE_OPS_L2(id), { approved, remarks }),
    approveInvoiceOpsHead: (id, remarks) => api.post(API_ENDPOINTS.WORKFLOW_INVOICE_OPS_HEAD(id), { remarks }),
    reviewInvoiceCEO: (id, approved, remarks) => api.post(API_ENDPOINTS.WORKFLOW_INVOICE_CEO(id), { approved, remarks }),
    approveInvoiceMD: (id, approved, remarks, disbursedAmount) =>
        api.post(API_ENDPOINTS.WORKFLOW_INVOICE_MD(id), { approved, remarks, disbursedAmount }),

    // Document Verification
    verifyDocument: (documentId, status, remarks) =>
        api.post(`/workflows/documents/${documentId}/verify`, { status, remarks }),

    // Dashboard Fetching
    getRMDashboard: () => api.get(API_ENDPOINTS.DASHBOARD_RM_CUSTOMERS),
    getRMSupplierDashboard: () => api.get(API_ENDPOINTS.DASHBOARD_RM_SUPPLIERS),
    getRMInvoiceDashboard: () => api.get(API_ENDPOINTS.DASHBOARD_RM_INVOICES),
    getCreditDashboard: (level) => api.get(API_ENDPOINTS.DASHBOARD_CREDIT_PENDING(level)),
    getExecutiveDashboard: () => api.get(API_ENDPOINTS.DASHBOARD_EXECUTIVE_PENDING),
    getOperationsDashboard: () => api.get(API_ENDPOINTS.DASHBOARD_OPERATIONS_PENDING),
    getSupplierOperationsDashboard: () => api.get('/workflows/suppliers/dashboard/operations'),
}

import api from './api'
import { API_ENDPOINTS } from '../constants/api'

export const workflowService = {
    // Customer Onboarding
    createCustomer: (data) => api.post(API_ENDPOINTS.WORKFLOW_CUSTOMER_CREATE, data),
    submitCustomer: (id, remarks, pushedTo) => api.post(API_ENDPOINTS.WORKFLOW_CUSTOMER_SUBMIT(id), { remarks, pushedTo }),
    approveCreditL1: (id, approved, remarks, sanctionData) => api.post(API_ENDPOINTS.WORKFLOW_CUSTOMER_CREDIT_L1(id), { approved, remarks, partnerSanctions: sanctionData?.partnerSanctions }),
    approveCreditL2: (id, approved, remarks, sanctionData) => api.post(API_ENDPOINTS.WORKFLOW_CUSTOMER_CREDIT_L2(id), { approved, remarks, partnerSanctions: sanctionData?.partnerSanctions, sanctionAmount: sanctionData?.sanctionAmount }),
    approveCEO: (id, approved, remarks, sanctionData) => api.post(API_ENDPOINTS.WORKFLOW_CUSTOMER_CEO(id), { 
      approved, 
      remarks, 
      partnerSanctions: sanctionData?.partnerSanctions, 
      sanctionAmount: sanctionData?.sanctionAmount 
      // CEO can only modify sanctionAmount, not tenure or interestRate
    }),
    submitRMToMD: (id, remarks, sanctionData) => api.post(`/workflows/customers/${id}/rm-submit-md`, { remarks, ...sanctionData }),
    approveMD: (id, approved, remarks, sanctionData) => api.post(API_ENDPOINTS.WORKFLOW_CUSTOMER_MD(id), { approved, remarks, ...sanctionData }),
    submitToOperations: (id, remarks) => api.post(API_ENDPOINTS.WORKFLOW_CUSTOMER_OPS_SUBMIT(id), { remarks }),
    approveOpsL1: (id, approved, remarks) => api.post(API_ENDPOINTS.WORKFLOW_CUSTOMER_OPS_L1(id), { approved, remarks }),
    approveOpsHead: (id, remarks) => api.post(API_ENDPOINTS.WORKFLOW_CUSTOMER_OPS_HEAD(id), { remarks }),
    updateBankDetails: (id, data) => api.patch(API_ENDPOINTS.WORKFLOW_CUSTOMER_BANK_DETAILS(id), data),
    updateDocumentMetadata: (id, data) => api.patch(API_ENDPOINTS.WORKFLOW_DOCUMENT_UPDATE(id), data),

    // Sanction Limits
    getSanctionLimits: (customerId) => api.get(API_ENDPOINTS.WORKFLOW_SANCTION_LIMITS(customerId)),

    // Supplier Onboarding
    createSupplier: (data) => api.post(API_ENDPOINTS.WORKFLOW_SUPPLIER_CREATE, data),
    submitSupplier: (id, remarks) => api.post(API_ENDPOINTS.WORKFLOW_SUPPLIER_SUBMIT(id), { remarks }),
    approveSupplierOpsL1: (id, approved, remarks) => api.post(API_ENDPOINTS.WORKFLOW_SUPPLIER_OPS_L1(id), { approved, remarks }),
    approveSupplierOpsHead: (id, remarks) => api.post(API_ENDPOINTS.WORKFLOW_SUPPLIER_OPS_HEAD(id), { remarks }),

    // Invoice Discounting
    createInvoice: (data) => api.post(API_ENDPOINTS.WORKFLOW_INVOICE_CREATE, data),
    submitInvoice: (id, data) => api.post(API_ENDPOINTS.WORKFLOW_INVOICE_SUBMIT(id), data),
    opsL1Approve: (id, remarks) => api.post(API_ENDPOINTS.WORKFLOW_INVOICE_OPS_L1(id), { approved: true, remarks }),
    opsL1Reject: (id, remarks) => api.post(API_ENDPOINTS.WORKFLOW_INVOICE_OPS_L1(id), { approved: false, remarks }),
    opsL2Approve: (id, remarks) => api.post(API_ENDPOINTS.WORKFLOW_INVOICE_OPS_L2(id), { approved: true, remarks }),
    opsL2Reject: (id, remarks) => api.post(API_ENDPOINTS.WORKFLOW_INVOICE_OPS_L2(id), { approved: false, remarks }),
    opsHeadApprove: (id, remarks) => api.post(API_ENDPOINTS.WORKFLOW_INVOICE_OPS_HEAD(id), { approved: true, remarks }),
    opsHeadReject: (id, remarks) => api.post(API_ENDPOINTS.WORKFLOW_INVOICE_OPS_HEAD(id), { approved: false, remarks }),
    mdApprove: (id, remarks) => api.post(API_ENDPOINTS.WORKFLOW_INVOICE_MD(id), { approved: true, remarks }),
    mdReject: (id, remarks) => api.post(API_ENDPOINTS.WORKFLOW_INVOICE_MD(id), { approved: false, remarks }),
    verifyInvoiceOpsL1: (id, approved, remarks) => api.post(API_ENDPOINTS.WORKFLOW_INVOICE_OPS_L1(id), { approved, remarks }),
    validateInvoiceOpsL2: (id, approved, remarks) => api.post(API_ENDPOINTS.WORKFLOW_INVOICE_OPS_L2(id), { approved, remarks }),
    approveInvoiceOpsHead: (id, approved, remarks) => api.post(API_ENDPOINTS.WORKFLOW_INVOICE_OPS_HEAD(id), { approved, remarks }),
    reviewInvoiceCEO: (id, approved, remarks) => api.post(API_ENDPOINTS.WORKFLOW_INVOICE_CEO(id), { approved, remarks }),
    approveInvoiceMD: (id, approved, remarks) => api.post(API_ENDPOINTS.WORKFLOW_INVOICE_MD(id), { approved, remarks }),
    disburseInvoice: (id, data) => api.post(API_ENDPOINTS.WORKFLOW_INVOICE_DISBURSE(id), data),
    finalVerifyOpsL2: (id, approved, remarks) => api.post(API_ENDPOINTS.WORKFLOW_INVOICE_FINAL_OPS_L2(id), { approved, remarks }),
    finalOpsL2Approve: (id, remarks) => api.post(API_ENDPOINTS.WORKFLOW_INVOICE_FINAL_OPS_L2(id), { approved: true, remarks }),
    finalOpsL2Reject: (id, remarks) => api.post(API_ENDPOINTS.WORKFLOW_INVOICE_FINAL_OPS_L2(id), { approved: false, remarks }),

    // Invoice Discounting - Customer Mobile App
    customerApproveInvoice: (id, approved, remarks) => api.post(API_ENDPOINTS.WORKFLOW_INVOICE_CUSTOMER_APPROVE(id), { approved, remarks }),
    customerApprove: (id, remarks) => api.post(API_ENDPOINTS.WORKFLOW_INVOICE_CUSTOMER_APPROVE(id), { approved: true, remarks }),
    customerReject: (id, remarks) => api.post(API_ENDPOINTS.WORKFLOW_INVOICE_CUSTOMER_APPROVE(id), { approved: false, remarks }),
    getCustomerInvoiceDetails: (id) => api.get(API_ENDPOINTS.WORKFLOW_INVOICE_CUSTOMER_DETAILS(id)),
    getCustomerPendingInvoices: () => api.get(API_ENDPOINTS.WORKFLOW_INVOICE_CUSTOMER_PENDING),

    // Invoice Discounting - Dashboard endpoints
    getOPS1PendingInvoices: () => api.get(API_ENDPOINTS.WORKFLOW_INVOICE_OPS_L1_PENDING),
    getOPS2PendingInvoices: () => api.get(API_ENDPOINTS.WORKFLOW_INVOICE_OPS_L2_PENDING),
    getMDPendingInvoices: () => api.get(API_ENDPOINTS.WORKFLOW_INVOICE_MD_PENDING),
    getOPSHeadPendingInvoices: () => api.get(API_ENDPOINTS.WORKFLOW_INVOICE_OPS_HEAD_PENDING),
    getDisbursementEntryPendingInvoices: () => api.get(API_ENDPOINTS.WORKFLOW_INVOICE_DISBURSEMENT_ENTRY_PENDING),
    getDisbursementEntryInvoices: () => api.get(API_ENDPOINTS.WORKFLOW_INVOICE_DISBURSEMENT_ENTRY_PENDING),
    getFinalOPS2PendingInvoices: () => api.get(API_ENDPOINTS.WORKFLOW_INVOICE_FINAL_OPS_L2_PENDING),
    getActiveInvoices: () => api.get(API_ENDPOINTS.WORKFLOW_INVOICE_ACTIVE),

    // Invoice Discounting - RM endpoints
    getCustomersForRM: () => api.get(API_ENDPOINTS.WORKFLOW_INVOICE_GET_CUSTOMERS),
    getCustomersByRM: () => api.get(API_ENDPOINTS.WORKFLOW_INVOICE_GET_CUSTOMERS),
    getLANsByCustomer: (customerId) => api.get(API_ENDPOINTS.WORKFLOW_INVOICE_GET_LANS(customerId)),
    getSuppliersByCustomer: (customerId) => api.get(API_ENDPOINTS.WORKFLOW_INVOICE_GET_SUPPLIERS(customerId)),
    getSupplierBankDetails: (supplierId) => api.get(API_ENDPOINTS.WORKFLOW_INVOICE_GET_SUPPLIER_BANK(supplierId)),

    // Document Verification
    verifyDocument: (documentId, status, remarks) =>
        api.post(`/workflows/documents/${documentId}/verify`, { status, remarks }),

    // Dashboard Fetching
    getRMDashboard: () => api.get(API_ENDPOINTS.DASHBOARD_RM_CUSTOMERS),
    getRMSupplierDashboard: () => api.get(API_ENDPOINTS.DASHBOARD_RM_SUPPLIERS),
    getRMInvoiceDashboard: () => api.get(API_ENDPOINTS.DASHBOARD_RM_INVOICES),
    getRMInvoices: () => api.get('/workflows/invoices/dashboard/rm'),
    getCreditDashboard: (level) => api.get(API_ENDPOINTS.DASHBOARD_CREDIT_PENDING(level)),
    getExecutiveDashboard: () => api.get(API_ENDPOINTS.DASHBOARD_EXECUTIVE_PENDING),
    getOperationsDashboard: () => api.get(API_ENDPOINTS.DASHBOARD_OPERATIONS_PENDING),
}

// API Base URL - Backend API endpoint
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'

// API Endpoints matching backend routes
export const API_ENDPOINTS = {
  // Auth
  LOGIN: '/auth/login',
  LOGOUT: '/auth/logout',

  // Users (Admin)
  USERS: '/users',
  USER_BY_ID: (id) => `/users/${id}`,
  USER_TOGGLE_STATUS: (id) => `/users/${id}/toggle-status`,
  REMOVE_ROLE: '/users/remove-role',
  UPDATE_USER: (id) => `/users/${id}`,
  DELETE_USER: (id) => `/users/${id}`,
  ASSIGN_ROLE: '/users/assign-role',
  ASSIGN_MULTIPLE_ROLES: '/users/assign-multiple-roles',

  // Roles (Admin)
  ROLES: '/roles',
  ROLE_BY_ID: (id) => `/roles/${id}`,
  ROLE_TOGGLE_STATUS: (id) => `/roles/${id}/toggle-status`,
  ROLE_ASSIGN_PERMISSION: '/roles/assign-permission',
  ROLE_REMOVE_PERMISSION: '/roles/remove-permission',

  // Approval Flows (Admin)
  APPROVAL_FLOWS: '/approvals/flows',
  APPROVAL_FLOW_BY_ID: (id) => `/approvals/flows/${id}`,
  APPROVAL_FLOW_TOGGLE: (id) => `/approvals/flows/${id}/toggle-status`,
  APPROVAL_STEPS: '/approvals/steps',
  APPROVAL_STEP_BY_ID: (id) => `/approvals/steps/${id}`,

  // Customers
  CUSTOMERS: '/customers',
  CUSTOMER_BY_ID: (id) => `/customers/${id}`,
  CUSTOMER_DOCUMENTS: (id) => `/customers/${id}/documents`,
  CUSTOMER_KYC: (id) => `/customers/${id}/kyc`,
  CUSTOMER_COAPPLICANTS: (id) => `/customers/${id}/coapplicants`,
  CUSTOMER_ADDRESSES: (id) => `/customers/${id}/addresses`,
  CUSTOMER_HISTORY: (id) => `/customers/${id}/history`,
  CUSTOMER_SANCTIONS: (id) => `/customers/${id}/sanctions`,
  CUSTOMER_CONTACT_PERSONS: (id) => `/customers/${id}/contact-persons`,
  SUBMIT_CUSTOMER: (id) => `/customers/${id}/submit`,

  // Credit
  CREDIT_SANCTION: '/credit/sanction',
  CREDIT_PENDING: '/credit/pending',
  CREDIT_SANCTION_BY_ID: (id) => `/credit/sanction/${id}`,

  // Approvals
  APPROVALS_PENDING: '/approvals/pending',
  APPROVAL_ACTION: (id) => `/approvals/${id}/action`,
  APPROVAL_HISTORY: (id) => `/approvals/${id}/history`,

  // Documents
  DOCUMENTS_UPLOAD: '/documents/upload',
  DOCUMENTS_BY_CUSTOMER: (customerId) => `/customers/${customerId}/documents`,
  DOCUMENT_VERIFY: (id) => `/documents/${id}/verify`,
  DOCUMENT_DELETE: (id) => `/documents/${id}`,

  // Workflow Endpoints
  WORKFLOW_CUSTOMER_CREATE: '/workflows/customers/create',
  WORKFLOW_CUSTOMER_SUBMIT: (id) => `/workflows/customers/${id}/submit`,
  
  WORKFLOW_CUSTOMER_RETURN: (id) => `/workflows/customers/${id}/return`,  
  
  WORKFLOW_CUSTOMER_CREDIT_L1: (id) => `/workflows/customers/${id}/credit-l1`,
  WORKFLOW_CUSTOMER_CREDIT_L2: (id) => `/workflows/customers/${id}/credit-l2`,
  WORKFLOW_CUSTOMER_MD: (id) => `/workflows/customers/${id}/md-approve`,
  WORKFLOW_CUSTOMER_OPS_SUBMIT: (id) => `/workflows/customers/${id}/ops-submit`,
  WORKFLOW_CUSTOMER_OPS_L1: (id) => `/workflows/customers/${id}/ops-l1`,
  WORKFLOW_CUSTOMER_OPS_HEAD: (id) => `/workflows/customers/${id}/ops-head`,
  WORKFLOW_CUSTOMER_BANK_DETAILS: (id) => `/workflows/customers/${id}/bank-details`,
  WORKFLOW_DOCUMENT_UPDATE: (id) => `/workflows/documents/${id}`,

  // Sanction Limits
  WORKFLOW_SANCTION_LIMITS: (customerId) => `/workflows/customers/${customerId}/sanction-limits`,

  // Supplier Workflow
  WORKFLOW_SUPPLIER_CREATE: '/workflows/suppliers/create',
  WORKFLOW_SUPPLIER_SUBMIT: (id) => `/workflows/suppliers/${id}/submit`,
  WORKFLOW_SUPPLIER_OPS_L1_CREATE: '/workflows/suppliers/ops-l1/create',
  WORKFLOW_SUPPLIER_CHEQUE_UPLOAD: (id) => `/workflows/suppliers/${id}/cheque`,
  WORKFLOW_SUPPLIER_OPS_HEAD: (id) => `/workflows/suppliers/${id}/ops-head`,
  WORKFLOW_SUPPLIER_RM_CREATE: '/workflows/suppliers/rm/create',
  WORKFLOW_SUPPLIER_CUSTOMERS_APPROVED: '/workflows/suppliers/customers/approved',
  WORKFLOW_SUPPLIER_DETAILS: (id) => `/workflows/suppliers/${id}/details`,

  // Invoice Workflow
  WORKFLOW_INVOICE_CREATE: '/workflows/invoices/create',
  WORKFLOW_INVOICE_SUBMIT: (id) => `/workflows/invoices/${id}/submit`,
  WORKFLOW_INVOICE_OPS_L1: (id) => `/workflows/invoices/${id}/ops-l1`,
  WORKFLOW_INVOICE_OPS_L2: (id) => `/workflows/invoices/${id}/ops-l2`,
  WORKFLOW_INVOICE_OPS_HEAD: (id) => `/workflows/invoices/${id}/ops-head`,
  WORKFLOW_INVOICE_CEO: (id) => `/workflows/invoices/${id}/ceo-review`,
  WORKFLOW_INVOICE_MD: (id) => `/workflows/invoices/${id}/md-approve`,
  WORKFLOW_INVOICE_DISBURSE: (id) => `/workflows/invoices/${id}/disburse`,
  WORKFLOW_INVOICE_FINAL_OPS_L2: (id) => `/workflows/invoices/${id}/final-ops-l2`,
  
  // Invoice Discounting - Customer Mobile App
  WORKFLOW_INVOICE_CUSTOMER_APPROVE: (id) => `/workflows/invoices/${id}/customer-approve`,
  WORKFLOW_INVOICE_CUSTOMER_DETAILS: (id) => `/workflows/invoices/${id}/customer-details`,
  WORKFLOW_INVOICE_CUSTOMER_PENDING: '/workflows/invoices/pending/customer',
  WORKFLOW_INVOICE_SEND_CUSTOMER_EMAIL: (id) => `/workflows/invoices/${id}/send-customer-email`,
  
  // Invoice Discounting - Dashboard Endpoints
  WORKFLOW_INVOICE_OPS_L1_PENDING: '/workflows/invoices/pending/ops-l1',
  WORKFLOW_INVOICE_OPS_L2_PENDING: '/workflows/invoices/pending/ops-l2',
  WORKFLOW_INVOICE_MD_PENDING: '/workflows/invoices/pending/md',
  WORKFLOW_INVOICE_OPS_HEAD_PENDING: '/workflows/invoices/pending/ops-head',
  WORKFLOW_INVOICE_DISBURSEMENT_ENTRY_PENDING: '/workflows/invoices/pending/disbursement-entry',
  WORKFLOW_INVOICE_FINAL_OPS_L2_PENDING: '/workflows/invoices/pending/final-ops-l2',
  WORKFLOW_INVOICE_ACTIVE: '/workflows/invoices/active',
  
  // Invoice Discounting - RM endpoints
  WORKFLOW_INVOICE_GET_CUSTOMERS: '/workflows/invoices/customers',
  WORKFLOW_INVOICE_GET_LANS: (customerId) => `/workflows/invoices/customers/${customerId}/lans`,
   WORKFLOW_INVOICE_GET_RATES: (customerId, lanId) => `/workflows/invoices/customers/${customerId}/lans/${lanId}/rates`,
  WORKFLOW_INVOICE_GET_SUPPLIERS: (customerId) => `/workflows/invoices/customers/${customerId}/suppliers`,
  WORKFLOW_INVOICE_GET_SUPPLIER_BANK: (supplierId) => `/workflows/invoices/suppliers/${supplierId}/bank-details`,

  // Dashboards
  DASHBOARD_RM_CUSTOMERS: '/workflows/customers/dashboard/rm',
  DASHBOARD_CREDIT_PENDING: (level) => `/workflows/customers/dashboard/credit/${level}`,
  DASHBOARD_EXECUTIVE_PENDING: '/workflows/customers/dashboard/executive',
  DASHBOARD_OPERATIONS_PENDING: '/workflows/customers/dashboard/operations',
  // Supplier Dashboards

  
DASHBOARD_OPERATIONS_SUPPLIERS: '/workflows/suppliers/dashboard/operations',

  DASHBOARD_RM_SUPPLIERS: '/workflows/suppliers/dashboard/rm',
  DASHBOARD_RM_INVOICES: '/workflows/invoices/dashboard/rm',

  // Operations
  OPERATIONS_PENDING: '/operations/pending',
  OPERATIONS_BY_ID: (id) => `/operations/${id}`,
  OPERATIONS_LOAN_CUSTOMERS: '/operations/loan-search/customers',

  // Repayment Uploads
  REPAYMENTS_UPLOAD: '/operations/repayments/upload',
  REPAYMENTS_LIST: '/operations/repayments',
  REPAYMENT_BY_ID: (id) => `/operations/repayments/${id}`,
  REPAYMENT_RETRY: (id) => `/operations/repayments/${id}/retry`,
  REPAYMENT_LENDERS: '/operations/repayments/lenders',
  REPAYMENT_LANS: '/operations/repayments/lans',
  CUSTOMER_MIGRATION_UPLOAD: '/operations/migrations/customers',
  CUSTOMER_MIGRATION_TEMPLATE: '/operations/migrations/customers/template',
  INVOICE_MIGRATION_UPLOAD: '/operations/migrations/invoices',
  INVOICE_MIGRATION_SINGLE_UPLOAD: '/operations/migrations/invoices/single',
  INVOICE_MIGRATION_SUPPLIERS: '/operations/migrations/invoices/suppliers',
  INVOICE_MIGRATION_TEMPLATE: '/operations/migrations/invoices/template',
  SUPPLIER_MIGRATION_UPLOAD: '/operations/migrations/suppliers',
  SUPPLIER_MIGRATION_TEMPLATE: '/operations/migrations/suppliers/template',

  // Loan Servicing
  LOAN_SERVICING_ACCOUNT: (lan) => `/loan-servicing/accounts/${lan}`,
  LOAN_SERVICING_SCHEDULE: (lan) => `/loan-servicing/accounts/${lan}/schedule`,
  LOAN_SERVICING_STATEMENT: (lan) => `/loan-servicing/accounts/${lan}/statement`,
  LOAN_SERVICING_COLLECTION_DETAIL: (lan, utr) => `/loan-servicing/collections/${lan}/${utr}`,
  LOAN_SERVICING_COLLECTIONS_BY_LAN: (lan) => `/loan-servicing/collections/${lan}`,
  LOAN_SERVICING_INVOICES_BY_LAN: (lan) => `/loan-servicing/invoices/${lan}`,
  LOAN_SERVICING_PORTFOLIO_REPORT: '/loan-servicing/reports/portfolio',
  LOAN_SERVICING_DISBURSEMENT_REPORT: '/loan-servicing/reports/disbursements',
  LOAN_SERVICING_COLLECTION_REPORT: '/loan-servicing/reports/collections',
  LOAN_SERVICING_SCF_15D_REPORT_EXPORT: '/loan-servicing/reports/scf-15d/export',
  LOAN_SERVICING_SCF_AS_OF_NOW_REPORT_EXPORT: '/loan-servicing/reports/scf-as-of-now/export',
  LOAN_SERVICING_SCF_COLLECTION_REPORT_EXPORT: '/loan-servicing/reports/scf-collections/export',
  LOAN_SERVICING_SCF_SOA_REPORT_EXPORT: '/loan-servicing/reports/scf-soa/export',

  // Onboarding Integrations
  ONBOARDING_MOBILE_SEND_OTP: '/onboarding/mobile/send-otp',
  ONBOARDING_MOBILE_VERIFY_OTP: '/onboarding/mobile/verify-otp',
  ONBOARDING_EMAIL_SEND_OTP: '/onboarding/email/send-otp',
  ONBOARDING_EMAIL_VERIFY_OTP: '/onboarding/email/verify-otp',
  ONBOARDING_KYC_PAN: '/onboarding/kyc/pan',
  ONBOARDING_KYC_GST: '/onboarding/kyc/gst',
  ONBOARDING_KYC_AADHAAR: '/onboarding/kyc/aadhaar',
  ONBOARDING_BUREAU_CHECK: '/onboarding/bureau/check',
  ONBOARDING_OCR_PROCESS: '/onboarding/ocr/process',

  // PAN OCR (Direct frontend call)
  PAN_OCR: 'https://sandbox.fintreelms.com/ocr/v1/pan',
  // Cheque OCR (Direct frontend call)
  CHEQUE_OCR: 'https://sandbox.fintreelms.com/ocr/v1/cheque',

  // User Performance (SuperAdmin)
  USER_PERFORMANCE_SUMMARY: '/superadmin/user-performance/summary',
  USER_PERFORMANCE_LIST: '/superadmin/user-performance/list',
  USER_PERFORMANCE_USERS: '/superadmin/user-performance/users',
  USER_PERFORMANCE_DETAIL: (userId) => `/superadmin/user-performance/${userId}`,
  
  // Cases (SuperAdmin)
  SUPERADMIN_CASES: '/superadmin/cases',
  SUPERADMIN_CASE_COMPANY_SUGGESTIONS: '/superadmin/cases/company-suggestions',

  // Case lifecycle / renewals
  CASE_MANAGEMENT_CHECKLISTS: '/case-management/post-sanction-checklists',
  CASE_MANAGEMENT_RENEWALS: (customerId) => `/case-management/customers/${customerId}/renewals`,
  CASE_MANAGEMENT_START_RENEWAL: (customerId) => `/case-management/customers/${customerId}/renewals/start`,
  CASE_MANAGEMENT_HOLD: (customerId) => `/case-management/customers/${customerId}/hold`,
  CASE_MANAGEMENT_RESUME: (customerId) => `/case-management/customers/${customerId}/resume`,
  CASE_MANAGEMENT_ARCHIVE: (customerId) => `/case-management/customers/${customerId}/archive`,
  CASE_MANAGEMENT_REASSIGN_RM: (customerId) => `/case-management/customers/${customerId}/reassign-rm`,
  CASE_MANAGEMENT_CALENDAR_RMS: '/case-management/calendar/rms',
  CASE_MANAGEMENT_CALENDAR: '/case-management/calendar',
  CASE_MANAGEMENT_RUN_REMINDERS: '/case-management/reminders/run',

  // Invoice approval batches
  WORKFLOW_INVOICE_APPROVAL_BATCH_CREATE: '/workflows/invoices/customer-approval-batches',
  WORKFLOW_INVOICE_APPROVAL_BATCH_PENDING: '/workflows/invoices/pending/customer-batches',
  WORKFLOW_INVOICE_APPROVAL_BATCH_CUSTOMER_APPROVE: (batchId) => `/workflows/invoices/customer-approval-batches/${batchId}/customer-approve`,
}

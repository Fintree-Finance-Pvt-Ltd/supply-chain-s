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
  DOCUMENTS_BY_CUSTOMER: (customerId) => `/documents/customer/${customerId}`,
  DOCUMENT_VERIFY: (id) => `/documents/${id}/verify`,
  DOCUMENT_DELETE: (id) => `/documents/${id}`,

  // Workflow Endpoints
  WORKFLOW_CUSTOMER_CREATE: '/workflows/customers/create',
  WORKFLOW_CUSTOMER_SUBMIT: (id) => `/workflows/customers/${id}/submit`,
  WORKFLOW_CUSTOMER_CREDIT_L1: (id) => `/workflows/customers/${id}/credit-l1`,
  WORKFLOW_CUSTOMER_CREDIT_L2: (id) => `/workflows/customers/${id}/credit-l2`,
  WORKFLOW_CUSTOMER_CEO: (id) => `/workflows/customers/${id}/ceo-approve`,
  WORKFLOW_CUSTOMER_MD: (id) => `/workflows/customers/${id}/md-approve`,
  WORKFLOW_CUSTOMER_OPS_SUBMIT: (id) => `/workflows/customers/${id}/ops-submit`,
  WORKFLOW_CUSTOMER_OPS_L1: (id) => `/workflows/customers/${id}/ops-l1`,
  WORKFLOW_CUSTOMER_OPS_HEAD: (id) => `/workflows/customers/${id}/ops-head`,
  WORKFLOW_CUSTOMER_BANK_DETAILS: (id) => `/workflows/customers/${id}/bank-details`,
  WORKFLOW_DOCUMENT_UPDATE: (id) => `/workflows/documents/${id}`,

  // Supplier Workflow
  WORKFLOW_SUPPLIER_CREATE: '/workflows/suppliers/create',
  WORKFLOW_SUPPLIER_SUBMIT: (id) => `/workflows/suppliers/${id}/submit`,
  WORKFLOW_SUPPLIER_OPS_L1: (id) => `/workflows/suppliers/${id}/ops-l1`,
  WORKFLOW_SUPPLIER_OPS_HEAD: (id) => `/workflows/suppliers/${id}/ops-head`,

  // Invoice Workflow
  WORKFLOW_INVOICE_CREATE: '/workflows/invoices/create',
  WORKFLOW_INVOICE_SUBMIT: (id) => `/workflows/invoices/${id}/submit`,
  WORKFLOW_INVOICE_OPS_L1: (id) => `/workflows/invoices/${id}/ops-l1`,
  WORKFLOW_INVOICE_OPS_L2: (id) => `/workflows/invoices/${id}/ops-l2`,
  WORKFLOW_INVOICE_OPS_HEAD: (id) => `/workflows/invoices/${id}/ops-head`,
  WORKFLOW_INVOICE_CEO: (id) => `/workflows/invoices/${id}/ceo-review`,
  WORKFLOW_INVOICE_MD: (id) => `/workflows/invoices/${id}/md-approve`,

  // Dashboards
  DASHBOARD_RM_CUSTOMERS: '/workflows/customers/dashboard/rm',
  DASHBOARD_CREDIT_PENDING: (level) => `/workflows/customers/dashboard/credit/${level}`,
  DASHBOARD_EXECUTIVE_PENDING: '/workflows/customers/dashboard/executive',
  DASHBOARD_OPERATIONS_PENDING: '/workflows/customers/dashboard/operations',

  DASHBOARD_RM_SUPPLIERS: '/workflows/suppliers/dashboard/rm',
  DASHBOARD_RM_INVOICES: '/workflows/invoices/dashboard/rm',

  // Operations
  OPERATIONS_PENDING: '/operations/pending',
  OPERATIONS_BY_ID: (id) => `/operations/${id}`,

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
}

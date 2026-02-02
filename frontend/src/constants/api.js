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
  ASSIGN_ROLE: '/users/assign-role',
  
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
  
  // Operations
  OPERATIONS_PENDING: '/operations/pending',
  OPERATIONS_BY_ID: (id) => `/operations/${id}`,
}


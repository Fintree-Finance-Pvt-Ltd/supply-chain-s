// User Roles
export const ROLES = {
  ADMIN: 'admin',
  RELATIONSHIP_MANAGER: 'relationship_manager',
  CREDIT_TEAM: 'credit_team',
  OPERATIONS_TEAM: 'operations_team',
  CFO: 'cfo',
  CEO: 'ceo',
  MD: 'md',
} as const;

// Case Status
export const CASE_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  CREDIT_APPROVED: 'credit_approved',
  POST_SANCTION_PENDING: 'post_sanction_pending',
  POST_SANCTION_COMPLETED: 'post_sanction_completed',
  OPERATIONS_APPROVED: 'operations_approved',
  FULLY_ONBOARDED: 'fully_onboarded',
  REJECTED: 'rejected',
} as const;

export type CaseStatus = typeof CASE_STATUS[keyof typeof CASE_STATUS];

// Approval Status
export const APPROVAL_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

// Document Types
export const DOCUMENT_TYPES = {
  PAN: 'pan',
  AADHAAR: 'aadhaar',
  ELECTRICITY_BILL: 'electricity_bill',
  SANCTION_LETTER: 'sanction_letter',
  ESIGN_DOCUMENT: 'esign_document',
  ENACH_DOCUMENT: 'enach_document',
  OTHER: 'other',
} as const;

// Approval Flow Types
export const APPROVAL_FLOW_TYPES = {
  CREDIT_SANCTION: 'credit_sanction',
  OPERATIONS: 'operations',
} as const;


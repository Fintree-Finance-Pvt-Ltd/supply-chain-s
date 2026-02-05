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

  // KYC Documents
  GST_CERTIFICATE: 'gst_certificate',
  MSME_CERTIFICATE: 'msme_certificate',

  // Company Documents
  COI: 'coi', // Certificate of Incorporation
  MOA: 'moa', // Memorandum of Association
  AOA: 'aoa', // Articles of Association
  LIST_OF_DIRECTORS: 'list_of_directors',
  COMPANY_PAN: 'company_pan',
  PARTNERSHIP_DEED: 'partnership_deed',
  LLP_DEED: 'llp_deed',

  // Address Proof
  OFFICE_ELECTRICITY_BILL: 'office_electricity_bill',
  RENT_AGREEMENT: 'rent_agreement',
  RESIDENCE_ELECTRICITY_BILL: 'residence_electricity_bill',

  // Financial Documents
  ITR_FY_2223: 'itr_fy_2223',
  ITR_FY_2324: 'itr_fy_2324',
  ITR_FY_2425: 'itr_fy_2425',
  AUDITED_FINANCIALS_2122: 'audited_financials_2122',
  AUDITED_FINANCIALS_2223: 'audited_financials_2223',
  AUDITED_FINANCIALS_2324: 'audited_financials_2324',
  AUDITED_FINANCIALS_2425: 'audited_financials_2425',
  BANK_STATEMENT: 'bank_statement',

  // GST & Sales
  GSTR_3B: 'gstr_3b',
  SALES_PURCHASE: 'sales_purchase',

  // Other Business Documents
  DEBTOR_AGEING: 'debtor_ageing',
  OBLIGATION_SHEET: 'obligation_sheet',

  OTHER: 'other',
} as const;

// Company Types
export const COMPANY_TYPES = {
  PROPRIETORSHIP: 'Proprietorship',
  PARTNERSHIP: 'Partnership',
  PVT_LTD: 'Pvt Ltd / Ltd',
  LLP: 'LLP',
} as const;

// KYC Types
export const KYC_TYPES = {
  PAN: 'PAN',
  GST: 'GST',
  AADHAAR: 'AADHAAR',
} as const;

// Approval Flow Types
export const APPROVAL_FLOW_TYPES = {
  CREDIT_SANCTION: 'credit_sanction',
  OPERATIONS: 'operations',
} as const;



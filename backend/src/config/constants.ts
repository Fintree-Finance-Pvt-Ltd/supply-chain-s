// User Roles
export const ROLES = {
  ADMIN: 'admin',
  RELATIONSHIP_MANAGER: 'relationship_manager',
  CREDIT_TEAM_L1: 'credit_team_l1',
  CREDIT_TEAM_L2: 'credit_team_l2',
  OPERATIONS_TEAM_L1: 'operations_team_l1',
  OPERATIONS_TEAM_L2: 'operations_team_l2',
  OPERATIONS_HEAD: 'operations_head',
  CREDIT_SANCTION_CUSTOMER_APPROVAL: 'credit_sanction_customer_approval',
  CFO: 'cfo',
  CEO: 'ceo',
  MD: 'md',
} as const;

// Case Status
export const CASE_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  CREDIT_L1_APPROVED: 'credit_l1_approved',
  CREDIT_L2_APPROVED: 'credit_l2_approved',
  CEO_APPROVED: 'ceo_approved',
  MD_PENDING_TERMS: 'md_pending_terms',
  MD_TERMS_SUBMITTED: 'md_terms_submitted',
  MD_APPROVED: 'md_approved',
  OPS_L1_REVIEW: 'ops_l1_review',
  OPS_L1_APPROVED: 'ops_l1_approved',
  OPS_L2_VERIFIED: 'ops_l2_verified',
  OPS_HEAD_APPROVED: 'ops_head_approved',
  COMPLETED: 'completed',
  DISBURSED: 'disbursed',
  REJECTED: 'rejected',

  // Backward compatibility
  CREDIT_APPROVED: 'credit_l2_approved',
  POST_SANCTION_PENDING: 'md_approved',
  POST_SANCTION_COMPLETED: 'ops_l1_approved',
  FULLY_ONBOARDED: 'completed',
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

  // Additional Photos & Bank docs
  LIVE_PHOTO: 'live_photo',
  SHOP_PHOTO: 'shop_photo',
  CHEQUE: 'cheque',

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
  INVOICE_DISCOUNTING: 'invoice_discounting',
  SUPPLIER_ONBOARD: 'supplier_onboard',
  IT_APPROVAL: 'it_approval',
} as const;

// Genders
export const GENDERS = {
  MALE: 'Male',
  FEMALE: 'Female',
  OTHER: 'Other',
} as const;

// Address Types
export const ADDRESS_TYPES = {
  RESIDENCE: 'Residence',
  SHOP: 'Shop',
  GODOWN: 'Godown',
  RENTED: 'Rented',
  OWNED: 'Owned',
} as const;



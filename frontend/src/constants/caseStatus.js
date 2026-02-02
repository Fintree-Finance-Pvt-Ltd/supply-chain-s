export const CASE_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  CREDIT_APPROVED: 'credit_approved',
  POST_SANCTION_PENDING: 'post_sanction_pending',
  OPERATIONS_APPROVED: 'operations_approved',
  FULLY_ONBOARDED: 'fully_onboarded',
  REJECTED: 'rejected',
}

export const CASE_STATUS_LABELS = {
  [CASE_STATUS.DRAFT]: 'Draft',
  [CASE_STATUS.SUBMITTED]: 'Submitted',
  [CASE_STATUS.CREDIT_APPROVED]: 'Credit Approved',
  [CASE_STATUS.POST_SANCTION_PENDING]: 'Post Sanction Pending',
  [CASE_STATUS.OPERATIONS_APPROVED]: 'Operations Approved',
  [CASE_STATUS.FULLY_ONBOARDED]: 'Fully Onboarded',
  [CASE_STATUS.REJECTED]: 'Rejected',
}

export const CASE_STATUS_COLORS = {
  [CASE_STATUS.DRAFT]: 'gray',
  [CASE_STATUS.SUBMITTED]: 'blue',
  [CASE_STATUS.CREDIT_APPROVED]: 'green',
  [CASE_STATUS.POST_SANCTION_PENDING]: 'yellow',
  [CASE_STATUS.OPERATIONS_APPROVED]: 'green',
  [CASE_STATUS.FULLY_ONBOARDED]: 'green',
  [CASE_STATUS.REJECTED]: 'red',
}


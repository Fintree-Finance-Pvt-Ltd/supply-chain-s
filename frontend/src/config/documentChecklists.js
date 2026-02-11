// Document checklists organized by company type
// Each document has: key (unique identifier), label (display name), mandatory (required for submission), documentType (backend enum value)

export const COMPANY_TYPES = {
    PROPRIETORSHIP: 'Proprietorship',
    HUF: 'HUF',
    PARTNERSHIP: 'Partnership',
    PVT_LTD: 'Pvt Ltd / Ltd',
    LLP: 'LLP',
}

// Common financial documents requested by the user
const COMMON_FINANCIALS = [
    { key: 'audited_financials_3y', label: 'Audited Financials (Last 3 Years)', mandatory: true, documentType: 'audited_financials', supportMultiple: true },
    { key: 'gstr_3b_latest', label: 'GSTR-3B (Latest 2 – Required)', mandatory: true, documentType: 'gstr_3b', supportMultiple: true },
    { key: 'bank_statement', label: 'Bank Statement (Last 12 months)', mandatory: true, documentType: 'bank_statement', supportMultiple: true },
    { key: 'obligation_sheet', label: 'Obligation Sheet', mandatory: false, documentType: 'obligation_sheet' },
]

// Proprietorship Document Checklist
export const PROPRIETORSHIP_CHECKLIST = [
    { key: 'gst_certificate', label: 'GST Certificate', mandatory: false, documentType: 'gst_certificate' },
    { key: 'msme_certificate', label: 'MSME Certificate', mandatory: false, documentType: 'msme_certificate' },
    { key: 'office_electricity_bill', label: 'Office Electricity Bill', mandatory: false, documentType: 'office_electricity_bill' },
    { key: 'pan_aadhaar_applicant', label: 'PAN & Aadhaar of Applicant', mandatory: true, documentType: 'pan' },
    { key: 'pan_aadhaar_female_co_applicant', label: 'PAN & Aadhaar of Female Co-Applicant', mandatory: false, documentType: 'pan' },
    { key: 'residence_electricity_bill', label: 'Residence Electricity Bill', mandatory: false, documentType: 'residence_electricity_bill' },
    ...COMMON_FINANCIALS,
    { key: 'sales_purchase', label: 'Sales & Purchase (Monthwise, Tally)', mandatory: false, documentType: 'sales_purchase' },
]

// Pvt Ltd / Ltd Document Checklist
export const PVT_LTD_CHECKLIST = [
    { key: 'gst_certificate', label: 'GST Certificate', mandatory: false, documentType: 'gst_certificate' },
    { key: 'msme_certificate', label: 'MSME Certificate', mandatory: false, documentType: 'msme_certificate' },
    { key: 'coi', label: 'COI (Certificate of Incorporation)', mandatory: true, documentType: 'coi' },
    { key: 'moa', label: 'MOA (Memorandum of Association)', mandatory: true, documentType: 'moa' },
    { key: 'aoa', label: 'AOA (Articles of Association)', mandatory: true, documentType: 'aoa' },
    { key: 'list_of_directors', label: 'List of Directors & Shareholders', mandatory: true, documentType: 'list_of_directors' },
    { key: 'company_pan', label: 'Company PAN', mandatory: true, documentType: 'company_pan' },
    { key: 'office_electricity_bill', label: 'Office Electricity Bill / Rent Agreement', mandatory: false, documentType: 'office_electricity_bill' },
    { key: 'pan_aadhaar_directors', label: 'PAN & Aadhaar of ALL Directors', mandatory: true, documentType: 'pan' },
    ...COMMON_FINANCIALS,
    { key: 'sales_purchase', label: 'Sales & Purchase (Monthwise, Tally)', mandatory: false, documentType: 'sales_purchase' },
    { key: 'debtor_ageing', label: 'Debtor Ageing', mandatory: false, documentType: 'debtor_ageing' },
]

// Partnership / LLP Document Checklist
export const PARTNERSHIP_LLP_CHECKLIST = [
    { key: 'gst_certificate', label: 'GST Certificate', mandatory: false, documentType: 'gst_certificate' },
    { key: 'msme_certificate', label: 'MSME Certificate', mandatory: false, documentType: 'msme_certificate' },
    { key: 'partnership_deed', label: 'Partnership Deed / LLP Deed', mandatory: true, documentType: 'partnership_deed' },
    { key: 'company_pan', label: 'Company PAN', mandatory: true, documentType: 'company_pan' },
    { key: 'office_electricity_bill', label: 'Office Electricity Bill / Rent Agreement', mandatory: false, documentType: 'office_electricity_bill' },
    { key: 'pan_aadhaar_partners', label: 'PAN & Aadhaar of ALL Partners', mandatory: true, documentType: 'pan' },
    ...COMMON_FINANCIALS,
    { key: 'sales_purchase', label: 'Sales & Purchase (Monthwise, Tally)', mandatory: false, documentType: 'sales_purchase' },
    { key: 'debtor_ageing', label: 'Debtor Ageing', mandatory: false, documentType: 'debtor_ageing' },
]

// Get checklist based on company type
export const getDocumentChecklist = (companyType) => {
    switch (companyType) {
        case COMPANY_TYPES.PROPRIETORSHIP:
            return PROPRIETORSHIP_CHECKLIST
        case COMPANY_TYPES.PARTNERSHIP:
        case COMPANY_TYPES.LLP:
            return PARTNERSHIP_LLP_CHECKLIST
        case COMPANY_TYPES.PVT_LTD:
            return PVT_LTD_CHECKLIST
        case COMPANY_TYPES.HUF:
            return PROPRIETORSHIP_CHECKLIST
        default:
            return []
    }
}

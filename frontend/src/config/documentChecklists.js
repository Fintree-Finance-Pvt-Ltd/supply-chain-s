// Document checklists organized by company type
// Each document has: key (unique identifier), label (display name), mandatory (required for submission), documentType (backend enum value)

export const COMPANY_TYPES = {
    PROPRIETORSHIP: 'Proprietorship',
    PARTNERSHIP: 'Partnership',
    PVT_LTD: 'Pvt Ltd / Ltd',
    LLP: 'LLP',
}

// Proprietorship Document Checklist
export const PROPRIETORSHIP_CHECKLIST = [
    { key: 'gst_certificate', label: 'GST Certificate', mandatory: true, documentType: 'gst_certificate' },
    { key: 'msme_certificate', label: 'MSME Certificate', mandatory: false, documentType: 'msme_certificate' },
    { key: 'office_electricity_bill', label: 'Office Electricity Bill', mandatory: true, documentType: 'office_electricity_bill' },
    { key: 'pan_aadhaar_applicant', label: 'PAN & Aadhaar of Applicant', mandatory: true, documentType: 'pan' },
    { key: 'pan_aadhaar_female_co_applicant', label: 'PAN & Aadhaar of Female Co-Applicant', mandatory: true, documentType: 'aadhaar' },
    { key: 'residence_electricity_bill', label: 'Residence Electricity Bill', mandatory: true, documentType: 'residence_electricity_bill' },
    { key: 'audited_financials_2122', label: 'Audited Financials (FY 21-22)', mandatory: true, documentType: 'audited_financials_2122' },
    { key: 'audited_financials_2223', label: 'Audited Financials (FY 22-23)', mandatory: true, documentType: 'audited_financials_2223' },
    { key: 'audited_financials_2324', label: 'Audited Financials (FY 23-24)', mandatory: true, documentType: 'audited_financials_2324' },
    { key: 'audited_financials_2425', label: 'Audited Financials (FY 24-25)', mandatory: true, documentType: 'audited_financials_2425' },
    { key: 'gstr_3b', label: 'GSTR 3B (Apr 2024 – Sept 2025)', mandatory: true, documentType: 'gstr_3b' },
    { key: 'bank_statement', label: 'Bank Statement (Apr 2024 – Latest, PDF)', mandatory: true, documentType: 'bank_statement' },
    { key: 'sales_purchase', label: 'Sales & Purchase (Monthwise, Tally, Apr 24 – Nov 25)', mandatory: true, documentType: 'sales_purchase' },
    { key: 'obligation_sheet', label: 'Obligation Sheet (as per format)', mandatory: true, documentType: 'obligation_sheet' },
]

// Pvt Ltd / Ltd Document Checklist
export const PVT_LTD_CHECKLIST = [
    { key: 'gst_certificate', label: 'GST Certificate', mandatory: true, documentType: 'gst_certificate' },
    { key: 'msme_certificate', label: 'MSME Certificate', mandatory: false, documentType: 'msme_certificate' },
    { key: 'coi', label: 'COI (Certificate of Incorporation)', mandatory: true, documentType: 'coi' },
    { key: 'moa', label: 'MOA (Memorandum of Association)', mandatory: true, documentType: 'moa' },
    { key: 'aoa', label: 'AOA (Articles of Association)', mandatory: true, documentType: 'aoa' },
    { key: 'list_of_directors', label: 'List of Directors & Shareholders', mandatory: true, documentType: 'list_of_directors' },
    { key: 'company_pan', label: 'Company PAN', mandatory: true, documentType: 'company_pan' },
    { key: 'office_electricity_bill', label: 'Office Electricity Bill / Rent Agreement', mandatory: true, documentType: 'office_electricity_bill' },
    { key: 'pan_aadhaar_directors', label: 'PAN & Aadhaar of ALL Directors', mandatory: true, documentType: 'pan' },
    { key: 'itr_2223', label: 'ITR (FY 22-23)', mandatory: true, documentType: 'itr_fy_2223' },
    { key: 'itr_2324', label: 'ITR (FY 23-24)', mandatory: true, documentType: 'itr_fy_2324' },
    { key: 'itr_2425', label: 'ITR (FY 24-25)', mandatory: true, documentType: 'itr_fy_2425' },
    { key: 'bank_statement', label: 'Bank Statement (Last 12 months)', mandatory: true, documentType: 'bank_statement' },
    { key: 'gstr_3b', label: 'GSTR 3B (Apr 2024 – Latest)', mandatory: true, documentType: 'gstr_3b' },
    { key: 'sales_purchase', label: 'Sales & Purchase (Monthwise, Tally)', mandatory: true, documentType: 'sales_purchase' },
    { key: 'debtor_ageing', label: 'Debtor Ageing', mandatory: true, documentType: 'debtor_ageing' },
    { key: 'obligation_sheet', label: 'Obligation Sheet', mandatory: true, documentType: 'obligation_sheet' },
]

// Partnership / LLP Document Checklist
export const PARTNERSHIP_LLP_CHECKLIST = [
    { key: 'gst_certificate', label: 'GST Certificate', mandatory: true, documentType: 'gst_certificate' },
    { key: 'msme_certificate', label: 'MSME Certificate', mandatory: false, documentType: 'msme_certificate' },
    { key: 'partnership_deed', label: 'Partnership Deed / LLP Deed', mandatory: true, documentType: 'partnership_deed' },
    { key: 'company_pan', label: 'Company PAN', mandatory: true, documentType: 'company_pan' },
    { key: 'office_electricity_bill', label: 'Office Electricity Bill / Rent Agreement', mandatory: true, documentType: 'office_electricity_bill' },
    { key: 'pan_aadhaar_partners', label: 'PAN & Aadhaar of ALL Partners', mandatory: true, documentType: 'pan' },
    { key: 'itr_2223', label: 'ITR (FY 22-23)', mandatory: true, documentType: 'itr_fy_2223' },
    { key: 'itr_2324', label: 'ITR (FY 23-24)', mandatory: true, documentType: 'itr_fy_2324' },
    { key: 'itr_2425', label: 'ITR (FY 24-25)', mandatory: true, documentType: 'itr_fy_2425' },
    { key: 'bank_statement', label: 'Bank Statement (Last 12 months)', mandatory: true, documentType: 'bank_statement' },
    { key: 'gstr_3b', label: 'GSTR 3B (Apr 2024 – Latest)', mandatory: true, documentType: 'gstr_3b' },
    { key: 'sales_purchase', label: 'Sales & Purchase (Monthwise, Tally)', mandatory: true, documentType: 'sales_purchase' },
    { key: 'debtor_ageing', label: 'Debtor Ageing', mandatory: true, documentType: 'debtor_ageing' },
    { key: 'obligation_sheet', label: 'Obligation Sheet', mandatory: true, documentType: 'obligation_sheet' },
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
        default:
            return []
    }
}

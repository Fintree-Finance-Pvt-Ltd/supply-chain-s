import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { supplierService } from '../../services/supplierService'
import kycService from '../../services/kycService'
import { useSelector } from 'react-redux'
import { ROLES } from '../../constants/roles'
import { API_BASE_URL } from '../../constants/api'

const SupplierDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [supplier, setSupplier] = useState(null)
  const [workflow, setWorkflow] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [file, setFile] = useState(null)
  const [bank, setBank] = useState(null)
  const [chequeDocument, setChequeDocument] = useState(null)
  const [remarks, setRemarks] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [isEditingBank, setIsEditingBank] = useState(false)
  const [isSavingBank, setIsSavingBank] = useState(false)
  const [isSubmittingToOpsHead, setIsSubmittingToOpsHead] = useState(false)
  const [isDeletingCheque, setIsDeletingCheque] = useState(false)
  const [bankValidationErrors, setBankValidationErrors] = useState({})
  const [bankForm, setBankForm] = useState({
    bankAccountNumber: '',
    ifscCode: '',
    bankName: '',
    accountHolderName: '',
    micrCode: '',
    chequeNumber: ''
  })
  const { user } = useSelector((s) => s.auth)

  const normalizeRole = (role) => {
    const value = role?.role?.name || role?.roleName || role?.name || role
    return String(value || '').toLowerCase()
  }

  const hasUserRole = (role) => {
    const userRoles = [
      user?.role,
      user?.defaultRole,
      ...(user?.roles || []),
      ...(user?.userRoles || [])
    ]

    return userRoles.map(normalizeRole).includes(role)
  }

  // Fetch supplier details on mount
  useEffect(() => {
    fetchSupplierDetails()
  }, [id])

  const fetchSupplierDetails = async () => {
    try {
      setLoading(true)
      const res = await supplierService.getSupplierById(Number(id))
      const data = res.data?.data
      setSupplier(data?.supplier)
      setWorkflow(data?.workflow)
      setHistory(data?.history || [])
      setBank(data?.supplier?.bankDetail)
      setChequeDocument(data?.chequeDocument)
      
      // Populate bank form with existing bank details
      if (data?.supplier?.bankDetail) {
        setBankForm({
          bankAccountNumber: data.supplier.bankDetail.bankAccountNumber || '',
          ifscCode: data.supplier.bankDetail.ifscCode || '',
          bankName: data.supplier.bankDetail.bankName || '',
          accountHolderName: data.supplier.bankDetail.accountHolderName || '',
          micrCode: data.supplier.bankDetail.micrCode || '',
          chequeNumber: data.supplier.bankDetail.chequeNumber || ''
        })
      } else {
        setBankForm({
          bankAccountNumber: '',
          ifscCode: '',
          bankName: '',
          accountHolderName: '',
          micrCode: '',
          chequeNumber: ''
        })
      }
    } catch (e) {
      console.error(e)
      toast.error('Failed to fetch supplier details')
    } finally {
      setLoading(false)
    }
  }

  const updateBankFormField = (field, value) => {
    const nextValue = field === 'ifscCode' ? value.toUpperCase() : value
    setBankForm((prev) => ({ ...prev, [field]: nextValue }))
    setBankValidationErrors((prev) => {
      if (!prev[field]) return prev
      const nextErrors = { ...prev }
      delete nextErrors[field]
      return nextErrors
    })
  }

  const getNormalizedBankForm = () => ({
    bankAccountNumber: bankForm.bankAccountNumber.replace(/\s+/g, ''),
    ifscCode: bankForm.ifscCode.replace(/\s+/g, '').toUpperCase(),
    bankName: bankForm.bankName.trim(),
    accountHolderName: bankForm.accountHolderName.trim(),
    micrCode: bankForm.micrCode.replace(/\s+/g, ''),
    chequeNumber: bankForm.chequeNumber.trim()
  })

  const getNormalizedSavedBank = () => ({
    bankAccountNumber: String(bank?.bankAccountNumber || '').replace(/\s+/g, ''),
    ifscCode: String(bank?.ifscCode || '').replace(/\s+/g, '').toUpperCase(),
    bankName: String(bank?.bankName || '').trim(),
    accountHolderName: String(bank?.accountHolderName || '').trim(),
    micrCode: String(bank?.micrCode || '').replace(/\s+/g, ''),
    chequeNumber: String(bank?.chequeNumber || '').trim()
  })

  const isBankFormSaved = (values) => {
    if (!bank) return false
    const savedBank = getNormalizedSavedBank()

    return Object.keys(values).every((key) => values[key] === savedBank[key])
  }

  const validateBankDetails = () => {
    const values = getNormalizedBankForm()
    const errors = {}

    if (!values.bankAccountNumber) {
      errors.bankAccountNumber = 'Account number is required'
    } else if (!/^\d{6,18}$/.test(values.bankAccountNumber)) {
      errors.bankAccountNumber = 'Enter a valid account number'
    }

    if (!values.ifscCode) {
      errors.ifscCode = 'IFSC code is required'
    } else if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(values.ifscCode)) {
      errors.ifscCode = 'Enter a valid IFSC code'
    }

    if (!values.bankName) {
      errors.bankName = 'Bank name is required'
    }

    if (!values.accountHolderName) {
      errors.accountHolderName = 'Account holder name is required'
    }

    if (values.micrCode && !/^\d{9}$/.test(values.micrCode)) {
      errors.micrCode = 'MICR code must be 9 digits'
    }

    setBankValidationErrors(errors)

    return {
      isValid: Object.keys(errors).length === 0,
      values,
      firstError: Object.values(errors)[0]
    }
  }

  const uploadCheque = async () => {
    try {
      if (!file) return toast.error('Select cheque file')
      
      setIsUploading(true)
      
      // ----- Direct Cheque OCR from frontend (no backend routing) -----
      try {
        const ocrResult = await kycService.processChequeOcr(file);
        
        if (ocrResult.success) {
          const { bank_account_number, ifsc_code, bank_name, account_holder_name, micr_code, cheque_number } = ocrResult.data;
          
          // Log provider name
          console.log('Cheque OCR Provider:', ocrResult.provider);
          
          // Populate form with OCR data for editing
          setBankForm({
            bankAccountNumber: bank_account_number || '',
            ifscCode: ifsc_code || '',
            bankName: bank_name || '',
            accountHolderName: account_holder_name || '',
            micrCode: micr_code || '',
            chequeNumber: cheque_number || ''
          });
          
          setIsEditingBank(true);
          
          toast.success('Cheque OCR completed! Please verify and edit bank details if needed.');
        }
      } catch (ocrErr) {
        // OCR failed - show message to enter details manually
        console.error('Cheque OCR Error:', ocrErr.message);
        setIsEditingBank(true);
        toast.error('Unable to read cheque. Please enter details manually.');
      }
      
    } catch (e) {
      console.error(e)
      toast.error(e?.response?.data?.message || 'Cheque upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const saveBankDetails = async () => {
    const validation = validateBankDetails()
    if (!validation.isValid) {
      setIsEditingBank(true)
      toast.error(validation.firstError || 'Please fill bank details')
      return
    }

    try {
      setIsSavingBank(true)
      const res = await supplierService.updateBankDetails(Number(id), validation.values)
      setBank(res.data?.data)
      setBankForm(validation.values)
      setIsEditingBank(false)
      toast.success('Bank details saved successfully')
      fetchSupplierDetails()
    } catch (e) {
      console.error(e)
      toast.error(e?.response?.data?.message || 'Failed to save bank details')
    } finally {
      setIsSavingBank(false)
    }
  }

  const deleteCheque = async () => {
    if (!window.confirm('Are you sure you want to remove the cheque document and bank details?')) {
      return
    }
    try {
      setIsDeletingCheque(true)
      await supplierService.deleteChequeDocument(Number(id))
      setBank(null)
      setChequeDocument(null)
      setIsEditingBank(false)
      setBankForm({
        bankAccountNumber: '',
        ifscCode: '',
        bankName: '',
        accountHolderName: '',
        micrCode: '',
        chequeNumber: ''
      })
      toast.success('Cheque document removed')
      fetchSupplierDetails()
    } catch (e) {
      console.error(e)
      toast.error(e?.response?.data?.message || 'Failed to delete cheque')
    } finally {
      setIsDeletingCheque(false)
    }
  }

  const opsHeadDecision = async (approved) => {
    try {
      await supplierService.opsHeadDecision(Number(id), approved, remarks)
      toast.success(approved ? 'Supplier onboarded!' : 'Supplier rejected!')
      fetchSupplierDetails()
    } catch (e) {
      console.error(e)
      toast.error(e?.response?.data?.message || 'Action failed')
    }
  }

  const handleSubmit = async () => {
    try {
      await supplierService.submitSupplier(Number(id), remarks)
      toast.success('Supplier submitted for operations approval')
      fetchSupplierDetails()
    } catch (e) {
      console.error(e)
      toast.error(e?.response?.data?.message || 'Submit failed')
    }
  }

  // Ops L1 submit to Ops Head
  const handleSubmitToOpsHead = async () => {
    const validation = validateBankDetails()
    if (!validation.isValid) {
      setIsEditingBank(true)
      toast.error(validation.firstError || 'Please fill bank details before submitting')
      return
    }

    try {
      setIsSubmittingToOpsHead(true)
      if (!isBankFormSaved(validation.values)) {
        setIsEditingBank(true)
        toast.error('Please save bank details before submitting to Ops Head')
        return
      }

      await supplierService.submitToOpsHead(Number(id), remarks || 'Submitting to Operations Head')
      toast.success('Supplier submitted to Operations Head')
      fetchSupplierDetails()
    } catch (e) {
      console.error(e)
      toast.error(e?.response?.data?.message || 'Submit failed')
    } finally {
      setIsSubmittingToOpsHead(false)
    }
  }

  // Normalize status to uppercase
  const normalizeStatus = (status) => {
    return status?.toUpperCase() || 'UNKNOWN'
  }

  // Get status badge
  const getStatusBadge = (status) => {
    const normalizedStatus = normalizeStatus(status)
    const statusColors = {
      'DRAFT': 'bg-gray-100 text-gray-800',
      'SUBMITTED': 'bg-blue-100 text-blue-800',
      'OPS_L1_APPROVED': 'bg-yellow-100 text-yellow-800',
      'COMPLETED': 'bg-green-100 text-green-800',
      'REJECTED': 'bg-red-100 text-red-800',
    }
    const colorClass = statusColors[normalizedStatus] || 'bg-gray-100 text-gray-800'
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${colorClass}`}>
        {normalizedStatus}
      </span>
    )
  }

  // Check if Ops Head can approve (status must be OPS_L1_APPROVED)
  const canApprove = () => {
    const status = normalizeStatus(supplier?.status)
    return status === 'OPS_L1_APPROVED'
  }

  if (loading) return <div className="p-6">Loading...</div>

  if (!supplier) return <div className="p-6">Supplier not found</div>

  const isOpsL1Draft = hasUserRole(ROLES.OPERATIONS_TEAM_L1) && normalizeStatus(supplier.status) === 'DRAFT'
  const isRMUser = hasUserRole(ROLES.RELATIONSHIP_MANAGER)
  const isOpsHeadUser = hasUserRole(ROLES.OPERATIONS_HEAD)
  const showBankDetailsPanel = bank || chequeDocument || isEditingBank || isOpsL1Draft
  const showBankForm = isOpsL1Draft && (isEditingBank || !bank)
  const hasSavedBankDetails = isBankFormSaved(getNormalizedBankForm())

  return (
    <div className="p-6">
      <button
        onClick={() => navigate('/operations/suppliers')}
        className="text-primary-600 hover:underline mb-4"
      >
        ← Back to Dashboard
      </button>

      <div className="grid grid-cols-2 gap-6">
        {/* Supplier Details */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Supplier Details</h2>
          
          <div className="space-y-3">
            <div>
              <label className="text-sm text-gray-500">Supplier Name</label>
              <div className="font-medium">{supplier.supplierName}</div>
            </div>
            <div>
              <label className="text-sm text-gray-500">Supplier Code</label>
              <div>{supplier.supplierCode}</div>
            </div>
            <div>
              <label className="text-sm text-gray-500">Status</label>
              <div>{getStatusBadge(supplier.status)}</div>
            </div>
            <div>
              <label className="text-sm text-gray-500">Customer</label>
              <div>{supplier.customer?.name || supplier.customer?.supplierName || '-'} (LAN: {supplier.customer?.lanId || '-'})</div>
            </div>
            <div>
              <label className="text-sm text-gray-500">Mobile</label>
              <div>{supplier.contactNumber}</div>
            </div>
            
            <div>
              <label className="text-sm text-gray-500">GST Number</label>
              <div>{supplier.gstNumber || '-'}</div>
            </div>
            
          </div>
        </div>

        {/* Actions & Bank Details */}
        <div className="space-y-6">
          {/* Bank Details */}
          {showBankDetailsPanel && (
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold">Bank Details</h3>
                {showBankForm && bank && (
                  <button
                    onClick={() => setIsEditingBank(false)}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    View Mode
                  </button>
                )}
                {!showBankForm && isOpsL1Draft && (bank || chequeDocument) && (
                  <button
                    onClick={() => setIsEditingBank(true)}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Edit
                  </button>
                )}
              </div>
              
              {showBankForm ? (
                /* Editable Form */
                <div className="space-y-3">
                  {!bank && (
                    <p className="text-sm text-gray-500">
                      Enter bank details manually if cheque upload or OCR is unavailable.
                    </p>
                  )}
                  <div>
                    <label className="text-sm text-gray-500 block">Account Number *</label>
                    <input
                      type="text"
                      value={bankForm.bankAccountNumber}
                      onChange={(e) => updateBankFormField('bankAccountNumber', e.target.value)}
                      className={`w-full border p-2 rounded ${bankValidationErrors.bankAccountNumber ? 'border-red-500' : ''}`}
                      placeholder="Enter account number"
                    />
                    {bankValidationErrors.bankAccountNumber && (
                      <p className="mt-1 text-xs text-red-500">{bankValidationErrors.bankAccountNumber}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm text-gray-500 block">IFSC Code *</label>
                    <input
                      type="text"
                      value={bankForm.ifscCode}
                      onChange={(e) => updateBankFormField('ifscCode', e.target.value)}
                      className={`w-full border p-2 rounded ${bankValidationErrors.ifscCode ? 'border-red-500' : ''}`}
                      placeholder="Enter IFSC code"
                    />
                    {bankValidationErrors.ifscCode && (
                      <p className="mt-1 text-xs text-red-500">{bankValidationErrors.ifscCode}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm text-gray-500 block">Bank Name *</label>
                    <input
                      type="text"
                      value={bankForm.bankName}
                      onChange={(e) => updateBankFormField('bankName', e.target.value)}
                      className={`w-full border p-2 rounded ${bankValidationErrors.bankName ? 'border-red-500' : ''}`}
                      placeholder="Enter bank name"
                    />
                    {bankValidationErrors.bankName && (
                      <p className="mt-1 text-xs text-red-500">{bankValidationErrors.bankName}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm text-gray-500 block">Account Holder Name *</label>
                    <input
                      type="text"
                      value={bankForm.accountHolderName}
                      onChange={(e) => updateBankFormField('accountHolderName', e.target.value)}
                      className={`w-full border p-2 rounded ${bankValidationErrors.accountHolderName ? 'border-red-500' : ''}`}
                      placeholder="Enter holder name"
                    />
                    {bankValidationErrors.accountHolderName && (
                      <p className="mt-1 text-xs text-red-500">{bankValidationErrors.accountHolderName}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm text-gray-500 block">MICR Code</label>
                      <input
                        type="text"
                        value={bankForm.micrCode}
                        onChange={(e) => updateBankFormField('micrCode', e.target.value)}
                        className={`w-full border p-2 rounded ${bankValidationErrors.micrCode ? 'border-red-500' : ''}`}
                        placeholder="MICR"
                      />
                      {bankValidationErrors.micrCode && (
                        <p className="mt-1 text-xs text-red-500">{bankValidationErrors.micrCode}</p>
                      )}
                    </div>
                    <div>
                      <label className="text-sm text-gray-500 block">Cheque Number</label>
                      <input
                        type="text"
                        value={bankForm.chequeNumber}
                        onChange={(e) => updateBankFormField('chequeNumber', e.target.value)}
                        className="w-full border p-2 rounded"
                        placeholder="Cheque No"
                      />
                    </div>
                  </div>
                  
                  <button
                    onClick={saveBankDetails}
                    disabled={isSavingBank || isSubmittingToOpsHead}
                    className={`mt-4 bg-green-600 text-white px-4 py-2 rounded ${isSavingBank || isSubmittingToOpsHead ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {isSavingBank ? 'Saving...' : 'Save Bank Details'}
                  </button>
                </div>
              ) : (
                /* View Mode */
                bank && (
                  <div className="space-y-2 text-sm">
                    <div><span className="text-gray-500">Account:</span> {bank.bankAccountNumber}</div>
                    <div><span className="text-gray-500">IFSC:</span> {bank.ifscCode}</div>
                    <div><span className="text-gray-500">Bank:</span> {bank.bankName}</div>
                    <div><span className="text-gray-500">Holder:</span> {bank.accountHolderName}</div>
                    {bank.micrCode && <div><span className="text-gray-500">MICR:</span> {bank.micrCode}</div>}
                    {bank.chequeNumber && <div><span className="text-gray-500">Cheque No:</span> {bank.chequeNumber}</div>}
                  </div>
                )
              )}
              
              {/* Cheque Document Display */}
              {chequeDocument && (
                <div className="mt-4 pt-4 border-t">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-medium text-sm">Cheque Document</h4>
                    {isOpsL1Draft && (
                      <button
                        onClick={deleteCheque}
                        disabled={isDeletingCheque}
                        className="text-red-500 hover:text-red-700 text-xs flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        {isDeletingCheque ? 'Removing...' : 'Remove'}
                      </button>
                    )}
                  </div>
                  <div className="text-sm text-gray-600 mb-3">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="font-medium">{chequeDocument.fileName}</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      Uploaded: {chequeDocument.createdAt ? new Date(chequeDocument.createdAt).toLocaleString() : 'N/A'}
                    </div>
                  </div>
                  
                  {/* Preview Image */}
                  {chequeDocument.filePath && (
                    <div className="mb-3">
                      <a 
                        href={`${API_BASE_URL.replace('/api', '')}/${chequeDocument.filePath}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <img 
                          src={`${API_BASE_URL.replace('/api', '')}/${chequeDocument.filePath}`} 
                          alt="Cheque Preview" 
                          className="max-w-full h-auto border rounded"
                          style={{ maxHeight: '200px' }}
                        />
                      </a>
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    <a 
                      href={`${API_BASE_URL.replace('/api', '')}/${chequeDocument.filePath}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700 flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      View
                    </a>
                    <a 
                      href={`${API_BASE_URL.replace('/api', '')}/${chequeDocument.filePath}`}
                      download={chequeDocument.fileName}
                      className="bg-gray-600 text-white px-3 py-1.5 rounded text-sm hover:bg-gray-700 flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* RM: Submit for Operations */}
          {/* {isRMUser && normalizeStatus(supplier.status) === 'DRAFT' && (
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="font-semibold mb-3">Submit for Operations</h3>
              <textarea
                className="w-full border p-2 rounded mb-3"
                placeholder="Remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
              <button
                onClick={handleSubmit}
                className="bg-primary-600 text-white px-4 py-2 rounded"
              >
                Submit to Operations
              </button>
            </div>
          )} */}

          {/* Ops L1: Upload Cheque - only show for DRAFT status */}
          {isOpsL1Draft && (
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="font-semibold mb-3">Upload Cheque</h3>
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0])}
                className="mb-3"
              />
              <button
                onClick={uploadCheque}
                disabled={isUploading}
                className={`bg-green-600 text-white px-4 py-2 rounded ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isUploading ? 'Processing OCR...' : 'Upload & Auto Fill Bank'}
              </button>
              {isUploading && (
                <div className="mt-2 text-sm text-gray-500">
                  Reading cheque details... Please wait.
                </div>
              )}
            </div>
          )}

          {/* Ops L1: Submit to Ops Head - only show for DRAFT status */}
          {isOpsL1Draft && (
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="font-semibold mb-3">Submit to Operations Head</h3>
              <textarea
                className="w-full border p-2 rounded mb-3"
                placeholder="Remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
              <button
                onClick={handleSubmitToOpsHead}
                disabled={isSubmittingToOpsHead || isSavingBank}
                className={`bg-primary-600 text-white px-4 py-2 rounded ${isSubmittingToOpsHead || isSavingBank ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isSubmittingToOpsHead ? 'Submitting...' : 'Submit to Ops Head'}
              </button>
              {!hasSavedBankDetails && (
                <p className="text-xs text-red-500 mt-2">
                  Save bank details before submitting to Ops Head.
                </p>
              )}
            </div>
          )}

          {/* Ops Head: Decision */}
          {isOpsHeadUser && (
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="font-semibold mb-3">Operations Head Decision</h3>
              {!canApprove() ? (
                <div className="text-yellow-600 text-sm mb-3">
                  This supplier is currently in "{normalizeStatus(supplier.status)}" status. 
                  Operations Head can only make decisions on suppliers with "OPS_L1_APPROVED" status.
                </div>
              ) : (
                <>
                  <textarea
                    className="w-full border p-2 rounded mb-3"
                    placeholder="Remarks"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={() => opsHeadDecision(true)}
                      className="bg-green-600 text-white px-4 py-2 rounded"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => opsHeadDecision(false)}
                      className="bg-red-600 text-white px-4 py-2 rounded"
                    >
                      Reject
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Workflow History */}
      <div className="mt-6 bg-white shadow rounded-lg p-6">
        <h3 className="font-semibold mb-4">Workflow History</h3>
        {history.length > 0 ? (
          <div className="space-y-3">
            {history.map((h, idx) => (
              <div key={idx} className="flex items-start gap-3 border-l-2 border-gray-200 pl-4">
                <div className="w-2 h-2 rounded-full bg-primary-600 mt-2"></div>
                <div>
                  <div className="font-medium">
                    {h.status} 
                    {h.previousStatus !== 'None' && <span className="text-gray-500 font-normal"> from {h.previousStatus}</span>}
                  </div>
                  <div className="text-sm text-gray-500">{h.remarks || 'No remarks'}</div>
                  <div className="text-xs text-gray-400">
                    {new Date(h.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No history available</p>
        )}
      </div>
    </div>
  )
}

export default SupplierDetail

import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { createCase, updateCase, submitCase, fetchCaseById } from '../../store/slices/caseSlice'
import { documentService } from '../../services/documentService'
import kycService from '../../services/kycService'
import DocumentChecklistUploader from '../../components/DocumentChecklistUploader'
import CoApplicantForm from '../../components/CoApplicantForm'
import LoadingSpinner from '../../components/LoadingSpinner'
import { validatePAN, validateMobile, validateEmail } from '../../utils/validation'
import { COMPANY_TYPES, getDocumentChecklist } from '../../config/documentChecklists'
import { FiUpload, FiPlus } from 'react-icons/fi';

const NewCustomerOnboarding = () => {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const [searchParams] = useSearchParams()
  const caseId = searchParams.get('id')
  const { currentCase, isLoading } = useSelector((state) => state.cases)

  // Tab state
  const [activeTab, setActiveTab] = useState('basic-kyc')

  // Form data
  const [formData, setFormData] = useState({
    companyType: '',
    companyName: '',
    customerName: '',
    mobileNumber: '',
    email: '',
    gstNumber: '',
    electricityBillNumber: '',
  })

  // KYC data for applicant
  const [applicantKyc, setApplicantKyc] = useState({
    panNumber: '',
    panFile: null,
    gstFile: null,
  })

  // Co-applicants
  const [coApplicants, setCoApplicants] = useState([])

  // Co-applicant KYC data
  const [coApplicantKyc, setCoApplicantKyc] = useState({})

  const [documents, setDocuments] = useState([])
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isOcrProcessing, setIsOcrProcessing] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)

  useEffect(() => {
    if (caseId) {
      dispatch(fetchCaseById(caseId))
    }
  }, [caseId, dispatch])

  useEffect(() => {
    if (currentCase && caseId) {
      setFormData({
        companyType: currentCase.companyType || '',
        companyName: currentCase.companyName || '',
        customerName: currentCase.name || currentCase.customerName || '',
        mobileNumber: currentCase.mobile || currentCase.mobileNumber || '',
        email: currentCase.email || '',
        gstNumber: currentCase.gstNumber || '',
        electricityBillNumber: currentCase.electricityBillNo || currentCase.electricityBillNumber || '',
      })
      setDocuments(currentCase.documents || [])

      // Load KYC data if it exists
      if (currentCase.kycDetails && currentCase.kycDetails.length > 0) {
        const panKyc = currentCase.kycDetails.find(k => k.kycType === 'PAN' && k.applicantType === 'applicant')
        if (panKyc) {
          setApplicantKyc(prev => ({ ...prev, panNumber: panKyc.kycNumber }))
        }
      }

      // Load co-applicants
      if (currentCase.coApplicants && currentCase.coApplicants.length > 0) {
        const loadedCoApps = currentCase.coApplicants.map(ca => ({
          id: ca.id,
          name: ca.name,
          mobile: ca.mobile,
          email: ca.email || '',
        }))
        setCoApplicants(loadedCoApps)

        // Load co-applicant KYC
        const loadedCoAppKyc = {}
        currentCase.coApplicants.forEach((ca, index) => {
          if (ca.kycDetails && ca.kycDetails.length > 0) {
            const panKyc = ca.kycDetails.find(k => k.kycType === 'PAN')
            if (panKyc) {
              loadedCoAppKyc[index] = {
                panNumber: panKyc.kycNumber,
                panFile: null,
              }
            }
          }
        })
        setCoApplicantKyc(loadedCoAppKyc)
      }
    }
  }, [currentCase, caseId])

  // Get document checklist based on company type
  const documentChecklist = getDocumentChecklist(formData.companyType)

  // PAN Upload and OCR for applicant
  const handleApplicantPanUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setIsOcrProcessing(true)
    try {
      const result = await kycService.runPanOcr(file)
      if (result.success) {
        setApplicantKyc(prev => ({
          ...prev,
          panNumber: result.data.panNumber,
          panFile: file,
        }))
        setFormData(prev => ({
          ...prev,
          customerName: result.data.name,
        }))
        alert(`OCR completed! PAN: ${result.data.panNumber}, Name: ${result.data.name}`)
      }
    } catch (error) {
      alert('OCR failed: ' + error.message)
    } finally {
      setIsOcrProcessing(false)
    }
  }

  const handlePanVerify = async () => {
    if (!applicantKyc.panNumber) {
      alert('Please upload PAN first')
      return
    }

    setIsVerifying(true)
    try {
      const result = await kycService.verifyPan(applicantKyc.panNumber)
      if (result.success) {
        alert(result.message || 'PAN verified successfully')
      }
    } catch (error) {
      alert('PAN verification failed: ' + error.message)
    } finally {
      setIsVerifying(false)
    }
  }

  const handleGstUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setApplicantKyc(prev => ({
      ...prev,
      gstFile: file,
    }))
    alert('GST document uploaded')
  }

  const handleGstVerify = async () => {
    if (!formData.gstNumber) {
      alert('Please enter GST number first')
      return
    }

    setIsVerifying(true)
    try {
      const result = await kycService.verifyGst(formData.gstNumber)
      if (result.success) {
        alert(result.message || 'GST verified successfully')
      }
    } catch (error) {
      alert('GST verification failed: ' + error.message)
    } finally {
      setIsVerifying(false)
    }
  }

  const handleMobileVerify = async () => {
    if (!formData.mobileNumber) {
      alert('Please enter mobile number first')
      return
    }

    setIsVerifying(true)
    try {
      const result = await kycService.verifyMobile(formData.mobileNumber)
      if (result.success) {
        alert(result.message || 'Mobile verified successfully')
      }
    } catch (error) {
      alert('Mobile verification failed: ' + error.message)
    } finally {
      setIsVerifying(false)
    }
  }

  const handleEmailVerify = async () => {
    if (!formData.email) {
      alert('Please enter email first')
      return
    }

    setIsVerifying(true)
    try {
      const result = await kycService.verifyEmail(formData.email)
      if (result.success) {
        alert(result.message || 'Email verified successfully')
      }
    } catch (error) {
      alert('Email verification failed: ' + error.message)
    } finally {
      setIsVerifying(false)
    }
  }

  const handleAadhaarKyc = async () => {
    setIsVerifying(true)
    try {
      const result = await kycService.initiateAadhaarKyc('')
      if (result.success) {
        alert(result.message || 'Aadhaar KYC initiated successfully')
      }
    } catch (error) {
      alert('Aadhaar KYC failed: ' + error.message)
    } finally {
      setIsVerifying(false)
    }
  }

  // Co-Applicant Management
  const addCoApplicant = () => {
    setCoApplicants([...coApplicants, { name: '', mobile: '', email: '' }])
  }

  const removeCoApplicant = (index) => {
    setCoApplicants(coApplicants.filter((_, i) => i !== index))
    // Remove KYC data for this co-applicant
    const newKyc = { ...coApplicantKyc }
    delete newKyc[index]
    setCoApplicantKyc(newKyc)
  }

  const updateCoApplicant = (index, data) => {
    const updated = [...coApplicants]
    updated[index] = data
    setCoApplicants(updated)
  }

  const handleCoApplicantPanUpload = (index, file, panNumber) => {
    setCoApplicantKyc(prev => ({
      ...prev,
      [index]: {
        ...prev[index],
        panNumber,
        panFile: file,
      }
    }))
  }

  const validateBasicKycTab = () => {
    const newErrors = {}

    if (!formData.companyType) {
      newErrors.companyType = 'Company type is required'
    }

    if (!formData.customerName.trim()) {
      newErrors.customerName = 'Entity name is required'
    }

    if (!validateMobile(formData.mobileNumber)) {
      newErrors.mobileNumber = 'Valid mobile number is required'
    }

    if (formData.email && !validateEmail(formData.email)) {
      newErrors.email = 'Valid email is required'
    }

    if (!applicantKyc.panNumber) {
      newErrors.pan = 'PAN is required - please upload PAN card'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const validateDocumentsTab = () => {
    if (!formData.companyType) {
      return true // Skip validation if no company type selected
    }

    const mandatoryDocs = documentChecklist.filter(item => item.mandatory)
    const uploadedTypes = new Set(documents.map(doc => doc.documentType))
    const missingMandatory = mandatoryDocs.filter(item => !uploadedTypes.has(item.documentType))

    if (missingMandatory.length > 0) {
      alert(`Please upload the following mandatory documents:\\n${missingMandatory.map(d => d.label).join('\\n')}`)
      return false
    }

    return true
  }

  const handleSaveDraft = async () => {
    if (!validateBasicKycTab()) {
      setActiveTab('basic-kyc')
      return
    }

    setIsSubmitting(true)
    try {
      const customerData = {
        name: formData.customerName,
        mobile: formData.mobileNumber,
        email: formData.email,
        companyType: formData.companyType,
        companyName: formData.companyName,
        gstNumber: formData.gstNumber,
        electricityBillNo: formData.electricityBillNumber,
      }

      let id = caseId
      if (caseId) {
        await dispatch(updateCase({ id: caseId, data: customerData })).unwrap()
      } else {
        const newCase = await dispatch(createCase(customerData)).unwrap()
        id = newCase.id
      }

      // Save KYC data
      if (id && applicantKyc.panNumber) {
        await kycService.createKyc(id, {
          applicantType: 'applicant',
          applicantIndex: 0,
          kycType: 'PAN',
          kycNumber: applicantKyc.panNumber,
        })

        if (applicantKyc.panFile) {
          await documentService.uploadDocument(
            id,
            applicantKyc.panFile,
            'pan',
            'applicant',
            0
          )
        }
      }

      if (id && formData.gstNumber) {
        await kycService.createKyc(id, {
          applicantType: 'applicant',
          applicantIndex: 0,
          kycType: 'GST',
          kycNumber: formData.gstNumber,
        })

        if (applicantKyc.gstFile) {
          await documentService.uploadDocument(
            id,
            applicantKyc.gstFile,
            'gst_certificate',
            'applicant',
            0
          )
        }
      }

      // Save co-applicants' profiles and KYC
      for (let i = 0; i < coApplicants.length; i++) {
        const coApp = coApplicants[i]
        const coAppKyc = coApplicantKyc[i]

        // Save/Update co-applicant profile first
        const coAppResult = await kycService.processCoApplicant({
          customerId: id,
          name: coApp.name,
          mobile: coApp.mobile,
          email: coApp.email
        })

        const coAppId = coAppResult.data.id

        if (coAppKyc && coAppKyc.panNumber) {
          await kycService.createKyc(id, {
            coApplicantId: coAppId,
            applicantType: 'co-applicant',
            applicantIndex: i + 1,
            kycType: 'PAN',
            kycNumber: coAppKyc.panNumber,
          })

          // Upload PAN file as a Document linked to CoApplicant
          if (coAppKyc.panFile) {
            await documentService.uploadDocument(
              id,
              coAppKyc.panFile,
              'pan',
              'co-applicant',
              i + 1,
              coAppId
            )
          }
        }
      }

      alert('Draft saved successfully')
      navigate('/rm/dashboard')
    } catch (error) {
      alert('Failed to save draft: ' + error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = async () => {
    // Validate both tabs
    if (!validateBasicKycTab()) {
      setActiveTab('basic-kyc')
      alert('Please complete all required fields in Basic & KYC tab')
      return
    }

    if (!validateDocumentsTab()) {
      setActiveTab('documents')
      return
    }

    setIsSubmitting(true)
    try {
      let id = caseId
      const customerData = {
        name: formData.customerName,
        mobile: formData.mobileNumber,
        email: formData.email,
        companyType: formData.companyType,
        companyName: formData.companyName,
        gstNumber: formData.gstNumber,
        electricityBillNo: formData.electricityBillNumber,
      }

      if (!id) {
        const newCase = await dispatch(createCase(customerData)).unwrap()
        id = newCase.id
      } else {
        await dispatch(updateCase({ id, data: customerData })).unwrap()
      }

      // Save KYC entries
      if (applicantKyc.panNumber) {
        await kycService.createKyc(id, {
          applicantType: 'applicant',
          applicantIndex: 0,
          kycType: 'PAN',
          kycNumber: applicantKyc.panNumber,
        })

        if (applicantKyc.panFile) {
          await documentService.uploadDocument(
            id,
            applicantKyc.panFile,
            'pan',
            'applicant',
            0
          )
        }
      }

      if (formData.gstNumber) {
        await kycService.createKyc(id, {
          applicantType: 'applicant',
          applicantIndex: 0,
          kycType: 'GST',
          kycNumber: formData.gstNumber,
        })

        if (applicantKyc.gstFile) {
          await documentService.uploadDocument(
            id,
            applicantKyc.gstFile,
            'gst_certificate',
            'applicant',
            0
          )
        }
      }

      // Save co-applicants' profiles and KYC
      for (let i = 0; i < coApplicants.length; i++) {
        const coApp = coApplicants[i]
        const coAppKyc = coApplicantKyc[i]

        // Save/Update co-applicant profile first
        const coAppResult = await kycService.processCoApplicant({
          customerId: id,
          name: coApp.name,
          mobile: coApp.mobile,
          email: coApp.email
        })

        const coAppId = coAppResult.data.id

        if (coAppKyc && coAppKyc.panNumber) {
          await kycService.createKyc(id, {
            coApplicantId: coAppId,
            applicantType: 'co-applicant',
            applicantIndex: i + 1,
            kycType: 'PAN',
            kycNumber: coAppKyc.panNumber,
          })

          // Upload PAN file as a Document linked to CoApplicant
          if (coAppKyc.panFile) {
            await documentService.uploadDocument(
              id,
              coAppKyc.panFile,
              'pan',
              'co-applicant',
              i + 1,
              coAppId
            )
          }
        }
      }

      await dispatch(submitCase(id)).unwrap()
      alert('Case submitted successfully')
      navigate('/rm/dashboard')
    } catch (error) {
      alert('Failed to submit case: ' + error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDocumentUploaded = (doc) => {
    setDocuments([...documents, doc])
  }

  const handleDocumentRemoved = (docId) => {
    setDocuments(documents.filter(doc => doc.id !== docId))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">New Customer Onboarding</h1>
        <p className="text-gray-600 mt-2">Complete KYC and upload required documents</p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('basic-kyc')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'basic-kyc'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            Basic & KYC
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'documents'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            Documents
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="card space-y-6">
        {activeTab === 'basic-kyc' && (
          <>
            {/* Company Type - MANDATORY FIRST */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company Type <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.companyType}
                onChange={(e) => setFormData({ ...formData, companyType: e.target.value })}
                className="input-field"
              >
                <option value="">Select company type</option>
                {Object.values(COMPANY_TYPES).map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              {errors.companyType && (
                <p className="text-red-500 text-xs mt-1">{errors.companyType}</p>
              )}
            </div>

            {/* Company Name - conditional */}
            {formData.companyType && formData.companyType !== COMPANY_TYPES.PROPRIETORSHIP && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Company Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  className="input-field"
                  placeholder="Enter company name"
                />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Entity Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Entity Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  className="input-field"
                  placeholder="Enter entity name"
                />
                {errors.customerName && (
                  <p className="text-red-500 text-xs mt-1">{errors.customerName}</p>
                )}
              </div>

              {/* Mobile Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mobile Number <span className="text-red-500">*</span>
                </label>
                <div className="flex space-x-2">
                  <input
                    type="tel"
                    value={formData.mobileNumber}
                    onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })}
                    className="input-field flex-1"
                    placeholder="Enter mobile number"
                    maxLength={10}
                  />
                  <button
                    type="button"
                    onClick={handleMobileVerify}
                    disabled={isVerifying}
                    className="btn-secondary"
                  >
                    {isVerifying ? 'Verifying...' : 'Verify'}
                  </button>
                </div>
                {errors.mobileNumber && (
                  <p className="text-red-500 text-xs mt-1">{errors.mobileNumber}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email ID
                </label>
                <div className="flex space-x-2">
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="input-field flex-1"
                    placeholder="Enter email address"
                  />
                  <button
                    type="button"
                    onClick={handleEmailVerify}
                    disabled={isVerifying}
                    className="btn-secondary"
                  >
                    {isVerifying ? 'Verifying...' : 'Verify'}
                  </button>
                </div>
                {errors.email && (
                  <p className="text-red-500 text-xs mt-1">{errors.email}</p>
                )}
              </div>

              {/* PAN Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  PAN Upload <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  <div className="flex space-x-2">
                    <label className="flex-1 cursor-pointer">
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={handleApplicantPanUpload}
                        className="hidden"
                      />
                      <div className="input-field flex items-center justify-center space-x-2 border-dashed">
                        <FiUpload className="h-4 w-4" />
                        <span className="text-sm">
                          {isOcrProcessing ? 'Processing OCR...' : 'Upload PAN'}
                        </span>
                      </div>
                    </label>
                    <button
                      type="button"
                      onClick={handlePanVerify}
                      disabled={isVerifying || !applicantKyc.panNumber}
                      className="btn-secondary"
                    >
                      Verify
                    </button>
                  </div>
                  {applicantKyc.panNumber && (
                    <>
                      <p className="text-xs text-green-600">PAN: {applicantKyc.panNumber}</p>
                      <p className="text-xs text-gray-500">Name auto-filled from OCR</p>
                    </>
                  )}
                  {errors.pan && (
                    <p className="text-red-500 text-xs">{errors.pan}</p>
                  )}
                </div>
              </div>

              {/* GST Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  GST Upload
                </label>
                <label className="cursor-pointer block">
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleGstUpload}
                    className="hidden"
                  />
                  <div className="input-field flex items-center justify-center space-x-2 border-dashed">
                    <FiUpload className="h-4 w-4" />
                    <span className="text-sm">
                      {applicantKyc.gstFile ? `Uploaded: ${applicantKyc.gstFile.name}` : 'Upload GST Certificate'}
                    </span>
                  </div>
                </label>
              </div>

              {/* GST Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  GST Number
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={formData.gstNumber}
                    onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value.toUpperCase() })}
                    className="input-field flex-1"
                    placeholder="Enter GST number"
                    maxLength={15}
                  />
                  <button
                    type="button"
                    onClick={handleGstVerify}
                    disabled={isVerifying}
                    className="btn-secondary"
                  >
                    {isVerifying ? 'Verifying...' : 'Verify'}
                  </button>
                </div>
              </div>
            </div>

            {/* Aadhaar KYC */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Aadhaar KYC <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={handleAadhaarKyc}
                disabled={isVerifying}
                className="btn-primary"
              >
                {isVerifying ? 'Processing...' : 'Complete Aadhaar KYC'}
              </button>
              <p className="text-xs text-gray-500 mt-1">
                This will initiate Aadhaar-based e-KYC verification
              </p>
            </div>

            {/* Co-Applicants Section */}
            <div className="border-t border-gray-200 pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Co-Applicants / Co-Borrowers</h3>
                <button
                  type="button"
                  onClick={addCoApplicant}
                  className="btn-secondary flex items-center space-x-2"
                >
                  <FiPlus className="h-4 w-4" />
                  <span>Add Co-Applicant</span>
                </button>
              </div>

              {coApplicants.length === 0 ? (
                <p className="text-gray-500 text-sm">No co-applicants added yet</p>
              ) : (
                <div className="space-y-4">
                  {coApplicants.map((coApp, index) => (
                    <CoApplicantForm
                      key={index}
                      index={index}
                      data={coApp}
                      onChange={updateCoApplicant}
                      onRemove={removeCoApplicant}
                      onPanUpload={handleCoApplicantPanUpload}
                      kycData={coApplicantKyc[index] || {}}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'documents' && (
          <DocumentChecklistUploader
            checklist={documentChecklist}
            uploadedDocuments={documents}
            customerId={caseId || currentCase?.id}
            onDocumentUploaded={handleDocumentUploaded}
            onDocumentRemoved={handleDocumentRemoved}
          />
        )}

        {/* Action Buttons */}
        <div className="flex space-x-3 pt-4 border-t border-gray-200">
          <button
            onClick={handleSaveDraft}
            disabled={isSubmitting}
            className="btn-secondary"
          >
            {isSubmitting ? <LoadingSpinner size="sm" /> : 'Save as Draft'}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="btn-primary"
          >
            {isSubmitting ? <LoadingSpinner size="sm" /> : 'Submit to Credit Team'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default NewCustomerOnboarding

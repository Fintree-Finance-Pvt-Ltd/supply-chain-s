import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { createCase, updateCase, submitCase, fetchCaseById } from '../../store/slices/caseSlice'
import { documentService } from '../../services/documentService'
import DocumentUploader from '../../components/DocumentUploader'
import LoadingSpinner from '../../components/LoadingSpinner'
import { validatePAN, validateMobile, validateAadhaar } from '../../utils/validation'

const NewCustomerOnboarding = () => {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const [searchParams] = useSearchParams()
  const caseId = searchParams.get('id')
  const { currentCase, isLoading } = useSelector((state) => state.cases)
  
  const [formData, setFormData] = useState({
    customerName: '',
    mobileNumber: '',
    panNumber: '',
    aadhaarNumber: '',
    electricityBillNumber: '',
  })
  
  const [documents, setDocuments] = useState([])
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (caseId) {
      dispatch(fetchCaseById(caseId))
    }
  }, [caseId, dispatch])

  useEffect(() => {
    if (currentCase && caseId) {
      setFormData({
        customerName: currentCase.name || currentCase.customerName || '',
        mobileNumber: currentCase.mobile || currentCase.mobileNumber || '',
        panNumber: currentCase.pan || currentCase.panNumber || '',
        aadhaarNumber: currentCase.aadhaar || currentCase.aadhaarNumber || '',
        electricityBillNumber: currentCase.electricityBillNo || currentCase.electricityBillNumber || '',
      })
      setDocuments(currentCase.documents || [])
    }
  }, [currentCase, caseId])

  const documentTypes = [
    { value: 'pan', label: 'PAN Card' },
    { value: 'aadhaar', label: 'Aadhaar Card' },
    { value: 'electricity_bill', label: 'Electricity Bill' },
    { value: 'other', label: 'Other' },
  ]

  const validateForm = () => {
    const newErrors = {}
    
    if (!formData.customerName.trim()) {
      newErrors.customerName = 'Customer name is required'
    }
    
    if (!validateMobile(formData.mobileNumber)) {
      newErrors.mobileNumber = 'Valid mobile number is required'
    }
    
    if (!validatePAN(formData.panNumber)) {
      newErrors.panNumber = 'Valid PAN number is required'
    }
    
    if (formData.aadhaarNumber && !validateAadhaar(formData.aadhaarNumber)) {
      newErrors.aadhaarNumber = 'Valid Aadhaar number is required'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSaveDraft = async () => {
    if (!validateForm()) return
    
    setIsSubmitting(true)
    try {
      const customerData = {
        name: formData.customerName,
        mobile: formData.mobileNumber,
        pan: formData.panNumber,
        aadhaar: formData.aadhaarNumber,
        electricityBillNo: formData.electricityBillNumber,
      }
      
      if (caseId) {
        await dispatch(updateCase({ id: caseId, data: customerData })).unwrap()
      } else {
        await dispatch(createCase(customerData)).unwrap()
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
    if (!validateForm()) {
      alert('Please fix validation errors before submitting')
      return
    }
    
    if (documents.length === 0) {
      alert('Please upload at least one document')
      return
    }
    
    setIsSubmitting(true)
    try {
      let id = caseId
      const customerData = {
        name: formData.customerName,
        mobile: formData.mobileNumber,
        pan: formData.panNumber,
        aadhaar: formData.aadhaarNumber,
        electricityBillNo: formData.electricityBillNumber,
      }
      
      if (!id) {
        const newCase = await dispatch(createCase(customerData)).unwrap()
        id = newCase.id
      } else {
        await dispatch(updateCase({ id, data: customerData })).unwrap()
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

  const handleDocumentUpload = async (file, documentType) => {
    try {
      const customerId = caseId || currentCase?.id
      if (!customerId) {
        alert('Please save customer first before uploading documents')
        return
      }
      
      const result = await documentService.uploadDocument(customerId, file, documentType)
      if (result.data) {
        setDocuments([...documents, result.data])
      }
    } catch (error) {
      alert('Failed to upload document: ' + error.message)
    }
  }

  const handleDocumentRemove = async (docId) => {
    try {
      await documentService.deleteDocument(docId)
      setDocuments(documents.filter(doc => doc.id !== docId))
    } catch (error) {
      alert('Failed to delete document: ' + error.message)
    }
  }

  const handleAadhaarKYC = () => {
    // Placeholder for Aadhaar KYC integration
    alert('Aadhaar KYC verification will be integrated here')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">New Customer Onboarding</h1>
        <p className="text-gray-600 mt-2">Enter customer details and upload documents</p>
      </div>

      <div className="card space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Customer Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.customerName}
              onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
              className="input-field"
              placeholder="Enter customer name"
            />
            {errors.customerName && (
              <p className="text-red-500 text-xs mt-1">{errors.customerName}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mobile Number <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={formData.mobileNumber}
              onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })}
              className="input-field"
              placeholder="Enter mobile number"
            />
            {errors.mobileNumber && (
              <p className="text-red-500 text-xs mt-1">{errors.mobileNumber}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              PAN Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.panNumber}
              onChange={(e) => setFormData({ ...formData, panNumber: e.target.value.toUpperCase() })}
              className="input-field"
              placeholder="ABCDE1234F"
              maxLength={10}
            />
            {errors.panNumber && (
              <p className="text-red-500 text-xs mt-1">{errors.panNumber}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Aadhaar Number
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={formData.aadhaarNumber}
                onChange={(e) => setFormData({ ...formData, aadhaarNumber: e.target.value.replace(/\D/g, '') })}
                className="input-field flex-1"
                placeholder="Enter Aadhaar number"
                maxLength={12}
              />
              <button
                type="button"
                onClick={handleAadhaarKYC}
                className="btn-secondary"
              >
                Verify KYC
              </button>
            </div>
            {errors.aadhaarNumber && (
              <p className="text-red-500 text-xs mt-1">{errors.aadhaarNumber}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Electricity Bill Number
            </label>
            <input
              type="text"
              value={formData.electricityBillNumber}
              onChange={(e) => setFormData({ ...formData, electricityBillNumber: e.target.value })}
              className="input-field"
              placeholder="Enter electricity bill number"
            />
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Document Upload</h3>
          <DocumentUploader
            documents={documents}
            onUpload={handleDocumentUpload}
            onRemove={handleDocumentRemove}
            documentTypes={documentTypes}
          />
        </div>

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


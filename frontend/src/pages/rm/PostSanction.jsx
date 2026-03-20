import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { toast } from 'react-toastify'
import { fetchCaseById, updateCase } from '../../store/slices/caseSlice'
import { documentService } from '../../services/documentService'
import { operationsService } from '../../services/operationsService'
import { workflowService } from '../../services/workflowService'
import api from '../../services/api'
import DocumentUploader from '../../components/DocumentUploader'
import LoadingSpinner from '../../components/LoadingSpinner'
import { FiFileText, FiCheck, FiEdit2, FiSave, FiX } from 'react-icons/fi'

const PostSanction = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { currentCase, isLoading } = useSelector((state) => state.cases)
  const { user } = useSelector((state) => state.auth)

  // Only RM and MD can access sanction details
  const canAccessSanctionDetails = () => {
    if (!user) return false;
    const role = (user.role || '').toLowerCase();
    return role === 'relationship_manager' || role === 'md';
  };

  const [documents, setDocuments] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sanctions, setSanctions] = useState([])
  const [isEditingSanction, setIsEditingSanction] = useState(false)
  const [editedSanction, setEditedSanction] = useState({})
  const [isLoadingSanctions, setIsLoadingSanctions] = useState(false)

  useEffect(() => {
    if (id) {
      dispatch(fetchCaseById(id))
    }
  }, [id, dispatch])

  useEffect(() => {
    const loadDocuments = async () => {
      if (currentCase?.id) {
        try {
          const response = await documentService.getDocumentsByCustomer(currentCase.id)
          setDocuments(response.data || [])
        } catch (error) {
          console.error('Error loading documents:', error)
        }
      }
    }
    loadDocuments()
  }, [currentCase])

  // Fetch sanctions data for RM post sanction review
  useEffect(() => {
    const fetchSanctions = async () => {
      if (id && canAccessSanctionDetails()) {
        setIsLoadingSanctions(true)
        try {
          const response = await api.get(`/sanctions/customer/${id}`)
          if (response.data && Array.isArray(response.data)) {
            setSanctions(response.data)
            if (response.data.length > 0) {
              setEditedSanction(response.data[0])
            }
          }
        } catch (error) {
          console.error('Error fetching sanctions:', error)
        } finally {
          setIsLoadingSanctions(false)
        }
      }
    }
    fetchSanctions()
  }, [id, user])

  const documentTypes = [
    { value: 'sanction_letter', label: 'Sanction Letter' },
    { value: 'esign_document', label: 'eSign Document' },
    { value: 'enach_document', label: 'eNACH Document' },
    { value: 'other', label: 'Other' },
  ]

  const handleDocumentUpload = async (file, documentType) => {
    try {
      const customerId = currentCase?.id || id
      if (!customerId) {
        toast.error('Customer ID not found')
        return
      }

      const result = await documentService.uploadDocument(customerId, file, documentType)
      if (result.data) {
        setDocuments([...documents, result.data])
      }
    } catch (error) {
      toast.error('Failed to upload document: ' + error.message)
    }
  }

  const handleDocumentRemove = async (docId) => {
    try {
      await documentService.deleteDocument(docId)
      setDocuments(documents.filter(doc => doc.id !== docId))
    } catch (error) {
      toast.error('Failed to delete document: ' + error.message)
    }
  }

  const handleESign = () => {
    // Placeholder for eSign integration
    toast.info('eSign integration will be implemented here')
  }

  const handleENACH = () => {
    // Placeholder for eNACH integration
    toast.info('eNACH integration will be implemented here')
  }

  const handleEditSanction = () => {
    setIsEditingSanction(true)
    setEditedSanction(sanctions[0] || {})
  }

  const handleCancelEdit = () => {
    setIsEditingSanction(false)
    setEditedSanction(sanctions[0] || {})
  }

  const handleSanctionChange = (field, value) => {
    setEditedSanction({
      ...editedSanction,
      [field]: value
    })
  }

  const handleSaveSanction = async () => {
    setIsSubmitting(true)
    try {
      // Submit to MD with edited sanction details
      await workflowService.submitRMToMD(id, 'RM review completed - final terms submitted', {
        sanctionAmount: editedSanction.sanctionAmount,
        tenure: editedSanction.tenure,
        interestRate: editedSanction.interestRate,
        penalCharges: editedSanction.penalCharges,
        processingFees: editedSanction.processingFees,
        conditions: editedSanction.conditions,
      })
      
      toast.success('Sanction details updated and submitted to MD successfully')
      setIsEditingSanction(false)
      // Refresh sanctions data
      const response = await api.get(`/sanctions/customer/${id}`)
      if (response.data && Array.isArray(response.data)) {
        setSanctions(response.data)
      }
    } catch (error) {
      toast.error('Failed to submit: ' + (error.message || error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmitToOps = async () => {
    setIsSubmitting(true)
    try {
      // Call operations service to submit post-sanction
      await operationsService.submitPostSanction(id, {
        documentsVerified: true,
        esignVerified: true,
        enachVerified: true,
        remarks: 'Post-sanction activities completed by RM',
      })

      toast.success('Case submitted to Operations Team successfully')
      navigate('/rm/dashboard')
    } catch (error) {
      toast.error('Failed to submit: ' + (error.message || error))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return <LoadingSpinner />
  }

  if (!currentCase) {
    return <div>Case not found</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Post Sanction Activities</h1>
        <p className="text-gray-600 mt-2">Complete post-sanction requirements</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Customer Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Customer Name</p>
                <p className="font-medium">{currentCase.name || currentCase.customerName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Mobile Number</p>
                <p className="font-medium">{currentCase.mobile || currentCase.mobileNumber}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">PAN Number</p>
                <p className="font-medium">{currentCase.pan || currentCase.panNumber}</p>
              </div>
            </div>
          </div>

          {sanctions.length > 0 && canAccessSanctionDetails() && (
            <div className="card">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Sanction Details</h2>
                {!isEditingSanction && (
                  <button
                    onClick={handleEditSanction}
                    className="btn-secondary flex items-center space-x-1 text-sm"
                  >
                    <FiEdit2 className="h-4 w-4" />
                    <span>Edit</span>
                  </button>
                )}
              </div>
              {isLoadingSanctions ? (
                <LoadingSpinner />
              ) : isEditingSanction ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Sanction Amount (₹)</label>
                    <input
                      type="number"
                      value={editedSanction.sanctionAmount || ''}
                      onChange={(e) => handleSanctionChange('sanctionAmount', parseFloat(e.target.value))}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Tenure (months)</label>
                    <input
                      type="number"
                      value={editedSanction.tenure || ''}
                      onChange={(e) => handleSanctionChange('tenure', parseInt(e.target.value))}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Interest Rate (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editedSanction.interestRate || ''}
                      onChange={(e) => handleSanctionChange('interestRate', parseFloat(e.target.value))}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Penal Charges (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editedSanction.penalCharges || ''}
                      onChange={(e) => handleSanctionChange('penalCharges', parseFloat(e.target.value))}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Processing Fees (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editedSanction.processingFees || ''}
                      onChange={(e) => handleSanctionChange('processingFees', parseFloat(e.target.value))}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div className="col-span-2 flex space-x-2 mt-4">
                    <button
                      onClick={handleSaveSanction}
                      disabled={isSubmitting}
                      className="btn-primary flex items-center space-x-1"
                    >
                      <FiSave className="h-4 w-4" />
                      <span>{isSubmitting ? 'Saving...' : 'Save & Submit to MD'}</span>
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      disabled={isSubmitting}
                      className="btn-secondary flex items-center space-x-1"
                    >
                      <FiX className="h-4 w-4" />
                      <span>Cancel</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Sanction Amount</p>
                    <p className="font-medium text-lg">₹{sanctions[0]?.sanctionAmount?.toLocaleString() || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Tenure</p>
                    <p className="font-medium">{sanctions[0]?.tenure || 'N/A'} months</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Interest Rate</p>
                    <p className="font-medium">{sanctions[0]?.interestRate || 'N/A'}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Penal Charges</p>
                    <p className="font-medium">{sanctions[0]?.penalCharges || 'N/A'}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Processing Fees</p>
                    <p className="font-medium">{sanctions[0]?.processingFees || 'N/A'}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Status</p>
                    <p className="font-medium">{sanctions[0]?.status || 'N/A'}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Document Upload</h2>
            <DocumentUploader
              documents={documents}
              onUpload={handleDocumentUpload}
              onRemove={handleDocumentRemove}
              documentTypes={documentTypes}
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Actions</h2>
            <div className="space-y-3">
              <button
                onClick={handleESign}
                className="w-full btn-primary flex items-center justify-center space-x-2"
              >
                <FiFileText className="h-5 w-5" />
                <span>Initiate eSign</span>
              </button>
              <button
                onClick={handleENACH}
                className="w-full btn-primary flex items-center justify-center space-x-2"
              >
                <FiFileText className="h-5 w-5" />
                <span>Initiate eNACH</span>
              </button>
              <button
                onClick={() => window.open('#', '_blank')}
                className="w-full btn-secondary flex items-center justify-center space-x-2"
              >
                <FiFileText className="h-5 w-5" />
                <span>View Sanction Letter</span>
              </button>
            </div>
          </div>

          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Checklist</h2>
            <div className="space-y-2">
              <label className="flex items-center space-x-2">
                <input type="checkbox" className="rounded" />
                <span>Documents uploaded</span>
              </label>
              <label className="flex items-center space-x-2">
                <input type="checkbox" className="rounded" />
                <span>eSign completed</span>
              </label>
              <label className="flex items-center space-x-2">
                <input type="checkbox" className="rounded" />
                <span>eNACH completed</span>
              </label>
              <label className="flex items-center space-x-2">
                <input type="checkbox" className="rounded" />
                <span>Sanction letter reviewed</span>
              </label>
            </div>
          </div>

          <button
            onClick={handleSubmitToOps}
            disabled={isSubmitting}
            className="w-full btn-primary flex items-center justify-center space-x-2"
          >
            {isSubmitting ? (
              <LoadingSpinner size="sm" />
            ) : (
              <>
                <FiCheck className="h-5 w-5" />
                <span>Submit to Operations</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default PostSanction


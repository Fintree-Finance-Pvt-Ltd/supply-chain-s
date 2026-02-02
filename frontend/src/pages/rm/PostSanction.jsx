import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { fetchCaseById, updateCase } from '../../store/slices/caseSlice'
import { documentService } from '../../services/documentService'
import { operationsService } from '../../services/operationsService'
import DocumentUploader from '../../components/DocumentUploader'
import LoadingSpinner from '../../components/LoadingSpinner'
import { FiFileText, FiCheck } from 'react-icons/fi'

const PostSanction = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { currentCase, isLoading } = useSelector((state) => state.cases)

  const [documents, setDocuments] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)

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
        alert('Customer ID not found')
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

  const handleESign = () => {
    // Placeholder for eSign integration
    alert('eSign integration will be implemented here')
  }

  const handleENACH = () => {
    // Placeholder for eNACH integration
    alert('eNACH integration will be implemented here')
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

      alert('Case submitted to Operations Team successfully')
      navigate('/rm/dashboard')
    } catch (error) {
      alert('Failed to submit: ' + (error.message || error))
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

          {currentCase.creditSanctions && currentCase.creditSanctions.length > 0 && (
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Sanction Details</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Sanction Amount</p>
                  <p className="font-medium text-lg">₹{currentCase.creditSanctions[0]?.sanctionAmount?.toLocaleString() || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Tenure</p>
                  <p className="font-medium">{currentCase.creditSanctions[0]?.tenure || 'N/A'} months</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Interest Rate</p>
                  <p className="font-medium">{currentCase.creditSanctions[0]?.interestRate || 'N/A'}%</p>
                </div>
              </div>
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


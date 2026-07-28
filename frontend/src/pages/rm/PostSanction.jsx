import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { toast } from 'react-toastify'
import { fetchCaseById, updateCase } from '../../store/slices/caseSlice'
import { documentService } from '../../services/documentService'
import { operationsService } from '../../services/operationsService'
import { caseManagementService } from '../../services/caseManagementService'
import api from '../../services/api'
import LoadingSpinner from '../../components/LoadingSpinner'
import { FiFileText, FiCheck, FiSave, FiX, FiUpload, FiRefreshCw } from 'react-icons/fi'

const POST_SANCTION_SECTIONS = ['kyc', 'sanctions']

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
  const [postSanctionChecklists, setPostSanctionChecklists] = useState([])
  const [renewalSummary, setRenewalSummary] = useState(null)
  const [uploadingKey, setUploadingKey] = useState('')

  useEffect(() => {
    if (id) {
      dispatch(fetchCaseById({ id, sections: POST_SANCTION_SECTIONS }))
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

  useEffect(() => {
    const loadLifecycleData = async () => {
      if (!id) return
      try {
        const [checklists, renewal] = await Promise.all([
          caseManagementService.getPostSanctionChecklists(),
          caseManagementService.getRenewalSummary(id),
        ])
        setPostSanctionChecklists(checklists)
        setRenewalSummary(renewal)
      } catch (error) {
        console.error('Error loading renewal/checklist data:', error)
      }
    }

    loadLifecycleData()
  }, [id])

  // Fetch sanctions data for RM post sanction review
  useEffect(() => {
    const fetchSanctions = async () => {
      if (id && canAccessSanctionDetails()) {
        setIsLoadingSanctions(true)
        try {
          const response = await api.get(`/customers/${id}/sanctions`)
          const creditSanctions = response.data?.data?.creditSanctions || []
          if (Array.isArray(creditSanctions)) {
            setSanctions(creditSanctions)
            if (creditSanctions.length > 0) {
              setEditedSanction(creditSanctions[0])
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

  const refreshDocuments = async () => {
    const customerId = currentCase?.id || id
    if (!customerId) return
    const response = await documentService.getDocumentsByCustomer(customerId)
    setDocuments(response.data || [])
    const renewal = await caseManagementService.getRenewalSummary(customerId)
    setRenewalSummary(renewal)
  }

  const handleLenderDocumentUpload = async (file, lender, item) => {
    const key = `${lender}-${item.key}`
    setUploadingKey(key)
    try {
      const customerId = currentCase?.id || id
      if (!customerId) {
        toast.error('Customer ID not found')
        return
      }

      await documentService.uploadDocument(customerId, file, item.key, 'applicant', 0, null, {
        lender,
        renewalCycleId: renewalSummary?.activeCycle?.id,
        documentLabel: item.label,
      })
      toast.success(`${item.label} uploaded`)
      await refreshDocuments()
    } catch (error) {
      toast.error('Failed to upload document: ' + error.message)
    } finally {
      setUploadingKey('')
    }
  }

  const handleDocumentRemove = async (docId) => {
    try {
      await documentService.deleteDocument(docId)
      setDocuments(documents.filter(doc => doc.id !== docId))
      setRenewalSummary((prev) => prev
        ? {
            ...prev,
            carriedForwardDocuments: (prev.carriedForwardDocuments || []).filter((doc) => doc.id !== docId),
          }
        : prev)
    } catch (error) {
      toast.error('Failed to delete document: ' + error.message)
    }
  }

  const getDocsForChecklistItem = (lender, itemKey) => documents.filter((doc) =>
    (doc.lender || '').toUpperCase() === lender && doc.documentType === itemKey
  )

  const handleESign = () => {
    // Placeholder for eSign integration
    toast.info('eSign integration will be implemented here')
  }

  const handleENACH = () => {
    // Placeholder for eNACH integration
    toast.info('eNACH integration will be implemented here')
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
      toast.info('Final sanction terms are locked after MD approval')
      setIsEditingSanction(false)
    } catch (error) {
      toast.error('Failed to save: ' + (error.message || error))
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
                      <span>{isSubmitting ? 'Saving...' : 'Save'}</span>
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
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Renewal Documents</h2>
                <p className="text-sm text-gray-500">
                  Carried-forward files are linked to the active renewal cycle.
                </p>
              </div>
              <button
                type="button"
                onClick={refreshDocuments}
                className="btn-secondary inline-flex items-center gap-2"
              >
                <FiRefreshCw />
                Refresh
              </button>
            </div>

            {renewalSummary?.activeCycle ? (
              <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">
                Active renewal cycle #{renewalSummary.activeCycle.cycleNumber}
              </div>
            ) : (
              <div className="mb-4 rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm text-gray-600">
                No active renewal cycle.
              </div>
            )}

            {(renewalSummary?.carriedForwardDocuments || []).length > 0 ? (
              <div className="space-y-2">
                {(renewalSummary?.carriedForwardDocuments || []).map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{doc.documentLabel || doc.documentType}</p>
                      <p className="text-xs text-gray-500">{doc.fileName}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDocumentRemove(doc.id)}
                      className="text-xs font-semibold text-red-600 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No documents have been carried forward yet.</p>
            )}
          </div>

          {postSanctionChecklists.map((checklist) => (
            <div key={checklist.lender} className="card">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{checklist.label} Documents</h2>
                  <p className="text-sm text-gray-500">Uploads in this box are independent for {checklist.label}.</p>
                </div>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-700">
                  {checklist.lender}
                </span>
              </div>

              <div className="space-y-3">
                {checklist.documents.map((item) => {
                  const itemDocs = getDocsForChecklistItem(checklist.lender, item.key)
                  const key = `${checklist.lender}-${item.key}`

                  return (
                    <div key={item.key} className="rounded-lg border border-gray-200 p-3">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              item.mandatory ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {item.mandatory ? 'REQUIRED' : 'OPTIONAL'}
                            </span>
                          </div>
                          {itemDocs.length > 0 ? (
                            <div className="mt-2 space-y-1">
                              {itemDocs.map((doc) => (
                                <p key={doc.id} className="text-xs text-gray-500">
                                  {doc.fileName}{doc.isCarriedForward ? ' - carried forward' : ''}
                                </p>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-1 text-xs text-gray-400">No file uploaded</p>
                          )}
                        </div>

                        <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                          <FiUpload />
                          {uploadingKey === key ? 'Uploading...' : 'Upload'}
                          <input
                            type="file"
                            className="hidden"
                            disabled={Boolean(uploadingKey)}
                            accept=".pdf,.jpg,.jpeg,.png,.xls,.xlsx"
                            onChange={(event) => {
                              const file = event.target.files?.[0]
                              if (file) handleLenderDocumentUpload(file, checklist.lender, item)
                              event.target.value = ''
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
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


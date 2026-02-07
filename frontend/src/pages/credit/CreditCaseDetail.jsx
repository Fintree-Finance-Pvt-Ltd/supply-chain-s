import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { fetchCaseById, clearCurrentCase, clearError } from '../../store/slices/caseSlice'
import { creditService } from '../../services/creditService'
import DocumentUploader from '../../components/DocumentUploader'
import LoadingSpinner from '../../components/LoadingSpinner'
import { formatDate, formatCurrency } from '../../utils/format'
import { FiFileText, FiCheck, FiX, FiDownload, FiUpload, FiEye } from 'react-icons/fi'
import { workflowService } from '../../services/workflowService'
import { documentService } from '../../services/documentService'
import StatusBadge from '../../components/StatusBadge'
import ApprovalTimeline from '../../components/ApprovalTimeline'
import CustomerFullDetails from '../../components/CustomerFullDetails'

const CreditCaseDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { user } = useSelector((state) => state.auth)
  const { currentCase, isLoading, error } = useSelector((state) => state.cases)

  const [sanctionData, setSanctionData] = useState({
    sanctionAmount: '',
    tenure: '',
    interestRate: '',
    conditions: '',
    penalCharges: '',
    processingFees: '',
  })

  const [remarks, setRemarks] = useState('')
  const [docRemarks, setDocRemarks] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (id) {
      dispatch(fetchCaseById(id))
    }
    return () => {
      dispatch(clearCurrentCase())
      dispatch(clearError())
    }
  }, [id, dispatch])

  useEffect(() => {
    if (currentCase) {
      setSanctionData({
        sanctionAmount: currentCase.creditSanctions?.[0]?.sanctionAmount || '',
        tenure: currentCase.creditSanctions?.[0]?.tenure || '',
        interestRate: currentCase.creditSanctions?.[0]?.interestRate || '',
        conditions: currentCase.creditSanctions?.[0]?.conditions || '',
        penalCharges: currentCase.creditSanctions?.[0]?.penalCharges || '',
        processingFees: currentCase.creditSanctions?.[0]?.processingFees || '',
      })
      setRemarks(currentCase.creditSanctions?.[0]?.creditRemarks || '')
    }
  }, [currentCase])

  const isEditable = () => {
    if (!currentCase || !user) return false
    const role = user.role.toLowerCase()
    const status = currentCase.status

    if (role === 'credit_team_l1' && status === 'submitted') return true // RM submitted to Credit (L1 picks up)
    if (role === 'credit_team_l1' && status === 'credit_l1_review') return true
    if (role === 'credit_team_l2' && status === 'credit_l1_approved') return true // L1 approved, L2 picks up
    if (role === 'credit_team_l2' && status === 'credit_l2_review') return true

    return false
  }

  const readOnly = !isEditable()

  const formattedApprovals = (currentCase?.statusHistory || []).map(action => ({
    approverName: action.changedByUser?.name || 'Workflow System',
    approverRole: action.changedByUser?.defaultRole?.replace(/_/g, ' ').toUpperCase() || 'System',
    status: action.status,
    approvedAt: action.createdAt,
    comments: action.remarks,
    sanctionAmount: action.sanctionAmount,
    tenure: action.tenure,
    interestRate: action.interestRate,
    penalCharges: action.penalCharges,
    processingFees: action.processingFees,
  }))

  const handleUpload = async (file, type) => {
    try {
      await documentService.uploadDocument(id, file, type)
      alert('Document uploaded successfully')
      dispatch(fetchCaseById(id))
    } catch (error) {
      alert('Upload failed: ' + (error.response?.data?.message || error.message))
    }
  }

  const handleUpdateDocType = async (docId, newType) => {
    try {
      // Assuming metadata update handles documentType change or we strictly need a specific endpoint.
      // Since documentService.updateDocumentMetadata takes (docId, meta), we try passing documentType.
      await documentService.updateDocumentMetadata(docId, { documentType: newType })
      alert('Document type updated')
      dispatch(fetchCaseById(id))
    } catch (error) {
      alert('Update failed: ' + (error.response?.data?.message || error.message))
    }
  }

  const handleVerifyDocument = async (docId, status) => {
    const remark = docRemarks[docId] || ''
    // Remarks made optional as per requirement
    // if (!remark.trim()) {
    //   alert('Please add remarks for verification')
    //   return
    // }
    try {
      await workflowService.verifyDocument(docId, status, remark)
      alert('Document status updated')
      dispatch(fetchCaseById(id))
    } catch (error) {
      alert('Verification failed: ' + (error.response?.data?.message || error.message))
    }
  }

  // ... (handleSaveSanction remains similar but checks readOnly implied by disabling button)
  const handleSaveSanction = async () => {
    if (readOnly) return;
    // ... rest of logic
    setIsSubmitting(true)
    try {
      const userRole = (user?.role || '').toLowerCase()
      const sanctionPayload = {
        customerId: id,
        sanctionAmount: parseFloat(sanctionData.sanctionAmount) || 0,
        tenure: parseInt(sanctionData.tenure) || 0,
        interestRate: parseFloat(sanctionData.interestRate) || 0,
        penalCharges: parseFloat(sanctionData.penalCharges) || 0,
        processingFees: parseFloat(sanctionData.processingFees) || 0,
        conditions: sanctionData.conditions,
        creditRemarks: remarks,
      }

      if (userRole === 'credit_team_l2') {
        // Save sanction details
        await creditService.createSanction(sanctionPayload)
        // Advance workflow to CEO
        await workflowService.approveCreditL2(id, true, remarks, sanctionPayload)
      } else if (userRole === 'credit_team_l1') {
        // Credit L1 saves sanction and approves
        await workflowService.approveCreditL1(id, true, remarks, sanctionPayload)
      } else {
        throw new Error('Unauthorized role for this action')
      }

      alert('Approval processed successfully')
      navigate('/credit/dashboard')
    } catch (error) {
      alert('Failed: ' + (error.response?.data?.message || error.message || error))
    } finally {
      setIsSubmitting(false)
    }
  }

  // ...

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-red-600">Error</h2>
        <p className="text-gray-600 mb-4">{error}</p>
        <button
          onClick={() => navigate('/credit/dashboard')}
          className="text-primary-600 hover:text-primary-700"
        >
          ← Back to Dashboard
        </button>
      </div>
    )
  }

  if (!currentCase) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ... header ... */}
      <div>
        <button
          onClick={() => navigate('/credit/dashboard')}
          className="text-primary-600 hover:text-primary-700 mb-4"
        >
          ← Back to Dashboard
        </button>
        <h1 className="text-3xl font-bold text-gray-900">Case Details {readOnly && '(Read Only)'}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Info Card */}
          {/* Customer Info Card */}
          <CustomerFullDetails customer={currentCase} />

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Uploaded Documents</h2>
              {!readOnly && (user?.role === 'credit_team_l1') && (
                <DocumentUploader
                  onUpload={handleUpload}
                  documentTypes={[
                    { value: 'cam', label: 'CAM' },
                    { value: 'sanction_letter', label: 'Sanction Letter' },
                    { value: 'other', label: 'Other' },
                  ]}
                />
              )}
            </div>
            {currentCase.documents && currentCase.documents.length > 0 ? (
              <div className="space-y-4">
                {currentCase.documents.map((doc) => (
                  <div key={doc.id} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <FiFileText className="h-5 w-5 text-gray-500" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{doc.fileName}</p>
                          {!readOnly && (user?.role === 'credit_team_l1' || user?.role === 'credit_team_l2') ? (
                            <select
                              value={doc.documentType}
                              onChange={(e) => handleUpdateDocType(doc.id, e.target.value)}
                              className="text-xs bg-transparent border-none p-0 text-primary-600 font-bold uppercase cursor-pointer hover:underline"
                            >
                              <option value="pan">PAN</option>
                              <option value="aadhaar">AADHAAR</option>
                              <option value="gst_certificate">GST CERTIFICATE</option>
                              <option value="bank_statement">BANK STATEMENT</option>
                              <option value="cam">CAM</option>
                              <option value="other">OTHER</option>
                            </select>
                          ) : (
                            <p className="text-xs text-gray-500 uppercase">{doc.documentType}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {/* Changed from Download to Preview */}
                        <a
                          href={`${import.meta.env.VITE_API_BASE_URL}/documents/download/${doc.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 text-primary-600 hover:bg-primary-50 rounded"
                          title="Preview"
                        >
                          <FiEye className="h-4 w-4" /> {/* Changed icon */}
                        </a>
                        <StatusBadge status={doc.status} />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">RM Remarks</p>
                        <p className="text-xs text-gray-600 bg-white p-2 rounded border border-gray-100 min-h-[30px]">
                          {doc.rmRemarks || 'No remarks from RM'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Credit Remarks</p>
                        <textarea
                          placeholder="Add your remarks..."
                          value={docRemarks[doc.id] || doc.remarks || ''}
                          onChange={(e) => setDocRemarks({ ...docRemarks, [doc.id]: e.target.value })}
                          className="w-full text-xs input-field"
                          rows={1}
                          disabled={readOnly}
                        />
                      </div>
                    </div>

                    {!readOnly && (user?.role === 'credit_team_l1' || user?.role === 'credit_team_l2') && doc.status === 'pending' && (
                      <div className="flex space-x-2 mt-2">
                        <button
                          onClick={() => handleVerifyDocument(doc.id, 'approved')}
                          className="flex-1 py-1 px-2 text-xs bg-green-600 text-white rounded hover:bg-green-700 flex items-center justify-center space-x-1"
                        >
                          <FiCheck className="h-3 w-3" />
                          <span>Approve Doc</span>
                        </button>
                        <button
                          onClick={() => handleVerifyDocument(doc.id, 'rejected')}
                          className="flex-1 py-1 px-2 text-xs bg-red-600 text-white rounded hover:bg-red-700 flex items-center justify-center space-x-1"
                        >
                          <FiX className="h-3 w-3" />
                          <span>Reject Doc</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No documents uploaded</p>
            )}
          </div>


          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Internal Remarks</h2>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="input-field"
              rows={4}
              placeholder="Enter internal remarks..."
              disabled={readOnly}
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Sanction Limit</h2>
            <div className="space-y-4">
              {/* Inputs disabled if readOnly */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sanction Amount (₹)
                </label>
                <input
                  type="number"
                  value={sanctionData.sanctionAmount}
                  onChange={(e) => setSanctionData({ ...sanctionData, sanctionAmount: e.target.value })}
                  className="input-field"
                  placeholder="Enter amount"
                  disabled={readOnly}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tenure (months)
                </label>
                <input
                  type="number"
                  value={sanctionData.tenure}
                  onChange={(e) => setSanctionData({ ...sanctionData, tenure: e.target.value })}
                  className="input-field"
                  placeholder="Enter tenure"
                  disabled={readOnly}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Interest Rate (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={sanctionData.interestRate}
                  onChange={(e) => setSanctionData({ ...sanctionData, interestRate: e.target.value })}
                  className="input-field"
                  placeholder="Enter interest rate"
                  disabled={readOnly}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Penal Charges (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={sanctionData.penalCharges}
                  onChange={(e) => setSanctionData({ ...sanctionData, penalCharges: e.target.value })}
                  className="input-field"
                  placeholder="Enter penal charges"
                  disabled={readOnly}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Processing Fees (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={sanctionData.processingFees}
                  onChange={(e) => setSanctionData({ ...sanctionData, processingFees: e.target.value })}
                  className="input-field"
                  placeholder="Enter processing fees"
                  disabled={readOnly}
                />
              </div>
            </div>
          </div>
          {formattedApprovals.length > 0 && (
            <div className="card">
              <ApprovalTimeline approvals={formattedApprovals} />
            </div>
          )}

          <button
            onClick={handleSaveSanction}
            disabled={isSubmitting || readOnly}
            className={`w-full btn-primary flex items-center justify-center space-x-2 ${readOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isSubmitting ? (
              <LoadingSpinner size="sm" />
            ) : (
              <>
                <FiCheck className="h-5 w-5" />
                <span>Save & Submit for Approval</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div >
  )
}

export default CreditCaseDetail


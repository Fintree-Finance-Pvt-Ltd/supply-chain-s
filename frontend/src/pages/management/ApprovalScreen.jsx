import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { workflowService } from '../../services/workflowService'
import { customerService } from '../../services/customerService'
import ApprovalTimeline from '../../components/ApprovalTimeline'
import LoadingSpinner from '../../components/LoadingSpinner'
import CustomerFullDetails from '../../components/CustomerFullDetails'
import { formatDate } from '../../utils/format'
import { FiCheck, FiX, FiEye, FiFileText } from 'react-icons/fi'

const ApprovalScreen = () => {
  const { id } = useParams() // This is now customerId
  const navigate = useNavigate()
  const { user } = useSelector((state) => state.auth)

  const [customer, setCustomer] = useState(null)
  const [workflow, setWorkflow] = useState(null)
  const [sanctionData, setSanctionData] = useState({
    sanctionAmount: '',
    tenure: '',
    interestRate: '',
    penalCharges: '',
    processingFees: '',
    conditions: '',
  })
  const [comments, setComments] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [previewedDocs, setPreviewedDocs] = useState(new Set())

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true)
        const custResponse = await customerService.getCustomerById(id)
        setCustomer(custResponse.data)
        if (custResponse.data?.creditSanctions?.[0]) {
          const s = custResponse.data.creditSanctions[0]
          setSanctionData({
            sanctionAmount: s.sanctionAmount || '',
            tenure: s.tenure || '',
            interestRate: s.interestRate || '',
            penalCharges: s.penalCharges || '',
            processingFees: s.processingFees || '',
            conditions: s.conditions || '',
          })
        }

        // Find the customer onboarding workflow in the history or relations
        // For simplicity, we assume the data comes from getCustomerById
        // which should include the workflow status history.
        // If not, we can adjust.
      } catch (error) {
        console.error('Error loading approval data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    if (id) {
      loadData()
    }
  }, [id])

  const handleApprove = async () => {
    if (!comments.trim()) {
      alert('Please add comments before approving')
      return
    }

    setIsSubmitting(true)
    try {
      const userRole = (user?.role || '').toLowerCase()
      const payload = {
        approved: true,
        remarks: comments,
        ...sanctionData
      }

      if (userRole === 'ceo') {
        await workflowService.approveCEO(id, payload.approved, payload.remarks, payload)
      } else if (userRole === 'md') {
        await workflowService.approveMD(id, payload.approved, payload.remarks, payload)
      } else {
        throw new Error('Unauthorized role for this action')
      }

      alert('Approval processed successfully')
      navigate('/management/dashboard')
    } catch (error) {
      alert('Failed to approve: ' + (error.response?.data?.message || error.message || error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReject = async () => {
    if (!comments.trim()) {
      alert('Please add rejection reason')
      return
    }

    setIsSubmitting(true)
    try {
      const userRole = (user?.role || '').toLowerCase()
      if (userRole === 'ceo') {
        await workflowService.approveCEO(id, false, comments)
      } else if (userRole === 'md') {
        await workflowService.approveMD(id, false, comments)
      } else {
        throw new Error('Unauthorized role for this action')
      }

      alert('Approval rejected')
      navigate('/management/dashboard')
    } catch (error) {
      alert('Failed to reject: ' + (error.response?.data?.message || error.message || error))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return <LoadingSpinner />
  }

  if (!customer) {
    return <div>Customer record not found</div>
  }

  // Format history for timeline
  const formattedApprovals = (customer.statusHistory || []).map(action => ({
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

  const isCreditDoc = (doc) => {
    const role = doc.uploadedByUser?.defaultRole?.toLowerCase() || ''
    return role.includes('credit')
  }

  const handlePreview = (doc) => {
    setPreviewedDocs(prev => new Set(prev).add(doc.id))
    const fileUrl = `${import.meta.env.VITE_API_BASE_URL}/documents/download/${doc.id}`
    window.open(fileUrl, '_blank')
  }

  const role = (user?.role || '').toLowerCase()
  
  // RM, MD, and CEO can access sanction details
  const canAccessSanctionDetails = () => {
    return role === 'relationship_manager' || role === 'md' || role === 'ceo';
  };
  
  const isReadOnly = (customer.status === 'credit_l2_rejected') ||
    (customer.status === 'ceo_rejected') ||
    (customer.status === 'md_rejected') ||
    (customer.status === 'rejected') ||
    (customer.status === 'completed') ||
    (customer.status.includes('ops')) ||
    (role === 'ceo' && customer.status !== 'credit_l2_approved') ||
    (role === 'md' && !['ceo_approved', 'md_terms_submitted'].includes(customer.status));

  const visibleDocuments = customer.documents || []
  // Management (CEO/MD) can approve even without viewing documents as per new request
  const allDocsPreviewed = true

  return (
    <div className="space-y-6">
      <div>
        <button
          onClick={() => navigate('/management/dashboard')}
          className="text-primary-600 hover:text-primary-700 mb-4"
        >
          ← Back to Dashboard
        </button>
        <h1 className="text-3xl font-bold text-gray-900">Approval Screen</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <CustomerFullDetails customer={customer} />

          {/* Only show sanction details for RM and MD roles */}
          {canAccessSanctionDetails() && (
          <div className="card border-l-4 border-primary-500">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Sanction Details (Review & Revise)</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Sanction Amount (₹)</label>
                <input
                  type="number"
                  value={sanctionData.sanctionAmount}
                  onChange={(e) => setSanctionData({ ...sanctionData, sanctionAmount: e.target.value })}
                  className="input-field text-sm"
                  readOnly={isReadOnly}
                />
              </div>
              {/* CEO and MD can see and edit Tenor */}
              {(role === 'ceo' || role === 'md') && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Tenor (Months)</label>
                <input
                  type="number"
                  value={sanctionData.tenure}
                  onChange={(e) => setSanctionData({ ...sanctionData, tenure: e.target.value })}
                  className="input-field text-sm"
                  readOnly={isReadOnly}
                />
              </div>
              )}
              {/* CEO and MD can see and edit ROI */}
              {(role === 'ceo' || role === 'md') && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Proposed ROI (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={sanctionData.interestRate}
                  onChange={(e) => setSanctionData({ ...sanctionData, interestRate: e.target.value })}
                  className="input-field text-sm"
                  readOnly={isReadOnly}
                />
              </div>
              )}
              <div className={role === 'md' ? "" : "hidden"}>
                <label className="block text-xs text-gray-500 mb-1">Penal Charges (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={sanctionData.penalCharges}
                  onChange={(e) => setSanctionData({ ...sanctionData, penalCharges: e.target.value })}
                  className="input-field text-sm"
                  readOnly={isReadOnly}
                />
              </div>
              <div className={role === 'md' ? "" : "hidden"}>
                <label className="block text-xs text-gray-500 mb-1">Processing Fee (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={sanctionData.processingFees}
                  onChange={(e) => setSanctionData({ ...sanctionData, processingFees: e.target.value })}
                  className="input-field text-sm"
                  readOnly={isReadOnly}
                />
              </div>
              <div className={role === 'md' ? "col-span-full" : "hidden col-span-full"}>
                <label className="block text-xs text-gray-500 mb-1">Sanction Conditions</label>
                <textarea
                  value={sanctionData.conditions}
                  onChange={(e) => setSanctionData({ ...sanctionData, conditions: e.target.value })}
                  className="input-field text-sm"
                  rows={2}
                  readOnly={isReadOnly}
                />
              </div>
            </div>
          </div>
          )}

          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Documents for Review</h2>
            {visibleDocuments.length > 0 ? (
              <div className="space-y-4">
                {visibleDocuments.map(doc => (
                  <div key={doc.id} className="p-4 bg-gray-50 rounded-lg border border-gray-100 flex flex-col space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-white rounded shadow-sm">
                          <FiFileText className="text-gray-500" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <p className="text-sm font-medium">{doc.fileName}</p>
                            {doc.applicantType === 'co-applicant' ? (
                              <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-bold">CO-APP {doc.applicantIndex || ''}</span>
                            ) : (
                              <span className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full font-bold">APPLICANT</span>
                            )}
                          </div>
                          <p className="text-[10px] text-gray-400 uppercase font-bold">{doc.documentType}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handlePreview(doc)}
                        className={`px-3 py-1 rounded text-xs font-bold border transition-colors flex items-center space-x-1 ${previewedDocs.has(doc.id) ? 'bg-green-100 text-green-700 border-green-200' : 'bg-primary-50 text-primary-600 border-primary-200 hover:bg-primary-100'}`}
                      >
                        {previewedDocs.has(doc.id) ? (
                          <>
                            <FiCheck className="h-3 w-3" />
                            <span>VIEWED</span>
                          </>
                        ) : (
                          <>
                            <FiEye className="h-3 w-3" />
                            <span>VIEW DOCUMENT</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase font-bold">Issue Date</p>
                        <p className="text-xs text-gray-700">{doc.issueDate ? formatDate(doc.issueDate) : 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase font-bold">Expiry Date</p>
                        <p className="text-xs text-gray-700">{doc.expiryDate ? formatDate(doc.expiryDate) : 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase font-bold">RM Remarks</p>
                        <p className="text-xs text-gray-700 truncate" title={doc.rmRemarks}>{doc.rmRemarks || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">No documents visible for review.</p>
            )}
          </div>

          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Approval Remarks</h2>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className="input-field"
              rows={4}
              placeholder={isReadOnly ? "Read-only mode" : "Enter your remarks/comments..."}
              required={!isReadOnly}
              readOnly={isReadOnly}
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <ApprovalTimeline approvals={formattedApprovals} />
          </div>

          <div className="card">
            {!isReadOnly ? (
              <div className="space-y-3">
                <button
                  onClick={handleApprove}
                  disabled={isSubmitting || (!allDocsPreviewed && visibleDocuments.length > 0)}
                  className={`w-full btn-primary flex items-center justify-center space-x-2 ${(!allDocsPreviewed && visibleDocuments.length > 0) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isSubmitting ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <>
                      <FiCheck className="h-5 w-5" />
                      <span>{(!allDocsPreviewed && visibleDocuments.length > 0) ? 'Preview Docs to Enable' : 'Approve'}</span>
                    </>
                  )}
                </button>
                <button
                  onClick={handleReject}
                  disabled={isSubmitting}
                  className="w-full btn-danger flex items-center justify-center space-x-2"
                >
                  {isSubmitting ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <>
                      <FiX className="h-5 w-5" />
                      <span>Reject</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="p-4 bg-gray-50 rounded-lg text-center">
                <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Read Only Mode</p>
                <p className="text-xs text-gray-400 mt-1">Case has been processed or is not at your stage.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ApprovalScreen


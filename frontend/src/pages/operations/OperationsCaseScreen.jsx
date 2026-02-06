import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { workflowService } from '../../services/workflowService'
import { customerService } from '../../services/customerService'
import ApprovalTimeline from '../../components/ApprovalTimeline'
import LoadingSpinner from '../../components/LoadingSpinner'
import { formatDate } from '../../utils/format'
import { FiCheck, FiX, FiFileText, FiDownload, FiLock } from 'react-icons/fi'
import DocumentUploader from '../../components/DocumentUploader'
import { useDispatch } from 'react-redux'
import { fetchCaseById } from '../../store/slices/caseSlice'

const OperationsCaseScreen = () => {
  const { id } = useParams() // customerId
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { user } = useSelector((state) => state.auth)

  const [customer, setCustomer] = useState(null)
  const [verification, setVerification] = useState({
    documentsVerified: false,
    esignVerified: false,
    enachVerified: false,
  })
  const [remarks, setRemarks] = useState('')
  const [docRemarks, setDocRemarks] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true)
        const response = await customerService.getCustomerById(id)
        if (response.data) {
          setCustomer(response.data)
          // Pre-fill if needed, but usually fresh for ops
        }
      } catch (error) {
        console.error('Error loading operations check:', error)
      } finally {
        setIsLoading(false)
      }
    }

    if (id) {
      loadData()
    }
  }, [id])

  const handleVerifyDocument = async (docId, status) => {
    const remark = docRemarks[docId] || ''
    if (!remark.trim()) {
      alert('Please add remarks for verification')
      return
    }
    try {
      await workflowService.verifyDocument(docId, status, remark)
      alert('Document status updated')
      const response = await customerService.getCustomerById(id)
      setCustomer(response.data)
    } catch (error) {
      alert('Verification failed')
    }
  }

  const handleApprove = async () => {
    setIsSubmitting(true)
    try {
      const userRole = (user?.role || '').toLowerCase()
      if (userRole === 'operations_head') {
        await workflowService.approveOpsHead(id, remarks)
      } else {
        await workflowService.approveOpsL1(id, true, remarks)
      }
      alert('Operations approval processed successfully')
      navigate('/operations/dashboard')
    } catch (error) {
      alert('Failed to update: ' + (error.response?.data?.message || error.message || error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReject = async () => {
    if (!remarks.trim()) {
      alert('Please add rejection reason')
      return
    }

    setIsSubmitting(true)
    try {
      await workflowService.approveOpsL1(id, false, remarks)
      alert('Operations check rejected')
      navigate('/operations/dashboard')
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
    return <div>Customer not found</div>
  }

  const formattedApprovals = (customer.statusHistory || []).map(action => ({
    approverName: action.changedByUser?.name || 'Workflow System',
    approverRole: action.changedByUser?.defaultRole?.replace(/_/g, ' ').toUpperCase() || 'System',
    status: action.status,
    approvedAt: action.createdAt,
    comments: action.remarks,
  }))

  return (
    <div className="space-y-6">
      <div>
        <button
          onClick={() => navigate('/operations/dashboard')}
          className="text-primary-600 hover:text-primary-700 mb-4"
        >
          ← Back to Dashboard
        </button>
        <h1 className="text-3xl font-bold text-gray-900">Operations Verification</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Customer Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Customer Name</p>
                <p className="font-medium">{customer?.customerName || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Contact Number</p>
                <p className="font-medium">{customer?.contactNumber || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Customer Code</p>
                <p className="font-medium">{customer?.customerCode || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <p className="font-medium uppercase">{customer?.status || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Credit & RM Reference Data */}
          <div className="card bg-gray-50 border-dashed border-2">
            <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
              <FiLock className="mr-2 text-gray-400" />
              Credit & RM Review Data
            </h2>
            <div className="grid grid-cols-2 gap-6 text-sm">
              <div className="space-y-2">
                <p className="text-xs text-gray-500 font-bold uppercase">Sanction Terms</p>
                <p>Amount: <span className="font-bold">₹{customer?.creditSanctions?.[0]?.sanctionAmount || 'N/A'}</span></p>
                <p>Tenure: <span className="font-bold">{customer?.creditSanctions?.[0]?.tenure || 'N/A'} Months</span></p>
                <p>Rate: <span className="font-bold">{customer?.creditSanctions?.[0]?.interestRate || 'N/A'}%</span></p>
              </div>
              <div className="space-y-2 border-l pl-6">
                <p className="text-xs text-gray-500 font-bold uppercase">Bank Details & Journey</p>
                <p>Acc No: <span className="font-bold">{customer?.bankAccountNo || 'N/A'}</span></p>
                <p>IFSC: <span className="font-bold">{customer?.bankIfscCode || 'N/A'}</span></p>
                <p>e-Sign: <span className={`font-bold ${customer?.eSignStatus === 'completed' ? 'text-green-600' : 'text-red-600'}`}>{customer?.eSignStatus?.toUpperCase() || 'PENDING'}</span></p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Document Verification</h2>
              {user?.role === 'operations_team_l1' && (
                <DocumentUploader
                  customerId={id}
                  onUploadSuccess={() => customerService.getCustomerById(id).then(r => setCustomer(r.data))}
                />
              )}
            </div>
            <div className="space-y-4">
              {customer?.documents?.map(doc => (
                <div key={doc.id} className="p-4 bg-white rounded border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <FiFileText className="text-gray-400" />
                      <div>
                        <p className="text-sm font-medium">{doc.fileName}</p>
                        <p className="text-xs text-gray-400 uppercase font-bold">{doc.documentType}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <a
                        href={`${import.meta.env.VITE_API_BASE_URL}/documents/download/${doc.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 text-primary-600 hover:bg-primary-50 rounded"
                      >
                        <FiDownload />
                      </a>
                      {doc.status === 'approved' ? (
                        <span className="badge bg-green-100 text-green-800">Verified</span>
                      ) : doc.status === 'rejected' ? (
                        <span className="badge bg-red-100 text-red-800">Rejected</span>
                      ) : (
                        <span className="badge bg-yellow-100 text-yellow-800 text-[10px]">Pending</span>
                      )}
                    </div>
                  </div>
                  {user?.role === 'operations_team_l1' && (
                    <div className="space-y-2">
                      <textarea
                        placeholder="Mandatory verification remarks..."
                        value={docRemarks[doc.id] || doc.remarks || ''}
                        onChange={(e) => setDocRemarks({ ...docRemarks, [doc.id]: e.target.value })}
                        className="w-full text-xs input-field"
                        rows={1}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleVerifyDocument(doc.id, 'approved')}
                          className="py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 font-bold"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleVerifyDocument(doc.id, 'rejected')}
                          className="py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 font-bold"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Verification Checklist</h2>
            <div className="space-y-3">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={verification.documentsVerified}
                  onChange={(e) => setVerification({ ...verification, documentsVerified: e.target.checked })}
                  className="rounded"
                />
                <span>Documents verified</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={verification.esignVerified}
                  onChange={(e) => setVerification({ ...verification, esignVerified: e.target.checked })}
                  className="rounded"
                />
                <span>eSign verified</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={verification.enachVerified}
                  onChange={(e) => setVerification({ ...verification, enachVerified: e.target.checked })}
                  className="rounded"
                />
                <span>eNACH verified</span>
              </label>
            </div>
          </div>

          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Operations Remarks</h2>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="input-field"
              rows={4}
              placeholder="Enter operations remarks..."
            />
          </div>
        </div>

        <div className="space-y-6">
          {formattedApprovals.length > 0 && (
            <div className="card">
              <ApprovalTimeline approvals={formattedApprovals} />
            </div>
          )}

          <div className="card">
            <div className="space-y-3">
              <button
                onClick={handleApprove}
                disabled={isSubmitting || !verification.documentsVerified || !verification.esignVerified || !verification.enachVerified}
                className="w-full btn-primary flex items-center justify-center space-x-2"
              >
                {isSubmitting ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <>
                    <FiCheck className="h-5 w-5" />
                    <span>Approve</span>
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
          </div>
        </div>
      </div>
    </div>
  )
}

export default OperationsCaseScreen


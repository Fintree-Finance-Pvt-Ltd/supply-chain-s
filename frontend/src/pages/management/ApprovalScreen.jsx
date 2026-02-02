import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { approvalService } from '../../services/approvalService'
import ApprovalTimeline from '../../components/ApprovalTimeline'
import LoadingSpinner from '../../components/LoadingSpinner'
import { formatDate, formatCurrency } from '../../utils/format'
import { FiCheck, FiX } from 'react-icons/fi'

const ApprovalScreen = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useSelector((state) => state.auth)
  
  const [approvalInstance, setApprovalInstance] = useState(null)
  const [approvalHistory, setApprovalHistory] = useState([])
  const [comments, setComments] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadApprovalData = async () => {
      try {
        setIsLoading(true)
        // Get approval instance details from pending approvals
        const pendingResponse = await approvalService.getPendingApprovals()
        const instance = pendingResponse.data.find(inst => inst.id === id)
        
        if (instance) {
          setApprovalInstance(instance)
          
          // Load approval history
          const historyResponse = await approvalService.getApprovalHistory(id)
          setApprovalHistory(historyResponse.data)
        }
      } catch (error) {
        console.error('Error loading approval data:', error)
      } finally {
        setIsLoading(false)
      }
    }
    
    if (id) {
      loadApprovalData()
    }
  }, [id])

  const handleApprove = async () => {
    if (!comments.trim()) {
      alert('Please add comments before approving')
      return
    }

    setIsSubmitting(true)
    try {
      await approvalService.processApproval(id, 'approved', comments)
      alert('Approval processed successfully')
      navigate('/management/dashboard')
    } catch (error) {
      alert('Failed to approve: ' + (error.message || error))
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
      await approvalService.processApproval(id, 'rejected', comments)
      alert('Approval rejected')
      navigate('/management/dashboard')
    } catch (error) {
      alert('Failed to reject: ' + (error.message || error))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return <LoadingSpinner />
  }

  if (!approvalInstance) {
    return <div>Approval instance not found</div>
  }

  const creditSanction = approvalInstance.creditSanction
  const customer = creditSanction?.customer || approvalInstance.operationsCheck?.customer

  // Format approval history for timeline component
  const formattedApprovals = approvalHistory.map(action => ({
    approverName: action.approver?.name || 'Unknown',
    approverRole: action.approver?.defaultRole || 'Unknown',
    status: action.action,
    approvedAt: action.createdAt,
    comments: action.comments,
  }))

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
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Case Summary</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Customer Name</p>
                <p className="font-medium">{customer?.name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Mobile Number</p>
                <p className="font-medium">{customer?.mobile || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">PAN Number</p>
                <p className="font-medium">{customer?.pan || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">RM Name</p>
                <p className="font-medium">{customer?.rm?.name || 'N/A'}</p>
              </div>
            </div>
          </div>

          {creditSanction && (
            <>
              <div className="card">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Sanction Details</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Sanction Amount</p>
                    <p className="font-medium text-lg">
                      {creditSanction.sanctionAmount ? formatCurrency(creditSanction.sanctionAmount) : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Tenure</p>
                    <p className="font-medium">{creditSanction.tenure || 'N/A'} months</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Interest Rate</p>
                    <p className="font-medium">{creditSanction.interestRate || 'N/A'}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Conditions</p>
                    <p className="font-medium">{creditSanction.conditions || 'N/A'}</p>
                  </div>
                </div>
              </div>

              <div className="card">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Credit Remarks</h2>
                <p className="text-gray-700">{creditSanction.creditRemarks || 'No remarks'}</p>
              </div>
            </>
          )}

          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Approval Comments</h2>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className="input-field"
              rows={4}
              placeholder="Enter your approval comments..."
              required
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <ApprovalTimeline approvals={formattedApprovals} />
          </div>

          <div className="card">
            <div className="space-y-3">
              <button
                onClick={handleApprove}
                disabled={isSubmitting}
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

export default ApprovalScreen


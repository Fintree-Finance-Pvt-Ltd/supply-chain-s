import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { workflowService } from '../../services/workflowService'
import { customerService } from '../../services/customerService'
import ApprovalTimeline from '../../components/ApprovalTimeline'
import LoadingSpinner from '../../components/LoadingSpinner'
import { formatDate } from '../../utils/format'
import { FiCheck, FiX } from 'react-icons/fi'

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
  })
  const [comments, setComments] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

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
                <p className="font-medium">{customer?.customerName || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Customer Code</p>
                <p className="font-medium">{customer?.customerCode || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Contact Number</p>
                <p className="font-medium">{customer?.contactNumber || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Email Address</p>
                <p className="font-medium">{customer?.email || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">RM Name</p>
                <p className="font-medium">{customer?.rm?.name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Industry</p>
                <p className="font-medium">{customer?.industryType || 'N/A'}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Onboarding Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Annual Turnover</p>
                <p className="font-medium">{customer?.annualTurnover || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Address</p>
                <p className="font-medium">{customer?.address || 'N/A'}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Sanction Details (Review & Revise)</h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Sanction Amount (₹)</label>
                <input
                  type="number"
                  value={sanctionData.sanctionAmount}
                  onChange={(e) => setSanctionData({ ...sanctionData, sanctionAmount: e.target.value })}
                  className="input-field text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Tenure (Months)</label>
                <input
                  type="number"
                  value={sanctionData.tenure}
                  onChange={(e) => setSanctionData({ ...sanctionData, tenure: e.target.value })}
                  className="input-field text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Interest Rate (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={sanctionData.interestRate}
                  onChange={(e) => setSanctionData({ ...sanctionData, interestRate: e.target.value })}
                  className="input-field text-sm"
                />
              </div>
            </div>
          </div>

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


import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { operationsService } from '../../services/operationsService'
import { approvalService } from '../../services/approvalService'
import ApprovalTimeline from '../../components/ApprovalTimeline'
import LoadingSpinner from '../../components/LoadingSpinner'
import { formatDate } from '../../utils/format'
import { FiCheck, FiX } from 'react-icons/fi'

const OperationsCaseScreen = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useSelector((state) => state.auth)
  
  const [opsCheck, setOpsCheck] = useState(null)
  const [approvalHistory, setApprovalHistory] = useState([])
  const [verification, setVerification] = useState({
    documentsVerified: false,
    esignVerified: false,
    enachVerified: false,
  })
  const [remarks, setRemarks] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true)
        const checkResponse = await operationsService.getCheckById(id)
        if (checkResponse.data) {
          setOpsCheck(checkResponse.data)
          setVerification({
            documentsVerified: checkResponse.data.documentsVerified || false,
            esignVerified: checkResponse.data.esignVerified || false,
            enachVerified: checkResponse.data.enachVerified || false,
          })
          setRemarks(checkResponse.data.opsRemarks || '')
          
          // Load approval history if approval instance exists
          if (checkResponse.data.approvalInstances && checkResponse.data.approvalInstances.length > 0) {
            const approvalId = checkResponse.data.approvalInstances[0].id
            const historyResponse = await approvalService.getApprovalHistory(approvalId)
            setApprovalHistory(historyResponse.data || [])
          }
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

  const handleApprove = async () => {
    setIsSubmitting(true)
    try {
      await operationsService.updateCheck(id, {
        ...verification,
        opsRemarks: remarks,
        status: 'approved',
      })
      alert('Operations check updated successfully')
      navigate('/operations/dashboard')
    } catch (error) {
      alert('Failed to update: ' + (error.message || error))
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
      await operationsService.updateCheck(id, {
        ...verification,
        opsRemarks: remarks,
        status: 'rejected',
      })
      alert('Operations check rejected')
      navigate('/operations/dashboard')
    } catch (error) {
      alert('Failed to reject: ' + (error.message || error))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return <LoadingSpinner />
  }

  if (!opsCheck) {
    return <div>Operations check not found</div>
  }

  const customer = opsCheck.customer
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
                <p className="text-sm text-gray-600">Status</p>
                <p className="font-medium">{opsCheck.status || 'N/A'}</p>
              </div>
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


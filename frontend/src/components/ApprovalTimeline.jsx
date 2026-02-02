import { formatDate } from '../utils/format'
import { FiCheckCircle, FiClock, FiXCircle } from 'react-icons/fi'

const ApprovalTimeline = ({ approvals = [] }) => {
  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved':
        return <FiCheckCircle className="h-5 w-5 text-green-500" />
      case 'rejected':
        return <FiXCircle className="h-5 w-5 text-red-500" />
      case 'pending':
        return <FiClock className="h-5 w-5 text-yellow-500" />
      default:
        return <FiClock className="h-5 w-5 text-gray-400" />
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return 'border-green-500 bg-green-50'
      case 'rejected':
        return 'border-red-500 bg-red-50'
      case 'pending':
        return 'border-yellow-500 bg-yellow-50'
      default:
        return 'border-gray-300 bg-gray-50'
    }
  }

  if (approvals.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No approval history available
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Approval Timeline</h3>
      <div className="relative">
        <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200"></div>
        <div className="space-y-6">
          {approvals.map((approval, index) => (
            <div key={index} className="relative flex items-start space-x-4">
              <div className={`relative z-10 flex items-center justify-center w-10 h-10 rounded-full border-2 ${getStatusColor(approval.status)}`}>
                {getStatusIcon(approval.status)}
              </div>
              <div className="flex-1 pb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {approval.approverName} ({approval.approverRole})
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDate(approval.approvedAt || approval.createdAt)}
                    </p>
                  </div>
                  <span className={`badge ${
                    approval.status === 'approved' ? 'bg-green-100 text-green-800' :
                    approval.status === 'rejected' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {approval.status}
                  </span>
                </div>
                {approval.comments && (
                  <p className="text-sm text-gray-600 mt-2">{approval.comments}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default ApprovalTimeline


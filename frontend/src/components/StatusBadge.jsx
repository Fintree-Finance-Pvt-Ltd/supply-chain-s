import { CASE_STATUS_COLORS } from '../constants/caseStatus'

const StatusBadge = ({ status, label }) => {
  const colorClasses = {
    gray: 'bg-gray-100 text-gray-800',
    blue: 'bg-blue-100 text-blue-800',
    green: 'bg-green-100 text-green-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    red: 'bg-red-100 text-red-800',
    orange: 'bg-orange-100 text-orange-800',
    purple: 'bg-purple-100 text-purple-800',
  }

  const color = CASE_STATUS_COLORS[status] || 'gray'
  const className = colorClasses[color] || colorClasses.gray

  return (
    <span className={`badge ${className}`}>
      {label || status}
    </span>
  )
}

export default StatusBadge


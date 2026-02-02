import { Link } from 'react-router-dom'
import { FiUsers, FiShield, FiGitBranch, FiBarChart } from 'react-icons/fi'

const AdminDashboard = () => {
  const stats = [
    { label: 'Total Users', value: '45', icon: FiUsers, color: 'bg-blue-500' },
    { label: 'Roles', value: '7', icon: FiShield, color: 'bg-green-500' },
    { label: 'Approval Flows', value: '3', icon: FiGitBranch, color: 'bg-purple-500' },
    { label: 'Active Cases', value: '128', icon: FiBarChart, color: 'bg-orange-500' },
  ]

  const quickActions = [
    { path: '/admin/users', label: 'Manage Users', icon: FiUsers },
    { path: '/admin/roles', label: 'Manage Roles', icon: FiShield },
    { path: '/admin/approval-flows', label: 'Configure Approval Flows', icon: FiGitBranch },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600 mt-2">Manage users, roles, and system configuration</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <div key={index} className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
              </div>
              <div className={`${stat.color} p-3 rounded-lg`}>
                <stat.icon className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quickActions.map((action, index) => (
            <Link
              key={index}
              to={action.path}
              className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors"
            >
              <action.icon className="h-6 w-6 text-primary-600" />
              <span className="font-medium text-gray-900">{action.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

export default AdminDashboard


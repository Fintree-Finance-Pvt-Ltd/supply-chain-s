import { useState } from 'react'
import { ROLES, ROLE_LABELS } from '../../constants/roles'

const RoleManagement = () => {
  const [roles] = useState(Object.values(ROLES).map((role, index) => ({
    id: index + 1,
    name: role,
    label: ROLE_LABELS[role],
    permissions: [], // TODO: Fetch from backend
  })))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Role Management</h1>
        <p className="text-gray-600 mt-2">View and manage system roles</p>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Role Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Label
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Permissions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {roles.map((role) => (
                <tr key={role.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {role.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {role.label}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {role.permissions.length > 0
                      ? role.permissions.join(', ')
                      : 'No permissions configured'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default RoleManagement


import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { fetchRoles, createRole, updateRole, deleteRole, toggleRoleStatus, assignPermission, removePermission } from '../../store/slices/roleSlice'
import { FiPlus, FiEdit2, FiTrash2, FiCheck, FiX } from 'react-icons/fi'
import LoadingSpinner from '../../components/LoadingSpinner'
import { toast } from 'react-toastify'

const RoleManagement = () => {
  const dispatch = useDispatch()
  const { roles, isLoading } = useSelector((state) => state.roles)
  const [permissions, setPermissions] = useState([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showPermissionsModal, setShowPermissionsModal] = useState(false)
  const [selectedRole, setSelectedRole] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    label: '',
    description: '',
  })

  useEffect(() => {
    dispatch(fetchRoles())
    fetchPermissions()
  }, [dispatch])

  const fetchPermissions = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('http://localhost:3000/api/permissions', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        const result = await response.json()
        setPermissions(result.data || [])
      }
    } catch (error) {
      console.error('Error fetching permissions:', error)
    }
  }

  const handlePermissionToggle = async (permissionId, checked) => {
    if (!selectedRole) return
    try {
      if (checked) {
        await dispatch(assignPermission({ roleId: selectedRole.id, permissionId })).unwrap()
        toast.success('Permission assigned')
      } else {
        await dispatch(removePermission({ roleId: selectedRole.id, permissionId })).unwrap()
        toast.success('Permission removed')
      }
      // Refresh roles list to update UI
      dispatch(fetchRoles())
    } catch (error) {
      toast.error(error || 'Failed to update permission')
    }
  }

  const handleCreateRole = async (e) => {
    e.preventDefault()
    try {
      await dispatch(createRole(formData)).unwrap()
      setShowCreateModal(false)
      setFormData({ name: '', label: '', description: '' })
      toast.success('Role created successfully')
    } catch (error) {
      toast.error(error || 'Failed to create role')
    }
  }

  const handleUpdateRole = async (e) => {
    e.preventDefault()
    try {
      await dispatch(updateRole({ id: selectedRole.id, data: { label: formData.label, description: formData.description } })).unwrap()
      setShowEditModal(false)
      toast.success('Role updated successfully')
    } catch (error) {
      toast.error(error || 'Failed to update role')
    }
  }

  const handleToggleStatus = async (roleId) => {
    try {
      await dispatch(toggleRoleStatus(roleId)).unwrap()
      toast.success('Role status toggled')
    } catch (error) {
      toast.error(error || 'Failed to toggle role status')
    }
  }

  const handleDeleteRole = async (roleId) => {
    if (window.confirm('Are you sure you want to delete this role?')) {
      try {
        await dispatch(deleteRole(roleId)).unwrap()
        toast.success('Role deleted successfully')
      } catch (error) {
        toast.error(error || 'Failed to delete role')
      }
    }
  }

  const handleEditClick = (role) => {
    setSelectedRole(role)
    setFormData({
      name: role.name,
      label: role.label,
      description: role.description || '',
    })
    setShowEditModal(true)
  }

  const handlePermissionsClick = (role) => {
    setSelectedRole(role)
    setShowPermissionsModal(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">Role Management</h1>
          <p className="text-gray-600 mt-2">Create and manage system roles with permissions</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center space-x-2"
        >
          <FiPlus className="h-5 w-5" />
          <span>Create Role</span>
        </button>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <div className="card">
          <div className="table-container">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="table-header">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Label</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Permissions</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {roles.map((role) => (
                  <tr key={role.id} className="table-row">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{role.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{role.label}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 truncate max-w-xs">{role.description || '-'}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className="badge badge-info">
                        {role.rolePermissions?.length || 0} perms
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={role.isActive ? 'status-active' : 'status-inactive'}>
                        {role.isActive ? '✓ Active' : '✕ Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2 flex">
                      <button
                        onClick={() => handleEditClick(role)}
                        className="action-button action-button-primary"
                        title="Edit"
                      >
                        <FiEdit2 className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handlePermissionsClick(role)}
                        className="action-button action-button-success"
                        title="Manage Permissions"
                      >
                        <FiCheck className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleToggleStatus(role.id)}
                        className={role.isActive ? 'action-button action-button-danger' : 'action-button action-button-success'}
                        title={role.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {role.isActive ? <FiX className="h-5 w-5" /> : <FiCheck className="h-5 w-5" />}
                      </button>
                      <button
                        onClick={() => handleDeleteRole(role.id)}
                        className="action-button action-button-danger"
                        title="Delete"
                      >
                        <FiTrash2 className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Role Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-screen overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Create New Role</h2>
              <form onSubmit={handleCreateRole} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., credit_team_l1"
                    required
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Label</label>
                  <input
                    type="text"
                    value={formData.label}
                    onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                    placeholder="e.g., Credit Team Level 1"
                    required
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="input-field"
                    rows="3"
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <button type="submit" className="btn-primary flex-1">Create</button>
                  <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary flex-1">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Role Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-screen overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Edit Role</h2>
              <form onSubmit={handleUpdateRole} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Name (Read-only)</label>
                  <input
                    type="text"
                    value={formData.name}
                    disabled
                    className="input-field opacity-50 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Label</label>
                  <input
                    type="text"
                    value={formData.label}
                    onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                    required
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="input-field"
                    rows="3"
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <button type="submit" className="btn-primary flex-1">Save</button>
                  <button type="button" onClick={() => setShowEditModal(false)} className="btn-secondary flex-1">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Permissions Modal */}
      {showPermissionsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-screen overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Manage Permissions - {selectedRole?.label}</h2>
              <div className="space-y-4">
                <div className="max-h-96 overflow-y-auto border border-gray-200 rounded p-4">
                  {permissions.length > 0 ? (
                    <div className="space-y-2">
                      {permissions.map((permission) => (
                        <div key={permission.id} className="flex items-center p-2 border border-gray-200 rounded hover:bg-blue-50 transition-colors">
                          <input
                            type="checkbox"
                            id={permission.id}
                            checked={selectedRole?.rolePermissions?.some(
                              (rp) => rp.permissionId === permission.id
                            )}
                            onChange={(e) => handlePermissionToggle(permission.id, e.target.checked)}
                            className="h-4 w-4 text-blue-600 rounded"
                          />
                          <label htmlFor={permission.id} className="ml-3 flex-1 cursor-pointer">
                            <div className="text-sm font-medium text-gray-900">{permission.label}</div>
                            <div className="text-xs text-gray-500">{permission.name}</div>
                          </label>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">No permissions available</p>
                  )}
                </div>
                <button onClick={() => setShowPermissionsModal(false)} className="btn-secondary w-full">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RoleManagement


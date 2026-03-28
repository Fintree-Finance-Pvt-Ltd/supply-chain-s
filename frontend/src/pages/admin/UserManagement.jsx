import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { fetchUsers, createUser, assignRole, assignMultipleRoles, removeRole, updateUser, deleteUser, toggleUserStatus } from '../../store/slices/userSlice'
import { fetchRoles as fetchRolesFromRoleSlice } from '../../store/slices/roleSlice'
import DataTable from '../../components/DataTable'
import LoadingSpinner from '../../components/LoadingSpinner'
import { FiPlus, FiEdit2, FiTrash2, FiCheck, FiX } from 'react-icons/fi'
import { toast } from 'react-toastify'

const UserManagement = () => {
  const dispatch = useDispatch()
  const { users, isLoading } = useSelector((state) => state.users)
  const { roles } = useSelector((state) => state.roles)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    mobile: '',
    defaultRole: '',
    selectedRoles: [],
  })
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    mobile: '',
    selectedRoles: [],
  })

  useEffect(() => {
    dispatch(fetchUsers())
    dispatch(fetchRolesFromRoleSlice())
  }, [dispatch])

  const handleCreateUser = async (e) => {
    e.preventDefault()
    try {
      await dispatch(createUser(formData)).unwrap()
      setShowCreateModal(false)
      setFormData({ name: '', email: '', password: '', mobile: '', defaultRole: '', selectedRoles: [] })
      dispatch(fetchUsers())
      toast.success('User created successfully')
    } catch (error) {
      toast.error('Failed to create user: ' + error)
    }
  }

  const handleEditUser = async (e) => {
    e.preventDefault()
    
    if (!selectedUser || !selectedUser.id) {
      toast.error('User not selected')
      return
    }
    
    try {
      // First, update user basic info (exclude selectedRoles from the data)
      const { selectedRoles, ...userData } = editFormData
      await dispatch(updateUser({ id: selectedUser.id, data: userData })).unwrap()
      
      // Then handle role changes - compare current roles with selected roles
      const currentRoleIds = selectedUser.userRoles?.map(ur => ur.roleId) || []
      const newRoleIds = editFormData.selectedRoles || []
      
      // Roles to add (in new but not in current)
      const rolesToAdd = newRoleIds.filter(roleId => !currentRoleIds.includes(roleId))
      // Roles to remove (in current but not in new)
      const rolesToRemove = currentRoleIds.filter(roleId => !newRoleIds.includes(roleId))
      
      // Add new roles
      for (const roleId of rolesToAdd) {
        await dispatch(assignRole({ userId: selectedUser.id, roleId })).unwrap()
      }
      
      // Remove old roles
      for (const roleId of rolesToRemove) {
        await dispatch(removeRole({ userId: selectedUser.id, roleId })).unwrap()
      }
      
      handleCloseEditModal()
      dispatch(fetchUsers())
      toast.success('User and roles updated successfully')
    } catch (error) {
      toast.error('Failed to update user: ' + (error.message || error))
    }
  }

  const handleToggleStatus = async (userId) => {
    try {
      await dispatch(toggleUserStatus(userId)).unwrap()
      dispatch(fetchUsers())
      toast.success('User status updated')
    } catch (error) {
      toast.error('Failed to toggle user status: ' + error)
    }
  }

  const handleDeleteUser = async (userId) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        await dispatch(deleteUser(userId)).unwrap()
        dispatch(fetchUsers())
        toast.success('User deleted successfully')
      } catch (error) {
        toast.error('Failed to delete user: ' + error)
      }
    }
  }

  const handleEditClick = (user) => {
    setSelectedUser(user)
    // Extract current role IDs from user's roles
    const currentRoleIds = user.userRoles?.map(ur => ur.roleId) || []
    setEditFormData({
      name: user.name,
      email: user.email,
      mobile: user.mobile || '',
      selectedRoles: currentRoleIds,
    })
    setShowEditModal(true)
  }

  const handleCloseEditModal = () => {
    setShowEditModal(false)
    setEditFormData({ name: '', email: '', mobile: '', selectedRoles: [] })
  }

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'mobile', label: 'Mobile' },
    {
      key: 'defaultRole',
      label: 'Default Role',
      render: (value) => <span className="badge badge-primary">{value || 'N/A'}</span>
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (value) => <span className={value ? 'status-active' : 'status-inactive'}>{value ? '✓ Active' : '✕ Inactive'}</span>
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600 mt-2">Create and manage system users with role assignments</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center space-x-2"
        >
          <FiPlus className="h-5 w-5" />
          <span>Create User</span>
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
                  {columns.map((col) => (
                    <th key={col.key} className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      {col.label}
                    </th>
                  ))}
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id} className="table-row">
                    {columns.map((col) => (
                      <td key={col.key} className="px-6 py-4 whitespace-nowrap text-sm">
                        {col.render ? col.render(user[col.key]) : user[col.key]}
                      </td>
                    ))}
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2 flex">
                      <button
                        onClick={() => handleEditClick(user)}
                        className="action-button action-button-primary"
                        title="Edit"
                      >
                        <FiEdit2 className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleToggleStatus(user.id)}
                        className={user.isActive ? 'action-button action-button-danger' : 'action-button action-button-success'}
                        title={user.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {user.isActive ? <FiX className="h-5 w-5" /> : <FiCheck className="h-5 w-5" />}
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id)}
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

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-screen overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Create New User</h2>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    className="input-field"
                  />
                </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Mobile</label>
                <input
                  type="tel"
                  value={formData.mobile}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Default Role</label>
                <select
                  value={formData.defaultRole}
                  onChange={(e) => setFormData({ ...formData, defaultRole: e.target.value })}
                  className="input-field"
                >
                  <option value="">Select a role</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.name}>{role.label}</option>
                  ))}
                </select>
              </div>
              {/* Multiple Roles Selection for Maker-Checker */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Assign Multiple Roles (Optional)</label>
                <p className="text-xs text-gray-500 mb-2">Select multiple roles to enable Maker-Checker functionality</p>
                <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-1">
                  {roles.map((role) => (
                    <label key={role.id} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.selectedRoles.includes(role.id)}
                        onChange={(e) => {
                          const roleId = role.id
                          if (e.target.checked) {
                            setFormData({ ...formData, selectedRoles: [...formData.selectedRoles, roleId] })
                          } else {
                            setFormData({ ...formData, selectedRoles: formData.selectedRoles.filter(id => id !== roleId) })
                          }
                        }}
                        className="rounded text-blue-600"
                      />
                      <span className="text-sm">{role.label}</span>
                    </label>
                  ))}
                </div>
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

      {/* Edit User Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-screen overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Edit User</h2>
              <form onSubmit={handleEditUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                  <input
                    type="text"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    required
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    required
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Mobile</label>
                  <input
                    type="tel"
                    value={editFormData.mobile}
                    onChange={(e) => setEditFormData({ ...editFormData, mobile: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <button type="submit" className="btn-primary flex-1">Save</button>
                  <button type="button" onClick={handleCloseEditModal} className="btn-secondary flex-1">Cancel</button>
                </div>
                {/* Edit User Roles Section */}
                <div className="border-t pt-4 mt-4">
                  <h3 className="font-medium mb-3">Edit Roles</h3>
                  <p className="text-xs text-gray-500 mb-2">Check/uncheck roles to update. Save to apply changes.</p>
                  <div className="max-h-32 overflow-y-auto border rounded-md p-2 space-y-1">
                    {roles.map((role) => (
                      <label key={role.id} className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editFormData.selectedRoles.includes(role.id)}
                          onChange={(e) => {
                            const roleId = role.id;
                            if (e.target.checked) {
                              setEditFormData({ ...editFormData, selectedRoles: [...editFormData.selectedRoles, roleId] });
                            } else {
                              setEditFormData({ ...editFormData, selectedRoles: editFormData.selectedRoles.filter(id => id !== roleId) });
                            }
                          }}
                          className="rounded text-blue-600"
                        />
                        <span className="text-sm">{role.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserManagement


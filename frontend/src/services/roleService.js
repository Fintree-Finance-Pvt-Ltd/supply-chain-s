import api from './api'
import { API_ENDPOINTS } from '../constants/api'

export const roleService = {
  getRoles: async () => {
    try {
      const response = await api.get(API_ENDPOINTS.ROLES)
      return { data: response.data.success ? response.data.data : [] }
    } catch (error) {
      console.error('Error fetching roles:', error)
      throw error
    }
  },

  getRoleById: async (id) => {
    try {
      const response = await api.get(API_ENDPOINTS.ROLE_BY_ID(id))
      return { data: response.data.success ? response.data.data : null }
    } catch (error) {
      console.error('Error fetching role:', error)
      throw error
    }
  },

  createRole: async (roleData) => {
    try {
      const response = await api.post(API_ENDPOINTS.ROLES, roleData)
      return { data: response.data.success ? response.data.data : null }
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to create role')
    }
  },

  updateRole: async (id, roleData) => {
    try {
      const response = await api.put(API_ENDPOINTS.ROLE_BY_ID(id), roleData)
      return { data: response.data.success ? response.data.data : null }
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to update role')
    }
  },

  deleteRole: async (id) => {
    try {
      const response = await api.delete(API_ENDPOINTS.ROLE_BY_ID(id))
      return { data: response.data.success ? response.data.data : null }
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to delete role')
    }
  },

  toggleRoleStatus: async (id) => {
    try {
      const response = await api.patch(API_ENDPOINTS.ROLE_TOGGLE_STATUS(id))
      return { data: response.data.success ? response.data.data : null }
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to toggle role status')
    }
  },

  assignPermission: async (roleId, permissionId) => {
    try {
      const response = await api.post(API_ENDPOINTS.ROLE_ASSIGN_PERMISSION, { roleId, permissionId })
      return { data: response.data.success ? response.data.data : null }
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to assign permission')
    }
  },

  removePermission: async (roleId, permissionId) => {
    try {
      const response = await api.post(API_ENDPOINTS.ROLE_REMOVE_PERMISSION, { roleId, permissionId })
      return { data: response.data.success ? response.data.data : null }
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to remove permission')
    }
  },
}

import api from './api'
import { API_ENDPOINTS } from '../constants/api'

export const userService = {
  getUsers: async () => {
    try {
      const response = await api.get(API_ENDPOINTS.USERS)
      return {
        data: response.data.success ? response.data.data : []
      }
    } catch (error) {
      console.error('Error fetching users:', error)
      throw error
    }
  },
  
  getRoles: async () => {
    try {
      const response = await api.get(API_ENDPOINTS.ROLES)
      return { data: response.data.success ? response.data.data : [] }
    } catch (error) {
      console.error('Error fetching roles:', error)
      throw error
    }
  },
  
  createUser: async (userData) => {
    try {
      const response = await api.post(API_ENDPOINTS.USERS, userData)
      return {
        data: response.data.success ? response.data.data : null
      }
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Failed to create user'
      throw new Error(message)
    }
  },
  
  assignRole: async (userId, roleId) => {
    try {
      const response = await api.post(API_ENDPOINTS.ASSIGN_ROLE, { userId, roleId })
      return {
        data: response.data.success ? response.data.data : null
      }
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Failed to assign role'
      throw new Error(message)
    }
  },
  removeRole: async (userId, roleId) => {
    try {
      const response = await api.post(API_ENDPOINTS.REMOVE_ROLE, { userId, roleId })
      return { data: response.data.success ? response.data.data : null }
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Failed to remove role'
      throw new Error(message)
    }
  },
  updateUser: async (userId, data) => {
    try {
      const response = await api.put(API_ENDPOINTS.UPDATE_USER(userId), data)
      return { data: response.data.success ? response.data.data : null }
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Failed to update user'
      throw new Error(message)
    }
  },
  deleteUser: async (userId) => {
    try {
      const response = await api.delete(API_ENDPOINTS.DELETE_USER(userId))
      return { data: response.data.success ? response.data.data : null }
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Failed to delete user'
      throw new Error(message)
    }
  },
  toggleUserStatus: async (userId) => {
    try {
      const response = await api.patch(API_ENDPOINTS.USER_TOGGLE_STATUS(userId))
      return { data: response.data.success ? response.data.data : null }
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Failed to toggle user status'
      throw new Error(message)
    }
  },
}


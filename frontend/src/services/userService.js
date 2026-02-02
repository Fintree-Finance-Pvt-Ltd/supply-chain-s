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
    // Note: Backend doesn't have a roles endpoint yet
    // Return static roles for now - can be enhanced when backend adds roles endpoint
    return {
      data: [
        { id: '550e8400-e29b-41d4-a716-446655440001', name: 'admin', label: 'Admin' },
        { id: '550e8400-e29b-41d4-a716-446655440002', name: 'relationship_manager', label: 'Relationship Manager' },
        { id: '550e8400-e29b-41d4-a716-446655440003', name: 'credit_team', label: 'Credit Team' },
        { id: '550e8400-e29b-41d4-a716-446655440004', name: 'operations_team', label: 'Operations Team' },
        { id: '550e8400-e29b-41d4-a716-446655440005', name: 'cfo', label: 'CFO' },
        { id: '550e8400-e29b-41d4-a716-446655440006', name: 'ceo', label: 'CEO' },
        { id: '550e8400-e29b-41d4-a716-446655440007', name: 'md', label: 'Managing Director' },
      ]
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
}


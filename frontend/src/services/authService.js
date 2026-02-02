import api from './api'
import { API_ENDPOINTS } from '../constants/api'

export const authService = {
  login: async (email, password) => {
    try {
      const response = await api.post(API_ENDPOINTS.LOGIN, { email, password })
      
      if (response.data.success) {
        const data = response.data.data
        // Debug logging (remove in production)
        if (process.env.NODE_ENV === 'development') {
          console.log('Login response:', data)
          console.log('User object:', data.user)
          console.log('User role:', data.user?.role || data.user?.defaultRole)
        }
        return data
      } else {
        throw new Error(response.data.message || 'Login failed')
      }
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Login failed'
      throw new Error(message)
    }
  },
  
  logout: async () => {
    try {
      await api.post(API_ENDPOINTS.LOGOUT)
      return true
    } catch (error) {
      // Even if logout fails on server, clear local storage
      console.error('Logout error:', error)
      return true
    }
  },
}


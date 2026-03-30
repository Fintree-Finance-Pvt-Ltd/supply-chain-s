import { API_BASE_URL, API_ENDPOINTS } from '../constants/api';
import api from '../services/api';

// Performance Service for SuperAdmin User Performance

export const performanceService = {
  // Get overall performance summary
  getSummary: async () => {
    const response = await api.get(API_ENDPOINTS.USER_PERFORMANCE_SUMMARY);
    return response.data.data;
  },

  // Get user performance list with filters
  getUserList: async (params = {}) => {
    const response = await api.get(API_ENDPOINTS.USER_PERFORMANCE_LIST, { params });
    return response.data.data;
  },

  // Get users for filter dropdown
  getUsers: async () => {
    const response = await api.get(API_ENDPOINTS.USER_PERFORMANCE_USERS);
    return response.data.data;
  },

  // Get detailed performance for a specific user
  getUserDetail: async (userId, params = {}) => {
    const response = await api.get(API_ENDPOINTS.USER_PERFORMANCE_DETAIL(userId), { params });
    return response.data.data;
  },

  // Get all cases across all users (SuperAdmin)
  getAllCases: async (params = {}) => {
    const response = await api.get(API_ENDPOINTS.SUPERADMIN_CASES, { params });
    return response.data.data;
  },
};

export default performanceService;
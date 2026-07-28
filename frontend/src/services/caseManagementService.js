import api from './api'
import { API_ENDPOINTS } from '../constants/api'

const unwrap = (response, fallback = null) => (
  response.data?.success ? response.data.data : fallback
)

export const caseManagementService = {
  getPostSanctionChecklists: async () => {
    const response = await api.get(API_ENDPOINTS.CASE_MANAGEMENT_CHECKLISTS)
    return unwrap(response, [])
  },

  getRenewalSummary: async (customerId) => {
    const response = await api.get(API_ENDPOINTS.CASE_MANAGEMENT_RENEWALS(customerId))
    return unwrap(response, null)
  },

  startRenewal: async (customerId, remarks = '') => {
    const response = await api.post(API_ENDPOINTS.CASE_MANAGEMENT_START_RENEWAL(customerId), { remarks })
    return unwrap(response, null)
  },

  holdCase: async (customerId, reason = '') => {
    const response = await api.post(API_ENDPOINTS.CASE_MANAGEMENT_HOLD(customerId), { reason })
    return unwrap(response, null)
  },

  resumeCase: async (customerId, remarks = '') => {
    const response = await api.post(API_ENDPOINTS.CASE_MANAGEMENT_RESUME(customerId), { remarks })
    return unwrap(response, null)
  },

  archiveCase: async (customerId, reason = '') => {
    const response = await api.post(API_ENDPOINTS.CASE_MANAGEMENT_ARCHIVE(customerId), { reason })
    return unwrap(response, null)
  },

  reassignRM: async (customerId, newRmId, remarks = '') => {
    const response = await api.post(API_ENDPOINTS.CASE_MANAGEMENT_REASSIGN_RM(customerId), { newRmId, remarks })
    return unwrap(response, null)
  },

  getCalendarEvents: async (params = {}) => {
    const response = await api.get(API_ENDPOINTS.CASE_MANAGEMENT_CALENDAR, { params })
    return unwrap(response, [])
  },

  getCalendarRelationshipManagers: async () => {
    const response = await api.get(API_ENDPOINTS.CASE_MANAGEMENT_CALENDAR_RMS)
    return unwrap(response, [])
  },

  runReminders: async () => {
    const response = await api.post(API_ENDPOINTS.CASE_MANAGEMENT_RUN_REMINDERS)
    return unwrap(response, null)
  },
}

export default caseManagementService

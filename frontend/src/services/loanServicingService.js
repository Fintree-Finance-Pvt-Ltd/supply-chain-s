import api from './api'
import { API_ENDPOINTS } from '../constants/api'

const buildQuery = (filters = {}) => {
  const params = new URLSearchParams()
  if (filters.startDate) {params.append('startDate', filters.startDate)}

  if (filters.endDate) {params.append('endDate', filters.endDate)}

  if (filters.asOfDate) {params.append('asOfDate', filters.asOfDate) }

  if (filters.lan) {params.append('lan', String(filters.lan).trim().toUpperCase())}

  if (filters.allCases) {params.append('allCases', 'true')}
  const query = params.toString()
  return query ? `?${query}` : ''
}

const getDownloadErrorMessage = async (error, fallbackMessage) => {
  const data = error.response?.data
  const isBlob = typeof Blob !== 'undefined' && data instanceof Blob

  if (isBlob) {
    const text = await data.text()
    if (text) {
      try {
        const parsed = JSON.parse(text)
        return parsed.message || fallbackMessage
      } catch {
        return text
      }
    }
  }

  return data?.message || error.message || fallbackMessage
}

const SCF_REPORT_ENDPOINTS = {
  fifteenDay: API_ENDPOINTS.LOAN_SERVICING_SCF_15D_REPORT_EXPORT,
  asOfNow: API_ENDPOINTS.LOAN_SERVICING_SCF_AS_OF_NOW_REPORT_EXPORT,
  collections: API_ENDPOINTS.LOAN_SERVICING_SCF_COLLECTION_REPORT_EXPORT,
  soa: API_ENDPOINTS.LOAN_SERVICING_SCF_SOA_REPORT_EXPORT,
}

export const loanServicingService = {
  getPortfolioReport: async () => {
    const response = await api.get(API_ENDPOINTS.LOAN_SERVICING_PORTFOLIO_REPORT)
    return response.data
  },

  getDisbursementReport: async (filters = {}) => {
    const response = await api.get(`${API_ENDPOINTS.LOAN_SERVICING_DISBURSEMENT_REPORT}${buildQuery(filters)}`)
    return response.data
  },

  getCollectionReport: async (filters = {}) => {
    const response = await api.get(`${API_ENDPOINTS.LOAN_SERVICING_COLLECTION_REPORT}${buildQuery(filters)}`)
    return response.data
  },

  getAccount: async (lan) => {
    const response = await api.get(API_ENDPOINTS.LOAN_SERVICING_ACCOUNT(lan))
    return response.data
  },

  getSchedule: async (lan) => {
    const response = await api.get(API_ENDPOINTS.LOAN_SERVICING_SCHEDULE(lan))
    return response.data
  },

  getStatement: async (lan, filters = {}) => {
    const response = await api.get(`${API_ENDPOINTS.LOAN_SERVICING_STATEMENT(lan)}${buildQuery(filters)}`)
    return response.data
  },

  getCollectionDetail: async (lan, utr) => {
    const response = await api.get(API_ENDPOINTS.LOAN_SERVICING_COLLECTION_DETAIL(lan, utr))
    return response.data
  },

  deleteCollectionsByLan: async (lan) => {
    const response = await api.delete(API_ENDPOINTS.LOAN_SERVICING_COLLECTIONS_BY_LAN(lan))
    return response.data
  },

  deleteInvoicesByLan: async (lan) => {
    const response = await api.delete(API_ENDPOINTS.LOAN_SERVICING_INVOICES_BY_LAN(lan))
    return response.data
  },

  downloadScfReport: async (reportType, filters = {}) => {
    const endpoint = SCF_REPORT_ENDPOINTS[reportType]
    if (!endpoint) {
      throw new Error('Unknown SCF report type')
    }

    try {
      const response = await api.get(
        `${endpoint}${buildQuery(filters)}`,
        { responseType: 'blob' },
      )
      return response
    } catch (error) {
      const message = await getDownloadErrorMessage(error, 'Failed to generate SCF report')
      throw new Error(message)
    }
  },
}

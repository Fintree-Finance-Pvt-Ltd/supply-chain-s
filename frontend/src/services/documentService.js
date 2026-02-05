import api from './api'
import { API_ENDPOINTS } from '../constants/api'

export const documentService = {
  uploadDocument: async (customerId, file, documentType, applicantType = 'applicant', applicantIndex = 0) => {
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('customerId', customerId)
      formData.append('documentType', documentType)
      formData.append('applicantType', applicantType)
      formData.append('applicantIndex', applicantIndex)

      const response = await api.post(API_ENDPOINTS.DOCUMENTS_UPLOAD, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      return {
        data: response.data.success ? response.data.data : null
      }
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Failed to upload document'
      throw new Error(message)
    }
  },

  getDocumentsByCustomer: async (customerId) => {
    try {
      const response = await api.get(API_ENDPOINTS.DOCUMENTS_BY_CUSTOMER(customerId))
      return {
        data: response.data.success ? response.data.data : []
      }
    } catch (error) {
      console.error('Error fetching documents:', error)
      throw error
    }
  },

  verifyDocument: async (documentId, remarks) => {
    try {
      const response = await api.post(API_ENDPOINTS.DOCUMENT_VERIFY(documentId), {
        remarks,
      })
      return {
        data: response.data.success ? response.data.data : null
      }
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Failed to verify document'
      throw new Error(message)
    }
  },

  deleteDocument: async (documentId) => {
    try {
      const response = await api.delete(API_ENDPOINTS.DOCUMENT_DELETE(documentId))
      return {
        data: response.data.success
      }
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Failed to delete document'
      throw new Error(message)
    }
  },
}


import api from './api'

export const partnerService = {
  // Get all active partners
  getActivePartners: async () => {
    const response = await api.get('/partners/active')
    return response.data
  },

  // Get all partners (admin)
  getAllPartners: async () => {
    const response = await api.get('/partners')
    return response.data
  },

  // Get partner by ID
  getPartnerById: async (id) => {
    const response = await api.get(`/partners/${id}`)
    return response.data
  },

  // Create new partner (admin)
  createPartner: async (partnerData) => {
    const response = await api.post('/partners', partnerData)
    return response.data
  },

  // Update partner (admin)
  updatePartner: async (id, partnerData) => {
    const response = await api.put(`/partners/${id}`, partnerData)
    return response.data
  },

  // Deactivate partner (admin)
  deactivatePartner: async (id) => {
    const response = await api.delete(`/partners/${id}`)
    return response.data
  },
}

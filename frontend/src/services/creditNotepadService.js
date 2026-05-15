import api from './api'

export const CREDIT_NOTEPAD_SECTIONS = {
  CREDIT_MAKER: 'credit_maker',
  CEO_CHECKER: 'ceo_checker',
}

export const creditNotepadService = {
  getCustomerNotepads: async (customerId) => {
    const response = await api.get(`/credit-notepads/customers/${customerId}`)
    return response.data?.data || {}
  },

  updateCustomerNotepad: async (customerId, sanctionKey, section, content) => {
    const response = await api.put(
      `/credit-notepads/customers/${customerId}/${section}`,
      { sanctionKey, content },
    )
    return response.data?.data
  },
}

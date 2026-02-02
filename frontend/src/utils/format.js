import { format } from 'date-fns'

export const formatDate = (date, formatStr = 'dd MMM yyyy') => {
  if (!date) return '-'
  try {
    return format(new Date(date), formatStr)
  } catch (error) {
    return '-'
  }
}

export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return '-'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

export const formatPhoneNumber = (phone) => {
  if (!phone) return '-'
  // Format: +91 12345 67890
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 10) {
    return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`
  }
  return phone
}


export const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return re.test(email)
}

export const validatePAN = (pan) => {
  const re = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/
  return re.test(pan)
}

export const validateAadhaar = (aadhaar) => {
  const re = /^\d{12}$/
  return re.test(aadhaar.replace(/\s/g, ''))
}

export const validateMobile = (mobile) => {
  const re = /^[6-9]\d{9}$/
  return re.test(mobile.replace(/\D/g, ''))
}

export const validateRequired = (value) => {
  return value !== null && value !== undefined && value.toString().trim() !== ''
}

export const validateAmount = (amount) => {
  const num = parseFloat(amount)
  return !isNaN(num) && num > 0
}


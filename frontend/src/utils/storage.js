const TOKEN_KEY = 'scf_token'
const USER_KEY = 'scf_user'

export const storage = {
  setToken: (token) => {
    localStorage.setItem(TOKEN_KEY, token)
  },
  
  getToken: () => {
    return localStorage.getItem(TOKEN_KEY)
  },
  
  removeToken: () => {
    localStorage.removeItem(TOKEN_KEY)
  },
  
  setUser: (user) => {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  },
  
  getUser: () => {
    const user = localStorage.getItem(USER_KEY)
    return user ? JSON.parse(user) : null
  },
  
  removeUser: () => {
    localStorage.removeItem(USER_KEY)
  },
  
  clear: () => {
    storage.removeToken()
    storage.removeUser()
  },
}


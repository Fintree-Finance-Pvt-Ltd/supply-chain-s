import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { authService } from '../../services/authService'
import { storage } from '../../utils/storage'
import { decodeJWT } from '../../utils/jwtDecode'

// Async thunks
export const login = createAsyncThunk(
  'auth/login',
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const response = await authService.login(email, password)
      storage.setToken(response.token)
      storage.setUser(response.user)
      return response
    } catch (error) {
      const message = error.message || error.response?.data?.message || 'Login failed'
      return rejectWithValue(message)
    }
  }
)

export const logout = createAsyncThunk('auth/logout', async (_, { rejectWithValue }) => {
  try {
    await authService.logout()
    storage.clear()
    return true
  } catch (error) {
    // Even if API call fails, clear local storage
    storage.clear()
    return true
  }
})

export const checkAuth = createAsyncThunk('auth/checkAuth', async () => {
  const token = storage.getToken()
  const user = storage.getUser()
  if (token && user) {
    // Decode JWT to get role if not in user object
    const decoded = decodeJWT(token)
    if (decoded && decoded.role && !user.role) {
      user.role = decoded.role
    }
    return { token, user }
  }
  throw new Error('No auth data found')
})

const initialState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(login.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false
        state.isAuthenticated = true
        // Decode JWT to get role if not in user object
        const decoded = decodeJWT(action.payload.token)
        const role = action.payload.user.role || action.payload.user.defaultRole || decoded?.role
        
        // Ensure role is set on user object
        const user = {
          ...action.payload.user,
          role: role,
        }
        state.user = user
        state.token = action.payload.token
        state.error = null
        
        // Debug logging (remove in production)
        if (process.env.NODE_ENV === 'development') {
          console.log('Login successful:', { user, role, decoded })
        }
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false
        state.isAuthenticated = false
        state.error = action.payload
      })
      // Logout
      .addCase(logout.fulfilled, (state) => {
        state.user = null
        state.token = null
        state.isAuthenticated = false
      })
      // Check Auth
      .addCase(checkAuth.fulfilled, (state, action) => {
        // Ensure role is set on user object
        const user = {
          ...action.payload.user,
          role: action.payload.user.role || action.payload.user.defaultRole,
        }
        state.user = user
        state.token = action.payload.token
        state.isAuthenticated = true
        state.isLoading = false
      })
      .addCase(checkAuth.rejected, (state) => {
        state.user = null
        state.token = null
        state.isAuthenticated = false
        state.isLoading = false
      })
  },
})

export const { clearError } = authSlice.actions
export default authSlice.reducer


import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { customerService } from '../../services/customerService'
import { workflowService } from '../../services/workflowService'

// Async thunks
export const fetchCases = createAsyncThunk(
  'cases/fetchCases',
  async (filters = {}, { rejectWithValue }) => {
    try {
      const response = await customerService.getCustomers(filters)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch cases')
    }
  }
)

export const fetchCaseById = createAsyncThunk(
  'cases/fetchCaseById',
  async (id, { rejectWithValue }) => {
    try {
      const response = await customerService.getCustomerById(id)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch case')
    }
  }
)

export const createCase = createAsyncThunk(
  'cases/createCase',
  async (caseData, { rejectWithValue }) => {
    try {
      const response = await workflowService.createCustomer(caseData)
      return response.data.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create case')
    }
  }
)

export const updateCase = createAsyncThunk(
  'cases/updateCase',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await customerService.updateCustomer(id, data)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update case')
    }
  }
)

export const submitCase = createAsyncThunk(
  'cases/submitCase',
  async ({ id, remarks = '' }, { rejectWithValue }) => {
    try {
      const response = await workflowService.submitCustomer(id, remarks)
      return response.data.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to submit case')
    }
  }
)

const initialState = {
  cases: [],
  currentCase: null,
  isLoading: false,
  error: null,
  filters: {},
}

const caseSlice = createSlice({
  name: 'cases',
  initialState,
  reducers: {
    setFilters: (state, action) => {
      state.filters = action.payload
    },
    clearCurrentCase: (state) => {
      state.currentCase = null
    },
    clearError: (state) => {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Cases
      .addCase(fetchCases.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchCases.fulfilled, (state, action) => {
        state.isLoading = false
        state.cases = action.payload
      })
      .addCase(fetchCases.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })
      // Fetch Case By ID
      .addCase(fetchCaseById.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchCaseById.fulfilled, (state, action) => {
        state.isLoading = false
        state.currentCase = action.payload
      })
      .addCase(fetchCaseById.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })
      // Create Case
      .addCase(createCase.fulfilled, (state, action) => {
        state.cases.unshift(action.payload)
        state.currentCase = action.payload
      })
      // Update Case
      .addCase(updateCase.fulfilled, (state, action) => {
        const index = state.cases.findIndex(c => c.id === action.payload.id)
        if (index !== -1) {
          state.cases[index] = action.payload
        }
        if (state.currentCase?.id === action.payload.id) {
          state.currentCase = action.payload
        }
      })
      // Submit Case
      .addCase(submitCase.fulfilled, (state, action) => {
        const index = state.cases.findIndex(c => c.id === action.payload.id)
        if (index !== -1) {
          state.cases[index] = action.payload
        }
        if (state.currentCase?.id === action.payload.id) {
          state.currentCase = action.payload
        }
      })
  },
})

export const { setFilters, clearCurrentCase, clearError } = caseSlice.actions
export default caseSlice.reducer


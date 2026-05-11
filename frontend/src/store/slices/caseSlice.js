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

export const fetchRMDashboard = createAsyncThunk(
  'cases/fetchRMDashboard',
  async (_, { rejectWithValue }) => {
    try {
      const response = await workflowService.getRMDashboard()
      return response.data.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch RM dashboard')
    }
  }
)

export const fetchWorkflowDashboard = createAsyncThunk(
  'cases/fetchWorkflowDashboard',
  async ({ role, level, handledPage, handledLimit }, { rejectWithValue }) => {
    try {
      let response;
      if (role === 'credit') {
        response = await workflowService.getCreditDashboard(level, {
          handledPage,
          handledLimit,
        });
      } else if (role === 'operations') {
        response = await workflowService.getOperationsDashboard();
      }
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch dashboard')
    }
  }
)

export const fetchExecutiveDashboard = createAsyncThunk(
  'cases/fetchExecutiveDashboard',
  async (_, { rejectWithValue }) => {
    try {
      const response = await workflowService.getExecutiveDashboard();
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch dashboard')
    }
  }
)

export const fetchCaseById = createAsyncThunk(
  'cases/fetchCaseById',
  async (payload, { rejectWithValue }) => {
    try {
      const id = typeof payload === 'object' ? payload.id : payload
      const sections = typeof payload === 'object' ? (payload.sections || []) : []
      const response = sections.length
        ? await customerService.getCustomerWithSections(id, sections)
        : await customerService.getCustomerById(id)
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
  async ({ id, remarks = '', pushedTo }, { rejectWithValue }) => {
    try {
      const response = await workflowService.submitCustomer(id, remarks, pushedTo)
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
      // RM Dashboard
      .addCase(fetchRMDashboard.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchRMDashboard.fulfilled, (state, action) => {
        state.isLoading = false
        state.dashboardData = action.payload
        state.cases = action.payload?.customers || []
      })
      .addCase(fetchRMDashboard.rejected, (state, action) => {
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
      // Workflow Dashboard
      .addCase(fetchWorkflowDashboard.pending, (state) => {
        state.isLoading = true
      })
      .addCase(fetchWorkflowDashboard.fulfilled, (state, action) => {
        state.isLoading = false
        // Combine pending and handled for the list, they can be separated in the component
        state.dashboardData = action.payload;
        state.cases = [...(action.payload.pending || []), ...(action.payload.handled || [])];
      })
      .addCase(fetchWorkflowDashboard.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })
      // Executive Dashboard
      .addCase(fetchExecutiveDashboard.pending, (state) => {
        state.isLoading = true
      })
      .addCase(fetchExecutiveDashboard.fulfilled, (state, action) => {
        state.isLoading = false
        state.dashboardData = action.payload;
        state.cases = [...(action.payload.pending || []), ...(action.payload.handled || [])];
      })
      .addCase(fetchExecutiveDashboard.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })
  },
})

export const { setFilters, clearCurrentCase, clearError } = caseSlice.actions
export default caseSlice.reducer


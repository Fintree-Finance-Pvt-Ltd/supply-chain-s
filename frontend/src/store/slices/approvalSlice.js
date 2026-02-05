import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { approvalService } from '../../services/approvalService'

// Async thunks
export const fetchFlows = createAsyncThunk(
  'approvals/fetchFlows',
  async (_, { rejectWithValue }) => {
    try {
      const response = await approvalService.getFlows()
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch flows')
    }
  }
)

export const createFlow = createAsyncThunk(
  'approvals/createFlow',
  async (flowData, { rejectWithValue }) => {
    try {
      const response = await approvalService.createFlow(flowData)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to create flow')
    }
  }
)

export const updateFlow = createAsyncThunk(
  'approvals/updateFlow',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await approvalService.updateFlow(id, data)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to update flow')
    }
  }
)

export const deleteFlow = createAsyncThunk(
  'approvals/deleteFlow',
  async (id, { rejectWithValue }) => {
    try {
      await approvalService.deleteFlow(id)
      return { id }
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to delete flow')
    }
  }
)

export const toggleFlowStatus = createAsyncThunk(
  'approvals/toggleFlowStatus',
  async (id, { rejectWithValue }) => {
    try {
      const response = await approvalService.toggleFlowStatus(id)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to toggle flow status')
    }
  }
)

export const addApprovalStep = createAsyncThunk(
  'approvals/addStep',
  async (stepData, { rejectWithValue }) => {
    try {
      const response = await approvalService.addStep(stepData)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to add step')
    }
  }
)

export const removeApprovalStep = createAsyncThunk(
  'approvals/removeStep',
  async (id, { rejectWithValue }) => {
    try {
      await approvalService.removeStep(id)
      return { id }
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to remove step')
    }
  }
)

export const fetchPendingApprovals = createAsyncThunk(
  'approvals/fetchPending',
  async (_, { rejectWithValue }) => {
    try {
      const response = await approvalService.getPendingApprovals()
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch pending approvals')
    }
  }
)

const initialState = {
  flows: [],
  pendingApprovals: [],
  isLoading: false,
  error: null,
}

const approvalSlice = createSlice({
  name: 'approvals',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Flows
      .addCase(fetchFlows.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchFlows.fulfilled, (state, action) => {
        state.isLoading = false
        state.flows = action.payload
      })
      .addCase(fetchFlows.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })
      // Create Flow
      .addCase(createFlow.fulfilled, (state, action) => {
        state.flows.push(action.payload)
      })
      // Update Flow
      .addCase(updateFlow.fulfilled, (state, action) => {
        const index = state.flows.findIndex(f => f.id === action.payload.id)
        if (index !== -1) state.flows[index] = action.payload
      })
      // Delete Flow
      .addCase(deleteFlow.fulfilled, (state, action) => {
        state.flows = state.flows.filter(f => f.id !== action.payload.id)
      })
      // Toggle Flow Status
      .addCase(toggleFlowStatus.fulfilled, (state, action) => {
        const index = state.flows.findIndex(f => f.id === action.payload.id)
        if (index !== -1) state.flows[index] = action.payload
      })
      // Add Step - triggers flow refresh
      .addCase(addApprovalStep.fulfilled, (state, action) => {
        const flowIndex = state.flows.findIndex(f => f.id === action.payload.flowId)
        if (flowIndex !== -1) {
          if (!state.flows[flowIndex].steps) state.flows[flowIndex].steps = []
          state.flows[flowIndex].steps.push(action.payload)
        }
      })
      // Remove Step
      .addCase(removeApprovalStep.fulfilled, (state, action) => {
        state.flows.forEach(flow => {
          flow.steps = flow.steps?.filter(s => s.id !== action.payload.id) || []
        })
      })
      // Fetch Pending
      .addCase(fetchPendingApprovals.pending, (state) => {
        state.isLoading = true
      })
      .addCase(fetchPendingApprovals.fulfilled, (state, action) => {
        state.isLoading = false
        state.pendingApprovals = action.payload
      })
  },
})

export const { clearError } = approvalSlice.actions
export default approvalSlice.reducer

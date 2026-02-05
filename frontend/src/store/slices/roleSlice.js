import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { roleService } from '../../services/roleService'

// Async thunks
export const fetchRoles = createAsyncThunk(
  'roles/fetchRoles',
  async (_, { rejectWithValue }) => {
    try {
      const response = await roleService.getRoles()
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch roles')
    }
  }
)

export const createRole = createAsyncThunk(
  'roles/createRole',
  async (roleData, { rejectWithValue }) => {
    try {
      const response = await roleService.createRole(roleData)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to create role')
    }
  }
)

export const updateRole = createAsyncThunk(
  'roles/updateRole',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await roleService.updateRole(id, data)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to update role')
    }
  }
)

export const deleteRole = createAsyncThunk(
  'roles/deleteRole',
  async (id, { rejectWithValue }) => {
    try {
      await roleService.deleteRole(id)
      return { id }
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to delete role')
    }
  }
)

export const toggleRoleStatus = createAsyncThunk(
  'roles/toggleRoleStatus',
  async (id, { rejectWithValue }) => {
    try {
      const response = await roleService.toggleRoleStatus(id)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to toggle role status')
    }
  }
)

export const assignPermission = createAsyncThunk(
  'roles/assignPermission',
  async ({ roleId, permissionId }, { rejectWithValue }) => {
    try {
      const response = await roleService.assignPermission(roleId, permissionId)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to assign permission')
    }
  }
)

export const removePermission = createAsyncThunk(
  'roles/removePermission',
  async ({ roleId, permissionId }, { rejectWithValue }) => {
    try {
      const response = await roleService.removePermission(roleId, permissionId)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to remove permission')
    }
  }
)

const initialState = {
  roles: [],
  isLoading: false,
  error: null,
}

const roleSlice = createSlice({
  name: 'roles',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Roles
      .addCase(fetchRoles.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchRoles.fulfilled, (state, action) => {
        state.isLoading = false
        state.roles = action.payload
      })
      .addCase(fetchRoles.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })
      // Create Role
      .addCase(createRole.fulfilled, (state, action) => {
        state.roles.push(action.payload)
      })
      // Update Role
      .addCase(updateRole.fulfilled, (state, action) => {
        const index = state.roles.findIndex(r => r.id === action.payload.id)
        if (index !== -1) state.roles[index] = action.payload
      })
      // Delete Role
      .addCase(deleteRole.fulfilled, (state, action) => {
        state.roles = state.roles.filter(r => r.id !== action.payload.id)
      })
      // Toggle Status
      .addCase(toggleRoleStatus.fulfilled, (state, action) => {
        const index = state.roles.findIndex(r => r.id === action.payload.id)
        if (index !== -1) state.roles[index] = action.payload
      })
  },
})

export const { clearError } = roleSlice.actions
export default roleSlice.reducer

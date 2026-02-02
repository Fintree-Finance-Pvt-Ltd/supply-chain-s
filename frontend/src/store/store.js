import { configureStore } from '@reduxjs/toolkit'
import authReducer from './slices/authSlice'
import caseReducer from './slices/caseSlice'
import userReducer from './slices/userSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    cases: caseReducer,
    users: userReducer,
  },
})

// Type exports removed - this is a JavaScript project
// If migrating to TypeScript, uncomment these:
// export type RootState = ReturnType<typeof store.getState>
// export type AppDispatch = typeof store.dispatch


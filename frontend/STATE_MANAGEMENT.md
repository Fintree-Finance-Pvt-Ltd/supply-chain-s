# State Management Architecture

## Why Redux Toolkit?

I chose **Redux Toolkit** over Context API for the following reasons:

### 1. **Scalability**
- This is an enterprise application with complex state interactions
- Multiple roles, workflows, and approval processes require centralized state
- Redux provides predictable state updates across the entire application

### 2. **Async Operations**
- Built-in support for async operations via `createAsyncThunk`
- Handles loading states, errors, and success states automatically
- Perfect for API calls and complex workflows

### 3. **Developer Experience**
- Redux DevTools for debugging
- Time-travel debugging
- Action logging and state inspection
- Better for team collaboration

### 4. **Performance**
- Optimized re-renders with selectors
- Memoization built-in
- Only components using specific state slices re-render

### 5. **Type Safety (Future)**
- Easy to migrate to TypeScript
- Type-safe actions and reducers
- Better IDE support

## Store Structure

```javascript
{
  auth: {
    user: User | null,           // Current logged-in user
    token: string | null,        // JWT token
    isAuthenticated: boolean,    // Auth status
    isLoading: boolean,          // Loading state
    error: string | null         // Error messages
  },
  
  cases: {
    cases: Case[],               // List of all cases
    currentCase: Case | null,   // Currently viewed case
    isLoading: boolean,         // Loading state
    error: string | null,       // Error messages
    filters: object             // Current filters
  },
  
  users: {
    users: User[],              // List of all users (admin only)
    roles: Role[],              // Available roles
    isLoading: boolean,         // Loading state
    error: string | null        // Error messages
  }
}
```

## Redux Slices

### 1. Auth Slice (`authSlice.js`)

**Purpose**: Manages authentication state

**Actions**:
- `login(email, password)` - Async thunk for login
- `logout()` - Clear auth state
- `checkAuth()` - Verify existing auth
- `clearError()` - Clear error messages

**State Flow**:
```
Login → API Call → Success → Store Token & User → Update State → Redirect
                → Failure → Store Error → Show Error Message
```

**Usage**:
```javascript
const { user, isAuthenticated, login, logout } = useAuth()
```

### 2. Case Slice (`caseSlice.js`)

**Purpose**: Manages case/customer onboarding data

**Actions**:
- `fetchCases(filters)` - Get list of cases
- `fetchCaseById(id)` - Get single case details
- `createCase(data)` - Create new case
- `updateCase(id, data)` - Update existing case
- `submitCase(id)` - Submit case for approval
- `setFilters(filters)` - Update filter state
- `clearCurrentCase()` - Clear current case

**State Flow**:
```
RM Creates Case → createCase → State Updated → UI Reflects Change
Credit Reviews → fetchCaseById → View Details → updateCase → Status Changed
```

**Usage**:
```javascript
const { cases, currentCase, fetchCases, updateCase } = useSelector(state => state.cases)
```

### 3. User Slice (`userSlice.js`)

**Purpose**: Manages user and role data (Admin only)

**Actions**:
- `fetchUsers()` - Get all users
- `fetchRoles()` - Get all roles
- `createUser(data)` - Create new user
- `assignRole(userId, roleId)` - Assign role to user

**Usage**:
```javascript
const { users, roles, createUser } = useSelector(state => state.users)
```

## Async Thunks Pattern

All API calls use `createAsyncThunk`:

```javascript
export const fetchCases = createAsyncThunk(
  'cases/fetchCases',
  async (filters = {}, { rejectWithValue }) => {
    try {
      const response = await caseService.getCases(filters)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message)
    }
  }
)
```

**Benefits**:
- Automatic loading state management
- Error handling built-in
- Success/failure states handled automatically

## State Updates Flow

### Example: Creating a Case

```
1. User fills form → Click "Submit"
2. Component dispatches: createCase(formData)
3. Redux calls: caseService.createCase()
4. On success: State updated with new case
5. Component re-renders with new data
6. User sees success message
```

### Example: Login Flow

```
1. User enters credentials → Click "Login"
2. Component dispatches: login(email, password)
3. Redux calls: authService.login()
4. On success: 
   - Token stored in localStorage
   - User data stored in localStorage
   - Auth state updated
5. Component redirects to dashboard
```

## Local Storage Integration

Authentication data is persisted in localStorage:

```javascript
// Storage utilities (src/utils/storage.js)
storage.setToken(token)
storage.getToken()
storage.setUser(user)
storage.getUser()
storage.clear()
```

**Why localStorage?**
- Persists across page refreshes
- Simple implementation
- Works with JWT tokens

**Note**: For production, consider httpOnly cookies for better security.

## Component Integration

### Using Redux in Components

```javascript
// Option 1: Using hooks
import { useSelector, useDispatch } from 'react-redux'
import { fetchCases } from '../store/slices/caseSlice'

const MyComponent = () => {
  const dispatch = useDispatch()
  const { cases, isLoading } = useSelector(state => state.cases)
  
  useEffect(() => {
    dispatch(fetchCases())
  }, [dispatch])
  
  return <div>...</div>
}

// Option 2: Using custom hooks (Recommended)
import { useAuth } from '../hooks/useAuth'

const MyComponent = () => {
  const { user, login, logout } = useAuth()
  // Cleaner and more maintainable
}
```

## Custom Hooks

### useAuth Hook

Abstraction over auth slice:

```javascript
const useAuth = () => {
  const dispatch = useDispatch()
  const { user, isAuthenticated } = useSelector(state => state.auth)
  
  const handleLogin = async (email, password) => {
    await dispatch(login({ email, password }))
  }
  
  return { user, isAuthenticated, login: handleLogin, ... }
}
```

**Benefits**:
- Cleaner component code
- Encapsulates Redux logic
- Easier to test
- Better separation of concerns

### useRole Hook

Role-based utilities:

```javascript
const { userRole, hasRole, isAdmin, isManagement } = useRole()
```

## State Management Best Practices

### 1. **Keep State Normalized**
- Store data in flat structures
- Use IDs for relationships
- Avoid nested state

### 2. **Use Selectors**
- Create reusable selectors
- Memoize expensive computations
- Keep components simple

### 3. **Handle Loading States**
- Show loading indicators
- Disable buttons during operations
- Provide user feedback

### 4. **Error Handling**
- Store errors in state
- Display user-friendly messages
- Clear errors on new actions

### 5. **Async Operations**
- Always use `createAsyncThunk`
- Handle both success and failure
- Update UI optimistically when appropriate

## Migration to Real Backend

When integrating with backend:

1. **Update Service Layer**: Replace mocks with real API calls
2. **Update Response Handling**: Match backend response structure
3. **Add Error Handling**: Handle network errors, timeouts
4. **Implement Token Refresh**: Auto-refresh expired tokens
5. **Add Request Interceptors**: Add loading indicators
6. **Add Response Interceptors**: Handle common errors

## Alternative: Context API

If you prefer Context API, here's how it would differ:

### Pros of Context API:
- Simpler setup
- Less boilerplate
- Built into React
- Good for simple state

### Cons of Context API:
- No DevTools
- Manual optimization needed
- Can cause unnecessary re-renders
- More complex for async operations

### When to Use Context API:
- Simple state (theme, language)
- Small applications
- No complex async operations
- Limited state updates

### When to Use Redux Toolkit:
- Complex state management ✅ (This project)
- Multiple async operations ✅
- Large team collaboration ✅
- Need for DevTools ✅
- Time-travel debugging ✅

## Summary

**Redux Toolkit** is the right choice for this enterprise application because:
1. Complex multi-role workflows
2. Multiple async operations
3. Need for predictable state updates
4. Better debugging capabilities
5. Scalability for future features

The structure is clean, maintainable, and ready for backend integration.


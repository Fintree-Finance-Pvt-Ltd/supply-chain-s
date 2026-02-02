# Supply Chain Finance System - Frontend Architecture

## Overview

This is a comprehensive, enterprise-grade frontend application built with React, Redux Toolkit, and Tailwind CSS. The system implements a multi-role, multi-approval workflow for Supply Chain Finance operations.

## Tech Stack

- **React 18** - UI library
- **Vite** - Build tool and dev server
- **React Router v6** - Client-side routing
- **Redux Toolkit** - State management
- **Axios** - HTTP client
- **Tailwind CSS** - Utility-first CSS framework
- **React Icons** - Icon library
- **date-fns** - Date formatting utilities

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ApprovalTimeline.jsx
│   ├── DataTable.jsx
│   ├── DocumentUploader.jsx
│   ├── LoadingSpinner.jsx
│   ├── ProtectedRoute.jsx
│   └── StatusBadge.jsx
│
├── constants/          # Constants and configurations
│   ├── api.js          # API endpoints
│   ├── caseStatus.js   # Case status definitions
│   └── roles.js        # Role definitions
│
├── hooks/              # Custom React hooks
│   ├── useAuth.js      # Authentication hook
│   └── useRole.js      # Role-based access hook
│
├── layouts/            # Layout components
│   ├── Header.jsx      # Top navigation header
│   ├── MainLayout.jsx  # Main app layout wrapper
│   └── Sidebar.jsx     # Sidebar navigation
│
├── pages/              # Page components
│   ├── admin/          # Admin pages
│   │   ├── AdminDashboard.jsx
│   │   ├── ApprovalFlowConfig.jsx
│   │   ├── RoleManagement.jsx
│   │   └── UserManagement.jsx
│   ├── auth/           # Authentication pages
│   │   └── Login.jsx
│   ├── common/         # Common pages
│   │   └── Unauthorized.jsx
│   ├── credit/         # Credit team pages
│   │   ├── CreditCaseDetail.jsx
│   │   └── CreditDashboard.jsx
│   ├── management/     # Management pages
│   │   ├── ApprovalScreen.jsx
│   │   └── ManagementDashboard.jsx
│   ├── operations/     # Operations pages
│   │   ├── OperationsCaseScreen.jsx
│   │   └── OperationsDashboard.jsx
│   └── rm/             # Relationship Manager pages
│       ├── NewCustomerOnboarding.jsx
│       ├── PostSanction.jsx
│       └── RMDashboard.jsx
│
├── services/           # API services
│   ├── api.js          # Axios instance configuration
│   ├── authService.js  # Authentication API calls
│   ├── caseService.js  # Case management API calls
│   └── userService.js  # User management API calls
│
├── store/              # Redux store
│   ├── slices/         # Redux slices
│   │   ├── authSlice.js
│   │   ├── caseSlice.js
│   │   └── userSlice.js
│   └── store.js         # Store configuration
│
├── utils/              # Utility functions
│   ├── format.js       # Formatting utilities
│   ├── storage.js      # LocalStorage utilities
│   └── validation.js   # Validation utilities
│
├── App.jsx             # Main app component with routing
├── main.jsx            # Application entry point
└── index.css           # Global styles
```

## State Management (Redux Toolkit)

### Store Structure

```javascript
{
  auth: {
    user: User | null,
    token: string | null,
    isAuthenticated: boolean,
    isLoading: boolean,
    error: string | null
  },
  cases: {
    cases: Case[],
    currentCase: Case | null,
    isLoading: boolean,
    error: string | null,
    filters: object
  },
  users: {
    users: User[],
    roles: Role[],
    isLoading: boolean,
    error: string | null
  }
}
```

### Why Redux Toolkit?

1. **Scalability**: Centralized state management for complex workflows
2. **DevTools**: Excellent debugging capabilities
3. **Async Handling**: Built-in support for async operations via `createAsyncThunk`
4. **Type Safety**: Easy to add TypeScript later
5. **Performance**: Optimized re-renders with selectors

## Routing Architecture

### Protected Routes

All routes except `/login` are protected by the `ProtectedRoute` component, which:
1. Checks authentication status
2. Validates user role against route requirements
3. Redirects to `/login` if not authenticated
4. Redirects to `/unauthorized` if role doesn't match

### Role-Based Routing

Routes are organized by role:
- **Admin**: `/admin/*`
- **RM**: `/rm/*`
- **Credit Team**: `/credit/*`
- **Operations**: `/operations/*`
- **Management**: `/management/*`

### Route Flow

```
Login → MainLayout → Role-based Dashboard
  ↓
MainLayout handles role-based redirect:
  - Admin → /admin
  - RM → /rm/dashboard
  - Credit → /credit/dashboard
  - Operations → /operations/dashboard
  - Management → /management/dashboard
```

## Component Architecture

### Reusable Components

1. **StatusBadge**: Displays case status with color coding
2. **DocumentUploader**: Handles file uploads with preview
3. **ApprovalTimeline**: Visual timeline of approval steps
4. **DataTable**: Configurable data table with sorting/filtering
5. **LoadingSpinner**: Loading indicator
6. **ProtectedRoute**: Route guard component

### Layout Components

1. **MainLayout**: Wraps all authenticated pages, handles role-based redirects
2. **Header**: Fixed top navigation bar
3. **Sidebar**: Role-based navigation menu

## Workflow Flows

### 1. Customer Onboarding Flow (RM)

```
RM Dashboard
  ↓
New Customer Onboarding
  ├─ Enter customer details
  ├─ Upload documents
  ├─ Save as Draft (optional)
  └─ Submit to Credit Team
      ↓
Case Status: "submitted"
```

### 2. Credit Review Flow

```
Credit Dashboard (filters submitted cases)
  ↓
Case Detail Screen
  ├─ Review customer information
  ├─ Verify documents
  ├─ Enter sanction details
  └─ Submit for Approval
      ↓
Case Status: "credit_approved"
```

### 3. Management Approval Flow

```
Management Dashboard
  ↓
Approval Screen
  ├─ Review case summary
  ├─ Review sanction details
  ├─ View approval timeline
  ├─ Add comments
  └─ Approve/Reject
      ↓
If Approved:
  Case Status: "post_sanction_pending"
  ↓
RM Post-Sanction Page
```

### 4. Post-Sanction Flow (RM)

```
Post-Sanction Page
  ├─ Upload pending documents
  ├─ Initiate eSign
  ├─ Initiate eNACH
  └─ Submit to Operations
      ↓
Case Status: "post_sanction_completed"
```

### 5. Operations Verification Flow

```
Operations Dashboard
  ↓
Operations Case Screen
  ├─ Verify documents
  ├─ Verify eSign & eNACH
  ├─ Multi-level approval (Checker → Manager → Final)
  └─ Approve/Reject
      ↓
If Approved:
  Case Status: "fully_onboarded"
```

## API Integration

### Service Layer Pattern

All API calls are abstracted in service files:
- `authService.js` - Authentication endpoints
- `caseService.js` - Case management endpoints
- `userService.js` - User management endpoints

### Mock Services

Currently, all services use mock implementations. To integrate with real backend:

1. Update `API_BASE_URL` in `constants/api.js`
2. Replace mock functions in service files with actual API calls
3. Update response handling to match backend structure

### API Endpoints Structure

```javascript
// Example: Case Service
caseService.getCases(filters)
caseService.getCaseById(id)
caseService.createCase(data)
caseService.updateCase(id, data)
caseService.submitCase(id)
caseService.uploadDocument(caseId, file, type)
```

## Authentication Flow

1. User logs in via `Login` page
2. Credentials sent to `authService.login()`
3. On success:
   - Token stored in localStorage
   - User data stored in localStorage
   - Redux auth state updated
   - Redirect to role-based dashboard
4. Token automatically attached to all API requests via Axios interceptor
5. On 401 response, user is logged out and redirected to login

## Role-Based Access Control (RBAC)

### Role Definitions

- **Admin**: Full system access, user/role management
- **Relationship Manager (RM)**: Customer onboarding, post-sanction activities
- **Credit Team**: Case review, sanction limit setting
- **Operations Team**: Post-sanction verification, multi-level approval
- **Management (CEO/CFO/MD)**: Credit sanction approval

### Implementation

1. **Route Protection**: `ProtectedRoute` component checks role
2. **UI Rendering**: Components conditionally render based on `useRole()` hook
3. **Sidebar Navigation**: Role-based menu items
4. **API Permissions**: Backend should validate role permissions

## Status Management

### Case Status Flow

```
draft → submitted → credit_approved → post_sanction_pending 
  → post_sanction_completed → operations_approved → fully_onboarded
```

Status can also transition to `rejected` at any approval stage.

## Multi-Level Approval System

### Configuration

Admin can configure approval flows in `/admin/approval-flows`:
- Define sequential approval steps
- Assign roles to each step
- Enable/disable multi-level approvals

### Implementation

1. **Credit Sanction Flow**: Credit Team → CFO → CEO → MD
2. **Operations Flow**: Ops Checker → Ops Manager → Final Approver

Each approval step:
- Records approver information
- Stores comments
- Updates timeline
- Moves to next approver in sequence

## Styling Approach

### Tailwind CSS

- Utility-first CSS framework
- Custom color palette in `tailwind.config.js`
- Reusable component classes in `index.css`
- Responsive design with mobile-first approach

### Design System

- **Primary Color**: Blue (#3b82f6)
- **Status Colors**: 
  - Gray: Draft/Pending
  - Blue: Submitted
  - Green: Approved/Completed
  - Yellow: In Progress
  - Red: Rejected

## Key Features

1. **Document Upload**: Multi-file upload with preview and removal
2. **Approval Timeline**: Visual representation of approval history
3. **Status Badges**: Color-coded status indicators
4. **Data Tables**: Sortable, filterable tables with pagination support
5. **Form Validation**: Client-side validation with error messages
6. **Loading States**: Loading indicators for async operations
7. **Error Handling**: User-friendly error messages

## Development Workflow

### Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Environment Variables

Create `.env` file:
```
VITE_API_BASE_URL=http://localhost:3000/api
```

### Mock Data

Currently using mock services. To test different roles:
- Login with: `admin@scf.com`, `rm@scf.com`, `credit@scf.com`, etc.
- Password: any (not validated in mock)

## Backend Integration Checklist

When backend is ready:

1. ✅ Update `API_BASE_URL` in `constants/api.js`
2. ✅ Replace mock functions in service files
3. ✅ Update response data structures
4. ✅ Implement actual file upload
5. ✅ Add error handling for network failures
6. ✅ Implement token refresh mechanism
7. ✅ Add request/response interceptors for logging
8. ✅ Update case status transitions
9. ✅ Implement multi-level approval logic
10. ✅ Add real-time updates (WebSocket/SSE) if needed

## Assumptions

1. **JWT Authentication**: Token-based auth assumed
2. **File Storage**: Documents stored on backend, URLs returned
3. **Approval Flow**: Sequential, one approver at a time
4. **Status Transitions**: Backend validates status transitions
5. **Role Permissions**: Backend enforces role-based permissions
6. **Data Format**: Backend returns data in expected format

## Future Enhancements

1. **TypeScript Migration**: Add type safety
2. **Unit Tests**: Jest + React Testing Library
3. **E2E Tests**: Cypress/Playwright
4. **Real-time Updates**: WebSocket integration
5. **Advanced Filtering**: More filter options
6. **Export Functionality**: PDF/Excel export
7. **Notifications**: Toast notifications for actions
8. **Dark Mode**: Theme switching
9. **Internationalization**: Multi-language support
10. **Accessibility**: WCAG compliance

## Security Considerations

1. **Token Storage**: Currently in localStorage (consider httpOnly cookies)
2. **XSS Protection**: React automatically escapes content
3. **CSRF Protection**: Backend should implement CSRF tokens
4. **Input Validation**: Client-side validation + backend validation
5. **File Upload**: Validate file types and sizes
6. **Role Validation**: Always validate on backend

## Performance Optimizations

1. **Code Splitting**: Route-based code splitting
2. **Lazy Loading**: Lazy load heavy components
3. **Memoization**: Use React.memo for expensive components
4. **Virtual Scrolling**: For large data tables
5. **Image Optimization**: Compress and lazy load images

---

**Note**: This is a frontend-only implementation. Backend integration points are clearly marked with TODO comments in the code.


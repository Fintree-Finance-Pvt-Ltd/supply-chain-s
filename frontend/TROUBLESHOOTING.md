# Troubleshooting Guide - Unauthorized Access Issue

## Issue: Admin Getting "Unauthorized Access"

### Root Cause
The backend was returning the user object without the `role` property directly attached, causing the frontend role check to fail.

### Fixes Applied

1. **Backend Updated** (`backend/src/services/auth.service.ts`):
   - Now includes `role` property in user response
   - Role is extracted from userRoles and added to user object

2. **Frontend Updated**:
   - `ProtectedRoute.jsx` - Checks both `user.role` and `user.defaultRole`
   - `useRole.js` - Handles both role properties
   - `authSlice.js` - Extracts role from JWT token as fallback
   - Added JWT decode utility for role extraction

### How to Verify

1. **Check Browser Console:**
   - Open browser DevTools (F12)
   - Go to Console tab
   - Login as admin
   - Look for debug logs showing:
     - Login response
     - User object
     - User role
     - ProtectedRoute checks

2. **Check localStorage:**
   ```javascript
   // In browser console
   JSON.parse(localStorage.getItem('scf_user'))
   // Should show user object with 'role' property
   ```

3. **Verify Backend Response:**
   - Check Network tab in DevTools
   - Look at `/api/auth/login` response
   - Verify `data.user.role` is present

### Testing Steps

1. **Clear browser storage:**
   ```javascript
   localStorage.clear()
   ```

2. **Restart backend:**
   ```bash
   cd backend
   npm run dev
   ```

3. **Restart frontend:**
   ```bash
   npm run dev
   ```

4. **Login as admin:**
   - Email: `admin@scf.com`
   - Password: `password123`
   - Check console for debug logs
   - Should redirect to `/admin` dashboard

### If Still Not Working

1. **Check Backend Logs:**
   - Verify user has admin role in database
   - Check if userRoles table has entry for admin user

2. **Verify Database:**
   ```sql
   SELECT u.*, ur.roleId, r.name as role_name 
   FROM users u
   LEFT JOIN user_roles ur ON u.id = ur.userId
   LEFT JOIN roles r ON ur.roleId = r.id
   WHERE u.email = 'admin@scf.com';
   ```

3. **Check Role Constant:**
   - Verify `ROLES.ADMIN` in frontend matches backend role name
   - Should be `'admin'` (lowercase)

4. **Manual Role Check:**
   ```javascript
   // In browser console after login
   const state = window.__REDUX_STORE__?.getState()
   console.log('Auth state:', state?.auth)
   console.log('User role:', state?.auth?.user?.role)
   ```

### Expected Behavior

After login as admin:
1. User object should have `role: 'admin'`
2. ProtectedRoute should allow access to `/admin` routes
3. Should redirect to `/admin` dashboard
4. Sidebar should show admin menu items

### Debug Information

The code now includes console logging in development mode:
- Login response details
- User object structure
- Role extraction
- ProtectedRoute access checks

Check browser console for these logs to diagnose the issue.

---

**If issue persists, check:**
1. Backend is running and accessible
2. Database has admin user with correct role
3. JWT token is being generated correctly
4. Role name matches exactly (case-sensitive)


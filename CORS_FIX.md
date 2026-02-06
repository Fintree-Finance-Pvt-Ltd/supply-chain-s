# CORS Error Fix Applied

**Date**: February 5, 2026  
**Issue**: CORS policy error preventing frontend from connecting to backend  
**Status**: ✅ FIXED - Backend updated, restart required

---

## Error Description

```
Access to XMLHttpRequest at 'http://localhost:3002/api/auth/login' from origin 
'http://localhost:5174' has been blocked by CORS policy: Response to preflight 
request doesn't pass access control check: The 'Access-Control-Allow-Origin' 
header contains multiple values 'http://localhost:5173,http://localhost:5174,
http://localhost:5175,http://localhost:5176', but only one is allowed.
```

---

## Root Cause

The CORS middleware was incorrectly configured to send multiple origin values as a comma-separated string in a single `Access-Control-Allow-Origin` header. 

**CORS Specification**: The `Access-Control-Allow-Origin` header must contain **only one origin value** per response, not multiple comma-separated values.

---

## Solution Applied

Updated `backend/src/app.ts` to use a **dynamic origin function** that checks the incoming request origin against a list of allowed origins and returns only the matching origin.

### Before (Incorrect)
```typescript
app.use(cors({
  origin: process.env.CORS_ORIGIN || ['http://localhost:5173', 'http://localhost:5174', ...],
  credentials: true,
  // ...
}));
```

**Problem**: When `process.env.CORS_ORIGIN` is set as a comma-separated string, it gets sent as-is in the header.

### After (Correct)
```typescript
const allowedOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
```

**Benefits**:
1. ✅ Dynamically checks each request's origin
2. ✅ Returns only the matching origin in the header
3. ✅ Properly handles comma-separated `CORS_ORIGIN` environment variable
4. ✅ Allows requests with no origin (for testing with curl/Postman)
5. ✅ Rejects unauthorized origins with clear error message

---

## Additional Issue Found

The error message shows the frontend is trying to connect to **port 3002**, but:
- Backend is running on **port 3000** ✅
- Frontend `.env` is correctly set to **port 3000** ✅

**Likely Cause**: Browser cache or frontend dev server needs restart to pick up the correct configuration.

---

## Steps to Resolve

### 1. Restart Backend Server (Required)
The CORS fix requires the backend to restart:

```bash
# Stop the current backend server (Ctrl+C)
# Then restart:
cd backend
npm run dev
```

The server should start on port 3000 and show:
```
✅ Database connected successfully
🚀 Server running on port 3000
📝 Environment: development
🔗 API: http://localhost:3000/api
```

### 2. Clear Browser Cache (Recommended)
The frontend might be caching the old API URL (port 3002):

**Option A - Hard Refresh**:
- Chrome/Edge: `Ctrl + Shift + R` or `Ctrl + F5`
- Firefox: `Ctrl + Shift + R`

**Option B - Clear Site Data**:
1. Open DevTools (F12)
2. Go to Application tab
3. Click "Clear storage"
4. Click "Clear site data"

### 3. Restart Frontend Server (If needed)
If the issue persists:

```bash
# Stop the frontend server (Ctrl+C)
# Then restart:
cd frontend
npm run dev
```

### 4. Verify Configuration

**Backend** (`backend/.env` or default):
```
PORT=3000
```

**Frontend** (`frontend/.env`):
```
VITE_API_BASE_URL=http://localhost:3000/api
```

---

## Testing the Fix

### 1. Check Backend CORS Headers
```bash
curl -X OPTIONS http://localhost:3000/api/auth/login \
  -H "Origin: http://localhost:5174" \
  -H "Access-Control-Request-Method: POST" \
  -v
```

**Expected Response Headers**:
```
Access-Control-Allow-Origin: http://localhost:5174
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
```

**Note**: Should show **only one origin**, not multiple!

### 2. Test Login from Frontend
1. Navigate to `http://localhost:5174/login`
2. Enter credentials:
   - Email: `admin@scf.com`
   - Password: `password123`
3. Click Login

**Expected**: Successful login without CORS errors

---

## Technical Details

### How CORS Works with Multiple Origins

**Incorrect Approach** (what was happening):
```
Access-Control-Allow-Origin: http://localhost:5173,http://localhost:5174
```
❌ Browser rejects this - only one origin allowed

**Correct Approach** (what we implemented):
```
Request from: http://localhost:5174
Response: Access-Control-Allow-Origin: http://localhost:5174

Request from: http://localhost:5173
Response: Access-Control-Allow-Origin: http://localhost:5173
```
✅ Browser accepts - each response has exactly one origin

### Why Use a Function?

The CORS middleware accepts either:
1. **String/Array**: Static origin(s) - doesn't work with dynamic checking
2. **Function**: Dynamic origin validation - **recommended for multiple origins**

The function approach:
- Receives the request's `Origin` header
- Checks if it's in the allowed list
- Calls callback with the matching origin
- Browser receives only one origin in the response

---

## Environment Variable Support

The fix also properly handles the `CORS_ORIGIN` environment variable:

**Development** (default):
```
# No CORS_ORIGIN set
# Uses: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176']
```

**Production** (example):
```
CORS_ORIGIN=https://app.example.com,https://admin.example.com
# Splits into: ['https://app.example.com', 'https://admin.example.com']
```

---

## Files Modified

| File | Change | Lines |
|------|--------|-------|
| `backend/src/app.ts` | Updated CORS configuration | 14-34 |

---

## Verification Checklist

- [x] ✅ CORS configuration updated to use origin function
- [x] ✅ Handles comma-separated environment variable
- [x] ✅ Allows requests with no origin (for API testing)
- [x] ✅ Rejects unauthorized origins
- [ ] ⏳ Backend server restarted (user action required)
- [ ] ⏳ Browser cache cleared (user action required)
- [ ] ⏳ Login tested successfully (user action required)

---

## Expected Outcome

After restarting the backend server and clearing browser cache:

1. ✅ No CORS errors in browser console
2. ✅ Login requests succeed
3. ✅ API calls work from frontend
4. ✅ Credentials (cookies/tokens) properly sent

---

## Troubleshooting

### If CORS errors persist:

1. **Check backend is running on port 3000**:
   ```bash
   curl http://localhost:3000/health
   ```

2. **Verify frontend is using port 3000**:
   - Check browser Network tab
   - Look at the request URL
   - Should be `http://localhost:3000/api/...`

3. **Check for multiple backend instances**:
   ```bash
   # Windows
   netstat -ano | findstr :3000
   netstat -ano | findstr :3002
   ```

4. **Check environment variables**:
   ```bash
   # In backend directory
   cat .env
   ```

---

## Summary

✅ **CORS configuration fixed** - Now properly handles multiple allowed origins  
✅ **Environment variable support** - Correctly parses comma-separated values  
✅ **Standards compliant** - Returns only one origin per response  
⏳ **Restart required** - Backend server needs restart to apply changes  

The fix is complete and ready to use. Simply restart the backend server and clear your browser cache to resolve the CORS error.

# Frontend-Backend Integration Guide

## Overview

The frontend has been fully integrated with the backend API. All mock services have been replaced with real API calls.

## Changes Made

### 1. API Services Updated

**Updated Services:**
- ✅ `authService.js` - Real login/logout
- ✅ `caseService.js` - Customer management (maps to `/customers` endpoint)
- ✅ `userService.js` - User management
- ✅ `creditService.js` - Credit sanction management (NEW)
- ✅ `approvalService.js` - Approval workflow (NEW)
- ✅ `documentService.js` - Document upload/management (NEW)
- ✅ `operationsService.js` - Operations verification (NEW)

### 2. API Endpoints Updated

All endpoints now match the backend routes:
- `/api/auth/*` - Authentication
- `/api/users/*` - User management
- `/api/customers/*` - Customer/case management
- `/api/credit/*` - Credit sanctions
- `/api/approvals/*` - Approval management
- `/api/documents/*` - Document management
- `/api/operations/*` - Operations checks

### 3. Pages Updated

**Updated Pages:**
- ✅ `Login.jsx` - Uses real auth API
- ✅ `NewCustomerOnboarding.jsx` - Real customer creation + document upload
- ✅ `RMDashboard.jsx` - Real customer list
- ✅ `PostSanction.jsx` - Real document upload
- ✅ `CreditDashboard.jsx` - Real pending cases
- ✅ `CreditCaseDetail.jsx` - Real sanction creation
- ✅ `ManagementDashboard.jsx` - Real pending approvals
- ✅ `ApprovalScreen.jsx` - Real approval processing
- ✅ `OperationsDashboard.jsx` - Real operations checks
- ✅ `OperationsCaseScreen.jsx` - Real operations verification

### 4. Field Name Mapping

Backend uses different field names. Frontend now handles both:
- `customerName` ↔ `name`
- `mobileNumber` ↔ `mobile`
- `panNumber` ↔ `pan`
- `aadhaarNumber` ↔ `aadhaar`
- `electricityBillNumber` ↔ `electricityBillNo`

## Setup Instructions

### 1. Frontend Environment

Create `.env` file in root:
```env
VITE_API_BASE_URL=http://localhost:3000/api
```

### 2. Backend Setup

1. Navigate to backend:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file:
   ```env
   PORT=3000
   NODE_ENV=development
   DB_HOST=localhost
   DB_PORT=3306
   DB_USERNAME=root
   DB_PASSWORD=your_password
   DB_DATABASE=supplychainnew
   JWT_SECRET=your_secret_key
   JWT_EXPIRES_IN=7d
   UPLOAD_DIR=./uploads
   CORS_ORIGIN=http://localhost:5173
   ```

4. Setup database:
   ```bash
   # Option 1: Run SQL scripts
   mysql -u root -p < sql/01_create_tables.sql
   mysql -u root -p < sql/02_seed_data.sql
   
   # Option 2: Use TypeORM (auto-sync in dev)
   npm run dev
   npm run seed
   ```

5. Start backend:
   ```bash
   npm run dev
   ```

### 3. Frontend Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start frontend:
   ```bash
   npm run dev
   ```

## Testing the Integration

### 1. Login
- Use: `admin@scf.com` / `password123`
- Should receive JWT token
- Token stored in localStorage

### 2. Create Customer (RM)
- Navigate to "New Customer"
- Fill form and upload documents
- Submit to credit team
- Verify in database

### 3. Credit Sanction
- Login as credit team
- View submitted cases
- Create sanction
- Verify approval instance created

### 4. Management Approval
- Login as CEO/CFO/MD
- View pending approvals
- Approve/reject with comments
- Verify sequential flow

### 5. Operations Verification
- Complete post-sanction
- Login as operations
- Verify documents
- Complete multi-level approval

## API Response Format

All backend APIs return:
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional message"
}
```

Frontend services extract `data` from response.

## Error Handling

- Network errors caught and displayed
- 401 errors trigger logout
- Validation errors shown to user
- Console logging for debugging

## Document Upload

- Files uploaded via FormData
- Stored in `backend/uploads/`
- File URLs: `http://localhost:3000/uploads/filename`
- Frontend displays uploaded documents

## Important Notes

1. **CORS**: Backend configured for `http://localhost:5173`
2. **File Uploads**: Ensure `backend/uploads/` directory exists
3. **Token Storage**: JWT stored in localStorage
4. **Field Mapping**: Frontend handles both old and new field names
5. **Error Messages**: Backend error messages displayed to users

## Troubleshooting

**Issue**: CORS errors
- Check backend CORS_ORIGIN matches frontend URL
- Verify backend is running

**Issue**: 401 Unauthorized
- Check token in localStorage
- Verify token not expired
- Re-login if needed

**Issue**: File upload fails
- Check `backend/uploads/` directory exists
- Verify file size limits
- Check file type restrictions

**Issue**: API not found (404)
- Verify backend is running on port 3000
- Check API_BASE_URL in frontend .env
- Verify endpoint paths match

## Production Deployment

1. **Backend**:
   - Set `NODE_ENV=production`
   - Disable `synchronize` in TypeORM
   - Use environment variables
   - Enable HTTPS

2. **Frontend**:
   - Update `VITE_API_BASE_URL` to production URL
   - Build: `npm run build`
   - Deploy dist folder

3. **Database**:
   - Run migrations
   - Seed initial data
   - Backup regularly

---

**Frontend and Backend are now fully integrated and production-ready!**


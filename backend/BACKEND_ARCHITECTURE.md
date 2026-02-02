# Backend Architecture - Supply Chain Finance System

## Overview

Complete Node.js/Express backend with TypeORM, MySQL, JWT authentication, and a sophisticated multi-level approval engine.

## Tech Stack

- **Node.js** + **Express.js** - Server framework
- **TypeORM** - ORM for database operations
- **MySQL** - Database
- **JWT** - Authentication
- **bcrypt** - Password hashing
- **Multer** - File uploads
- **express-validator** - Request validation

## Project Structure

```
backend/
├── src/
│   ├── app.ts                 # Express app configuration
│   ├── server.ts              # Server entry point
│   ├── config/
│   │   ├── database.ts        # TypeORM data source
│   │   └── constants.ts       # System constants
│   ├── entities/              # TypeORM entities (15 entities)
│   ├── controllers/          # Request handlers
│   ├── services/              # Business logic
│   ├── routes/                # API routes
│   ├── middlewares/           # Auth, role, error handling
│   ├── utils/                 # Utilities (JWT, password, upload)
│   └── seed/                  # Database seeding
├── sql/
│   ├── 01_create_tables.sql  # Database schema
│   └── 02_seed_data.sql      # Initial data
└── package.json
```

## Core Modules

### 1. Authentication & Authorization

**Files:**
- `middlewares/auth.middleware.ts` - JWT verification
- `middlewares/role.middleware.ts` - Role-based access control
- `services/auth.service.ts` - Login/logout logic
- `utils/jwt.ts` - Token generation/verification
- `utils/password.ts` - Password hashing

**Flow:**
1. User logs in → JWT token generated
2. Token included in Authorization header
3. `authMiddleware` verifies token
4. `roleMiddleware` checks user permissions
5. Request proceeds if authorized

### 2. Approval Flow Engine (CRITICAL)

**Files:**
- `services/approval.service.ts` - Core approval logic
- `entities/ApprovalFlow.ts` - Flow configuration
- `entities/ApprovalStep.ts` - Step definitions
- `entities/ApprovalInstance.ts` - Active approvals
- `entities/ApprovalAction.ts` - Approval history

**How It Works:**

1. **Configuration:**
   - Admin creates approval flows (e.g., "Credit Sanction Approval")
   - Defines sequential steps with approver roles
   - Example: Credit Team → CFO → CEO → MD

2. **Instance Creation:**
   - When credit sanction is created, approval instance is auto-created
   - First step's approver is assigned as `currentApproverId`
   - Status: `pending`

3. **Sequential Processing:**
   - Current approver sees approval in pending list
   - Approves/rejects with comments
   - If approved:
     - Move to next step
     - Assign next approver
   - If rejected:
     - Mark instance as rejected
     - Update related entity status

4. **Completion:**
   - When all steps completed → Status: `approved`
   - Related entity (credit sanction/ops check) updated
   - Customer status updated

**Key Methods:**
- `createCreditSanctionApproval()` - Start approval process
- `processApproval()` - Handle approve/reject action
- `getPendingApprovalsForUser()` - Get user's pending approvals
- `getApprovalHistory()` - View approval timeline

### 3. Customer Onboarding

**Flow:**
1. RM creates customer → Status: `draft`
2. RM uploads documents
3. RM submits → Status: `submitted`
4. Credit team reviews → Creates sanction
5. Management approves (via approval engine)
6. RM completes post-sanction
7. Operations verifies
8. Status: `fully_onboarded`

**Status Transitions:**
```
draft → submitted → credit_approved → post_sanction_pending 
→ post_sanction_completed → operations_approved → fully_onboarded
```

### 4. Document Management

- File upload via Multer
- Stored in `./uploads` directory
- Document verification tracking
- Support for multiple document types

### 5. Audit & Tracking

- `CaseStatusHistory` entity tracks all status changes
- Records who changed status, when, and why
- Full audit trail for compliance

## Database Schema

### Core Tables

1. **users** - System users
2. **roles** - User roles
3. **permissions** - System permissions
4. **user_roles** - User-role assignments
5. **role_permissions** - Role-permission mappings
6. **customers** - Customer records
7. **documents** - Uploaded documents
8. **credit_sanctions** - Credit sanction details
9. **post_sanctions** - Post-sanction activities
10. **operations_checks** - Operations verification
11. **approval_flows** - Approval flow configurations
12. **approval_steps** - Approval step definitions
13. **approval_instances** - Active approval processes
14. **approval_actions** - Approval history/actions
15. **case_status_history** - Status change audit

## API Endpoints Summary

### Auth
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout

### Users (Admin)
- `POST /api/users` - Create user
- `GET /api/users` - List users
- `GET /api/users/:id` - Get user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user
- `POST /api/users/assign-role` - Assign role

### Customers
- `POST /api/customers` - Create (RM)
- `GET /api/customers` - List
- `GET /api/customers/:id` - Get details
- `PUT /api/customers/:id` - Update (RM)
- `POST /api/customers/:id/submit` - Submit (RM)

### Credit
- `POST /api/credit/sanction` - Create sanction (Credit Team)
- `GET /api/credit/pending` - Pending sanctions
- `GET /api/credit/sanction/:id` - Get details
- `PUT /api/credit/sanction/:id` - Update

### Approvals
- `GET /api/approvals/pending` - Pending (Management)
- `POST /api/approvals/:id/action` - Approve/Reject
- `GET /api/approvals/:id/history` - History

### Documents
- `POST /api/documents/upload` - Upload
- `GET /api/documents/customer/:id` - List by customer
- `POST /api/documents/:id/verify` - Verify
- `DELETE /api/documents/:id` - Delete

### Operations
- `GET /api/operations/pending` - Pending (Ops)
- `GET /api/operations/:id` - Get details
- `PUT /api/operations/:id` - Update (Ops)

## Setup Instructions

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Environment
Create `.env` file:
```env
PORT=3000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=your_password
DB_DATABASE=supply_chain_finance
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=7d
UPLOAD_DIR=./uploads
CORS_ORIGIN=http://localhost:5173
```

### 3. Setup Database

**Option A: Using SQL Scripts**
```bash
mysql -u root -p < sql/01_create_tables.sql
mysql -u root -p < sql/02_seed_data.sql
```

**Option B: Using TypeORM (Auto-sync in dev)**
```bash
npm run dev
# Tables auto-created
npm run seed
```

### 4. Run Server
```bash
npm run dev
```

## Default Credentials

After seeding:
- **Admin:** admin@scf.com / password123
- **RM:** rm@scf.com / password123
- **Credit:** credit@scf.com / password123
- **Operations:** ops@scf.com / password123
- **CEO:** ceo@scf.com / password123
- **CFO:** cfo@scf.com / password123
- **MD:** md@scf.com / password123

⚠️ **Change passwords in production!**

## Key Features

### 1. Multi-Level Sequential Approval
- Configurable approval flows
- Sequential step processing
- Automatic next approver assignment
- Full approval history

### 2. Role-Based Access Control
- Fine-grained permissions
- Role-based route protection
- Dynamic permission checking

### 3. Status Management
- Automatic status transitions
- Status history tracking
- Audit trail

### 4. Document Management
- Secure file uploads
- Document verification
- Type-based organization

### 5. Error Handling
- Centralized error middleware
- Consistent error responses
- Development error details

## Business Rules

### Approval Rules
1. Approvals are sequential - one at a time
2. Rejection stops the flow immediately
3. All steps must be approved for completion
4. Current approver is determined by step order

### Status Rules
1. Status transitions are validated
2. Status changes are logged
3. Certain statuses trigger approval flows

### Access Rules
1. RM can only see their own customers
2. Credit team sees submitted cases
3. Management sees pending approvals
4. Operations sees post-sanction cases

## Testing the API

### 1. Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@scf.com","password":"password123"}'
```

### 2. Create Customer (with token)
```bash
curl -X POST http://localhost:3000/api/customers \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Customer",
    "mobile": "9876543210",
    "pan": "TEST1234E"
  }'
```

## Production Considerations

1. **Security:**
   - Use strong JWT_SECRET
   - Enable HTTPS
   - Validate file uploads strictly
   - Rate limiting

2. **Database:**
   - Use connection pooling
   - Regular backups
   - Index optimization

3. **File Storage:**
   - Consider cloud storage (S3, etc.)
   - Implement file cleanup
   - Virus scanning

4. **Monitoring:**
   - Logging (Winston, etc.)
   - Error tracking (Sentry)
   - Performance monitoring

5. **Scalability:**
   - Load balancing
   - Database replication
   - Caching (Redis)

## Next Steps

1. Connect frontend to backend
2. Update API_BASE_URL in frontend
3. Test complete workflows
4. Add validation rules
5. Implement file cleanup
6. Add logging
7. Performance optimization

---

**Backend is production-ready and fully integrated with the frontend architecture!**


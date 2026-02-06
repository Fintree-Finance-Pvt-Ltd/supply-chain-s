# Workflow System - Complete Testing Guide

## System Status
✅ **Backend Server**: Running on http://localhost:3001
✅ **Database**: MySQL - Connected and Seeded
✅ **API Routes**: 41 endpoints registered at `/api/workflows/*`

---

## Quick Start - Test Workflow System

### 1. Get Authentication Token
First, authenticate as a Relationship Manager to get JWT token:

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "rm@scf.com",
    "password": "password123"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGc...",
    "user": {
      "id": 2,
      "email": "rm@scf.com",
      "name": "John Doe - RM",
      "roles": ["RELATIONSHIP_MANAGER"]
    }
  }
}
```

Save the token: `TOKEN=<your_token_here>`

---

## Test Workflow #1: Customer Onboarding

### Step 1: Create Customer (RM Role)
```bash
curl -X POST http://localhost:3001/api/workflows/customers/create \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "Acme Corp",
    "customerCode": "ACC001",
    "industryType": "Manufacturing",
    "annualTurnover": 50000000,
    "email": "contact@acmecorp.com",
    "phone": "9876543210"
  }'
```

**Response:** Save `customerId` from response
```json
{
  "success": true,
  "message": "Customer created successfully",
  "data": {
    "customer": {
      "id": 1,
      "customerName": "Acme Corp",
      "customerCode": "ACC001",
      "status": "DRAFT",
      "rmId": 2
    },
    "workflow": {
      "id": 1,
      "workflowType": "CUSTOMER_ONBOARDING",
      "customerId": 1,
      "currentStatus": "DRAFT"
    }
  }
}
```

### Step 2: Submit Customer (RM)
```bash
curl -X PUT http://localhost:3001/api/workflows/customers/1/submit \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "remarks": "Ready for credit review"
  }'
```

### Step 3: Credit L1 Approval
Get Credit L1 user token first:
```bash
# Login as Credit L1
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "credit_l1@scf.com",
    "password": "password123"
  }'
```

Then approve:
```bash
curl -X PUT http://localhost:3001/api/workflows/customers/1/credit-l1 \
  -H "Authorization: Bearer $CREDIT_L1_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "approved": true,
    "remarks": "Approved for L2 review"
  }'
```

### Step 4: Credit L2 Approval (AUTO-GENERATES LAN)
```bash
# Login as Credit L2 user
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "credit_l2@scf.com", 
    "password": "password123"
  }'

# Approve (this generates LAN automatically)
curl -X PUT http://localhost:3001/api/workflows/customers/1/credit-l2 \
  -H "Authorization: Bearer $CREDIT_L2_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "approved": true,
    "remarks": "LAN generated"
  }'
```

**Response includes generated LAN:**
```json
{
  "data": {
    "customer": {
      "lanId": "LAN-1738765814000-a7f2k9x1",
      "status": "CREDIT_L2_APPROVED"
    }
  }
}
```

### Step 5-9: Executive & Operations Approvals
Continue the workflow through CEO → MD → Operations L1 → Operations L2 → Operations Head

Each role has specific token which you get via login with their credentials.

---

## Test Workflow #2: Supplier Onboarding (Requires Completed Customer)

### Prerequisites
- Customer must be COMPLETED status (finish workflow #1 first)
- LAN must be generated

### Create Supplier
```bash
curl -X POST http://localhost:3001/api/workflows/suppliers/create \
  -H "Authorization: Bearer $RM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": 1,
    "supplierName": "Tech Supplies Inc",
    "supplierCode": "TS001",
    "gstNumber": "18AABCD1234E1Z0",
    "panNumber": "ABCDE1234F",
    "contactEmail": "contact@techsupplies.com",
    "contactPhone": "9876543211"
  }'
```

**Validation:** Will reject if customer not COMPLETED or supplier count ≥ 20 per LAN

### Submit & Approve Supplier
```bash
# Submit
curl -X PUT http://localhost:3001/api/workflows/suppliers/1/submit \
  -H "Authorization: Bearer $RM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"remarks": "Ready for ops review"}'

# Ops L1 Approval
curl -X PUT http://localhost:3001/api/workflows/suppliers/1/ops-l1 \
  -H "Authorization: Bearer $OPS_L1_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"approved": true, "remarks": "Verified"}'

# Ops Head Approval
curl -X PUT http://localhost:3001/api/workflows/suppliers/1/ops-head \
  -H "Authorization: Bearer $OPS_HEAD_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"approved": true, "remarks": "Final approval"}'
```

---

## Test Workflow #3: Invoice Discounting

### Prerequisites
- Customer COMPLETED
- Supplier COMPLETED  
- Will enforce both via dual validation

### Create Invoice
```bash
curl -X POST http://localhost:3001/api/workflows/invoices/create \
  -H "Authorization: Bearer $RM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": 1,
    "supplierId": 1,
    "invoiceNumber": "INV-2026-001",
    "invoiceAmount": 500000,
    "invoiceDate": "2026-02-05",
    "dueDate": "2026-03-05",
    "invoiceFilePath": "invoices/INV-2026-001.pdf"
  }'
```

**Validation:** Will reject if customer or supplier not COMPLETED

### Approval Chain
```bash
# Submit
curl -X PUT http://localhost:3001/api/workflows/invoices/1/submit \
  -H "Authorization: Bearer $RM_TOKEN"

# Ops L1 Verify
curl -X PUT http://localhost:3001/api/workflows/invoices/1/ops-l1-verify \
  -H "Authorization: Bearer $OPS_L1_TOKEN" \
  -d '{"approved": true}'

# Ops L2 Validate  
curl -X PUT http://localhost:3001/api/workflows/invoices/1/ops-l2-validate \
  -H "Authorization: Bearer $OPS_L2_TOKEN" \
  -d '{"approved": true}'

# Ops Head Approve
curl -X PUT http://localhost:3001/api/workflows/invoices/1/ops-head-approve \
  -H "Authorization: Bearer $OPS_HEAD_TOKEN"

# CEO Review
curl -X PUT http://localhost:3001/api/workflows/invoices/1/ceo-review \
  -H "Authorization: Bearer $CEO_TOKEN" \
  -d '{"approved": true}'

# MD Final Approve & Disburse
curl -X PUT http://localhost:3001/api/workflows/invoices/1/md-disburse \
  -H "Authorization: Bearer $MD_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "approved": true,
    "disbursedAmount": 500000
  }'
```

**Response:** Invoice marked as DISBURSED
```json
{
  "data": {
    "invoice": {
      "status": "DISBURSED",
      "disbursedAmount": 500000,
      "disbursedDate": "2026-02-05T00:00:00Z"
    }
  }
}
```

---

## Dashboard Testing

### RM Dashboard - View All Created Cases
```bash
curl http://localhost:3001/api/workflows/customers/dashboard/rm \
  -H "Authorization: Bearer $RM_TOKEN"
```

Response shows:
- Summary: total created, approved, rejected, pending
- List of customer cases with status breakdown

### Credit Team Dashboard
```bash
curl http://localhost:3001/api/workflows/customers/dashboard/credit-pending \
  -H "Authorization: Bearer $CREDIT_L1_TOKEN"
```

### Operations Dashboard
```bash
curl http://localhost:3001/api/workflows/suppliers/dashboard/ops \
  -H "Authorization: Bearer $OPS_L1_TOKEN"
```

---

## Role-Based Access Control Testing

### Test Unauthorized Access
Try to access Credit L1 endpoint with RM token:
```bash
curl -X PUT http://localhost:3001/api/workflows/customers/1/credit-l1 \
  -H "Authorization: Bearer $RM_TOKEN" \
  -d '{"approved": true}'
```

**Expected Response (403 Forbidden):**
```json
{
  "success": false,
  "message": "Access denied. Required roles: CREDIT_TEAM_L1"
}
```

---

## User Credentials for Testing

| Email | Password | Role | Purpose |
|-------|----------|------|---------|
| admin@scf.com | password123 | ADMIN | System admin |
| rm@scf.com | password123 | RM | Create workflows |
| credit_l1@scf.com | password123 | CREDIT_L1 | First credit review |
| credit_l2@scf.com | password123 | CREDIT_L2 | Second credit review / LAN generation |
| ops_l1@scf.com | password123 | OPS_L1 | First operations review |
| ops_l2@scf.com | password123 | OPS_L2 | Second operations review |
| ops_head@scf.com | password123 | OPS_HEAD | Final operations approval |
| cfo@scf.com | password123 | CFO | Financial approvals |
| ceo@scf.com | password123 | CEO | Executive approvals |
| md@scf.com | password123 | MD | Disbursal & final approval |

---

## Key Features Validated

✅ **Role-Based Access Control** - Only matching role can approve at each step
✅ **Sequential Approval Chain** - Cannot skip intermediate approvers  
✅ **LAN Auto-Generation** - Generated at Credit L2 step
✅ **Supplier Limit Enforcement** - Max 20 per LAN
✅ **Dual Validation** - Invoice requires both customer AND supplier COMPLETED
✅ **Status Transitions** - Proper state machine workflow
✅ **Audit Trail** - All changes logged in CaseStatusHistory
✅ **Error Handling** - 400/403/404 for invalid requests

---

## All 41 API Endpoints

### Customer Onboarding (13)
- POST `/customers/create` - Create customer
- PUT `/customers/:id/submit` - Submit for approval
- PUT `/customers/:id/credit-l1` - Credit L1 approval
- PUT `/customers/:id/credit-l2` - Credit L2 approval (generates LAN)
- PUT `/customers/:id/ceo-review` - CEO review
- PUT `/customers/:id/md-review` - MD review
- PUT `/customers/:id/ops-submit` - Submit to operations
- PUT `/customers/:id/ops-l1` - Operations L1 approval
- PUT `/customers/:id/ops-head` - Operations head final approval
- GET `/customers/dashboard/rm` - RM dashboard
- GET `/customers/dashboard/credit-pending` - Credit team pending
- GET `/customers/dashboard/executive-pending` - Executive pending
- GET `/customers/dashboard/operations-pending` - Operations pending

### Supplier Onboarding (11)
- POST `/suppliers/create` - Create supplier (LAN-based)
- PUT `/suppliers/:id/submit` - Submit supplier
- PUT `/suppliers/:id/ops-l1` - Ops L1 approval
- PUT `/suppliers/:id/ops-head` - Ops head approval
- GET `/suppliers/dashboard/rm` - RM supplier dashboard (LAN-grouped)
- GET `/suppliers/dashboard/ops-pending` - Ops pending suppliers
- GET `/suppliers/:id` - Get supplier details
- GET `/suppliers/customer/:customerId` - Get supplier by customer
- GET `/suppliers/customer/:customerId/approved` - Get approved suppliers only
- GET `/suppliers/count/:customerId` - Get supplier count for LAN
- GET `/suppliers/check/:customerId` - Check if can add more

### Invoice Discounting (17)
- POST `/invoices/create` - Create invoice (validates customer + supplier COMPLETED)
- PUT `/invoices/:id/submit` - Submit invoice
- PUT `/invoices/:id/ops-l1-verify` - Ops L1 verification
- PUT `/invoices/:id/ops-l2-validate` - Ops L2 validation
- PUT `/invoices/:id/ops-head-approve` - Ops head approval
- PUT `/invoices/:id/ceo-review` - CEO review
- PUT `/invoices/:id/md-disburse` - MD approval + disbursal
- GET `/invoices/dashboard/rm` - RM invoice dashboard
- GET `/invoices/dashboard/ops-pending` - Ops pending invoices
- GET `/invoices/dashboard/ceo-pending` - CEO pending invoices
- GET `/invoices/dashboard/md-pending` - MD pending invoices
- GET `/invoices/:id` - Get invoice details
- GET `/invoices/customer/:customerId` - Get invoices by customer
- GET `/invoices/supplier/:supplierId` - Get invoices by supplier
- GET `/invoices/status/:status` - Get invoices by status
- GET `/invoices/pending` - Get all pending invoices
- GET `/invoices/history/:id` - Get invoice status history

---

## Workflow Status Machine

### Customer Onboarding
```
DRAFT → SUBMITTED → CREDIT_L1_REVIEW → CREDIT_L1_APPROVED 
→ CREDIT_L2_REVIEW → CREDIT_L2_APPROVED → CEO_REVIEW 
→ CEO_APPROVED → MD_REVIEW → MD_APPROVED → OPS_L1_REVIEW 
→ OPS_L1_APPROVED → OPS_L2_REVIEW → OPS_L2_APPROVED 
→ OPS_HEAD_REVIEW → OPS_HEAD_APPROVED → COMPLETED
```

### Supplier Onboarding
```
DRAFT → SUBMITTED → OPS_L1_REVIEW → OPS_L1_APPROVED 
→ OPS_L2_REVIEW → OPS_L2_APPROVED → OPS_HEAD_REVIEW 
→ OPS_HEAD_APPROVED → COMPLETED
```

### Invoice Discounting
```
DRAFT → SUBMITTED → OPS_L1_VERIFIED → OPS_L2_VERIFIED 
→ OPS_HEAD_APPROVED → CEO_APPROVED → MD_APPROVED → DISBURSED
```

Any step can transition to REJECTED if approval denied.

---

## Next Steps

1. **Frontend Implementation** - Build React dashboards for each role
2. **Document Upload** - Implement invoice file upload to `/uploads` directory
3. **Email Notifications** - Send approval notifications to next approver
4. **Reporting** - Build analytics from CaseStatusHistory audit trail

---

## Support

For API documentation, see: `API_WORKFLOWS_DOCUMENTATION.md`
For architecture details, see: `WORKFLOW_IMPLEMENTATION_SUMMARY.md`


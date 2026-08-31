# Workflow Management API Documentation

## Overview
Complete REST API for role-based financial workflow management system with three core workflows:
1. **Customer Onboarding** - KYC and credit approval workflow
2. **Supplier Onboarding** - LAN-based supplier management (10-20 suppliers per customer)
3. **Invoice Discounting** - Multi-level approval for invoice financing

---

## Authentication
All endpoints require JWT token in Authorization header:
```
Authorization: Bearer <jwt_token>
```

---

## Error Responses
All error responses follow this format:
```json
{
  "success": false,
  "message": "Error description"
}
```

---

## 1. CUSTOMER ONBOARDING WORKFLOW

### Step 1: Create Customer (RM)
- **Endpoint:** `POST /api/workflows/customers/create`
- **Required Role:** RM
- **Request Body:**
```json
{
  "customerName": "ABC Electronics",
  "customerCode": "CUST001",
  "email": "contact@abc.com",
  "contactNumber": "9876543210",
  "address": "123 Business Park",
  "industryType": "Manufacturing",
  "annualTurnover": 50000000
}
```
- **Response:** Customer object with status="DRAFT"
- **Next Step:** RM must submit for Credit L1 review

### Step 2: Submit for Credit Review (RM)
- **Endpoint:** `POST /api/workflows/customers/:customerId/submit`
- **Required Role:** RM
- **Request Body:**
```json
{
  "remarks": "KYC verified successfully"
}
```
- **Response:** Workflow object with status="SUBMITTED"
- **Next Approver:** CREDIT_TEAM_L1

### Step 3: Credit L1 Review (CREDIT_TEAM_L1)
- **Endpoint:** `POST /api/workflows/customers/:customerId/credit-l1`
- **Required Role:** CREDIT_TEAM_L1
- **Request Body:**
```json
{
  "approved": true,
  "remarks": "Initial credit assessment passed"
}
```
- **Response:** Workflow object
- **If Approved:** Status = "CREDIT_L1_APPROVED", Next = CREDIT_TEAM_L2
- **If Rejected:** Status = "REJECTED", Workflow ends

### Step 4: Credit L2 Review (CREDIT_TEAM_L2)
- **Endpoint:** `POST /api/workflows/customers/:customerId/credit-l2`
- **Required Role:** CREDIT_TEAM_L2
- **Request Body:**
```json
{
  "approved": true,
  "remarks": "Credit limit approved: 10,000,000"
}
```
- **Response:** Workflow object with generated LAN ID
- **LAN ID Format:** `LAN-{timestamp}-{randomstring}`
- **If Approved:** Status = "CREDIT_L2_APPROVED", LAN generated, Next = CEO
- **If Rejected:** Status = "REJECTED", Workflow ends

### Step 5: CEO Approval (CEO)
- **Endpoint:** `POST /api/workflows/customers/:customerId/ceo-approve`
- **Required Role:** CEO
- **Request Body:**
```json
{
  "approved": true,
  "remarks": "Executive approval granted"
}
```
- **Response:** Workflow object
- **If Approved:** Status = "CEO_APPROVED", Next = MD
- **If Rejected:** Status = "REJECTED"

### Step 6: MD Final Approval (MD)
- **Endpoint:** `POST /api/workflows/customers/:customerId/md-approve`
- **Required Role:** MD
- **Request Body:**
```json
{
  "approved": true,
  "remarks": "Final approval - customer approved for operations"
}
```
- **Response:** Workflow object
- **If Approved:** Status = "MD_APPROVED", Next = RM (for operations submission)
- **If Rejected:** Status = "REJECTED"

### Step 7: Submit to Operations (RM)
- **Endpoint:** `POST /api/workflows/customers/:customerId/ops-submit`
- **Required Role:** RM
- **Request Body:**
```json
{
  "remarks": "Ready for operations verification"
}
```
- **Response:** Workflow object with status = "OPS_L1_REVIEW"
- **Next Approver:** OPERATIONS_L1

### Step 8: Operations L1 Verification (OPERATIONS_L1)
- **Endpoint:** `POST /api/workflows/customers/:customerId/ops-l1`
- **Required Role:** OPERATIONS_L1
- **Request Body:**
```json
{
  "approved": true,
  "remarks": "Documentation verified"
}
```
- **Response:** Workflow object
- **If Approved:** Status = "OPS_L1_APPROVED", Next = OPERATIONS_HEAD
- **If Rejected:** Status = "REJECTED"

### Step 9: Operations Head Completion (OPERATIONS_HEAD)
- **Endpoint:** `POST /api/workflows/customers/:customerId/ops-head`
- **Required Role:** OPERATIONS_HEAD
- **Request Body:**
```json
{
  "remarks": "Onboarding complete"
}
```
- **Response:** Workflow object with status = "COMPLETED"
- **Workflow Status:** COMPLETED (Final state - Customer is now ACTIVE)

### Customer Dashboards

#### RM Dashboard
- **Endpoint:** `GET /api/workflows/customers/dashboard/rm`
- **Required Role:** RM
- **Response:**
```json
{
  "success": true,
  "data": {
    "totalCustomers": 15,
    "draft": 3,
    "submitted": 2,
    "approved": 8,
    "rejected": 2,
    "customers": []
  }
}
```

#### Credit Team Dashboard
- **Endpoint:** `GET /api/workflows/customers/dashboard/credit/:level`
- **Required Role:** CREDIT_TEAM_L1 or CREDIT_TEAM_L2
- **URL Params:** level = "1" or "2"
- **Response:** Array of pending customers for that level

#### Executive Dashboard
- **Endpoint:** `GET /api/workflows/customers/dashboard/executive`
- **Required Role:** CEO or MD
- **Response:** Array of pending customers awaiting executive approval

#### Operations Dashboard
- **Endpoint:** `GET /api/workflows/customers/dashboard/operations`
- **Required Role:** OPERATIONS_L1, OPERATIONS_L2, or OPERATIONS_HEAD
- **Response:** Array of pending customers for operations verification

---

## 2. SUPPLIER ONBOARDING WORKFLOW

### Prerequisites
- Customer must have status = "COMPLETED" (fully approved)
- Customer must have `lanId` assigned (generated by Credit L2)
- Max 20 suppliers per LAN, minimum 10 suppliers recommended

### Step 1: Create Supplier (RM)
- **Endpoint:** `POST /api/workflows/suppliers/create`
- **Required Role:** RM
- **Request Body:**
```json
{
  "customerId": 5,
  "supplierName": "XYZ Supplies Ltd",
  "supplierCode": "SUP001",
  "email": "supplier@xyz.com",
  "contactNumber": "9876543211",
  "address": "456 Industrial Road",
  "gstNumber": "27AABCT1234H1Z0",
  "panNumber": "AABCT1234H"
}
```
- **Validations:**
  - Customer must exist and have status = "COMPLETED"
  - supplierCode must be unique
  - Customer LAN must not have 20+ suppliers
- **Response:** Supplier object with status = "DRAFT"

### Step 2: Submit Supplier (RM)
- **Endpoint:** `POST /api/workflows/suppliers/:supplierId/submit`
- **Required Role:** RM
- **Request Body:**
```json
{
  "remarks": "Supplier documents verified"
}
```
- **Response:** Workflow object with status = "SUBMITTED"
- **Next Approver:** OPERATIONS_L1

### Step 3: Operations L1 Approval (OPERATIONS_L1)
- **Endpoint:** `POST /api/workflows/suppliers/:supplierId/ops-l1`
- **Required Role:** OPERATIONS_L1
- **Request Body:**
```json
{
  "approved": true,
  "remarks": "GST and PAN verified"
}
```
- **Response:** Workflow object
- **If Approved:** Status = "OPS_L1_APPROVED", Next = OPERATIONS_HEAD
- **If Rejected:** Status = "REJECTED"

### Step 4: Operations Head Completion (OPERATIONS_HEAD)
- **Endpoint:** `POST /api/workflows/suppliers/:supplierId/ops-head`
- **Required Role:** OPERATIONS_HEAD
- **Request Body:**
```json
{
  "remarks": "Supplier onboarding complete"
}
```
- **Response:** Workflow object with status = "COMPLETED"
- **Supplier Status:** COMPLETED (Supplier is now ACTIVE in LAN)

### Supplier Dashboards

#### RM Supplier Dashboard
- **Endpoint:** `GET /api/workflows/suppliers/dashboard/rm`
- **Required Role:** RM
- **Response:**
```json
{
  "success": true,
  "data": {
    "totalSuppliers": 35,
    "draft": 5,
    "submitted": 3,
    "completed": 25,
    "rejected": 2,
    "lanWiseSuppliers": {
      "LAN-123456": {
        "customerId": 5,
        "customerName": "ABC Electronics",
        "suppliers": []
      }
    }
  }
}
```

#### Operations Dashboard
- **Endpoint:** `GET /api/workflows/suppliers/dashboard/operations`
- **Required Role:** OPERATIONS_L1 or OPERATIONS_HEAD
- **Response:** Array of pending suppliers

### Supplier Retrieval Endpoints

#### Get All Suppliers for Customer LAN
- **Endpoint:** `GET /api/workflows/suppliers/customer/:customerId/all`
- **Response:** Array of all suppliers (all statuses) for customer's LAN

#### Get Approved Suppliers for Customer
- **Endpoint:** `GET /api/workflows/suppliers/customer/:customerId/approved`
- **Response:** Array of suppliers with status = "COMPLETED"

#### Check Supplier Limit
- **Endpoint:** `GET /api/workflows/suppliers/customer/:customerId/check-limit`
- **Response:**
```json
{
  "success": true,
  "data": {
    "canAdd": true,
    "currentCount": 15,
    "maxLimit": 20,
    "minLimit": 10
  }
}
```

---

## 3. INVOICE DISCOUNTING WORKFLOW

### Prerequisites
- Customer must have status = "COMPLETED" (fully onboarded)
- Supplier must have status = "COMPLETED" (fully approved)
- Invoice amount must be <= customer credit limit
- Invoice date must be <= today
- Due date must be > invoice date

### Step 1: Create Invoice (RM)
- **Endpoint:** `POST /api/workflows/invoices/create`
- **Required Role:** RM
- **Request Body (Multipart/Form-Data):**
```json
{
  "customerId": 5,
  "supplierId": 12,
  "invoiceNumber": "INV-2024-001",
  "invoiceAmount": 500000,
  "invoiceDate": "2024-01-15",
  "dueDate": "2024-02-15",
  "invoiceFile": <binary file>
}
```
- **Validations:**
  - Both customer and supplier must be COMPLETED
  - invoiceNumber must be unique
  - Amount must be positive
  - Dates must be valid
- **Response:** Invoice object with status = "DRAFT"

### Step 2: RM Submit Invoice
- **Endpoint:** `POST /api/workflows/invoices/:invoiceId/submit`
- **Required Role:** RM
- **Request Body:**
```json
{
  "remarks": "Invoice submitted for customer approval"
}
```
- **Response:** Workflow object with status = "PENDING_CUSTOMER_APPROVAL"
- **Next Approver:** CUSTOMER

### Step 3: Customer Approval (CUSTOMER)
- **Endpoint:** `POST /api/workflows/invoices/:invoiceId/customer-approve`
- **Required Role:** Customer context / customer approval request
- **Request Body:**
```json
{
  "approved": true,
  "remarks": "Invoice approved"
}
```
- **If Approved:** Status = "PENDING_OPS_L1_APPROVAL", Next = OPERATIONS_L1
- **If Rejected:** Status = "REJECTED_BY_CUSTOMER"

### Step 4: Operations L1 Verification (OPERATIONS_L1)
- **Endpoint:** `POST /api/workflows/invoices/:invoiceId/ops-l1`
- **Required Role:** OPERATIONS_L1
- **Request Body:**
```json
{
  "approved": true,
  "remarks": "Invoice details verified"
}
```
- **Response:** Workflow object
- **If Approved:** Status = "PENDING_MD_APPROVAL", Next = MD
- **If Rejected:** Status = "REJECTED"

### Step 5: MD Approval (MD)
- **Endpoint:** `POST /api/workflows/invoices/:invoiceId/md-approve`
- **Required Role:** MD
- **Request Body:**
```json
{
  "approved": true,
  "remarks": "Approved for disbursement"
}
```
- **If Approved:** Status = "DISBURSEMENT_DATA_ENTRY", Next = OPERATIONS_L1
- **If Rejected:** Status = "REJECTED"

### Step 6: Operations L1 UTR Entry (OPERATIONS_L1)
- **Endpoint:** `POST /api/workflows/invoices/:invoiceId/disburse`
- **Required Role:** OPERATIONS_L1
- **Request Body:**
```json
{
  "disbursementUtr": "UTR123456789",
  "disbursementDate": "2024-02-01"
}
```
- **Response:** Workflow object with status = "PENDING_FINAL_OPS_L2_APPROVAL"
- **Next Approver:** OPERATIONS_L2

### Step 7: Final Operations L2 Verification (OPERATIONS_L2)
- **Endpoint:** `POST /api/workflows/invoices/:invoiceId/final-ops-l2`
- **Required Role:** OPERATIONS_L2
- **Request Body:**
```json
{
  "approved": true,
  "remarks": "UTR/date/amount verified"
}
```
- **If Approved:** Status = "ACTIVE"
- **If Rejected:** Status = "REJECTED"
- **Workflow Status:** COMPLETED when ACTIVE

### Invoice Dashboards

#### RM Invoice Dashboard
- **Endpoint:** `GET /api/workflows/invoices/dashboard/rm`
- **Required Role:** RM
- **Response:**
```json
{
  "success": true,
  "data": {
    "totalInvoices": 50,
    "draft": 5,
    "submitted": 3,
    "disbursed": 35,
    "rejected": 2,
    "totalAmount": 25000000,
    "totalDisbursed": 23750000,
    "invoices": []
  }
}
```

#### Operations Dashboard
- **Endpoint:** `GET /api/workflows/invoices/dashboard/operations`
- **Required Role:** OPERATIONS_L1 or OPERATIONS_L2
- **Response:** Role-specific pending invoices
  - OPERATIONS_L1: Invoices with status = "PENDING_OPS_L1_APPROVAL" or "DISBURSEMENT_DATA_ENTRY"
  - OPERATIONS_L2: Invoices with status = "PENDING_FINAL_OPS_L2_APPROVAL"

#### Executive Dashboard
- **Endpoint:** `GET /api/workflows/invoices/dashboard/executive`
- **Required Role:** MD
- **Response:** Role-specific pending invoices
  - MD: Invoices with status = "PENDING_MD_APPROVAL"

### Invoice Retrieval Endpoints

#### Get Invoice Details
- **Endpoint:** `GET /api/workflows/invoices/:invoiceId/details`
- **Response:** Invoice object with all relationships loaded (customer, supplier, createdBy, statusHistory)

---

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success (GET/existing operations) |
| 201 | Created (POST for creating new entities) |
| 400 | Bad Request (validation/business logic error) |
| 403 | Forbidden (user doesn't have required role) |
| 404 | Not Found (resource doesn't exist) |
| 500 | Internal Server Error |

---

## Role-Based Access Control

### Available Roles
- **RM** - Relationship Manager (Creates and submits entities)
- **CREDIT_TEAM_L1** - Initial credit review
- **CREDIT_TEAM_L2** - Final credit approval (generates LAN)
- **CEO** - Executive approval for customers and invoices
- **MD** - Final approval for customers and invoices, disbursal for invoices
- **OPERATIONS_L1** - Initial operations verification
- **OPERATIONS_L2** - Additional validation (invoices only)
- **OPERATIONS_HEAD** - Final operations approval

### Access Control Matrix

| Endpoint | RM | CT-L1 | CT-L2 | CEO | MD | Ops-L1 | Ops-L2 | Ops-Head |
|----------|----|----|----|----|----|----|----|----|
| Customer Create | ✓ | | | | | | | |
| Customer Submit | ✓ | | | | | | | |
| Credit L1 Approve | | ✓ | | | | | | |
| Credit L2 Approve | | | ✓ | | | | | |
| CEO Approve (Cust) | | | | ✓ | | | | |
| MD Approve (Cust) | | | | | ✓ | | | |
| Ops Submit (Cust) | ✓ | | | | | | | |
| Ops L1 Verify | | | | | | ✓ | | |
| Ops Head (Cust) | | | | | | | | ✓ |

---

## Implementation Notes

1. **Idempotency**: All endpoints should be idempotent - calling the same endpoint twice should not create duplicate records
2. **Audit Trail**: Every state change must be logged in CaseStatusHistory
3. **Status Transitions**: Only allowed state transitions can be performed (enforced by WorkflowService canTransition method)
4. **Rejection Flow**: Once rejected, workflow cannot proceed - RM must create a new entity
5. **LAN Generation**: Generated automatically by Credit L2 in format `LAN-{timestamp}-{randomstring}`
6. **Supplier Limits**: 10-20 suppliers per LAN can be verified via `/check-limit` endpoint

---

## Example Flow: Complete Customer Onboarding

```
1. RM calls /customers/create → Status: DRAFT
2. RM calls /customers/{id}/submit → Status: SUBMITTED
3. CREDIT_L1 calls /customers/{id}/credit-l1 → Status: CREDIT_L1_APPROVED
4. CREDIT_L2 calls /customers/{id}/credit-l2 → Status: CREDIT_L2_APPROVED (LAN generated)
5. CEO calls /customers/{id}/ceo-approve → Status: CEO_APPROVED
6. MD calls /customers/{id}/md-approve → Status: MD_APPROVED
7. RM calls /customers/{id}/ops-submit → Status: OPS_L1_REVIEW
8. OPS_L1 calls /customers/{id}/ops-l1 → Status: OPS_L1_APPROVED
9. OPS_HEAD calls /customers/{id}/ops-head → Status: COMPLETED
```


# System Architecture & Components

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                          │
│       (To be built - Dashboards & Approval Forms)            │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP/JWT
                     ↓
┌─────────────────────────────────────────────────────────────┐
│              EXPRESS.JS API SERVER (Port 3001)               │
├─────────────────────────────────────────────────────────────┤
│  Authentication Middleware (JWT Validation)                  │
│  Authorization Middleware (Role-Based Access Control)        │
├─────────────────────────────────────────────────────────────┤
│  41 API Endpoints across 3 Workflow Routes:                  │
│  ├─ POST/PUT /workflows/customers/*        (13 endpoints)    │
│  ├─ POST/PUT /workflows/suppliers/*        (11 endpoints)    │
│  └─ POST/PUT /workflows/invoices/*         (17 endpoints)    │
├─────────────────────────────────────────────────────────────┤
│  3 Service Classes:                                           │
│  ├─ CustomerOnboardingService              (194 lines)       │
│  ├─ SupplierOnboardingService              (121 lines)       │
│  └─ InvoiceDiscountingService              (161 lines)       │
└────────────────────┬────────────────────────────────────────┘
                     │ SQL Queries
                     ↓
┌─────────────────────────────────────────────────────────────┐
│            TYPEORM + MYSQL DATABASE                          │
├─────────────────────────────────────────────────────────────┤
│  9 Main Entities:                                            │
│  ├─ User (8 roles assigned via UserRole)                    │
│  ├─ Role (8 different roles)                                │
│  ├─ Customer                                                │
│  ├─ Supplier (LAN-grouped, max 20 per LAN)                  │
│  ├─ Invoice (Requires customer + supplier COMPLETED)        │
│  ├─ CaseWorkflow (Central workflow hub)                     │
│  ├─ Permission                                              │
│  ├─ ApprovalFlow                                            │
│  ├─ ApprovalStep                                            │
│  └─ CaseStatusHistory (Audit trail)                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Workflow Data Flow

### Customer Onboarding Flow

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────┐
│     RM      │────▶│ Create Customer  │────▶│ DRAFT status │
│             │     │ + Workflow entry │     │              │
└─────────────┘     └──────────────────┘     └──────────────┘
                                                    │
                                                    ↓
                           ┌────────────────────────────────────────┐
                           │ Submit for Credit Review               │
                           │ → Status: SUBMITTED                    │
                           └────────────────────────────────────────┘
                                         │
                ┌────────────────────────┴────────────────────────┐
                ↓                                                 ↓
    ┌───────────────────────┐                    ┌───────────────────────┐
    │ Credit L1 Review      │                    │ Rejection Option      │
    │ → CREDIT_L1_APPROVED  │                    │ → REJECTED (terminal) │
    └───────────────────────┘                    └───────────────────────┘
                │
                ↓
    ┌───────────────────────────────────────┐
    │ Credit L2 Review                      │
    │ + LAN Generation                      │
    │ → CREDIT_L2_APPROVED                  │
    │ (LAN: LAN-{timestamp}-{random})       │
    └───────────────────────────────────────┘
                │
                ↓
    ┌───────────────────────┬────────────────────┐
    ↓                       ↓                    ↓
┌─────────────┐    ┌──────────────────┐  ┌──────────────┐
│ CEO Review  │───▶│ MD Review        │─▶│ Ops L1 Review│
│(APPROVED)   │    │ (APPROVED)       │  │ (APPROVED)   │
└─────────────┘    └──────────────────┘  └──────────────┘
                                                │
                                                ↓
                                        ┌────────────────┐
                                        │ Ops L2 Review  │
                                        │ Ops Head Final │
                                        │ (COMPLETED)    │
                                        └────────────────┘
```

### Supplier Onboarding Flow (Shortened)

```
Customer COMPLETED + LAN Exists
         │
         ↓
┌──────────────────────┐     ┌──────────────────────┐
│ RM Creates Supplier  │────▶│ Max 20/LAN check     │
│ (Validates Customer) │     │ DRAFT → SUBMITTED    │
└──────────────────────┘     └──────────────────────┘
         │
         ├─ Supplier Count ≥ 20? ──▶ ERROR 400
         │
         ↓
┌──────────────────────┐     ┌──────────────────────┐
│ Ops L1 Verify        │────▶│ Ops Head Approve     │
│ (APPROVED)           │     │ (COMPLETED)          │
└──────────────────────┘     └──────────────────────┘
```

### Invoice Discounting Flow (With Disbursal)

```
Requires: Customer COMPLETED + Supplier COMPLETED
         │
         ↓
┌──────────────────────────────────────┐
│ RM Creates Invoice                   │
│ Dual Validation:                     │
│ ✓ Customer COMPLETED?                │
│ ✓ Supplier COMPLETED?                │
└──────────────────────────────────────┘
         │
         ├─ Either missing? ──▶ ERROR 400
         │
         ↓
┌──────────────────────────────────────┐
│ OPS L1 Verify → OPS L2 Validate      │
│ → OPS Head Approve → CEO Review      │
└──────────────────────────────────────┘
         │
         ↓
┌──────────────────────────────────────┐
│ MD Disburse                          │
│ Input: disbursedAmount (≤ invoice)  │
│ Output: DISBURSED (terminal)         │
│ Records: disbursedDate               │
└──────────────────────────────────────┘
```

---

## Role Hierarchy & Responsibilities

```
┌────────────────────────────────────────────────────────────┐
│                      WORKFLOW INITIATORS                    │
├────────────────────────────────────────────────────────────┤
│  Relationship Manager (RM)                                 │
│  • Creates customers, suppliers, invoices                  │
│  • Submits for approval chain                              │
│  • Views role-specific dashboards                          │
└────────────────────────────────────────────────────────────┘
                            │
          ┌─────────────────┼─────────────────┐
          ↓                 ↓                 ↓
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │ Credit Team  │ │ Operations   │ │ Executives   │
    │              │ │ Teams        │ │              │
    ├──────────────┤ ├──────────────┤ ├──────────────┤
    │ L1: Review   │ │ L1: Verify   │ │ CEO: Policy  │
    │ L2: Approve  │ │ L2: Validate │ │ MD: Disburse │
    │+ LAN Gen     │ │ Head: Final  │ │              │
    └──────────────┘ └──────────────┘ └──────────────┘
```

---

## Endpoint Organization

```
/api/workflows/
├── /customers/
│   ├── POST create                          [RM]
│   ├── PUT :id/submit                       [RM]
│   ├── PUT :id/credit-l1                    [CREDIT_L1]
│   ├── PUT :id/credit-l2                    [CREDIT_L2] → Generates LAN
│   ├── PUT :id/ceo-review                   [CEO]
│   ├── PUT :id/md-review                    [MD]
│   ├── PUT :id/ops-submit                   [RM]
│   ├── PUT :id/ops-l1                       [OPS_L1]
│   ├── PUT :id/ops-head                     [OPS_HEAD]
│   ├── GET dashboard/rm                     [RM]
│   ├── GET dashboard/credit-pending         [CREDIT_L1/L2]
│   ├── GET dashboard/executive-pending      [CEO/MD]
│   └── GET dashboard/operations-pending     [OPS*]
│
├── /suppliers/
│   ├── POST create                          [RM] → Validates LAN limit
│   ├── PUT :id/submit                       [RM]
│   ├── PUT :id/ops-l1                       [OPS_L1]
│   ├── PUT :id/ops-head                     [OPS_HEAD]
│   ├── GET dashboard/rm                     [RM] → Grouped by LAN
│   ├── GET dashboard/ops-pending            [OPS*]
│   ├── GET :id                              [All]
│   ├── GET customer/:customerId             [All]
│   ├── GET customer/:customerId/approved    [All]
│   ├── GET count/:customerId                [All]
│   └── GET check/:customerId                [All]
│
└── /invoices/
    ├── POST create                          [RM] → Validates customer+supplier
    ├── PUT :id/submit                       [RM]
    ├── PUT :id/ops-l1-verify                [OPS_L1]
    ├── PUT :id/ops-l2-validate              [OPS_L2]
    ├── PUT :id/ops-head-approve             [OPS_HEAD]
    ├── PUT :id/ceo-review                   [CEO]
    ├── PUT :id/md-disburse                  [MD] → Collects amount
    ├── GET dashboard/rm                     [RM]
    ├── GET dashboard/ops-pending            [OPS*]
    ├── GET dashboard/ceo-pending            [CEO]
    ├── GET dashboard/md-pending             [MD]
    ├── GET :id                              [All]
    ├── GET customer/:customerId             [All]
    ├── GET supplier/:supplierId             [All]
    ├── GET status/:status                   [All]
    ├── GET pending                          [All]
    └── GET history/:id                      [All] → Audit trail
```

---

## Database Relations Diagram

```
┌─────────────────┐
│     User        │
├─────────────────┤
│ id (PK)         │
│ email           │
│ name            │
│ password        │
└────┬────────────┘
     │
     ├─→ OneToMany: UserRole (M)
     │   └─→ ManyToOne: Role
     │
     ├─→ OneToMany: Customer (M)
     │
     ├─→ OneToMany: Supplier (M)
     │
     ├─→ OneToMany: Invoice (M)
     │
     └─→ OneToMany: CaseStatusHistory (M)


┌─────────────────┐
│    Customer     │ ◄─────── LAN Generated here (Credit L2 step)
├─────────────────┤
│ id (PK)         │
│ customerCode    │
│ customerName    │
│ lanId           │ ◄─────── Links suppliers to max 20/group
│ status          │
└────┬────────────┘
     │
     ├─→ ManyToOne: User (RM)
     │
     ├─→ OneToMany: Supplier (M) ◄─── Via LAN
     │
     ├─→ OneToMany: Invoice (M)
     │
     └─→ OneToMany: CaseWorkflow (M)


┌─────────────────┐
│    Supplier     │
├─────────────────┤
│ id (PK)         │
│ customerId (FK) │ ◄─────── LAN inherited from customer
│ supplierCode    │
│ gstNumber       │
│ status          │
└────┬────────────┘
     │
     ├─→ ManyToOne: Customer
     │
     ├─→ OneToMany: Invoice (M)
     │
     └─→ OneToMany: CaseStatusHistory (M)


┌──────────────────┐
│    Invoice       │
├──────────────────┤
│ id (PK)          │
│ customerId (FK)  │ ◄───────┐
│ supplierId (FK)  │ ◄───────┤─── Both required!
│ invoiceNumber    │         │
│ invoiceAmount    │         │
│ disbursedAmount  │ ◄─── MD fills this
│ disbursedDate    │ ◄─── Recorded when disbursed
│ status           │
└────┬─────────────┘
     │
     ├─→ ManyToOne: Customer
     │
     ├─→ ManyToOne: Supplier
     │
     └─→ OneToMany: CaseStatusHistory (M)


┌──────────────────────┐
│   CaseWorkflow       │ ◄─── Central hub
├──────────────────────┤
│ id (PK)              │
│ workflowType enum    │ ◄─── CUSTOMER/SUPPLIER/INVOICE
│ customerId (FK, Null)│
│ supplierId (FK, Null)│
│ invoiceId (FK, Null) │
│ currentStatus        │ ◄─── States from all 3 workflows
│ currentApproverRole  │ ◄─── Next role to approve
│ isRejected          │
│ rejectionReason     │
│ isCompleted         │
│ completedDate       │
└────┬─────────────────┘
     │
     └─→ OneToMany: CaseStatusHistory (M) ◄─── Complete audit trail


┌──────────────────────────┐
│ CaseStatusHistory        │ ◄─── Audit Log
├──────────────────────────┤
│ id (PK)                  │
│ customerId (FK, Null)    │
│ supplierId (FK, Null)    │
│ invoiceId (FK, Null)     │
│ caseWorkflowId (FK, Null)│
│ previousStatus           │
│ currentStatus            │
│ changedByUserId (FK)     │ ◄─── Who approved
│ changedAt                │ ◄─── When
│ remarks                  │ ◄─── Why/Comments
└──────────────────────────┘
```

---

## State Machine Validation

The system prevents invalid state transitions through:

1. **Role-based Guards**: Only correct role can call endpoint
2. **Status Checks**: Service methods validate current status before transition
3. **Sequential Enforcement**: Cannot jump to step N+2, must go through N+1
4. **FK Sanctions**: CaseWorkflow enforces only one of (customer/supplier/invoice) populated

Example:
```typescript
// Cannot approve at CREDIT_L1 if status is not SUBMITTED
if (workflow.currentStatus !== 'SUBMITTED') {
  throw new Error('Cannot approve: workflow not in SUBMITTED state');
}
```

---

## Error Handling Strategy

```
Request
  │
  ├─ Syntax Error (malformed JSON)
  │  └─→ 400 Bad Request
  │
  ├─ Missing JWT Token
  │  └─→ 401 Unauthorized
  │
  ├─ Token Invalid/Expired
  │  └─→ 401 Unauthorized
  │
  ├─ Wrong Role
  │  └─→ 403 Forbidden (Role required: X)
  │
  ├─ Missing Required Fields
  │  └─→ 400 Bad Request (Field X required)
  │
  ├─ Business Logic Validation
  │  ├─ Customer not found       → 404
  │  ├─ Invalid status           → 400
  │  ├─ Supplier limit exceeded  → 400
  │  ├─ Invoice requires completed customer+supplier → 400
  │  └─→ Descriptive error message
  │
  └─ Unexpected Error
     └─→ 500 Internal Server Error
```

---

## Authentication Flow

```
┌─────────────┐
│   Frontend  │
└──────┬──────┘
       │
       ├─ User enters credentials
       │  (email: "rm@scf.com", password: "password123")
       │
       ↓
┌──────────────────────────────────────┐
│ POST /api/auth/login                 │
└──────┬───────────────────────────────┘
       │
       ├─ Verify email exists
       ├─ Compare password hash
       ├─ Load user roles via UserRole table
       │
       ↓
       │
    ✓ Success
       │
       ├─ Generate JWT token
       │  (includes: user.id, user.email, user.roles array)
       │
       ↓
┌─────────────────────────────────────┐
│ Response: { token, user }           │
└─────────────────────────────────────┘
       │
       ├─ Frontend stores token in localStorage
       │
       ↓
┌─────────────────────────────────────┐
│ All future requests include:        │
│ Authorization: Bearer <token>       │
└─────────────────────────────────────┘
       │
       └─→ authMiddleware validates & extracts user info
           └─→ checkRole middleware validates role
               └─→ Route handler executes
```

---

## LAN Generation Logic

```
Credit L2 Approval Handler
    │
    ├─ Check if customer workflow transitioning?
    │
    ├─ If yes, LAN not yet generated
    │  └─→ Generate new LAN
    │      │
    │      ├─ Format: LAN-{Date.now()}-{randomString(8)}
    │      │  Example: LAN-1738765814000-a7f2k9x1
    │      │
    │      └─→ Save to Customer.lanId
    │
    └─→ Store LAN for supplier grouping (max 20/LAN)
```

---

## Approval Chain Enforcement

```
Each Workflow Step:

Step N Handler
    │
    ├─ Load workflow from database
    │
    ├─ Validate current status === expected (e.g., SUBMITTED)
    │
    ├─ Check user has required role
    │
    ├─ Perform business logic (approve/reject)
    │
    ├─ Update workflow status → Step N+1 (or REJECTED)
    │
    ├─ Record in CaseStatusHistory
    │  (who: userId, when: timestamp, why: remarks)
    │
    └─ Return updated workflow
       (Cannot proceed to step N+2 until step N completed)
```

---

## Key Design Principles

1. **Single Source of Truth**: CaseWorkflow is authoritative for workflow state
2. **Immutable History**: CaseStatusHistory never modified, only appended
3. **Fail-Safe Defaults**: All approvals require explicit action, no auto-approval
4. **Audit First**: Every decision recorded with user context
5. **Role Separation**: Clear boundaries between roles, cannot override
6. **Eventual Consistency**: Audit logs lag by seconds, not critical
7. **Graceful Degradation**: Rejection doesn't break system, case halts cleanly

---


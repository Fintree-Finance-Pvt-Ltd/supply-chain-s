# Supply Chain Finance System - Complete Architecture & Sanction Flow Analysis

## 1. Project Architecture Overview

### Technology Stack
- **Backend Framework**: Node.js + Express.js
- **ORM**: TypeORM
- **Database**: MySQL
- **Authentication**: JWT (JSON Web Tokens)
- **Password Hashing**: bcrypt
- **File Uploads**: Multer
- **Validation**: express-validator
- **Security**: Helmet, CORS

### Project Structure
```
backend/
├── src/
│   ├── app.ts                    # Express app configuration
│   ├── server.ts                 # Server entry point
│   ├── config/
│   │   ├── database.ts           # TypeORM data source
│   │   └── constants.ts          # System constants, roles, statuses
│   ├── entities/                 # TypeORM entity definitions (35+ entities)
│   ├── controllers/              # Request handlers
│   ├── services/                 # Business logic
│   ├── routes/                   # API route definitions
│   ├── middlewares/              # Auth, role, error handling
│   ├── utils/                    # Utilities (JWT, API responses)
│   ├── integrations/              # External service integrations (Aadhaar, Bureau, eSign, etc.)
│   ├── migrations/               # Database migrations
│   ├── seed/                     # Database seeding
│   └── cron/                     # Scheduled jobs
├── sql/
│   ├── 01_create_tables.sql      # Database schema
│   └── 02_seed_data.sql          # Initial data
└── package.json
```

---

## 2. Supply Chain Finance Module Overview

The Supply Chain Finance (SCF) system consists of the following key business domains:

### Core Business Modules

| Module | Description | Key Entities |
|--------|-------------|--------------|
| **Customer Onboarding** | RM-led customer creation and submission | Customer, CaseWorkflow |
| **KYC Verification** | Document collection and verification | KycDetail, KycVerificationStatus |
| **Credit Sanction** | Credit limit approval workflow | CreditSanction, SanctionLimitHistory |
| **Multi-Level Approval Engine** | Sequential approval workflow | ApprovalFlow, ApprovalStep, ApprovalInstance, ApprovalAction |
| **Post-Sanction** | E-sign, e-NACH completion | PostSanction |
| **Operations** | Document verification and final approval | OperationsCheck |
| **Supplier Management** | Vendor onboarding per customer LAN | Supplier, SupplierBankDetail, SupplierDocument |
| **Invoice Discounting** | Invoice submission and disbursement | Invoice, CaseWorkflow |
| **Loan Accounts** | Lender assignment and LAN management | LoanAccount |
| **Disbursement** | Fund disbursement tracking | Drawdown, Loan |

### System Users & Roles
- **Relationship Manager (RM)**: Creates customers, uploads documents, submits for credit
- **Credit Team L1/L2**: Reviews and approves credit sanctions
- **CEO**: Executive approval for credit limits
- **MD (Managing Director)**: Final credit decision authority
- **Operations Team L1/L2/Head**: Post-sanction verification
- **Admin**: System administration

---

## 3. Sanction Lifecycle Flow

### 3.1 Complete Workflow Status Transitions

```
DRAFT → SUBMITTED → CREDIT_L1_APPROVED → CREDIT_L2_APPROVED → CEO_APPROVED → MD_APPROVED → OPS_L1_REVIEW → OPS_L1_APPROVED → OPS_HEAD_APPROVED → COMPLETED
         ↓             ↓                  ↓                  ↓            ↓             ↓              ↓                  ↓                    ↓
      (reject)      (reject)           (reject)          (reject)    (reject)     (reject)       (reject)            (reject)           (disbursed)
```

### 3.2 Sanction Flow - Step by Step

#### Stage 1: Customer Creation (RM)
- **Route**: `POST /api/workflows/customers/create`
- **Controller**: Workflow routes (inline)
- **Service**: `CustomerOnboardingService.createCustomer()`
- **Database**: `customers` table (status: 'draft')
- **Workflow**: `case_workflows` table created

#### Stage 2: Customer Submission (RM)
- **Route**: `POST /api/workflows/customers/:customerId/submit`
- **Service**: `CustomerOnboardingService.submitCustomer()`
- **Database**: 
  - `customers` status → 'submitted'
  - `case_workflows` currentStatus → 'submitted'
  - `case_status_history` - audit trail created

#### Stage 3: Credit L1 Approval
- **Route**: `POST /api/workflows/customers/:customerId/credit-l1`
- **Role**: credit_team_l1
- **Service**: `CustomerOnboardingService.creditL1Approve()`
- **Database Updates**:
  - `case_workflows` → 'credit_l1_approved' (if approved)
  - `credit_sanctions` → created/updated with sanction terms
  - `loan_accounts` → LAN generated per partner (FFPL/MFL/KITE)
  - `sanction_limit_history` → audit of sanction changes
  - `case_status_history` → audit trail

#### Stage 4: Credit L2 Approval
- **Route**: `POST /api/workflows/customers/:customerId/credit-l2`
- **Role**: credit_team_l2
- **Service**: `CustomerOnboardingService.creditL2Approve()`
- **Database Updates**: Same as Credit L1, with updated sanction amounts

#### Stage 5: CEO Approval
- **Route**: `POST /api/workflows/customers/:customerId/ceo-approve`
- **Role**: ceo
- **Service**: `CustomerOnboardingService.ceoApprove()`
- **Database Updates**: Updates workflow status to 'ceo_approved'

#### Stage 6: RM Submit to MD (Terms Submission)
- **Route**: `POST /api/workflows/customers/:customerId/rm-submit-md`
- **Role**: relationship_manager
- **Service**: `CustomerOnboardingService.rmSubmitToMD()`
- **Database Updates**: Status → 'md_pending_terms'

#### Stage 7: MD Approval (Final Credit Decision)
- **Route**: `POST /api/workflows/customers/:customerId/md-approve`
- **Role**: md
- **Service**: `CustomerOnboardingService.mdApprove()`
- **Database Updates**:
  - `case_workflows` → 'md_approved'
  - `credit_sanctions` status → 'approved'
  - Customer status → 'md_approved' (POST_SANCTION_PENDING)

#### Stage 8: RM Submit to Operations
- **Route**: `POST /api/workflows/customers/:customerId/ops-submit`
- **Role**: relationship_manager
- **Service**: `CustomerOnboardingService.submitForOperationsApproval()`

#### Stage 9: Operations L1 Verification
- **Route**: `POST /api/workflows/customers/:customerId/ops-l1`
- **Role**: operations_team_l1
- **Service**: `CustomerOnboardingService.opsL1Approve()`

#### Stage 10: Operations Head Approval
- **Route**: `POST /api/workflows/customers/:customerId/ops-head`
- **Role**: operations_head
- **Service**: `CustomerOnboardingService.opsHeadApprove()`

#### Stage 11: Final Completion
- **Customer Status**: 'completed' (FULLY_ONBOARDED)
- Customer ready for invoice discounting and disbursements

---

## 4. Files Involved in Sanction Flow

### Routes
| File | Purpose |
|------|---------|
| [`backend/src/routes/workflow.routes.ts`](backend/src/routes/workflow.routes.ts) | Main workflow routes including all credit approval endpoints |
| [`backend/src/routes/credit.routes.ts`](backend/src/routes/credit.routes.ts) | Credit sanction CRUD endpoints |
| [`backend/src/routes/approval.routes.ts`](backend/src/routes/approval.routes.ts) | Approval action endpoints |
| [`backend/src/routes/operations.routes.ts`](backend/src/routes/operations.routes.ts) | Operations check endpoints |

### Controllers
| File | Purpose |
|------|---------|
| [`backend/src/controllers/credit.controller.ts`](backend/src/controllers/credit.controller.ts) | Credit sanction controller |
| [`backend/src/controllers/approval.controller.ts`](backend/src/controllers/approval.controller.ts) | Approval processing controller |
| [`backend/src/controllers/operations.controller.ts`](backend/src/controllers/operations.controller.ts) | Operations check controller |

### Services
| File | Purpose |
|------|---------|
| [`backend/src/services/customer-onboarding.service.ts`](backend/src/services/customer-onboarding.service.ts) | Core customer workflow + sanction management + LAN generation |
| [`backend/src/services/credit.service.ts`](backend/src/services/credit.service.ts) | Credit sanction business logic |
| [`backend/src/services/approval.service.ts`](backend/src/services/approval.service.ts) | Multi-level approval engine |
| [`backend/src/services/operations.service.ts`](backend/src/services/operations.service.ts) | Operations verification logic |
| [`backend/src/services/supplier-onboarding.service.ts`](backend/src/services/supplier-onboarding.service.ts) | Supplier onboarding per LAN |
| [`backend/src/services/invoice-discounting.service.ts`](backend/src/services/invoice-discounting.service.ts) | Invoice discounting workflow |

### Entities (Database Models)
| Entity | Table | Purpose |
|--------|-------|---------|
| [`Customer`](backend/src/entities/Customer.ts) | customers | Main customer record with lanId, lender |
| [`CreditSanction`](backend/src/entities/CreditSanction.ts) | credit_sanctions | Current active sanction details |
| [`SanctionLimitHistory`](backend/src/entities/SanctionLimitHistory.ts) | sanction_limit_history | Audit trail of all sanction changes |
| [`LoanAccount`](backend/src/entities/LoanAccount.ts) | loan_accounts | LAN per lender (FFPL/MFL/KITE) |
| [`PostSanction`](backend/src/entities/PostSanction.ts) | post_sanctions | E-sign, e-NACH status |
| [`OperationsCheck`](backend/src/entities/OperationsCheck.ts) | operations_checks | Operations verification |
| [`CaseWorkflow`](backend/src/entities/CaseWorkflow.ts) | case_workflows | Workflow state machine |
| [`CaseStatusHistory`](backend/src/entities/CaseStatusHistory.ts) | case_status_history | Full audit trail |
| [`ApprovalFlow`](backend/src/entities/ApprovalFlow.ts) | approval_flows | Approval flow configuration |
| [`ApprovalStep`](backend/src/entities/ApprovalStep.ts) | approval_steps | Sequential approval steps |
| [`ApprovalInstance`](backend/src/entities/ApprovalInstance.ts) | approval_instances | Active approval instances |
| [`ApprovalAction`](backend/src/entities/ApprovalAction.ts) | approval_actions | Approval action history |

---

## 5. Routes, Controllers, and Services Summary

### Sanction-Related API Endpoints

| Endpoint | Method | Controller | Service | Description |
|----------|--------|------------|---------|-------------|
| `/api/workflows/customers/create` | POST | workflow.routes | CustomerOnboardingService | Create customer |
| `/api/workflows/customers/:customerId/submit` | POST | workflow.routes | CustomerOnboardingService | Submit to credit |
| `/api/workflows/customers/:customerId/credit-l1` | POST | workflow.routes | CustomerOnboardingService.creditL1Approve() | Credit L1 approval |
| `/api/workflows/customers/:customerId/credit-l2` | POST | workflow.routes | CustomerOnboardingService.creditL2Approve() | Credit L2 approval |
| `/api/workflows/customers/:customerId/ceo-approve` | POST | workflow.routes | CustomerOnboardingService.ceoApprove() | CEO approval |
| `/api/workflows/customers/:customerId/rm-submit-md` | POST | workflow.routes | CustomerOnboardingService.rmSubmitToMD() | RM submits terms to MD |
| `/api/workflows/customers/:customerId/md-approve` | POST | workflow.routes | CustomerOnboardingService.mdApprove() | MD final approval |
| `/api/workflows/customers/:customerId/ops-submit` | POST | workflow.routes | CustomerOnboardingService.submitForOperationsApproval() | Submit to ops |
| `/api/workflows/customers/:customerId/ops-l1` | POST | workflow.routes | CustomerOnboardingService.opsL1Approve() | Ops L1 verification |
| `/api/workflows/customers/:customerId/ops-head` | POST | workflow.routes | CustomerOnboardingService.opsHeadApprove() | Ops head approval |
| `/api/workflows/customers/:customerId/sanction-limits` | GET | workflow.routes | CustomerOnboardingService.getSanctionLimitsByCustomerId() | Get all sanction limits |
| `/api/credit/sanction` | POST | CreditController | CreditService.createSanction() | Legacy sanction creation |
| `/api/credit/pending` | GET | CreditController | CreditService.getPendingSanctions() | Get pending sanctions |
| `/api/approvals/pending` | GET | ApprovalController | ApprovalService.getPendingApprovalsForUser() | Get user approvals |
| `/api/approvals/:id/action` | POST | ApprovalController | ApprovalService.processApproval() | Process approval |
| `/api/operations/pending` | GET | OperationsController | OperationsService.getPendingChecks() | Get pending ops checks |
| `/api/operations/post-sanction/:customerId/submit` | POST | OperationsController | OperationsService.submitPostSanction() | Submit post-sanction |

---

## 6. Tables and Entities Involved in Sanction Lifecycle

### Core Tables Written To During Sanction Flow

| Table Name | Entity | Purpose | Written At |
|------------|--------|---------|------------|
| `customers` | Customer | Main customer record with status, lanId, lender | Customer creation, status updates |
| `case_workflows` | CaseWorkflow | Workflow state machine | Every stage transition |
| `case_status_history` | CaseStatusHistory | Full audit trail | Every status change |
| `credit_sanctions` | CreditSanction | Current active sanction | Credit L1/L2 approval |
| `sanction_limit_history` | SanctionLimitHistory | History of all sanction changes | Every sanction modification |
| `loan_accounts` | LoanAccount | LAN per lender (FFPL/MFL/KITE) | Credit L1/L2/MD approval |
| `approval_flows` | ApprovalFlow | Approval configuration | System setup |
| `approval_steps` | ApprovalStep | Approval step definitions | System setup |
| `approval_instances` | ApprovalInstance | Active approval processes | Sanction creation |
| `approval_actions` | ApprovalAction | Approval history | Every approval action |

### Key Database Columns for Sanction

#### customers table
- `id`: Primary key
- `lanId`: Loan Account Number (generated)
- `lender`: Primary lender (FFPL/MFL/KITE)
- `status`: Current case status
- `rmId`: Relationship Manager ID

#### loan_accounts table (NEW - stores LAN per lender)
- `id`: Primary key
- `customerId`: Foreign key to customers
- `lender`: Enum (KITE, FFPL, MFL)
- `lanId`: Unique loan account number (e.g., FFPL10000101)
- `sanctionedAmount`: Sanction limit
- `disbursedAmount`: Amount disbursed
- `status`: active/closed/defaulted

#### sanction_limit_history table
- `id`: Primary key
- `customerId`: Foreign key to customers
- `sanctionAmount`: Approved limit
- `tenure`: Loan tenure in months
- `interestRate`: Rate of interest
- `penalCharges`: Penal charges %
- `processingFees`: Processing fees %
- `conditions`: Terms and conditions
- `changedByRole`: Role that made change (CREDIT_L1, CREDIT_L2, CEO, MD)
- `changedByUserId`: User who made change
- `createdAt`: Timestamp

#### credit_sanctions table
- `id`: Primary key
- `customerId`: Foreign key
- `sanctionAmount`: Current approved amount
- `tenure`, `interestRate`, `conditions`
- `penalCharges`, `processingFees`
- `creditOfficerId`: Credit team user
- `status`: pending/approved/rejected

---

## 7. Step-by-Step Data Flow

### Sanction Creation and Approval Flow

```
USER ACTION (UI)
      ↓
API ROUTE: POST /api/workflows/customers/:customerId/credit-l1
      ↓
CONTROLLER: (inline in workflow.routes.ts)
      ↓
SERVICE: CustomerOnboardingService.creditL1Approve(customerId, userId, remarks, approved, sanctionData)
      ↓
DATABASE TRANSACTIONS:
│
├── 1. Get/Create CaseWorkflow
│   └── UPDATE case_workflows 
│       SET currentStatus = 'credit_l1_approved' | 'rejected'
│           currentApproverRoleName = 'CREDIT_TEAM_L2' | 'RM'
│           remarks = ?
│           isRejected = (if rejected)
│
├── 2. Process Sanction Data (if approved && sanctionData)
│   ├── FOR EACH partner in partnerSanctions[]:
│   │   └── upsertLoanAccount(customerId, partner, sanctionAmount)
│   │       └── INSERT INTO loan_accounts (new LAN) or
│   │           UPDATE loan_accounts (existing LAN)
│   │
│   ├── INSERT/UPDATE credit_sanctions
│   │   └── INSERT INTO credit_sanctions
│   │       SET customerId, sanctionAmount, tenure, interestRate,
│   │           penalCharges, processingFees, conditions,
│   │           creditOfficerId = userId, status = 'pending'|'approved'
│   │
│   └── INSERT INTO sanction_limit_history (if values changed)
│       └── INSERT INTO sanction_limit_history
│           SET customerId, sanctionAmount, tenure, interestRate,
│               penalCharges, processingFees, conditions,
│               changedByUserId = userId, changedByRole = 'CREDIT_L1'
│
├── 3. Update Customer Status
│   └── UPDATE customers SET status = 'credit_l1_approved' | 'rejected'
│
├── 4. Create Audit Trail
│   └── INSERT INTO case_status_history
│       SET customerId, caseWorkflowId = workflow.id,
│           status = 'credit_l1_approved' | 'rejected',
│           previousStatus = 'submitted',
│           changedBy = userId,
│           remarks = ?,
│           sanctionAmount = ? (from sanctionData)
│
└── 5. Return Workflow Response
    └── RETURN updated workflow object
```

### LAN (Loan Account Number) Generation Flow

```
LAN Generation happens in: CustomerOnboardingService.upsertLoanAccount()

STEP 1: Generate Next LAN ID
   └── getNextLanId(lender: string)
       ├── Query: SELECT MAX(lanId) FROM loan_accounts WHERE lanId LIKE 'FFPL%'
       ├── Parse numeric part, increment by 1
       └── Return: FFPL10000101, MFL10000101, KITE10000101

STEP 2: Upsert Loan Account
   ├── Check if loan_account exists for this customer+lender
   │   └── SELECT * FROM loan_accounts WHERE customerId = ? AND lender = ?
   │
   ├── IF exists:
   │   └── UPDATE loan_accounts 
   │       SET sanctionedAmount = ?, status = 'active'
   │
   └── IF new:
        └── INSERT INTO loan_accounts
            SET customerId = ?,
                lender = 'FFPL'|'MFL'|'KITE',
                lanId = 'FFPL10000101' (generated),
                sanctionedAmount = ?,
                disbursedAmount = 0,
                status = 'active'
```

---

## 8. History, Lender, and LAN Handling

### History/Audit Tracking

The system maintains comprehensive audit trails through multiple tables:

1. **`case_status_history`** - Main audit table
   - Tracks every status change in the customer lifecycle
   - Stores sanction-related data at each change (sanctionAmount, tenure, interestRate, etc.)
   - Records: who (changedBy), when (createdAt), why (remarks)

2. **`sanction_limit_history`** - Sanction-specific audit
   - Stores every change to credit terms
   - Tracks role that made the change (CREDIT_L1, CREDIT_L2, CEO, MD)
   - Only inserts when financial values actually change

3. **`approval_actions`** - Approval audit
   - Records each approval/rejection action
   - Stores step order, approver comments

### Lender Management

The system supports **multiple lenders/partners** per customer:

- **Partners Enum** (from [`constants.ts`](backend/src/config/constants.ts)):
  - `FFPL`: First Finvest Pvt Ltd
  - `MFL`: Micro Finance Ltd
  - `KITE`: KITE Lender

- **Lender Storage**:
  - `customers.lender`: Primary lender (single)
  - `loan_accounts.lender`: Per-lender record (supports multiple)
  - `customers.lanId`: Primary LAN (for backward compatibility)

### LAN (Loan Account Number) Handling

- **LAN Format**: `{PREFIX}{8-digit-sequence}`
  - FFPL: `FFPL10000101` to `FFPL99999999`
  - MFL: `MFL10000101` to `MFL99999999`
  - KITE: `KITE10000101` to `KITE99999999`

- **LAN Generation**:
  - Auto-generated in [`CustomerOnboardingService.getNextLanId()`](backend/src/services/customer-onboarding.service.ts:429)
  - Unique per lender
  - Generated at Credit L1/L2/MD approval stages

- **LAN Usage**:
  - Customer identification in LMS (Loan Management System)
  - Supplier onboarding tied to LAN
  - Invoice discounting per LAN
  - Transaction tracking by LAN

---

## 9. Integration with Supply Chain Finance Lifecycle

### Sanction in SCF Context

The sanction flow is **tied to the complete Supply Chain Finance lifecycle**:

1. **Customer Case**: Each customer has a case that moves through onboarding → sanction → operations → completion

2. **Buyer/Vendor Relationship**: 
   - Customer = Buyer (who gets financing)
   - Suppliers = Vendors (who get paid via invoice discounting)
   - LAN links buyer to their approved suppliers

3. **Lender Assignment**:
   - Multiple lenders (FFPL, MFL, KITE) can support a single customer
   - Each lender gets a separate LAN in `loan_accounts`
   - Sanction limits tracked per lender

4. **Post-Sanction to Disbursement Readiness**:
   ```
   MD Approved → RM completes e-sign/e-NACH → Operations verifies → 
   Customer = COMPLETED → Ready for Invoice Discounting/Disbursement
   ```

5. **Invoice/Program Flow**:
   - After customer completion, RM can submit invoices
   - Invoice goes through ops verification → CEO → MD → disbursed
   - Invoices linked to customer and their LAN

---

## 10. Key Files for Reference

| File | Lines | Description |
|------|-------|-------------|
| [`backend/src/services/customer-onboarding.service.ts`](backend/src/services/customer-onboarding.service.ts) | 800+ | Core sanction + LAN logic |
| [`backend/src/services/approval.service.ts`](backend/src/services/approval.service.ts) | 500+ | Multi-level approval engine |
| [`backend/src/routes/workflow.routes.ts`](backend/src/routes/workflow.routes.ts) | 1000+ | All workflow endpoints |
| [`backend/src/config/constants.ts`](backend/src/config/constants.ts) | 150+ | Roles, statuses, partners |
| [`backend/src/entities/Customer.ts`](backend/src/entities/Customer.ts) | 230 | Customer entity with LAN fields |
| [`backend/src/entities/LoanAccount.ts`](backend/src/entities/LoanAccount.ts) | 48 | LAN per lender entity |

---

## Summary

The Supply Chain Finance system implements a comprehensive **multi-level approval workflow** for credit sanctions with:

1. **Sequential approvals**: Credit L1 → Credit L2 → CEO → MD → Operations
2. **Multi-lender support**: FFPL, MFL, KITE with separate LANs per lender
3. **Complete audit trail**: case_status_history + sanction_limit_history + approval_actions
4. **LAN generation**: Auto-generated unique loan account numbers
5. **Integration**: Sanction leads to customer completion, enabling supplier onboarding and invoice discounting

The sanction data flows from UI through REST APIs → Controllers → Services → TypeORM → MySQL, with real-time status updates at each approval stage.

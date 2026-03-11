# Supply Chain Finance - Sanction Approval Flow Analysis

## Executive Summary

This document provides a comprehensive analysis of the sanction approval workflow in the Supply Chain Finance system. The flow follows a sequential approval process: **RM → CREDIT_L1 → CREDIT_L2 → CEO → MD**.

---

## 1. Step-by-Step Sanction Workflow

### 1.1 Workflow Overview

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌────────┐    ┌────────┐
│  RM Creates │───▶│ CREDIT_L1    │───▶│ CREDIT_L2   │───▶│  CEO   │───▶│   MD   │
│  Customer   │    │ Approves     │    │ Approves    │    │ Approves│   │ Approves│
└─────────────┘    └──────────────┘    └─────────────┘    └────────┘    └────────┘
       │                  │                   │               │             │
       ▼                  ▼                   ▼               ▼             ▼
   "draft"         "credit_l1_approved" "credit_l2_approved" "ceo_approved" "md_approved"
```

### 1.2 Detailed Step-by-Step Flow

#### Step 1: RM Creates Customer (Draft Status)
- **API**: `POST /api/workflows/customers/create`
- **Role**: Relationship Manager (RM)
- **Action**: RM creates a new customer in the system
- **Result**: Customer status set to `draft`
- **Workflow Created**: `CaseWorkflow` record created with `currentStatus: 'draft'`

#### Step 2: RM Submits to Credit Team
- **API**: `POST /api/workflows/customers/:customerId/submit`
- **Role**: Relationship Manager
- **Action**: RM submits customer for credit review
- **Result**: 
  - Customer status → `submitted`
  - Workflow status → `submitted`
  - `currentApproverRoleName` → `CREDIT_TEAM_L1`
- **Triggers**: Silent bureau check (non-blocking)

#### Step 3: Credit L1 Review
- **API**: `POST /api/workflows/customers/:customerId/credit-l1`
- **Role**: CREDIT_TEAM_L1
- **Action**: Reviews and approves/rejects with sanction amount
- **Can Edit**: `sanctionAmount` only
- **Validations**:
  - Cannot edit tenure, ROI, penal charges, processing fees, conditions
- **Result**:
  - If approved: Status → `credit_l1_approved`, Approver → `CREDIT_TEAM_L2`
  - If rejected: Status → `rejected`, Approver → `RM`
- **Data Storage**: Updates `credit_sanctions` table with partner-specific sanction amounts

#### Step 4: Credit L2 Review
- **API**: `POST /api/workflows/customers/:customerId/credit-l2`
- **Role**: CREDIT_TEAM_L2
- **Action**: Reviews and approves/rejects with sanction amount
- **Can Edit**: `sanctionAmount` only (per partner)
- **Validations**:
  - Must fill sanction amount for ALL active partners
  - Cannot edit tenure, ROI, penal charges, processing fees, conditions
- **Result**:
  - If approved: Status → `credit_l2_approved`, Approver → `CEO`
  - If rejected: Status → `rejected`, Approver → `RM`
- **LAN Generation**: No LAN generated at this stage (contrary to some documentation)

#### Step 5: CEO Review
- **API**: `POST /api/workflows/customers/:customerId/ceo-approve`
- **Role**: CEO
- **Action**: Reviews and approves/rejects
- **Can Edit**: `sanctionAmount`, `tenure`, `interestRate`
- **Cannot Edit**: `penalCharges`, `processingFees`, `conditions` (MD only)
- **Result**:
  - If approved: Status → `ceo_approved`, Approver → `MD`
  - If rejected: Status → `rejected`, Approver → `RM`
- **Important**: Case goes to `md_pending_terms` state first

#### Step 6: RM Submits to MD (Terms Submission)
- **API**: `POST /api/workflows/customers/:customerId/rm-submit-md`
- **Role**: Relationship Manager
- **Action**: RM submits final terms to MD
- **Can Edit**: All fields
- **Result**: Status → `md_terms_submitted`

#### Step 7: MD Final Approval
- **API**: `POST /api/workflows/customers/:customerId/md-approve`
- **Role**: MD (Managing Director)
- **Action**: Final credit decision
- **Can Edit**: ALL fields (`sanctionAmount`, `tenure`, `interestRate`, `penalCharges`, `processingFees`, `conditions`)
- **Result**:
  - If approved: Status → `md_approved`, Approver → `RM`
  - If rejected: Status → `rejected`, Approver → `RM`
- **CRITICAL**: Loan accounts are created at this stage!

#### Step 8: Submit to Operations
- **API**: `POST /api/workflows/customers/:customerId/ops-submit`
- **Role**: Relationship Manager
- **Action**: Submit to operations team after MD approval
- **Result**: Status → `ops_l1_review`

---

## 2. Table Data Flow

### 2.1 Primary Tables for Sanction Data

| Table | Purpose | Key Fields |
|-------|---------|------------|
| [`credit_sanctions`](backend/src/entities/CreditSanction.ts) | Main sanction storage | `customerId`, `partner`, `sanctionAmount`, `tenure`, `interestRate`, `penalCharges`, `processingFees`, `conditions`, `status` |
| [`sanction_limit_history`](backend/src/entities/SanctionLimitHistory.ts) | Audit trail of changes | `customerId`, `sanctionAmount`, `tenure`, `interestRate`, `changedByRole`, `changedByUserId` |
| [`loan_accounts`](backend/src/entities/LoanAccount.ts) | Loan accounts (created after MD approval) | `customerId`, `partnerId`, `lender`, `lanId`, `sanctionedAmount`, `disbursedAmount`, `status` |
| [`case_workflows`](backend/src/entities/CaseWorkflow.ts) | Workflow state tracking | `customerId`, `currentStatus`, `currentApproverRoleName`, `remarks` |
| [`case_status_history`](backend/src/entities/CaseStatusHistory.ts) | Status change audit | `customerId`, `status`, `previousStatus`, `changedBy`, `sanctionAmount`, `tenure`, `interestRate` |

### 2.2 Data Storage Locations

#### **Sanction Amount**
- **Primary Storage**: [`credit_sanctions.sanctionAmount`](backend/src/entities/CreditSanction.ts:29)
- **History Storage**: [`sanction_limit_history.sanctionAmount`](backend/src/entities/SanctionLimitHistory.ts:21)
- **Status History**: [`case_status_history.sanctionAmount`](backend/src/entities/CaseStatusHistory.ts:46)

#### **ROI (Interest Rate)**
- **Primary Storage**: [`credit_sanctions.interestRate`](backend/src/entities/CreditSanction.ts:35)
- **History Storage**: [`sanction_limit_history.interestRate`](backend/src/entities/SanctionLimitHistory.ts:27)

#### **Tenor**
- **Primary Storage**: [`credit_sanctions.tenure`](backend/src/entities/CreditSanction.ts:32)
- **History Storage**: [`sanction_limit_history.tenure`](backend/src/entities/SanctionLimitHistory.ts:24)

#### **Partner**
- **Storage**: [`credit_sanctions.partner`](backend/src/entities/CreditSanction.ts:26) (e.g., 'FFPL', 'KF', 'MFL')
- **Unique Constraint**: `Unique(['customerId', 'partner'])` - one sanction per customer per partner

#### **LAN (Loan Account Number)**
- **Storage**: [`loan_accounts.lanId`](backend/src/entities/LoanAccount.ts:41)
- **Generated**: In [`upsertLoanAccount()`](backend/src/services/customer-onboarding.service.ts:154) method
- **Format**: Auto-increment sequence per partner

### 2.3 Data Flow Diagram

```
RM Submit
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│                    credit_sanctions                         │
│  (Created/Updated at each approval stage)                   │
│  - credit_l1: sanctionAmount only                          │
│  - credit_l2: sanctionAmount only                          │
│  - ceo: sanctionAmount, tenure, interestRate               │
│  - md: ALL FIELDS                                          │
└─────────────────────────────────────────────────────────────┘
    │
    │ (on financial value change)
    ▼
┌─────────────────────────────────────────────────────────────┐
│               sanction_limit_history                        │
│  (Audit trail - only inserted when financial values change) │
│  Tracks: changedByRole, changedByUserId, timestamp         │
└─────────────────────────────────────────────────────────────┘
    │
    │ (on MD approval)
    ▼
┌─────────────────────────────────────────────────────────────┐
│                    loan_accounts                            │
│  (Created AFTER MD approval - one per partner)             │
│  Generates unique lanId for each partner                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Role Permissions

### 3.1 Field Editing Permissions Matrix

| Role | sanctionAmount | tenure | interestRate | penalCharges | processingFees | conditions |
|------|----------------|--------|---------------|--------------|----------------|------------|
| **RM** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **CREDIT_L1** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **CREDIT_L2** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **CEO** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **MD** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### 3.2 Backend Validation

The backend enforces these restrictions in [`workflow.routes.ts`](backend/src/routes/workflow.routes.ts):

#### Credit L1 Validation (Lines 176-188)
```typescript
if (isModifyingSanctions && userRole === 'credit_team_l1') {
  for (const ps of partnerSanctions) {
    if (ps.tenure || ps.interestRate || ps.penalCharges || ps.processingFees || ps.conditions) {
      // REJECTED: Credit L1 can only modify sanctionAmount
    }
  }
}
```

#### Credit L2 Validation (Lines 299-322)
```typescript
// Credit L2 can only modify sanctionAmount
if (isModifyingSanctions && userRole === 'credit_team_l2') {
  // REJECTED: Cannot edit tenure, ROI, penal charges, etc.
}
```

#### CEO Validation (Lines 365-386)
```typescript
// CEO can only modify sanctionAmount (not tenure, ROI, etc.)
// NOTE: This seems restrictive - documentation says CEO can edit tenure/ROI
```

#### MD Validation (Lines 451-471)
```typescript
// MD can edit ALL fields including penalCharges, processingFees, conditions
```

### 3.3 Issues Found

**Issue #1: CEO Permission Discrepancy**
- **Documentation in workflow.routes.ts** (Line 350): "CEO can edit sanctionAmount, tenure and interestRate"
- **Actual Code** (Lines 365-386): CEO is restricted to ONLY `sanctionAmount`
- **Impact**: CEO cannot set tenure or ROI despite documentation stating otherwise

---

## 4. Loan Account Creation Logic

### 4.1 When Are Loan Accounts Created?

**Location**: [`customer-onboarding.service.ts`](backend/src/services/customer-onboarding.service.ts:842-850)

```typescript
// AFTER MD APPROVAL: Create loan accounts from credit_sanctions table
if (approved) {
  // Read all credit_sanctions for this customer and create loan accounts
  const allSanctions = await this.sanctionRepository.find({ where: { customerId } });
  for (const sanction of allSanctions) {
    const partner = sanction.partner || 'FFPL';
    await this.upsertLoanAccount(customerId, partner, Number(sanction.sanctionAmount));
  }
}
```

**Timing**: Loan accounts are created **ONLY after MD approval** (final approval)

### 4.2 Loan Account Creation Process

**Method**: [`upsertLoanAccount()`](backend/src/services/customer-onboarding.service.ts:154-187)

```typescript
private async upsertLoanAccount(
  customerId: number,
  lender: string,
  sanctionedAmount: number
): Promise<string> {
  const lanId = await this.getNextLanId(lender);
  
  // Check if loan account already exists for this lender
  const existingAccount = await this.loanAccountRepository.findOne({
    where: { customerId, lender: lender as any }
  });
  
  if (existingAccount) {
    // Update existing account
    await this.loanAccountRepository.update(existingAccount.id, {
      sanctionedAmount,
      status: 'active',
    });
  } else {
    // Create new loan account
    await this.loanAccountRepository.save(this.loanAccountRepository.create({
      customerId,
      lender: lender as any,
      lanId,
      sanctionedAmount,
      disbursedAmount: 0,
      status: 'active',
    }));
  }
  
  return lanId;
}
```

### 4.3 One Loan Account Per Partner

- **Logic**: Creates ONE loan account per partner for the customer
- **LAN Generation**: Unique LAN ID generated per partner using `getNextLanId()`
- **Upsert**: If account exists, updates sanctioned amount; if not, creates new

---

## 5. Partner Handling (FFPL, KF, MFL, etc.)

### 5.1 Multi-Partner Support

The system supports **multiple partners** (FFPL, KF, MFL, etc.) with the following approach:

#### Partner Storage
- **Table**: [`credit_sanctions.partner`](backend/src/entities/CreditSanction.ts:26)
- **Type**: VARCHAR(20) - stores partner code (FFPL, KF, MFL, etc.)
- **Unique Constraint**: `Unique(['customerId', 'partner'])` - one record per customer per partner

#### Dynamic Partner Loading
- Partners are loaded dynamically from the `partners` table
- Frontend fetches active partners via `partnerService.getActivePartners()`

### 5.2 How Partners Flow Through Approval

#### Credit L1/L2 (Partner Sanctions Array)
```json
{
  "partnerSanctions": [
    { "partner": "FFPL", "sanctionAmount": 500000 },
    { "partner": "KF", "sanctionAmount": 300000 },
    { "partner": "MFL", "sanctionAmount": 200000 }
  ]
}
```

#### Credit L2 Validation
- Validates that ALL active partners have sanction amounts before approval
- Error message: "Please fill sanction amount for all partners. Missing: [list]"

#### MD Approval
- Creates/updates `credit_sanctions` record for each partner
- After MD approval, creates one `loan_accounts` record per partner

### 5.3 Frontend Partner Display

**File**: [`ApprovalScreen.jsx`](frontend/src/pages/management/ApprovalScreen.jsx:66-97)

```javascript
// Load all partner sanctions from sanctionLimitHistory
if (custResponse.data?.sanctionLimitHistory && custResponse.data.sanctionLimitHistory.length > 0) {
  const history = custResponse.data.sanctionLimitHistory;
  // Group by lender/partner - use LATEST entry (by createdAt)
  const partnerMap = {};
  history.forEach(item => {
    const partner = item.lender || PARTNERS[0] || '';
    // Always use the latest entry (most recent createdAt)
    if (!partnerMap[partner] || itemDate > existingDate) {
      partnerMap[partner] = {
        partner: partner,
        sanctionAmount: item.sanctionAmount || 0,
        tenure: item.tenure || 0,
        interestRate: item.interestRate || 0,
        lanId: item.lanId || '',
      };
    }
  });
}
```

---

## 6. Issues and Improvements

### 6.1 Critical Issues Found

#### Issue #1: CEO Permission Discrepancy
- **Location**: [`workflow.routes.ts:365-386`](backend/src/routes/workflow.routes.ts:365)
- **Problem**: Documentation states CEO can edit `sanctionAmount`, `tenure`, `interestRate`, but code only allows `sanctionAmount`
- **Recommendation**: Update code to allow CEO to edit `tenure` and `interestRate` as per business logic

#### Issue #2: sanction_limit_history Missing Partner Field
- **Location**: [`SanctionLimitHistory.ts`](backend/src/entities/SanctionLimitHistory.ts)
- **Problem**: History table doesn't have a `partner` field, making it impossible to track partner-specific changes
- **Impact**: Cannot determine which partner's limit was changed at each approval stage
- **Recommendation**: Add `partner` field to `sanction_limit_history` table

#### Issue #3: Credit L2 Documentation Says LAN Generation
- **Location**: [`workflow.routes.ts:259`](backend/src/routes/workflow.routes.ts:259)
- **Comment**: "Credit Team L2 reviews and approves/rejects (generates LAN ID if approved)"
- **Problem**: No LAN is generated at Credit L2 stage - only after MD approval
- **Recommendation**: Fix comment to remove "generates LAN ID"

#### Issue #4: Case Status Mismatch
- **Location**: [`constants.ts:36`](backend/src/config/constants.ts:36)
- **Problem**: `POST_SANCTION_PENDING: 'md_approved'` - confusing naming
- **Recommendation**: Use clearer status names

### 6.2 Recommended Improvements

1. **Add Partner to Sanction History**: Modify `sanction_limit_history` to include partner field
2. **Fix CEO Permissions**: Allow CEO to edit tenure and interest rate as originally intended
3. **Improve LAN Generation Logic**: Consider generating LAN at earlier stage (Credit L2) for better tracking
4. **Add Partner-Specific Workflow**: Consider separate approval flows per partner
5. **Enhanced Validation**: Add more comprehensive validation for partner-specific sanctions

### 6.3 Data Consistency Check

| Check | Status |
|-------|--------|
| Credit L1 can only edit sanctionAmount | ✅ Implemented |
| Credit L2 can only edit sanctionAmount | ✅ Implemented |
| CEO can edit tenure/ROI | ❌ NOT Implemented (only sanctionAmount) |
| MD can edit all fields | ✅ Implemented |
| Loan accounts created after MD | ✅ Implemented |
| Partner-specific sanctions | ✅ Implemented |
| History tracking | ⚠️ Partial (missing partner field) |

---

## 7. API Endpoints Summary

| Endpoint | Role | Action |
|----------|------|--------|
| `POST /api/workflows/customers/create` | RM | Create customer |
| `POST /api/workflows/customers/:id/submit` | RM | Submit to credit |
| `POST /api/workflows/customers/:id/credit-l1` | CREDIT_L1 | Approve with sanction amount |
| `POST /api/workflows/customers/:id/credit-l2` | CREDIT_L2 | Approve with sanction amount |
| `POST /api/workflows/customers/:id/ceo-approve` | CEO | Approve with terms |
| `POST /api/workflows/customers/:id/rm-submit-md` | RM | Submit final terms to MD |
| `POST /api/workflows/customers/:id/md-approve` | MD | Final approval (creates loan accounts) |
| `POST /api/workflows/customers/:id/ops-submit` | RM | Submit to operations |

---

## 8. Conclusion

The sanction approval flow is well-structured with clear role-based permissions. However, there are a few discrepancies:

1. **CEO permissions need to be fixed** to allow tenure and interest rate editing
2. **History tracking needs improvement** to include partner information
3. **Documentation needs updating** to reflect actual implementation

The multi-partner support is properly implemented, with separate sanction records and loan accounts created for each partner after MD approval.

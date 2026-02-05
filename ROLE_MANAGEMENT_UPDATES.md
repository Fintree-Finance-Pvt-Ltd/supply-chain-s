# Role Management & Approval Flows - Configuration Update

## Overview
Updated the role management system with new hierarchical roles and comprehensive approval flows for different business processes.

---

## 1. NEW ROLES ADDED

### Credit Team (2 levels)
- **Credit Team L1** (credit_team_l1)
  - Level 1 - Initial credit review
  - Email: credit_l1@scf.com

- **Credit Team L2** (credit_team_l2)
  - Level 2 - Secondary credit review
  - Email: credit_l2@scf.com

### Operations Team (3 levels)
- **Operations Team L1** (operations_team_l1)
  - Level 1 - Document verification
  - Email: ops_l1@scf.com

- **Operations Team L2** (operations_team_l2)
  - Level 2 - Further verification
  - Email: ops_l2@scf.com

- **Operations Head** (operations_head)
  - Final operations approval authority
  - Email: ops_head@scf.com

### Existing Roles Retained
- Admin
- Relationship Manager
- CFO
- CEO
- Managing Director

---

## 2. APPROVAL FLOWS CONFIGURED

### 1. Credit Sanction Customer Approval
**Flow ID:** aa0e8400-e29b-41d4-a716-446655440001  
**Sequence:**
1. Credit Team L1 Review
2. Credit Team L2 Review
3. CEO Approval
4. Managing Director Final Approval

### 2. Operations Approval for Customer
**Flow ID:** aa0e8400-e29b-41d4-a716-446655440002  
**Sequence:**
1. Operations Team L1 Verification
2. Operations Head Done

### 3. Invoice Discounting Flow (NEW)
**Flow ID:** aa0e8400-e29b-41d4-a716-446655440003  
**Type:** invoice_discounting  
**Sequence:**
1. Operation L1 Review
2. Operation L2 Review
3. Operation Head Approval
4. CEO Approval
5. Managing Director Approval

### 4. Supplier Onboard Flow (NEW)
**Flow ID:** aa0e8400-e29b-41d4-a716-446655440004  
**Type:** supplier_onboard  
**Sequence:**
1. Operation L1 Onboarding
2. Operation Head Approval

---

## 3. APPROVAL FLOW TYPES

Updated APPROVAL_FLOW_TYPES in constants:
- `credit_sanction` - Credit Sanction approvals
- `operations` - Operations approvals
- `invoice_discounting` - Invoice Discounting (NEW)
- `supplier_onboard` - Supplier Onboarding (NEW)

---

## 4. ROLE PERMISSIONS

### Credit Team L1
- View customers
- Create sanctions
- View sanctions
- View/verify documents

### Credit Team L2
- View customers
- Create sanctions
- View sanctions
- Approve sanctions
- View/verify documents

### Operations Team L1
- View customers
- View operations
- Verify operations
- View/verify documents

### Operations Team L2
- View customers
- View operations
- Verify operations
- Process approvals
- View/verify documents

### Operations Head
- View customers
- View operations
- Verify operations
- View approvals
- Process approvals
- View/verify documents

---

## 5. FILES MODIFIED

1. **backend/src/config/constants.ts**
   - Added new roles to ROLES object
   - Added new approval flow types to APPROVAL_FLOW_TYPES

2. **backend/sql/02_seed_data.sql**
   - Added 5 new roles to the roles table
   - Added role permissions for new roles
   - Added 5 new default users (one per new role)
   - Added user role assignments for new users
   - Added 4 approval flows (2 new + 2 updated)
   - Added 13 approval steps across all flows

---

## 6. DEFAULT USERS

| Email | Name | Role | Password |
|-------|------|------|----------|
| credit_l1@scf.com | Credit Officer L1 | Credit Team L1 | password123 |
| credit_l2@scf.com | Credit Officer L2 | Credit Team L2 | password123 |
| ops_l1@scf.com | Operations Officer L1 | Operations Team L1 | password123 |
| ops_l2@scf.com | Operations Officer L2 | Operations Team L2 | password123 |
| ops_head@scf.com | Operations Head | Operations Head | password123 |

---

## 7. DATABASE SYNC

To apply these changes:

1. Run the updated seed script:
   ```bash
   npm run seed
   ```

2. Or manually execute the SQL migration on your database

---

## 8. NOTES

- All flows are marked as `isSequential: true` (sequential approval required)
- All approval steps are marked as `isRequired: true`
- New roles are marked as `isActive: true`
- All approval flows are active
- Uses UUID format for all IDs (consistent with existing schema)

---

## 9. NEXT STEPS

1. Verify database schema includes all necessary tables:
   - roles
   - users
   - user_roles
   - approval_flows
   - approval_steps
   - role_permissions

2. Test approval flow transitions in your application
3. Verify user authentication with new roles
4. Update frontend role-based access controls if needed

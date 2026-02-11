# Fintree Supply Chain Finance - Application Workflow Documentation

This document outlines the end-to-end business process flow of the Fintree Supply Chain Finance application, from initial customer onboarding to final disbursement.

---

## 1. Authentication & Role-Based Access
- **Login**: Users authenticate using their credentials.
- **Role Assignment**: Each user is assigned a specific role (RM, Credit L1/L2, CEO, MD, Ops L1/Head, Admin).
- **Redirection**: Upon login, users are automatically redirected to their respective role-specific dashboard.

---

## 2. Phase 1: Customer Onboarding (Relationship Manager - RM)
The RM initiates the credit request process.

- **Step 1: New Customer Entry**
  - **Component**: `NewCustomerOnboarding.jsx`
  - **Action**: RM fills in primary details (Name, PAN, Mobile, Business Type, Revenue).
  - **Status**: `Draft`
- **Step 2: Document Collection**
  - **Component**: `RMCaseDetail.jsx`
  - **Action**: RM uploads mandatory documents (KYC, GST Certificate, Bank Statements, ITR).
- **Step 3: Submission to Credit**
  - **Action**: RM adds initial remarks and submits the case.
  - **Status Transition**: `Submitted` -> Moves to **Credit Team L1** bucket.

---

## 3. Phase 2: Credit Evaluation & Sanction (Credit Team)
The Credit Team evaluates the risk and proposes sanction terms.

- **Step 4: Primary Credit Review (Credit L1)**
  - **Component**: `CreditCaseDetail.jsx`
  - **Action**: Verifies uploaded documents, adds verification remarks per document, and proposes initial sanction terms (Amount, Tenure, IRR).
  - **Status Transition**: `Credit_L1_Review` -> `Credit_L1_Approved` (Moves to **Credit L2**).
- **Step 5: Final Credit Review (Credit L2)**
  - **Action**: Reviews L1's proposal, adjusts terms if necessary, and finalizes the Credit Appraisal Memo (CAM).
  - **Status Transition**: `Credit_L2_Review` -> `Credit_L2_Approved` (Moves to **Management**).

---

## 4. Phase 3: Senior Management Approval (CEO & MD)
High-value sanctions require executive sign-off.

- **Step 6: CEO Approval**
  - **Component**: `ApprovalScreen.jsx`
  - **Action**: CEO reviews the credit proposal and CAM. Can revise the sanction amount.
  - **Status Transition**: `CEO_Review` -> `CEO_Approved` (Moves to **MD**).
- **Step 7: Managing Director (MD) Final Sanction**
  - **Action**: MD provides the ultimate approval on sanction terms and conditions.
  - **Status Transition**: `MD_Review` -> `MD_Approved` (Moves back to **RM** for post-sanction activities).

---

## 5. Phase 4: Post-Sanction Activities (Relationship Manager - RM)
Once sanctioned, the case requires legal and fulfillment activities.

- **Step 8: Review Approved Terms**
  - **Component**: `PostSanction.jsx`
  - **Action**: RM reviews the MD-approved terms and shares the Sanction Letter with the customer.
- **Step 9: Bank Details & Fulfillment**
  - **Action**: RM captures and updates the customer's disbursal bank details (Account No, IFSC).
- **Step 10: Digital Journey (e-Sign & e-NACH)**
  - **Action**: RM triggers the digital links for the customer to electronically sign the agreement and set up the repayment mandate (e-NACH).
- **Step 11: Submission to Operations**
  - **Action**: RM uploads post-sanction documents (Security Cheques, Signed Letter) and submits to Ops.
  - **Status Transition**: `MD_Approved` -> `Ops_Pending`.

---

## 6. Phase 5: Verification & Disbursement (Operations Team)
The final check before money is moved.

- **Step 12: Operations Verification (Ops L1)** 
  - **Component**: `OperationsCaseScreen.jsx`
  - **Action**: Performs a "Four-Eye" check on all data, verifies e-Sign completion, and checks bank details accuracy.
  - **Status Transition**: `Ops_Pending` -> `Ops_L1_Approved`.
- **Step 13: Final Disbursement (Operations Head)**
  - **Action**: Final sign-off on the disbursement file.
  - **Status Transition**: `Ops_L1_Approved` -> `Disbursed`.

---

## 7. Phase 6: Admin & System Configuration (Admin)
Maintenance and governance.

- **User Management**: Creating and disabling users across roles.
- **Role & Permission Management**: Configuring what modules each role can access.
- **Audit Trail**: Viewing the history of actions (`statusHistory`) for any specific case.
- **Approval Flow Configuration**: Adjusting approval thresholds and sequences.

---

### **Summary of Status Transitions**
`Draft` -> `Submitted` -> `Credit_L1_Review` -> `Credit_L2_Review` -> `CEO_Review` -> `MD_Review` -> `MD_Approved` -> `Ops_Pending` -> `Disbursed`.

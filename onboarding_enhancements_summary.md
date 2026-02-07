# Task Summary: Customer Onboarding Enhancements

## Key Features Implemented

1.  **Live Photo Capture:**
    *   Integrated live photo capture using `react-webcam` in `NewCustomerOnboarding`.
    *   Allow users to capture "PAN Card" or "Selfie" using camera.

2.  **Document Management:**
    *   **Optional Remarks:** Made verification remarks optional across all screens (`DocumentChecklistUploader`, `CreditCaseDetail`, `OperationsCaseScreen`).
    *   **Preview Only:** Replaced "Download" actions with "Preview" (Eye icon) and opened files in new tab.
    *   **Read-Only Mode:** Implemented read-only views for Dashboards/Details when the case is not in the user's stage or is completed.
    *   **Fix Uploads:** Fixed document upload in `RMCaseDetail`.

3.  **Bank Details & Digital Journey:**
    *   **Bank Type:** Added `bankType` (Savings/Current/Overdraft) to Backend (`Customer` entity) and Frontend (`RMCaseDetail`, `OperationsCaseScreen`).
    *   **Cheque OCR:** Simulated Cheque OCR in `OperationsCaseScreen` to auto-fill bank details (including `bankType`).
    *   **Duplicate Actions:** Prevented duplicate clicks on eNACH/eSign and Bank Detail Save buttons by adding loading states (`isUpdating`) in `RMCaseDetail`.

4.  **UI/UX Improvements:**
    *   **Approval Timeline:** Added `ApprovalTimeline` to `CreditCaseDetail` for better visibility of case history.
    *   **Submission Modal:** Refined submission modal in `NewCustomerOnboarding` to hide background processes (like Credit submission).
    *   **Performance:** Optimized `useEffect` hooks to prevent unnecessary re-fetches.
    *   **Syntax Fixes:** Resolved JSX syntax errors in `NewCustomerOnboarding` and `CreditCaseDetail`.

## Files Modified

*   `frontend/src/pages/rm/NewCustomerOnboarding.jsx`
*   `frontend/src/components/DocumentChecklistUploader.jsx`
*   `frontend/src/pages/credit/CreditCaseDetail.jsx`
*   `frontend/src/pages/operations/OperationsCaseScreen.jsx`
*   `frontend/src/pages/rm/RMCaseDetail.jsx`
*   `backend/src/entities/Customer.ts`
*   `backend/src/services/customer-onboarding.service.ts`

## Next Steps

*   Verify `bankType` persistence in database (migration might be needed if not using `synchronize: true`).
*   Test Live Photo on actual device/camera.
*   Verify Cheque OCR simulation behaves as expected.

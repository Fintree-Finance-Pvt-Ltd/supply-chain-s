# Task Workflow Timing and Visibility System - Implementation Plan

## Overview
This plan implements the requirements for updating the task workflow timing and visibility system with role-based timing rules, SuperAdmin visibility fixes, and filter functionality improvements.

## Task Analysis Summary

### Information Gathered:
1. **user-performance.service.ts**: Main service for performance tracking - uses VALID_ROLES array that needs updating
2. **task-time-tracking.service.ts**: Tracks task timing - completeTask method handles time calculations
3. **superadmin.routes.ts**: SuperAdmin API routes including `/cases` endpoint
4. **TaskTimeTracking entity**: Has companyName column added for display

### Current Issues Identified:
1. VALID_ROLES only includes credit/ops/rm roles - needs to include all operational roles
2. No explicit exclusion of Admin/SuperAdmin from time tracking
3. getAllCasesByUsers method needs improvement for SuperAdmin visibility

### Files to be edited:
1. `backend/src/entities/TaskTimeTracking.ts` - ✓ DONE: Added companyName column
2. `backend/src/services/user-performance.service.ts` - Update VALID_ROLES and add exclusion logic
3. `backend/src/services/task-time-tracking.service.ts` - Add role-based timing logic
4. `backend/src/routes/superadmin.routes.ts` - Improve filter handling and visibility

## Implementation Plan

### Phase 1: Role-Based Timing Rules (Priority: HIGH)
- [ ] 1.1 Update VALID_ROLES to include all operational roles (credit_head, ceo, md)
- [ ] 1.2 Add EXCLUDED_ROLES array for Admin and SuperAdmin
- [ ] 1.3 Implement shouldCalculateTimingForRole() helper function
- [ ] 1.4 Update time calculation to use role-based logic

### Phase 2: SuperAdmin Visibility Fixes (Priority: HIGH)
- [ ] 2.1 Ensure assignedAt is always returned in API responses
- [ ] 2.2 Ensure completedAt is always returned in API responses
- [ ] 2.3 Ensure assigned_to/assignedUser is always visible
- [ ] 2.4 Ensure status field appears in all records

### Phase 3: SuperAdmin Filter Functionality (Priority: HIGH)
- [ ] 3.1 Fix status filters to work correctly
- [ ] 3.2 Fix assigned-user filters to work correctly
- [ ] 3.3 Fix date filters to work correctly
- [ ] 3.4 Fix workflow-stage filters to work correctly

### Phase 4: API Response Consistency (Priority: HIGH)
- [ ] 4.1 Ensure assigned_to maps correctly in responses
- [ ] 4.2 Ensure created_at returns correctly
- [ ] 4.3 Ensure completed_at returns correctly
- [ ] 4.4 Ensure role_stage_time calculates correctly

### Phase 5: Backward Compatibility (Priority: MEDIUM)
- [ ] 5.1 Maintain existing workflow logic
- [ ] 5.2 Ensure no breaking changes to existing APIs
- [ ] 5.3 Test current workflows still function

## Dependent Files:
- `backend/src/entities/TaskTimeTracking.ts`
- `backend/src/services/user-performance.service.ts`
- `backend/src/services/task-time-tracking.service.ts`
- `backend/src/routes/superadmin.routes.ts`
- `backend/src/services/customer-onboarding.service.ts`

## Follow-up Steps:
1. Run TypeScript compilation to check for any errors
2. Test the API endpoints with different role combinations
3. Verify SuperAdmin can see all required fields
4. Test filter functionality works correctly
5. Validate backward compatibility with existing workflows

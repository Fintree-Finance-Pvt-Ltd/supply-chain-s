import { CASE_STATUS } from '../config/constants';

/**
 * Workflow Transition Validator Service
 * Enforces strict state machine transitions for the approval workflow
 * 
 * Valid transitions:
 * DRAFT → SUBMITTED
 * SUBMITTED → CREDIT_L1
 * CREDIT_L1 → CREDIT_L2
 * CREDIT_L2 → CEO
 * CEO → MD
 * MD → OPS_L1
 * OPS_L1 → OPS_HEAD
 * OPS_HEAD → COMPLETED
 */
export class WorkflowValidatorService {

  // Define valid workflow transitions
  private static workflowTransitionMap: Record<string, string[]> = {
    'draft': ['submitted'],
    'submitted': ['credit_l1_approved'],
    'credit_l1_approved': ['credit_l2_approved'],
    'credit_l2_approved': ['ceo_approved'],
    'ceo_approved': ['md_pending_terms', 'md_approved'],
    'md_pending_terms': ['md_approved'],
    'md_approved': ['ops_l1_review'],
    'ops_l1_review': ['ops_l1_approved'],
    'ops_l1_approved': ['ops_head_approved'],
    'ops_head_approved': ['completed'],
    'completed': [],
    'rejected': [],
  };

  // Alias mapping for backward compatibility
  private static statusAliasMap: Record<string, string> = {
    'credit_approved': 'credit_l2_approved',
    'post_sanction_pending': 'md_approved',
    'post_sanction_completed': 'ops_l1_approved',
    'fully_onboarded': 'completed',
  };

  /**
   * Normalize status to canonical form
   */
  private static normalizeStatus(status: string): string {
    const lowerStatus = status.toLowerCase();
    return WorkflowValidatorService.statusAliasMap[lowerStatus] || lowerStatus;
  }

  /**
   * Validate if transition from current status to new status is allowed
   * 
   * @param currentStatus - Current workflow status
   * @param newStatus - Target workflow status
   * @returns true if transition is valid
   */
  static isValidTransition(currentStatus: string, newStatus: string): boolean {
    const normalizedCurrent = WorkflowValidatorService.normalizeStatus(currentStatus);
    const normalizedNew = WorkflowValidatorService.normalizeStatus(newStatus);

    const allowedTransitions = WorkflowValidatorService.workflowTransitionMap[normalizedCurrent];
    
    if (!allowedTransitions) {
      console.error('[WorkflowValidator] No transitions defined for status: ' + normalizedCurrent);
      return false;
    }

    return allowedTransitions.includes(normalizedNew);
  }

  /**
   * Validate and throw error if transition is invalid
   * 
   * @param currentStatus - Current workflow status
   * @param newStatus - Target workflow status
   * @throws Error if transition is not allowed
   */
  static validateTransition(currentStatus: string, newStatus: string): void {
    if (!WorkflowValidatorService.isValidTransition(currentStatus, newStatus)) {
      throw new Error(
        'Invalid workflow transition from "' + currentStatus + '" to "' + newStatus + '". ' +
        'Allowed transitions from "' + currentStatus + '": ' + 
        (WorkflowValidatorService.workflowTransitionMap[WorkflowValidatorService.normalizeStatus(currentStatus)] || []).join(', ')
      );
    }
  }

  /**
   * Get allowed next statuses from current status
   */
  static getAllowedTransitions(currentStatus: string): string[] {
    const normalized = WorkflowValidatorService.normalizeStatus(currentStatus);
    return WorkflowValidatorService.workflowTransitionMap[normalized] || [];
  }

  /**
   * Check if status is a terminal state
   */
  static isTerminalStatus(status: string): boolean {
    const normalized = WorkflowValidatorService.normalizeStatus(status);
    return normalized === 'completed' || normalized === 'rejected';
  }

  /**
   * Get the expected previous status for a given new status
   */
  static getExpectedPreviousStatus(newStatus: string): string | null {
    const normalized = WorkflowValidatorService.normalizeStatus(newStatus);
    
    for (const [current, allowed] of Object.entries(WorkflowValidatorService.workflowTransitionMap)) {
      if (allowed.includes(normalized)) {
        return current;
      }
    }
    
    return null;
  }

  /**
   * Validate that a case can proceed to approval at a specific role
   */
  static validateRoleApproval(currentStatus: string, role: string): boolean {
    const expectedRole = this.getApproverRoleForStatus(currentStatus);
    return expectedRole === role.toUpperCase();
  }

  /**
   * Get the approver role for a given status
   */
  private static getApproverRoleForStatus(status: string): string {
    const normalized = WorkflowValidatorService.normalizeStatus(status);
    
    const roleMap: Record<string, string> = {
      'draft': 'RELATIONSHIP_MANAGER',
      'submitted': 'CREDIT_TEAM_L1',
      'credit_l1_approved': 'CREDIT_TEAM_L2',
      'credit_l2_approved': 'CEO',
      'ceo_approved': 'MD',
      'md_pending_terms': 'RELATIONSHIP_MANAGER',
      'md_approved': 'RELATIONSHIP_MANAGER',
      'ops_l1_review': 'OPERATIONS_TEAM_L1',
      'ops_l1_approved': 'OPERATIONS_HEAD',
      'ops_head_approved': 'NONE',
      'completed': 'NONE',
      'rejected': 'NONE',
    };
    
    return roleMap[normalized] || 'UNKNOWN';
  }
}

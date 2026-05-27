import { AppDataSource } from '../config/database';
import {
  User,
  UserRole,
  Role,
  CaseStatusHistory,
  CaseWorkflow,
  TaskTimeTracking,
  Customer,
  Invoice,
  Supplier,
  ApprovalAction,
} from '../entities';
import { ROLES, CASE_STATUS, APPROVAL_STATUS } from '../config/constants';
import { Repository } from 'typeorm';

/**
 * Task Assignment Result
 */
export interface TaskAssignmentResult {
  caseId: string;
  assignedUserId: number | null;
  assignedUserName: string | null;
  assignedRoleLevel: string;
  assignmentTimestamp: string;
  userPendingCountAfterAssignment: number;
  makerCheckerValidationStatus: 'Pass' | 'Skipped Previous Handler';
  caseType: 'CUSTOMER_ONBOARDING' | 'SUPPLIER_ONBOARDING' | 'INVOICE_DISCOUNTING';
  workflowStage: string;
}

/**
 * User Workload Info
 */
interface UserWorkloadInfo {
  userId: number;
  userName: string;
  roleId: number;
  roleName: string;
  pendingCount: number;
  totalAssigned: number;
  totalCompleted: number;
  lastAssignedAt: Date | null;
  isActive: boolean;
}

/**
 * Task Distribution Statistics
 */
export interface UserTaskStats {
  userId: number;
  userName: string;
  roleName: string;
  totalAssignedCases: number;
  totalCompletedCases: number;
  currentPendingCases: number;
  roleWiseAssignmentCount: Record<string, number>;
  lastAssignmentTimestamp: Date | null;
}

/**
 * Workflow Stage Role Mapping
 */
const WORKFLOW_STAGE_ROLES: Record<string, string> = {
  'credit_l1': ROLES.CREDIT_TEAM_L1,
  'credit_l2': ROLES.CREDIT_TEAM_L2,
  // Removed ops_l1 and ops_l2
};

/**
 * Maker-Checker Stage Pairs
 * These stages cannot have the same user handle consecutive steps
 */
const MAKER_CHECKER_PAIRS: Record<string, string> = {
  [ROLES.CREDIT_TEAM_L1]: ROLES.CREDIT_TEAM_L2,
  [ROLES.OPERATIONS_TEAM_L1]: ROLES.OPERATIONS_TEAM_L2,
};

/**
 * Task Distribution Service
 * 
 * Implements automatic case distribution between users based on workflow stages:
 * RM → Credit L1 → Credit L2 → Ops L1 → Ops L2 → Continue sequentially
 * 
 * Features:
 * - Round-robin distribution
 * - Maker-Checker validation (same user cannot handle consecutive stages)
 * - Case history validation (prevent re-assignment to previous handlers)
 * - Role-based assignment with eligibility checks
 * - Loop continuity for consistent distribution order
 */
export class TaskDistributionService {
  private userRepository: Repository<User>;
  private userRoleRepository: Repository<UserRole>;
  private roleRepository: Repository<Role>;
  private caseStatusHistoryRepository: Repository<CaseStatusHistory>;
  private caseWorkflowRepository: Repository<CaseWorkflow>;
  private taskTimeTrackingRepository: Repository<TaskTimeTracking>;
  private customerRepository: Repository<Customer>;
  private invoiceRepository: Repository<Invoice>;
  private supplierRepository: Repository<Supplier>;
  private approvalActionRepository: Repository<ApprovalAction>;

  /**
   * Round-robin state tracking per workflow stage
   */
  private roundRobinState: Record<string, number> = {};

  constructor() {
    this.userRepository = AppDataSource.getRepository(User);
    this.userRoleRepository = AppDataSource.getRepository(UserRole);
    this.roleRepository = AppDataSource.getRepository(Role);
    this.caseStatusHistoryRepository = AppDataSource.getRepository(CaseStatusHistory);
    this.caseWorkflowRepository = AppDataSource.getRepository(CaseWorkflow);
    this.taskTimeTrackingRepository = AppDataSource.getRepository(TaskTimeTracking);
    this.customerRepository = AppDataSource.getRepository(Customer);
    this.invoiceRepository = AppDataSource.getRepository(Invoice);
    this.supplierRepository = AppDataSource.getRepository(Supplier);
    this.approvalActionRepository = AppDataSource.getRepository(ApprovalAction);
  }

  /**
   * Get eligible users for a specific workflow stage role
   */
  async getEligibleUsersForRole(
    roleName: string,
    workflowStage: string
  ): Promise<UserWorkloadInfo[]> {
    // Find role by name
    const role = await this.roleRepository.findOne({
      where: { name: roleName, isActive: true },
    });

    if (!role) {
      return [];
    }

    // Get all active user roles with this role
    const userRoles = await this.userRoleRepository.find({
      where: { roleId: role.id, isActive: true },
      relations: ['user'],
    });

    // Get pending case counts for each user
    const userWorkloads: UserWorkloadInfo[] = [];

    for (const userRole of userRoles) {
      const user = userRole.user;
      if (!user || !user.isActive) {
        continue;
      }

      // Count pending cases for this user in the current workflow stage
      const pendingCount = await this.getUserPendingCount(user.id, workflowStage);

      // Get total assigned and completed from task tracking
      const stats = await this.getUserTaskStats(user.id);

      userWorkloads.push({
        userId: user.id,
        userName: user.name,
        roleId: role.id,
        roleName: role.name,
        pendingCount,
        totalAssigned: stats.totalAssignedCases,
        totalCompleted: stats.totalCompletedCases,
        lastAssignedAt: stats.lastAssignmentTimestamp,
        isActive: user.isActive,
      });
    }

    return userWorkloads;
  }

  /**
   * Get user's pending case count for a specific workflow stage
   */
  private async getUserPendingCount(userId: number, workflowStage: string): Promise<number> {
    // Get all pending/active cases for this user
    const trackingRecords = await this.taskTimeTrackingRepository.find({
      where: {
        userId,
        status: 'pending',
      },
    });

    // Filter by workflow stage if needed
    // For now, return all pending
    return trackingRecords.length;
  }

  /**
   * Get user's task statistics
   */
  async getUserTaskStats(userId: number): Promise<UserTaskStats> {
    // Get all task tracking records for this user
    const trackingRecords = await this.taskTimeTrackingRepository.find({
      where: { userId },
    });

    const roleWiseCount: Record<string, number> = {};
    let totalAssigned = 0;
    let totalCompleted = 0;
    let lastAssigned: Date | null = null;

    for (const record of trackingRecords) {
      totalAssigned++;
      
      if (record.status === 'completed') {
        totalCompleted++;
      }

      if (record.assignedAt && (!lastAssigned || record.assignedAt > lastAssigned)) {
        lastAssigned = record.assignedAt;
      }

      // Track by role/bucket
      if (record.bucket) {
        roleWiseCount[record.bucket] = (roleWiseCount[record.bucket] || 0) + 1;
      }
    }

    // Get user info
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    const userRoles = await this.userRoleRepository.find({
      where: { userId, isActive: true },
      relations: ['role'],
    });

    const primaryRole = userRoles[0]?.role?.name || 'unknown';

    return {
      userId,
      userName: user?.name || 'Unknown',
      roleName: primaryRole,
      totalAssignedCases: totalAssigned,
      totalCompletedCases: totalCompleted,
      currentPendingCases: totalAssigned - totalCompleted,
      roleWiseAssignmentCount: roleWiseCount,
      lastAssignmentTimestamp: lastAssigned,
    };
  }

  /**
   * Get case history - previous handlers for a case
   */
  async getCaseHistory(caseId: string, caseType: string): Promise<number[]> {
    const previousHandlers: number[] = [];

    // Case status history
    const statusHistory = await this.caseStatusHistoryRepository.find({
      where: {
        customerId: parseInt(caseId),
      },
      order: { createdAt: 'ASC' },
    });

    for (const history of statusHistory) {
      if (!previousHandlers.includes(history.changedBy)) {
        previousHandlers.push(history.changedBy);
      }
    }

    // Approval actions
    const approvalActions = await this.approvalActionRepository.find({
      where: { approverId: undefined }, // This would need proper filtering
    });

    // Get from case workflow if available
    const caseWorkflow = await this.caseWorkflowRepository.findOne({
      where: { id: parseInt(caseId) },
    });

    return previousHandlers;
  }

  /**
   * Check maker-checker validation
   * Returns true if the user can be assigned (not a previous handler in maker stage)
   */
  async validateMakerChecker(
    caseId: string,
    caseType: string,
    userId: number,
    currentStage: string
  ): Promise<boolean> {
    // Get previous handlers for this case
    const previousHandlers = await this.getCaseHistory(caseId, caseType);

    // If user has handled this case before in a previous stage, skip
    if (previousHandlers.includes(userId)) {
      return false;
    }

    // Additional check: if user was the maker in previous stage, they cannot be checker in next
    const makerRole = this.getMakerRoleForStage(currentStage);
    if (makerRole) {
      // Check if user has handled this case in the maker role
      const userRoles = await this.userRoleRepository.find({
        where: { userId, isActive: true },
        relations: ['role'],
      });

      const userRoleNames = userRoles.map(ur => ur.role.name);

      // If user has both maker and checker roles, and was a handler in maker stage, skip
      if (userRoleNames.includes(makerRole) && previousHandlers.includes(userId)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get the maker role for a given checker stage
   */
  private getMakerRoleForStage(checkerStage: string): string | null {
    // Map checker stages to their corresponding maker stages
    const stageMap: Record<string, string> = {
      [ROLES.CREDIT_TEAM_L2]: ROLES.CREDIT_TEAM_L1,
      [ROLES.OPERATIONS_TEAM_L2]: ROLES.OPERATIONS_TEAM_L1,
    };

    return stageMap[checkerStage] || null;
  }

  /**
   * Get the workflow stage from case status
   */
  getWorkflowStageFromStatus(status: string): string {
    const statusToStage: Record<string, string> = {
      [CASE_STATUS.SUBMITTED]: 'credit_l1',  // Directly to Credit L1 when submitted
      [CASE_STATUS.CREDIT_L1_APPROVED]: 'credit_l2',  // To Credit L2 after L1 approval
      [CASE_STATUS.CREDIT_L2_APPROVED]: 'rm_final_terms',
          returned_to_rm: "rm", // ✅ NEW

    };

    return statusToStage[status] || 'unknown';
  }

  /**
   * Get next workflow stage
   */
  getNextWorkflowStage(currentStage: string): string | null {
    const stageSequence = ['credit_l1', 'credit_l2'];
    const currentIndex = stageSequence.indexOf(currentStage);
    
    if (currentIndex === -1 || currentIndex === stageSequence.length - 1) {
      return null;
    }

    return stageSequence[currentIndex + 1];
  }

  /**
   * Get the next round-robin start index from persisted assignment history.
   * This keeps rotation intact even when TaskDistributionService is recreated.
   */
  private async getRoundRobinStartIndex(
    workflowStage: string,
    eligibleUsers: UserWorkloadInfo[]
  ): Promise<number> {
    if (eligibleUsers.length === 0) {
      return 0;
    }

    const userIds = eligibleUsers.map((user) => user.userId);

    const latestAssignment = await this.taskTimeTrackingRepository
      .createQueryBuilder('tracking')
      .where('tracking.bucket = :workflowStage', { workflowStage })
      .andWhere('tracking.userId IN (:...userIds)', { userIds })
      .orderBy('tracking.assignedAt', 'DESC')
      .addOrderBy('tracking.createdAt', 'DESC')
      .getOne();

    if (!latestAssignment) {
      return this.roundRobinState[workflowStage] || 0;
    }

    const lastAssignedIndex = eligibleUsers.findIndex(
      (user) => user.userId === latestAssignment.userId
    );

    if (lastAssignedIndex === -1) {
      return this.roundRobinState[workflowStage] || 0;
    }

    return (lastAssignedIndex + 1) % eligibleUsers.length;
  }

  /**
   * Assign a single case to an eligible user
   * 
   * Algorithm:
   * 1. Get all eligible users for the current workflow stage role
   * 2. Sort users by stable id order
   * 3. Apply round-robin from the last assigned user for this stage
   * 4. Validate maker-checker (skip if user was handler in previous stage)
   * 5. Validate user is active
   */
  async assignCase(
    caseId: string,
    caseType: 'CUSTOMER_ONBOARDING' | 'SUPPLIER_ONBOARDING' | 'INVOICE_DISCOUNTING',
    currentStatus: string,
    workflowStage: string
  ): Promise<TaskAssignmentResult> {
    // Get the role for this workflow stage
    const roleName = WORKFLOW_STAGE_ROLES[workflowStage];
    
    if (!roleName) {
      throw new Error(`Unknown workflow stage: ${workflowStage}`);
    }

    // Get eligible users
    const eligibleUsers = await this.getEligibleUsersForRole(roleName, workflowStage);

    if (eligibleUsers.length === 0) {
      // No eligible users - escalate
      return {
        caseId,
        assignedUserId: null,
        assignedUserName: null,
        assignedRoleLevel: roleName,
        assignmentTimestamp: new Date().toISOString(),
        userPendingCountAfterAssignment: 0,
        makerCheckerValidationStatus: 'Skipped Previous Handler',
        caseType,
        workflowStage,
      };
    }

    // Keep a deterministic rotation order. Pending workload must not affect assignment.
    eligibleUsers.sort((a, b) => a.userId - b.userId);

    // Get round-robin position for this stage
    const lastPosition = await this.getRoundRobinStartIndex(workflowStage, eligibleUsers);

    // Try to find the best user
    let assignedUser: UserWorkloadInfo | null = null;
    let assignedIndex = -1;

    // Start from round-robin position and check all users
    for (let i = 0; i < eligibleUsers.length; i++) {
      const userIndex = (lastPosition + i) % eligibleUsers.length;
      const user = eligibleUsers[userIndex];

      // Check eligibility conditions
      if (!user.isActive) continue;

      // Maker-Checker validation
      const isValid = await this.validateMakerChecker(caseId, caseType, user.userId, workflowStage);
      
      if (!isValid) {
        continue; // Skip this user, try next
      }

      // User is eligible
      assignedUser = user;
      assignedIndex = userIndex;
      break;
    }

    // Update round-robin state
    if (assignedIndex >= 0) {
      this.roundRobinState[workflowStage] = (assignedIndex + 1) % eligibleUsers.length;
    } else {
      // No user found, use last position + 1
      this.roundRobinState[workflowStage] = (lastPosition + 1) % eligibleUsers.length;
    }

    if (!assignedUser) {
      // No eligible user found - escalate
      return {
        caseId,
        assignedUserId: null,
        assignedUserName: null,
        assignedRoleLevel: roleName,
        assignmentTimestamp: new Date().toISOString(),
        userPendingCountAfterAssignment: 0,
        makerCheckerValidationStatus: 'Skipped Previous Handler',
        caseType,
        workflowStage,
      };
    }

    // Create task tracking record
    await this.createTaskTracking(
      assignedUser.userId,
      caseId,
      caseType,
      workflowStage
    );

    return {
      caseId,
      assignedUserId: assignedUser.userId,
      assignedUserName: assignedUser.userName,
      assignedRoleLevel: roleName,
      assignmentTimestamp: new Date().toISOString(),
      userPendingCountAfterAssignment: assignedUser.pendingCount + 1,
      makerCheckerValidationStatus: 'Pass',
      caseType,
      workflowStage,
    };
  }

  /**
   * Create task tracking record
   */
  private async createTaskTracking(
    userId: number,
    caseId: string,
    caseType: string,
    workflowStage: string
  ): Promise<void> {
    const taskTracking = this.taskTimeTrackingRepository.create({
      userId,
      taskId: caseId,
      taskType: caseType,
      bucket: workflowStage,
      assignedAt: new Date(),
      status: 'pending',
    });

    await this.taskTimeTrackingRepository.save(taskTracking);
  }

  /**
   * Distribute multiple cases in batch
   */
  async distributeCases(
    cases: Array<{
      caseId: string;
      caseType: 'CUSTOMER_ONBOARDING' | 'SUPPLIER_ONBOARDING' | 'INVOICE_DISCOUNTING';
      currentStatus: string;
    }>
  ): Promise<TaskAssignmentResult[]> {
    const results: TaskAssignmentResult[] = [];

    for (const caseItem of cases) {
      const workflowStage = this.getWorkflowStageFromStatus(caseItem.currentStatus);
      
      const result = await this.assignCase(
        caseItem.caseId,
        caseItem.caseType,
        caseItem.currentStatus,
        workflowStage
      );

      results.push(result);
    }

    return results;
  }

  /**
   * Get distribution statistics for all users
   */
  async getDistributionStats(): Promise<UserTaskStats[]> {
    const users = await this.userRepository.find({
      where: { isActive: true },
    });

    const stats: UserTaskStats[] = [];

    for (const user of users) {
      const userStats = await this.getUserTaskStats(user.id);
      stats.push(userStats);
    }

    return stats;
  }

  /**
   * Get pending cases for a user by role
   */
  async getUserPendingCasesByRole(
    userId: number,
    roleName: string
  ): Promise<TaskTimeTracking[]> {
    return await this.taskTimeTrackingRepository.find({
      where: {
        userId,
        bucket: roleName,
        status: 'pending',
      },
    });
  }

  /**
   * Mark task as completed
   */
  async completeTask(
    taskId: string,
    userId: number,
    completedAt: Date = new Date()
  ): Promise<void> {
    const task = await this.taskTimeTrackingRepository.findOne({
      where: {
        taskId,
        userId,
      },
    });

    if (task) {
      task.status = 'completed';
      task.completedAt = completedAt;
      
      // Calculate completion time
      if (task.assignedAt) {
        const diff = completedAt.getTime() - task.assignedAt.getTime();
        task.totalCompletionTimeMinutes = Math.round(diff / 60000);
      }

      await this.taskTimeTrackingRepository.save(task);
    }
  }

  /**
   * Get workflow stage for case based on its current status
   */
  getStageFromStatus(status: string): string {
    return this.getWorkflowStageFromStatus(status);
  }

  /**
   * Check if a case needs to be moved to next stage
   */
  shouldMoveToNextStage(currentStatus: string): boolean {
    const stagesWithNext = [
      CASE_STATUS.SUBMITTED,
      CASE_STATUS.CREDIT_L1_APPROVED,
      // Removed ops stages
    ];

    return stagesWithNext.includes(currentStatus as any);
  }
}

export default TaskDistributionService;

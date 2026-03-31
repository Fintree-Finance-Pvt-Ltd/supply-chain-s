import { AppDataSource } from '../config/database';
import {
  ApprovalFlow,
  ApprovalStep,
  ApprovalInstance,
  ApprovalAction,
  CreditSanction,
  OperationsCheck,
  User,
  UserRole,
  Role,
  Customer,
  Invoice,
} from '../entities';
import { APPROVAL_STATUS, APPROVAL_FLOW_TYPES, CASE_STATUS } from '../config/constants';
import { Repository } from 'typeorm';

/**
 * CRITICAL: Approval Flow Engine Service
 * Handles multi-level sequential approval workflows
 * 
 * Implements Maker-Checker segregation:
 * - Maker (L1): Creates/transactions
 * - Checker (L2): Approves/reviews transactions
 * - If same user has both roles, they CANNOT approve their own transactions
 */
export class ApprovalService {
  private approvalFlowRepository: Repository<ApprovalFlow>;
  private approvalStepRepository: Repository<ApprovalStep>;
  private approvalInstanceRepository: Repository<ApprovalInstance>;
  private approvalActionRepository: Repository<ApprovalAction>;
  private creditSanctionRepository: Repository<CreditSanction>;
  private operationsCheckRepository: Repository<OperationsCheck>;
  private userRepository: Repository<User>;
  private userRoleRepository: Repository<UserRole>;
  private customerRepository: Repository<Customer>;
  private invoiceRepository: Repository<Invoice>;

  constructor() {
    this.approvalFlowRepository = AppDataSource.getRepository(ApprovalFlow);
    this.approvalStepRepository = AppDataSource.getRepository(ApprovalStep);
    this.approvalInstanceRepository = AppDataSource.getRepository(ApprovalInstance);
    this.approvalActionRepository = AppDataSource.getRepository(ApprovalAction);
    this.creditSanctionRepository = AppDataSource.getRepository(CreditSanction);
    this.operationsCheckRepository = AppDataSource.getRepository(OperationsCheck);
    this.userRepository = AppDataSource.getRepository(User);
    this.userRoleRepository = AppDataSource.getRepository(UserRole);
    this.customerRepository = AppDataSource.getRepository(Customer);
    this.invoiceRepository = AppDataSource.getRepository(Invoice);
  }

  /**
   * Create an approval instance for credit sanction
   */
  async createCreditSanctionApproval(
    creditSanctionId: number,
    flowType: string = APPROVAL_FLOW_TYPES.CREDIT_SANCTION
  ): Promise<ApprovalInstance> {
    // Get the approval flow
    const approvalFlow = await this.approvalFlowRepository.findOne({
      where: { flowType, isActive: true },
      relations: ['steps'],
    });

    if (!approvalFlow) {
      throw new Error(`Approval flow not found for type: ${flowType}`);
    }

    // Sort steps by order
    const steps = approvalFlow.steps.sort((a, b) => a.stepOrder - b.stepOrder);

    if (steps.length === 0) {
      throw new Error('No approval steps configured');
    }

    // Get first step's approver role
    const firstStep = steps[0];
    const currentApproverId = await this.getNextApprover(firstStep.approverRoleId);

    // Create approval instance
    const approvalInstance = this.approvalInstanceRepository.create({
      approvalFlowId: approvalFlow.id,
      creditSanctionId,
      status: APPROVAL_STATUS.PENDING,
      currentStep: 0,
      currentApproverId,
    });

    return await this.approvalInstanceRepository.save(approvalInstance);
  }

  /**
   * Create an approval instance for operations check
   */
  async createOperationsApproval(
    operationsCheckId: number
  ): Promise<ApprovalInstance> {
    const flowType = APPROVAL_FLOW_TYPES.OPERATIONS;

    const approvalFlow = await this.approvalFlowRepository.findOne({
      where: { flowType, isActive: true },
      relations: ['steps'],
    });

    if (!approvalFlow) {
      throw new Error(`Approval flow not found for type: ${flowType}`);
    }

    const steps = approvalFlow.steps.sort((a, b) => a.stepOrder - b.stepOrder);

    if (steps.length === 0) {
      throw new Error('No approval steps configured');
    }

    const firstStep = steps[0];
    const currentApproverId = await this.getNextApprover(firstStep.approverRoleId);

    const approvalInstance = this.approvalInstanceRepository.create({
      approvalFlowId: approvalFlow.id,
      operationsCheckId,
      status: APPROVAL_STATUS.PENDING,
      currentStep: 0,
      currentApproverId,
    });

    return await this.approvalInstanceRepository.save(approvalInstance);
  }

  /**
   * Process approval action (approve/reject)
   * 
   * CRITICAL: Maker-Checker Validation
   * This method enforces the segregation of duties by preventing a user
   * who has both Maker (L1) and Checker (L2) roles from approving their own transactions.
   * 
   * @param approvalInstanceId - The ID of the approval instance
   * @param approverId - The ID of the user attempting to approve
   * @param action - The action to take (approved/rejected)
   * @param comments - Optional comments
   * @returns Updated ApprovalInstance
   * @throws Error if approver tries to approve their own transaction as both Maker and Checker
   */
  async processApproval(
    approvalInstanceId: number,
    approverId: number,
    action: string,
    comments?: string
  ): Promise<ApprovalInstance> {
    const approvalInstance = await this.approvalInstanceRepository.findOne({
      where: { id: approvalInstanceId },
      relations: ['approvalFlow', 'approvalFlow.steps'],
    });

    if (!approvalInstance) {
      throw new Error('Approval instance not found');
    }

    if (approvalInstance.status !== APPROVAL_STATUS.PENDING) {
      throw new Error('Approval instance is not pending');
    }

    if (approvalInstance.currentApproverId !== approverId) {
      throw new Error('You are not the current approver');
    }

    /**
     * MAKER-CHECKER VALIDATION
     * 
     * Check if the current approver has both Maker (L1) and Checker (L2) roles.
     * If they do, we must verify they are not approving a transaction they created.
     * 
     * This prevents:
     * - Credit Officer (L1) creating a credit sanction, then approving it as Credit Team L2
     * - Operations L1 doing ops check, then approving as Operations L2
     */
    await this.validateMakerCheckerSegregation(approvalInstance, approverId);

    // Get current step
    const steps = approvalInstance.approvalFlow.steps.sort(
      (a, b) => a.stepOrder - b.stepOrder
    );
    const currentStep = steps[approvalInstance.currentStep];

    if (!currentStep) {
      throw new Error('Invalid approval step');
    }

    // Create approval action record
    const approvalAction = this.approvalActionRepository.create({
      approvalInstanceId,
      approverId,
      action: action as string,
      stepOrder: currentStep.stepOrder,
      comments,
    });

    await this.approvalActionRepository.save(approvalAction);

    // If rejected, mark instance as rejected
    if (action === APPROVAL_STATUS.REJECTED) {
      approvalInstance.status = APPROVAL_STATUS.REJECTED;
      approvalInstance.completedAt = new Date();
      approvalInstance.remarks = comments || null;

      // Update related entity status
      await this.updateRelatedEntityStatus(approvalInstance, APPROVAL_STATUS.REJECTED);

      return await this.approvalInstanceRepository.save(approvalInstance);
    }

    // If approved, move to next step
    const nextStepIndex = approvalInstance.currentStep + 1;

    if (nextStepIndex >= steps.length) {
      // All steps completed
      approvalInstance.status = APPROVAL_STATUS.APPROVED;
      approvalInstance.completedAt = new Date();
      approvalInstance.currentApproverId = null;

      // Update related entity status
      await this.updateRelatedEntityStatus(approvalInstance, APPROVAL_STATUS.APPROVED);
    } else {
      // Move to next step
      const nextStep = steps[nextStepIndex];
      const nextApproverId = await this.getNextApprover(nextStep.approverRoleId);

      approvalInstance.currentStep = nextStepIndex;
      approvalInstance.currentApproverId = nextApproverId;
    }

    return await this.approvalInstanceRepository.save(approvalInstance);
  }

  /**
   * Get next approver for a role
   */
  private async getNextApprover(roleId: number | null): Promise<number | null> {
    if (!roleId) {
      return null;
    }

    // Get first active user with this role
    const userRole = await this.userRoleRepository.findOne({
      where: { roleId, isActive: true },
      relations: ['user'],
    });

    return userRole?.user.id || null;
  }

  /**
   * Validates Maker-Checker Segregation
   * 
   * This method enforces the segregation of duties by checking:
   * 1. If the approver has both Maker (L1) and Checker (L2) roles
   * 2. If so, whether they are trying to approve a transaction they created
   * 
   * Supported workflows:
   * - Credit Sanction: creditOfficerId (Maker) vs approver (Checker)
   * - Operations Check: opsUserId (Maker) vs approver (Checker)
   * - Invoice: createdByUserId (Maker) vs approver (Checker)
   * 
   * @param approvalInstance - The approval instance being processed
   * @param approverId - The ID of the user attempting to approve
   * @throws Error if Maker tries to approve their own transaction
   */
  private async validateMakerCheckerSegregation(
    approvalInstance: ApprovalInstance,
    approverId: number
  ): Promise<void> {
    // Step 1: Check if the approver has both Maker (L1) and Checker (L2) roles
    const hasBothRoles = await this.userHasBothMakerAndCheckerRoles(approverId);
    
    if (!hasBothRoles) {
      // User doesn't have both roles - normal approval flow, allow
      return;
    }

    // Step 2: User has both roles - check if they are approving their own transaction
    let creatorId: number | null = null;

    // Check Credit Sanction workflow
    if (approvalInstance.creditSanctionId) {
      const creditSanction = await this.creditSanctionRepository.findOne({
        where: { id: approvalInstance.creditSanctionId },
      });
      creatorId = creditSanction?.creditOfficerId || null;
    }
    
    // Check Operations workflow
    if (approvalInstance.operationsCheckId && !creatorId) {
      const opsCheck = await this.operationsCheckRepository.findOne({
        where: { id: approvalInstance.operationsCheckId },
      });
      creatorId = opsCheck?.opsUserId || null;
    }

    // Step 3: Block if same user is trying to approve their own transaction
    if (creatorId && creatorId === approverId) {
      throw new Error(
        'Maker cannot approve their own transaction. ' +
        'You have both Maker (L1) and Checker (L2) roles, which creates a conflict of interest. '
        + 'Please assign this transaction to another Checker for approval.'
      );
    }
  }

  /**
   * Check if a user has both Maker (L1) and Checker (L2) roles
   * 
   * Maker roles (L1): credit_team_l1, operations_team_l1
   * Checker roles (L2): credit_team_l2, operations_team_l2
   * 
   * @param userId - The user ID to check
   * @returns true if user has both Maker and Checker roles
   */
  private async userHasBothMakerAndCheckerRoles(userId: number): Promise<boolean> {
    // Get all roles for this user
    const userRoles = await this.userRoleRepository.find({
      where: { userId, isActive: true },
      relations: ['role'],
    });

    if (!userRoles || userRoles.length === 0) {
      return false;
    }

    const roleNames = userRoles.map(ur => ur.role.name.toLowerCase());

    // Define Maker and Checker role patterns
    const makerRoles = ['credit_team_l1', 'operations_team_l1'];
    const checkerRoles = ['credit_team_l2', 'operations_team_l2'];

    const hasMakerRole = roleNames.some(name => makerRoles.includes(name));
    const hasCheckerRole = roleNames.some(name => checkerRoles.includes(name));

    // User has both if they have at least one Maker AND one Checker role
    return hasMakerRole && hasCheckerRole;
  }

  /**
   * Update related entity status based on approval
   */
  private async updateRelatedEntityStatus(
    approvalInstance: ApprovalInstance,
    status: string
  ): Promise<void> {
    if (approvalInstance.creditSanctionId) {
      const creditSanction = await this.creditSanctionRepository.findOne({
        where: { id: approvalInstance.creditSanctionId },
        relations: ['customer'],
      });

      if (creditSanction) {
        creditSanction.status = status;
        await this.creditSanctionRepository.save(creditSanction);

        // When credit sanction is approved, update customer status to POST_SANCTION_PENDING
        if (status === APPROVAL_STATUS.APPROVED && creditSanction.customer) {
          const customer = creditSanction.customer;
          customer.status = CASE_STATUS.POST_SANCTION_PENDING;
          await this.customerRepository.save(customer);
        } else if (status === APPROVAL_STATUS.REJECTED && creditSanction.customer) {
          const customer = creditSanction.customer;
          customer.status = CASE_STATUS.REJECTED;
          await this.customerRepository.save(customer);
        }
      }
    }

    if (approvalInstance.operationsCheckId) {
      const opsCheck = await this.operationsCheckRepository.findOne({
        where: { id: approvalInstance.operationsCheckId },
        relations: ['customer'],
      });

      if (opsCheck) {
        opsCheck.status = status;
        await this.operationsCheckRepository.save(opsCheck);

        // When operations is approved, update customer status to FULLY_ONBOARDED
        if (status === APPROVAL_STATUS.APPROVED && opsCheck.customer) {
          const customer = opsCheck.customer;
          customer.status = CASE_STATUS.FULLY_ONBOARDED;
          await this.customerRepository.save(customer);
        } else if (status === APPROVAL_STATUS.REJECTED && opsCheck.customer) {
          const customer = opsCheck.customer;
          customer.status = CASE_STATUS.REJECTED;
          await this.customerRepository.save(customer);
        }
      }
    }
  }

  /**
   * Get pending approvals for a user based on their roles
   * 
   * CRITICAL: When user has both Maker (L1) and Checker (L2) roles:
   * - Show pending cases for ALL roles the user has
   * - Include cases where user already approved at L1 and needs to approve at L2
   * - Exclude cases where user is the creator (Maker of that case) when they have Checker role
   * 
   * This ensures:
   * - Credit Officer (L1) sees cases needing L1 approval
   * - Credit Team L2 sees cases needing L2 approval
   * - User with both L1+L2 sees BOTH sets of pending cases
   * - User who approved at L1 can continue to approve at L2
   * - But NOT cases they themselves created as Maker
   */
  async getPendingApprovalsForUser(userId: number): Promise<ApprovalInstance[]> {
    // Step 1: Get all roles for this user
    const userRoles = await this.userRoleRepository.find({
      where: { userId, isActive: true },
      relations: ['role'],
    });

    if (!userRoles || userRoles.length === 0) {
      return [];
    }

    const roleNames = userRoles.map(ur => ur.role.name.toLowerCase());
    const userRoleIds = userRoles.map(ur => ur.role.id);

    // Step 2: Define Maker and Checker role patterns
    const makerRoles = ['credit_team_l1', 'operations_team_l1'];
    const checkerRoles = ['credit_team_l2', 'operations_team_l2'];

    const hasMakerRole = roleNames.some(name => makerRoles.includes(name));
    const hasCheckerRole = roleNames.some(name => checkerRoles.includes(name));
    const hasBothRoles = hasMakerRole && hasCheckerRole;

    // Step 3: Get ALL pending approval instances (not filtered by currentApproverId)
    // This ensures users can see cases assigned to their role, not just a specific user
    const pendingApprovals = await this.approvalInstanceRepository.find({
      where: {
        status: APPROVAL_STATUS.PENDING,
      },
      relations: [
        'approvalFlow',
        'approvalFlow.steps',
        'approvalFlow.steps.approverRole',
        'creditSanction',
        'creditSanction.customer',
        'creditSanction.creditOfficer',
        'operationsCheck',
        'operationsCheck.customer',
        'operationsCheck.opsUser',
        'actions',
        'actions.approver',
      ],
      order: { createdAt: 'DESC' },
    });

    // Step 4: Filter instances based on user's roles
    const filteredApprovals = pendingApprovals.filter(instance => {
      // Sort steps by order to get proper step sequence
      const steps = (instance.approvalFlow?.steps || []).sort(
        (a, b) => a.stepOrder - b.stepOrder
      );
      
      const currentStep = steps[instance.currentStep];
      
      if (!currentStep || !currentStep.approverRoleId) {
        return false;
      }

      // Get the role name of the current step
      const currentStepRoleName = currentStep.approverRole?.name?.toLowerCase() || '';

      // Check if the current step's role matches any of user's roles
      const isUserRoleStep = userRoleIds.includes(currentStep.approverRoleId);
      
      if (!isUserRoleStep) {
        return false;
      }

      // 🔧 FIX: Filter by assigned user for exclusive visibility
      // If case has assignedUserId, only show to that specific user
      if (instance.creditSanction?.customer?.assignedUserId) {
        if (instance.creditSanction.customer.assignedUserId !== userId) {
          return false; // Not assigned to this user
        }
      }

      // Step 5: If user has both Maker and Checker roles, handle the case properly
      if (hasBothRoles) {
        const isCurrentStepMaker = makerRoles.includes(currentStepRoleName);
        const isCurrentStepChecker = checkerRoles.includes(currentStepRoleName);

        // If current step is L1 (Maker role)
        if (isCurrentStepMaker) {
          // Check if user created this case - exclude if they are the Maker
          if (instance.creditSanctionId && instance.creditSanction) {
            if (instance.creditSanction.creditOfficerId === userId) {
              return false; // Exclude - user is the Maker
            }
          }
          if (instance.operationsCheckId && instance.operationsCheck) {
            if (instance.operationsCheck.opsUserId === userId) {
              return false; // Exclude - user is the Maker
            }
          }
          return true; // Show - user can approve at L1
        }

        // If current step is L2 (Checker role)
        if (isCurrentStepChecker) {
          // For L2 step - exclude cases where user is the Maker of the original case
          // (but now they can approve at L2 since they didn't create it)
          
          // Check credit sanction - if user created it, they can't approve at L2
          if (instance.creditSanctionId && instance.creditSanction) {
            if (instance.creditSanction.creditOfficerId === userId) {
              return false; // Exclude - can't approve own case at L2
            }
          }

          // Check operations check - if user created it, they can't approve at L2
          if (instance.operationsCheckId && instance.operationsCheck) {
            if (instance.operationsCheck.opsUserId === userId) {
              return false; // Exclude - can't approve own case at L2
            }
          }

          return true; // Show - user can approve at L2
        }
      }

      // Step 6: For users with only one role type
      // If user has only Maker role and current step is Maker role
      if (hasMakerRole && !hasCheckerRole) {
        if (makerRoles.includes(currentStepRoleName)) {
          // Exclude cases user created as Maker
          if (instance.creditSanctionId && instance.creditSanction) {
            if (instance.creditSanction.creditOfficerId === userId) {
              return false;
            }
          }
          if (instance.operationsCheckId && instance.operationsCheck) {
            if (instance.operationsCheck.opsUserId === userId) {
              return false;
            }
          }
          return true;
        }
      }

      // If user has only Checker role and current step is Checker role
      if (hasCheckerRole && !hasMakerRole) {
        if (checkerRoles.includes(currentStepRoleName)) {
          return true;
        }
      }

      return false;
    });

    return filteredApprovals;
  }

  /**
   * Get approval history for an instance
   */
  async getApprovalHistory(approvalInstanceId: number): Promise<ApprovalAction[]> {
    return await this.approvalActionRepository.find({
      where: { approvalInstanceId },
      relations: ['approver'],
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Get all approval flows with steps
   */
  async getFlows(): Promise<ApprovalFlow[]> {
    return await this.approvalFlowRepository.find({
      relations: ['steps', 'steps.approverRole'],
      order: { name: 'ASC' },
    });
  }

  /**
   * Update approval flow steps
   */
  async updateFlow(
    flowType: string,
    steps: { roleId: number | string; order: number; name?: string }[]
  ): Promise<ApprovalFlow> {
    const flow = await this.approvalFlowRepository.findOne({
      where: { flowType },
    });

    if (!flow) {
      throw new Error(`Approval flow not found for type: ${flowType}`);
    }

    // Transactional update
    return await AppDataSource.transaction(async (transactionalEntityManager) => {
      // 1. Delete existing steps
      await transactionalEntityManager.delete(ApprovalStep, {
        approvalFlowId: flow.id,
      });

      // 2. Create new steps
      const newSteps: ApprovalStep[] = [];
      const roleRepository = transactionalEntityManager.getRepository(Role); // Helper to find roles

      for (const stepData of steps) {
        let roleIdToUse: number;

        if (typeof stepData.roleId === 'number') {
          roleIdToUse = stepData.roleId;
        } else {
          const role = await roleRepository.findOne({ where: { name: stepData.roleId } });
          if (!role) {
            console.warn(`Role not found for name: ${stepData.roleId}, skipping step.`);
            throw new Error(`Invalid role: ${stepData.roleId}`);
          }
          roleIdToUse = role.id;
        }

        const step = transactionalEntityManager.create(ApprovalStep, {
          approvalFlowId: flow.id,
          approverRoleId: roleIdToUse,
          stepOrder: stepData.order,
          stepName: stepData.name || 'Approval Step',
          isRequired: true,
        });
        newSteps.push(step);
      }

      await transactionalEntityManager.save(ApprovalStep, newSteps);

      // Return updated flow
      return await transactionalEntityManager.findOne(ApprovalFlow, {
        where: { id: flow.id },
        relations: ['steps', 'steps.approverRole'],
      }) as ApprovalFlow;
    });
  }

  /**
   * Create a new approval flow
   */
  async createApprovalFlow(data: {
    name: string;
    flowType: string;
    description?: string;
    isSequential?: boolean;
  }): Promise<ApprovalFlow> {
    const flow = this.approvalFlowRepository.create({
      name: data.name,
      flowType: data.flowType,
      description: data.description,
      isSequential: data.isSequential ?? true,
      isActive: true,
    });

    return await this.approvalFlowRepository.save(flow);
  }

  /**
   * Get all approval flows
   */
  async getAllFlows(): Promise<ApprovalFlow[]> {
    return await this.approvalFlowRepository.find({
      relations: ['steps', 'steps.approverRole'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get approval flow by ID
   */
  async getFlowById(id: number): Promise<ApprovalFlow | null> {
    return await this.approvalFlowRepository.findOne({
      where: { id },
      relations: ['steps', 'steps.approverRole'],
    });
  }

  /**
   * Update approval flow
   */
  async updateApprovalFlow(
    id: number,
    data: Partial<ApprovalFlow>
  ): Promise<ApprovalFlow> {
    const flow = await this.approvalFlowRepository.findOne({ where: { id } });

    if (!flow) {
      throw new Error('Approval flow not found');
    }

    if (data.name) flow.name = data.name;
    if (data.description !== undefined) flow.description = data.description;
    if (data.isActive !== undefined) flow.isActive = data.isActive;
    if (data.isSequential !== undefined) flow.isSequential = data.isSequential;

    return await this.approvalFlowRepository.save(flow);
  }

  /**
   * Delete approval flow
   */
  async deleteApprovalFlow(id: number): Promise<void> {
    const flow = await this.approvalFlowRepository.findOne({ where: { id } });

    if (!flow) {
      throw new Error('Approval flow not found');
    }

    // Hard delete - remove all related steps and instances
    await this.approvalInstanceRepository.delete({ approvalFlowId: id });
    await this.approvalStepRepository.delete({ approvalFlowId: id });
    await this.approvalFlowRepository.delete({ id });
  }

  /**
   * Toggle approval flow status
   */
  async toggleFlowStatus(id: number): Promise<ApprovalFlow> {
    const flow = await this.approvalFlowRepository.findOne({ where: { id } });

    if (!flow) {
      throw new Error('Approval flow not found');
    }

    flow.isActive = !flow.isActive;
    return await this.approvalFlowRepository.save(flow);
  }

  /**
   * Add approval step to flow
   */
  async addApprovalStep(
    flowId: number,
    data: {
      approverRoleId: number;
      stepOrder: number;
      stepName: string;
      isRequired?: boolean;
    }
  ): Promise<ApprovalStep> {
    const flow = await this.approvalFlowRepository.findOne({ where: { id: flowId } });

    if (!flow) {
      throw new Error('Approval flow not found');
    }

    const step = this.approvalStepRepository.create({
      approvalFlowId: flowId,
      approverRoleId: data.approverRoleId,
      stepOrder: data.stepOrder,
      stepName: data.stepName,
      isRequired: data.isRequired ?? true,
    });

    return await this.approvalStepRepository.save(step);
  }

  /**
   * Remove approval step from flow
   */
  async removeApprovalStep(stepId: number): Promise<void> {
    const step = await this.approvalStepRepository.findOne({ where: { id: stepId } });

    if (step) {
      await this.approvalStepRepository.remove(step);
    }
  }

  /**
   * Update approval step
   */
  async updateApprovalStep(
    stepId: number,
    data: Partial<ApprovalStep>
  ): Promise<ApprovalStep> {
    const step = await this.approvalStepRepository.findOne({ where: { id: stepId } });

    if (!step) {
      throw new Error('Approval step not found');
    }

    if (data.approverRoleId) step.approverRoleId = data.approverRoleId;
    if (data.stepOrder) step.stepOrder = data.stepOrder;
    if (data.stepName) step.stepName = data.stepName;
    if (data.isRequired !== undefined) step.isRequired = data.isRequired;

    return await this.approvalStepRepository.save(step);
  }
}



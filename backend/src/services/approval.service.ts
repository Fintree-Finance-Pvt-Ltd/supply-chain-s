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
} from '../entities';
import { APPROVAL_STATUS, APPROVAL_FLOW_TYPES, CASE_STATUS } from '../config/constants';
import { Repository } from 'typeorm';

/**
 * CRITICAL: Approval Flow Engine Service
 * Handles multi-level sequential approval workflows
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
  }

  /**
   * Create an approval instance for credit sanction
   */
  async createCreditSanctionApproval(
    creditSanctionId: string,
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
    operationsCheckId: string
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
   */
  async processApproval(
    approvalInstanceId: string,
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
  private async getNextApprover(roleId: string | null): Promise<number | null> {
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
   * Get pending approvals for a user
   */
  async getPendingApprovalsForUser(userId: number): Promise<ApprovalInstance[]> {
    return await this.approvalInstanceRepository.find({
      where: {
        currentApproverId: userId,
        status: APPROVAL_STATUS.PENDING,
      },
      relations: [
        'approvalFlow',
        'creditSanction',
        'creditSanction.customer',
        'operationsCheck',
        'operationsCheck.customer',
        'actions',
        'actions.approver',
      ],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get approval history for an instance
   */
  async getApprovalHistory(approvalInstanceId: string): Promise<ApprovalAction[]> {
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
    steps: { roleId: string; order: number; name?: string }[]
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
      const newSteps = [];
      const roleRepository = transactionalEntityManager.getRepository(Role); // Helper to find roles

      for (const stepData of steps) {
        let roleId = stepData.roleId;

        // Check if roleId is a UUID or a Role Name
        // Valid UUID regex (simple check)
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roleId);

        if (!isUUID) {
          // Try to find role by name
          const role = await roleRepository.findOne({ where: { name: roleId } });
          if (role) {
            roleId = role.id;
          } else {
            console.warn(`Role not found for name: ${stepData.roleId}, skipping step.`);
            throw new Error(`Invalid role: ${stepData.roleId}`);
          }
        }

        const step = transactionalEntityManager.create(ApprovalStep, {
          approvalFlowId: flow.id,
          approverRoleId: roleId,
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
}


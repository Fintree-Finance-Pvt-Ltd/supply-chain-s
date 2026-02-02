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
} from '../entities';
import { APPROVAL_STATUS, APPROVAL_FLOW_TYPES } from '../config/constants';
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

  constructor() {
    this.approvalFlowRepository = AppDataSource.getRepository(ApprovalFlow);
    this.approvalStepRepository = AppDataSource.getRepository(ApprovalStep);
    this.approvalInstanceRepository = AppDataSource.getRepository(ApprovalInstance);
    this.approvalActionRepository = AppDataSource.getRepository(ApprovalAction);
    this.creditSanctionRepository = AppDataSource.getRepository(CreditSanction);
    this.operationsCheckRepository = AppDataSource.getRepository(OperationsCheck);
    this.userRepository = AppDataSource.getRepository(User);
    this.userRoleRepository = AppDataSource.getRepository(UserRole);
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
    approverId: string,
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
      action: action as APPROVAL_STATUS,
      stepOrder: currentStep.stepOrder,
      comments,
    });

    await this.approvalActionRepository.save(approvalAction);

    // If rejected, mark instance as rejected
    if (action === APPROVAL_STATUS.REJECTED) {
      approvalInstance.status = APPROVAL_STATUS.REJECTED;
      approvalInstance.completedAt = new Date();
      approvalInstance.remarks = comments;

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
  private async getNextApprover(roleId: string | null): Promise<string | null> {
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
    status: APPROVAL_STATUS
  ): Promise<void> {
    if (approvalInstance.creditSanctionId) {
      const creditSanction = await this.creditSanctionRepository.findOne({
        where: { id: approvalInstance.creditSanctionId },
      });

      if (creditSanction) {
        creditSanction.status = status;
        await this.creditSanctionRepository.save(creditSanction);
      }
    }

    if (approvalInstance.operationsCheckId) {
      const opsCheck = await this.operationsCheckRepository.findOne({
        where: { id: approvalInstance.operationsCheckId },
      });

      if (opsCheck) {
        opsCheck.status = status;
        await this.operationsCheckRepository.save(opsCheck);
      }
    }
  }

  /**
   * Get pending approvals for a user
   */
  async getPendingApprovalsForUser(userId: string): Promise<ApprovalInstance[]> {
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
}


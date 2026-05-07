import { AppDataSource } from '../config/database';
import { Customer } from '../entities/Customer';
import { CaseWorkflow } from '../entities/CaseWorkflow';
import { CaseStatusHistory } from '../entities/CaseStatusHistory';
import { CreditSanction } from '../entities/CreditSanction';
import { SanctionLimitHistory } from '../entities/SanctionLimitHistory';
import { LoanAccount, LENDER } from '../entities/LoanAccount';
import { ApprovalInstance } from '../entities/ApprovalInstance';
import { KycVerificationStatus, KycStatus } from '../entities/KycVerificationStatus';
import { LanGeneratorService } from './lan-generator.service';
import { WorkflowValidatorService } from './workflow-validator.service';
import { AuditService } from './audit.service';
import { Invoice } from '../entities/Invoice';
import { Partner, PARTNER_STATUS } from '../entities/Partner';
import { DEFAULT_PARTNER_CODES } from '../config/constants';
import { RewardService } from './reward.service';


export class SanctionService {
  private customerRepository = AppDataSource.getRepository(Customer);
  private workflowRepository = AppDataSource.getRepository(CaseWorkflow);
  private historyRepository = AppDataSource.getRepository(CaseStatusHistory);
  private sanctionRepository = AppDataSource.getRepository(CreditSanction);
  private sanctionHistoryRepository = AppDataSource.getRepository(SanctionLimitHistory);
  private loanAccountRepository = AppDataSource.getRepository(LoanAccount);
  private approvalInstanceRepository = AppDataSource.getRepository(ApprovalInstance);
  private kycRepository = AppDataSource.getRepository(KycVerificationStatus);
  private invoiceRepository = AppDataSource.getRepository(Invoice);
  private partnerRepository = AppDataSource.getRepository(Partner);

  private lanGenerator = new LanGeneratorService();
  private auditService = new AuditService();
  private rewardService = new RewardService();

  /**
   * Get default partner (FFPL) for backward compatibility
   * This will throw if no active partner exists
   */
  private async getDefaultPartner(): Promise<Partner> {
    const defaultPartner = await this.partnerRepository.findOne({
      where: { code: DEFAULT_PARTNER_CODES.FFPL, status: PARTNER_STATUS.ACTIVE }
    });
    
    if (!defaultPartner) {
      throw new Error('Default partner (FFPL) not found or inactive. Please configure partners in the system.');
    }
    
    return defaultPartner;
  }

  /**
   * Validate partner is active (for new sanctions by CREDIT_L1)
   * @param partnerCode - Partner code to validate
   * @param checkActive - Whether to check if partner is active (default true)
   */
  private async validatePartner(partnerCode: string, checkActive: boolean = true): Promise<Partner> {
    const partner = await this.partnerRepository.findOne({
      where: { code: partnerCode.toUpperCase() }
    });
    
    if (!partner) {
      throw new Error(`Partner not found: ${partnerCode}`);
    }
    
    // Only check active status for new sanctions (CREDIT_L1)
    // For existing sanctions (CREDIT_L2, CEO, MD), allow deactivated partners
    if (checkActive && partner.status !== PARTNER_STATUS.ACTIVE) {
      throw new Error(`Partner is not active: ${partnerCode}`);
    }
    
    return partner;
  }

  /**
   * Find partner by code without checking status
   * Used for existing sanctions where partner might be deactivated
   */
  private async findPartnerByCode(partnerCode: string): Promise<Partner | null> {
    return await this.partnerRepository.findOne({
      where: { code: partnerCode.toUpperCase() }
    });
  }

  /**
   * Process credit approval with full transaction safety
   * 
   * @param customerId - Customer ID
   * @param userId - User performing the action
   * @param role - User's role (CREDIT_L1, CREDIT_L2, CEO, MD)
   * @param approved - Whether to approve or reject
   * @param remarks - Approval comments
   * @param sanctionData - Sanction terms (if approving)
   * @param expectedStatus - Expected current status (for duplicate prevention)
   */
  async processCreditApproval(
    customerId: number,
    userId: number,
    role: string,
    approved: boolean,
    remarks: string,
    sanctionData?: {
      sanctionAmount?: number;
      tenure?: number;
      interestRate?: number;
      penalCharges?: number;
      processingFees?: number;
      legalCharges?: number;
      cashCollateral?: number;
      serviceFee?: number;
      
      conditions?: string;
      partnerSanctions?: Array<{
        partner: string;
        sanctionAmount: number;
        tenure?: number;
        interestRate?: number;
        penalCharges?: number;
        processingFees?: number;
        legalCharges?: number;
        cashCollateral?: number;
        serviceFee?: number;
        conditions?: string;
      }>;
    },
    expectedStatus?: string
  ): Promise<{ workflow: CaseWorkflow; customer: Customer }> {
    
    return await AppDataSource.transaction(async (manager) => {
      // Get repositories within transaction
      const customerRepo = manager.getRepository(Customer);
      const workflowRepo = manager.getRepository(CaseWorkflow);
      const historyRepo = manager.getRepository(CaseStatusHistory);
      const sanctionRepo = manager.getRepository(CreditSanction);
      const sanctionHistoryRepo = manager.getRepository(SanctionLimitHistory);
      const loanAccountRepo = manager.getRepository(LoanAccount);

      // ========================================
      // FIX 7: Prevent Duplicate Approval Requests
      // ========================================
      // Validate expected status if provided
      const customer = await customerRepo.findOne({ where: { id: customerId } });
      if (!customer) {
        throw new Error('Customer not found');
      }

      if (expectedStatus && customer.status !== expectedStatus) {
        throw new Error(
          'Duplicate approval request detected. Current status is "' + customer.status + 
          '", expected "' + expectedStatus + '". The case may have already been processed.'
        );
      }

      // ========================================
      // FIX 6: Enforce KYC Before Sanction Approval
      // ========================================
      if (approved && role !== 'rejected') {
        const kycStatus = await manager.getRepository(KycVerificationStatus).find({
          where: { customerId },
        });
        
        // Check if company KYC is verified (panStatus, gstStatus should be VERIFIED)
        const companyKyc = kycStatus.find(k => k.ownerType === 'COMPANY');
        const hasVerifiedKyc = companyKyc && 
          (companyKyc.panStatus === KycStatus.VERIFIED || companyKyc.gstStatus === KycStatus.VERIFIED);
        if (!hasVerifiedKyc) {
          throw new Error('KYC verification is required before sanction approval. Customer KYC is not verified.');
        }
      }

      // ========================================
      // FIX 3: Enforce Strict Workflow Transitions
      // ========================================
      // Determine new status based on role
      const newStatus = this.getNewStatusForRole(customer.status, role, approved);
      
      // Validate transition is allowed
      WorkflowValidatorService.validateTransition(customer.status, newStatus);

      // Get or create workflow
      let workflow = await workflowRepo.findOne({
        where: { customerId, workflowType: 'CUSTOMER_ONBOARDING' as any },
      });

      const previousStatus = workflow?.currentStatus || customer.status;

      // ========================================
      // FIX 4: Prevent Multiple Active Sanctions
      // ========================================
      if (approved && (role === 'CREDIT_L2' || role === 'MD')) {
        // Deactivate previous sanctions
        await sanctionRepo.update(
          { customerId, status: 'approved' },
          { status: 'superseded' }
        );
      }

      // ========================================
      // Process sanction data and generate LAN
      // ========================================
      // Only validate partner is active for CREDIT_L1 (new sanctions)
      // For other roles (CREDIT_L2, CEO, MD), use partner from existing sanctions
      const isNewSanction = role === 'CREDIT_L1' || role === 'CREDIT_TEAM_L1';
      
      if (approved && sanctionData) {
        // Handle multi-partner sanctions
        if (sanctionData.partnerSanctions && sanctionData.partnerSanctions.length > 0) {
          for (const ps of sanctionData.partnerSanctions) {

             
            // For new sanctions (CREDIT_L1), validate partner is active
            // For existing sanctions (CREDIT_L2, CEO, MD), find partner without checking status
            let partner: Partner;
            if (isNewSanction) {
              partner = await this.validatePartner(ps.partner, true);
            } else {
              // For existing sanctions, find partner but don't require active status
              // This allows viewing/editing sanctions even if partner was later deactivated
              partner = await this.findPartnerByCode(ps.partner) as Partner;
              if (!partner) {
                throw new Error(`Partner not found: ${ps.partner}`);
              }
            }
            
            // Generate LAN using transaction-safe service
            const lanId = await this.lanGenerator.getNextLanId(partner.code);

            // Upsert loan account with partner relation
            const existingAccount = await loanAccountRepo.findOne({
              where: { customerId, partnerId: partner.id },
            });

            if (existingAccount) {
              await loanAccountRepo.update(existingAccount.id, {
                sanctionedAmount: ps.sanctionAmount,
                status: 'active',
              });
            } else {
              await loanAccountRepo.save(loanAccountRepo.create({
                customerId,
                partnerId: partner.id,
                lender: ps.partner as any, // Keep for backward compatibility
                lanId,
                sanctionedAmount: ps.sanctionAmount,
                disbursedAmount: 0,
                status: 'active',
              }));
            }

            // Create/update credit sanction (use first partner for backward compatibility)
            // if (ps === sanctionData.partnerSanctions[0]) {
            //   console.log("UPSERT INPUT legalCharges:", ps.legalCharges);
            //   await this.upsertCreditSanction(
            //     sanctionRepo,
            //     customerId,
            //     userId,
            //     ps.sanctionAmount,
            //     ps.tenure,
            //     ps.interestRate,
            //     ps.penalCharges,
            //     ps.processingFees,
            //     ps.legalCharges,
            //     ps.conditions,
            //     role === 'MD' ? 'approved' : 'pending',
            //     ps.partner // Store partner code in credit_sanctions table
            //   );
            // }


            console.log("UPSERT INPUT legalCharges:", ps.legalCharges);

await this.upsertCreditSanction(
  sanctionRepo,
  customerId,
  userId,
  ps.sanctionAmount,
  ps.tenure,
  ps.interestRate,
  ps.penalCharges,
  ps.processingFees,
  ps.legalCharges,  
  ps.cashCollateral,
  ps.serviceFee,
  ps.conditions ,
  role === 'MD' ? 'approved' : 'pending',
  ps.partner
);

            // Insert into sanction_limit_history (append-only via audit service)
            await sanctionHistoryRepo.save(sanctionHistoryRepo.create({
              customerId,
              sanctionAmount: ps.sanctionAmount,
              tenure: ps.tenure || 0,
              interestRate: ps.interestRate || 0,
              penalCharges: ps.penalCharges || 0,
              processingFees: ps.processingFees || 0,
              legalCharges: ps.legalCharges || 0, // ✅ ADD THIS
              serviceFee: ps.serviceFee || 0, // ✅ ADD THIS
              cashCollateral: ps.cashCollateral || 0, // ✅ ADD THIS
              conditions: ps.conditions || undefined,
              remarks: remarks || undefined,
              changedByRole: role,
              changedByUserId: userId,
            }));
          }
        } else if (sanctionData.sanctionAmount) {
          // Legacy single sanction format - determine partner based on role
          let partner: Partner;
          let lender: string;
          
          if (isNewSanction) {
            // For new sanctions, use default partner and validate it's active
            partner = await this.getDefaultPartner();
            lender = partner.code;
          } else {
            // For existing sanctions, try to find existing partner or use default
            partner = await this.findPartnerByCode('FFPL') as Partner;
            if (!partner) {
              partner = await this.getDefaultPartner();
            }
            lender = partner.code;
          }
          
          const lanId = await this.lanGenerator.getNextLanId(lender);

          // Upsert loan account with partner relation
          const existingAccount = await loanAccountRepo.findOne({
            where: { customerId, partnerId: partner.id },
          });

          if (existingAccount) {
            await loanAccountRepo.update(existingAccount.id, {
              sanctionedAmount: sanctionData.sanctionAmount,
              status: 'active',
            });
          } else {
            await loanAccountRepo.save(loanAccountRepo.create({
              customerId,
              partnerId: partner.id,
              lender: lender as any, // Keep for backward compatibility
              lanId,
              sanctionedAmount: sanctionData.sanctionAmount,
              disbursedAmount: 0,
              status: 'active',
            }));
          }

          // Create/update credit sanction
          await this.upsertCreditSanction(
            sanctionRepo,
            customerId,
            userId,
            sanctionData.sanctionAmount,
            sanctionData.tenure,
            sanctionData.interestRate,
            sanctionData.penalCharges,
            sanctionData.processingFees,
            sanctionData.legalCharges, // ✅ ADD THIS
            sanctionData.serviceFee, // ✅ ADD THIS
            sanctionData.cashCollateral , // ✅ ADD THIS
            sanctionData.conditions ,
            role === 'MD' ? 'approved' : 'pending',
            lender
          );

          // Insert into sanction_limit_history
          await sanctionHistoryRepo.save(sanctionHistoryRepo.create({
            customerId,
            sanctionAmount: sanctionData.sanctionAmount,
            tenure: sanctionData.tenure || 0,
            interestRate: sanctionData.interestRate || 0,
            penalCharges: sanctionData.penalCharges || 0,
            processingFees: sanctionData.processingFees || 0,
            legalCharges: sanctionData.legalCharges || 0,
            cashCollateral: sanctionData.cashCollateral || 0,

            serviceFee: sanctionData.serviceFee || 0,
            conditions: sanctionData.conditions || undefined,
            remarks: remarks || undefined,
            changedByRole: role,
            changedByUserId: userId,
          }));
        }
      }

      // ========================================
      // FIX 9: Ensure Customer Status and Workflow Status Stay in Sync
      // ========================================
      // Update workflow
      if (!workflow) {
        workflow = workflowRepo.create({
          workflowType: 'CUSTOMER_ONBOARDING' as any,
          customerId,
          currentStatus: newStatus,
          currentApproverRoleName: this.getApproverRoleForStatus(newStatus),
          remarks,
        });
      } else {
        workflow.currentStatus = newStatus;
        workflow.currentApproverRoleName = this.getApproverRoleForStatus(newStatus);
        workflow.remarks = remarks;
        if (!approved) {
          workflow.isRejected = true;
        }
      }
      await workflowRepo.save(workflow);

      // Update customer status in same transaction
      customer.status = newStatus;
      if (!approved) {
        customer.rejectionReason = remarks;
      }
      await customerRepo.save(customer);

      // ========================================
      // Create audit trail (append-only)
      // ========================================
      await historyRepo.save(historyRepo.create({
        customerId,
        caseWorkflowId: workflow.id,
        status: newStatus,
        previousStatus,
        changedBy: userId,
        remarks,
        sanctionAmount: sanctionData?.sanctionAmount,
        tenure: sanctionData?.tenure,
        interestRate: sanctionData?.interestRate,
        penalCharges: sanctionData?.penalCharges,
        processingFees: sanctionData?.processingFees,
        conditions: sanctionData?.conditions,
      }));

      console.log('[SanctionService] Credit approval processed: customerId=' + customerId + 
        ', role=' + role + ', approved=' + approved + ', newStatus=' + newStatus);

      // ========================================
      // Award reward points for approval status changes
      // ========================================
      if (approved) {
        await this.awardApprovalRewards(customerId, userId, previousStatus, newStatus, role);
      }

      return { workflow, customer };
    });
  }

  /**
   * Helper: Upsert credit sanction
   */
  private async upsertCreditSanction(
    repo: any,
    customerId: number,
    creditOfficerId: number,
    sanctionAmount: number,
    tenure?: number,
    interestRate?: number,
    penalCharges?: number,
    processingFees?: number,
      legalCharges?: number,
      cashCollateral?: number,
      serviceFee?: number,
    conditions?: string,
    
    status?: string,
    partner?: string // Partner code to store in credit_sanctions table
  ): Promise<void> {


    const existing = await repo.findOne({
  where: { customerId, partner }
});

if (existing) {
  await repo.update(existing.id, {
  sanctionAmount: Number(sanctionAmount) || 0,
  tenure: Number(tenure) || 0,
  interestRate: Number(interestRate) || 0,
  penalCharges: Number(penalCharges) || 0,
  processingFees: Number(processingFees) || 0,
  legalCharges: Number(legalCharges) || 0,   //  MUST ADD
  serviceFee: Number(serviceFee) || 0,   //  MUST ADD
  cashCollateral: Number(cashCollateral) || 0, // MUST ADD
  conditions: conditions || null,
    creditOfficerId,
    status: status || 'pending',
    partner,
  });
} else {
  await repo.save(repo.create({
    customerId,
    creditOfficerId,
    sanctionAmount,
    tenure: tenure || 0,
    interestRate: interestRate || 0,
    penalCharges: penalCharges || 0,
    processingFees: processingFees || 0,
    legalCharges: Number(legalCharges) || 0,
    cashCollateral: Number(cashCollateral) || 0,
    serviceFee: Number(serviceFee) || 0, 
    conditions: conditions || null,
    status: status || 'pending',
    partner,
  }));
}
  }

  /**
   * Helper: Get new status based on role
   */
  private getNewStatusForRole(currentStatus: string, role: string, approved: boolean): string {
    if (!approved) {
      return 'rejected';
    }

    const roleStatusMap: Record<string, string> = {
      'CREDIT_L1': 'credit_l1_approved',
      'CREDIT_TEAM_L1': 'credit_l1_approved',
      'CREDIT_L2': 'credit_l2_approved',
      'CREDIT_TEAM_L2': 'credit_l2_approved',
      'CEO': 'ceo_approved',
      'MD': 'md_approved',
    };

    return roleStatusMap[role] || currentStatus;
  }

  /**
   * Helper: Get approver role for status
   */
  private getApproverRoleForStatus(status: string): string {
    const map: Record<string, string> = {
      'draft': 'RELATIONSHIP_MANAGER',
      'submitted': 'CREDIT_TEAM_L1',
      'credit_l1_approved': 'CREDIT_TEAM_L2',
      'credit_l2_approved': 'CEO',
      'ceo_approved': 'MD',
      'md_approved': 'RELATIONSHIP_MANAGER',
      'ops_l1_review': 'OPERATIONS_TEAM_L1',
      'ops_l1_approved': 'OPERATIONS_HEAD',
      'ops_head_approved': 'NONE',
      'completed': 'NONE',
      'rejected': 'NONE',
    };
    return map[status] || 'NONE';
  }

  /**
   * Award reward points for approval status changes
   * Points are calculated based on TIME TAKEN to complete the approval
   * Using reward configuration table:
   * - Fast (0-30 min): 5 points
   * - Medium (31-120 min): 3 points
   * - Slow (121+ min): 1 point
   */
  private async awardApprovalRewards(
    customerId: number,
    userId: number,
    previousStatus: string,
    newStatus: string,
    approverRole: string
  ): Promise<void> {
    try {
      // Define approval milestones
      const approvalTransitions: Record<string, { from: string; to: string; description: string }> = {
        'rm_submit': {
          from: 'draft',
          to: 'submitted',
          description: 'RM submitted case for credit review'
        },
        'credit_l1_approve': {
          from: 'submitted',
          to: 'credit_l1_approved',
          description: 'Credit L1 approved the case'
        },
        'credit_l2_approve': {
          from: 'credit_l1_approved',
          to: 'credit_l2_approved',
          description: 'Credit L2 approved the case'
        },
        'ceo_approve': {
          from: 'credit_l2_approved',
          to: 'ceo_approved',
          description: 'CEO approved the case'
        },
        'md_approve': {
          from: 'ceo_approved',
          to: 'md_approved',
          description: 'MD approved and sanctioned the case'
        },
        'ops_l1_approve': {
          from: 'ops_l1_review',
          to: 'ops_l1_approved',
          description: 'Operations L1 approved the case'
        },
        'ops_head_approve': {
          from: 'ops_l1_approved',
          to: 'ops_head_approved',
          description: 'Operations Head approved the case'
        },
      };

      // Find matching approval transition
      for (const key of Object.keys(approvalTransitions)) {
        const transition = approvalTransitions[key];
        if (previousStatus === transition.from && newStatus === transition.to) {
          // Calculate time taken for this approval stage
          const timeTakenMinutes = await this.calculateApprovalTime(customerId, previousStatus);
          
          // Get points based on time using reward configuration
          const { category, points } = await this.rewardService.calculatePoints(timeTakenMinutes);

          // Award points to the person who performed the action
          await this.rewardService.awardApprovalPoints({
            userId: userId,
            taskId: `approval_${customerId}_${newStatus}`,
            points: points,
            description: `${transition.description} (${category}: ${timeTakenMinutes} min)`,
            taskType: 'APPROVAL'
          });

          console.log(`[SanctionService] Reward awarded: userId=${userId}, points=${points}, category=${category}, timeTaken=${timeTakenMinutes}min`);
          break;
        }
      }
    } catch (error) {
      console.error('[SanctionService] Error awarding approval rewards:', error);
    }
  }

  /**
   * Calculate time taken for approval based on previous status timestamp
   */
  private async calculateApprovalTime(customerId: number, previousStatus: string): Promise<number> {
    try {
      // Get the most recent history entry for this customer with the previous status
      const historyRepo = AppDataSource.getRepository(CaseStatusHistory);
      const history = await historyRepo.find({
        where: { customerId },
        order: { createdAt: 'DESC' },
        take: 10
      });


      // Find the entry where status matches previousStatus
      for (const entry of history) {
        if (entry.status === previousStatus) {
          const diff = new Date().getTime() - new Date(entry.createdAt).getTime();
          return Math.round(diff / 60000); // Convert to minutes
        }
      }

      // If no history found, assume it was quick (use fast category)
      return 0;
    } catch (error) {
      console.error('[SanctionService] Error calculating approval time:', error);
      return 0;
    }
  }

  // ========================================
  // FIX 5: Fix Available Limit Calculation
  // ========================================
  
  /**
   * Calculate available limit for a customer/lender
   * 
   * available_limit = sanction_limit - utilized_limit
   * utilized_limit = sum of outstanding invoices
   */
  async calculateAvailableLimit(customerId: number, partnerCode?: string): Promise<{
    partnerCode: string;
    partnerName: string;
    sanctionedAmount: number;
    utilizedAmount: number;
    availableAmount: number;
  }[]> {
    return await AppDataSource.transaction(async (manager) => {
      const loanAccountRepo = manager.getRepository(LoanAccount);
      const invoiceRepo = manager.getRepository(Invoice);
      const partnerRepo = manager.getRepository(Partner);

      // Get loan accounts
      let query = loanAccountRepo.createQueryBuilder('la')
        .leftJoinAndSelect('la.partner', 'partner')
        .where('la.customerId = :customerId', { customerId });
      
      if (partnerCode) {
        // Validate partner
        const partner = await partnerRepo.findOne({
          where: { code: partnerCode.toUpperCase() }
        });
        if (!partner) {
          throw new Error(`Partner not found: ${partnerCode}`);
        }
        if (partner.status !== PARTNER_STATUS.ACTIVE) {
          throw new Error(`Partner is not active: ${partnerCode}`);
        }
        query = query.andWhere('la.partnerId = :partnerId', { partnerId: partner.id });
      }

      const loanAccounts = await query.getMany();

      const results = [];

      for (const account of loanAccounts) {
        // Calculate utilized amount from disbursed invoices
        const invoices = await invoiceRepo
          .createQueryBuilder('inv')
          .select('SUM(inv.disbursedAmount)', 'total')
          .where('inv.customerId = :customerId', { customerId })
          .andWhere('inv.status NOT IN (:...excludedStatuses)', { 
            excludedStatuses: ['REJECTED', 'DRAFT'] 
          })
          .getRawOne();

        const utilizedAmount = parseFloat(invoices?.total || '0');
        const availableAmount = parseFloat(account.sanctionedAmount.toString()) - utilizedAmount;

        results.push({
          partnerCode: account.partner?.code || account.lender,
          partnerName: account.partner?.name || account.lender,
          sanctionedAmount: parseFloat(account.sanctionedAmount.toString()),
          utilizedAmount,
          availableAmount: Math.max(0, availableAmount),
        });
      }

      return results;
    });
  }

  /**
   * Validate invoice amount against available limit
   */
  async validateInvoiceAmount(customerId: number, invoiceAmount: number, partnerCode?: string): Promise<boolean> {
    const limits = await this.calculateAvailableLimit(customerId, partnerCode);
    
    if (partnerCode) {
      const limit = limits.find(l => l.partnerCode === partnerCode.toUpperCase());
      return limit ? invoiceAmount <= limit.availableAmount : false;
    }

    // Check against any available limit
    return limits.some(l => invoiceAmount <= l.availableAmount);
  }
}

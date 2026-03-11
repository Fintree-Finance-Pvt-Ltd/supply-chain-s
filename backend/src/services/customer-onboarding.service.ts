import { In } from 'typeorm';
import { AppDataSource } from '../config/database';
import { Customer } from '../entities/Customer';
import { CaseWorkflow } from '../entities/CaseWorkflow';
import { CaseStatusHistory } from '../entities/CaseStatusHistory';
import { CreditSanction } from '../entities/CreditSanction';
import { SanctionLimitHistory } from '../entities/SanctionLimitHistory';
import { LoanAccount, LENDER } from '../entities/LoanAccount';
import { KycOwnerType } from '../entities/KycVerificationStatus';
import { CoApplicant } from '../entities/CoApplicant';
import { Partner } from '../entities/Partner';
import { OnboardingIntegrationService } from './onboarding-integration.service';
import { DEFAULT_PARTNER_CODES } from '../config/constants';

export class CustomerOnboardingService {
  private customerRepository = AppDataSource.getRepository(Customer);
  private workflowRepository = AppDataSource.getRepository(CaseWorkflow);
  private historyRepository = AppDataSource.getRepository(CaseStatusHistory);
  private sanctionRepository = AppDataSource.getRepository(CreditSanction);
  private sanctionHistoryRepository = AppDataSource.getRepository(SanctionLimitHistory);
  private loanAccountRepository = AppDataSource.getRepository(LoanAccount);
  private coApplicantRepository = AppDataSource.getRepository(CoApplicant);
  private partnerRepository = AppDataSource.getRepository(Partner);

  // LAN ID sequence - now uses dynamic Partner table

  private onboardingService: OnboardingIntegrationService;

  constructor() {
    this.onboardingService = new OnboardingIntegrationService();
  }

  private async getOrCreateWorkflow(customerId: number, workflowType: string = 'CUSTOMER_ONBOARDING'): Promise<CaseWorkflow> {
    let workflow = await this.workflowRepository.findOne({
      where: { customerId, workflowType: workflowType as any },
    });

    if (!workflow) {
      const customer = await this.customerRepository.findOne({ where: { id: customerId } });
      if (!customer) throw new Error('Customer not found');

      const status = (customer.status || 'draft').toLowerCase();
      workflow = this.workflowRepository.create({
        workflowType: workflowType as any,
        customerId: customer.id,
        currentStatus: status,
        currentApproverRoleName: this.getApproverForStatus(status),
      });
      workflow = await this.workflowRepository.save(workflow);
    }

    return workflow;
  }

  private getApproverForStatus(status: string): string {
    switch (status) {
      case 'draft': return 'RM';
      case 'submitted': return 'CREDIT_TEAM_L1';
      case 'credit_l1_approved': return 'CREDIT_TEAM_L2';
      case 'credit_l2_approved': return 'CEO';
      case 'ceo_approved': return 'MD';
      case 'md_approved': return 'RM';
      case 'ops_l1_review': return 'OPERATIONS_TEAM_L1';
      case 'ops_l1_approved': return 'OPERATIONS_HEAD';
      case 'completed': return 'None';
      default: return 'RM';
    }
  }

  private async logHistory(data: {
    customerId: number;
    supplierId?: number;
    invoiceId?: number;
    caseWorkflowId?: number;
    status: string;
    previousStatus: string;
    changedBy: number;
    remarks?: string;
    sanctionData?: any;
  }) {
    const history = this.historyRepository.create({
      ...data,
      status: data.status,
      previousStatus: data.previousStatus,
      changedBy: data.changedBy,
      remarks: data.remarks,
      ...(data.sanctionData || {})
    });
    return await this.historyRepository.save(history);
  }

  /**
   * Check if financial sanction values have changed
   * Returns true if any of these fields changed: sanctionAmount, tenure, interestRate, penalCharges, processingFees, conditions
   */
  private hasFinancialValuesChanged(oldValues: any, newValues: any): boolean {
    const financialFields = ['sanctionAmount', 'tenure', 'interestRate', 'penalCharges', 'processingFees', 'conditions'];
    
    for (const field of financialFields) {
      const oldValue = oldValues[field];
      const newValue = newValues[field];
      
      // Handle null/undefined/empty string comparisons
      const oldStr = oldValue === null || oldValue === undefined ? '' : String(oldValue);
      const newStr = newValue === null || newValue === undefined ? '' : String(newValue);
      
      if (oldStr !== newStr) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Insert into sanction_limit_history ONLY if financial values changed
   * Returns true if history was inserted, false otherwise
   */
  private async insertSanctionHistoryIfChanged(
    customerId: number,
    oldValues: any,
    newValues: any,
    changedByUserId: number,
    changedByRole: string,
    remarks?: string
  ): Promise<boolean> {
    // Check if financial values changed
    if (!this.hasFinancialValuesChanged(oldValues, newValues)) {
      console.log(`[SanctionHistory] No financial values changed for customer ${customerId}, skipping history insert`);
      return false;
    }
    
    // Insert into sanction_limit_history
    await this.sanctionHistoryRepository.save(this.sanctionHistoryRepository.create({
      customerId,
      changedByUserId,
      changedByRole,
      remarks,
      sanctionAmount: newValues.sanctionAmount || 0,
      tenure: newValues.tenure || 0,
      interestRate: newValues.interestRate || 0,
      penalCharges: newValues.penalCharges || 0,
      processingFees: newValues.processingFees || 0,
      conditions: newValues.conditions || null,
    }));
    
    console.log(`[SanctionHistory] Inserted history for customer ${customerId} due to financial value changes`);
    return true;
  }

  /**
   * Create or update loan account for a lender
   */
  private async upsertLoanAccount(
    customerId: number,
    lender: string,
    sanctionedAmount: number
  ): Promise<string> {
    const lanId = await this.getNextLanId(lender);
    
    // Check if loan account already exists for this lender
    const existingAccount = await this.loanAccountRepository.findOne({
      where: { customerId, lender: lender as any }
    });
    
    if (existingAccount) {
      // Update existing account
      await this.loanAccountRepository.update(existingAccount.id, {
        sanctionedAmount,
        status: 'active',
      });
      console.log(`[LoanAccount] Updated loan account ${existingAccount.lanId} for customer ${customerId}`);
    } else {
      // Create new loan account
      await this.loanAccountRepository.save(this.loanAccountRepository.create({
        customerId,
        lender: lender as any,
        lanId,
        sanctionedAmount,
        disbursedAmount: 0,
        status: 'active',
      }));
      console.log(`[LoanAccount] Created new loan account ${lanId} for customer ${customerId}`);
    }
    
    return lanId;
  }


  async runAllBureausForCustomer(customerId: number) {

    console.log('🔥 runbureaufor customer started', {
  customerId
});
  // Applicant
  await this.onboardingService.checkBureau(
    customerId,
    KycOwnerType.APPLICANT
  );

  // Co-applicants
  const coApplicants = await this.coApplicantRepository.find({
    where: { customerId },
  });

  for (const coApp of coApplicants) {
    await this.onboardingService.checkBureau(
      customerId,
      KycOwnerType.CO_APPLICANT,
      undefined,
      coApp.id
    );
  }
}


  async createCustomer(data: any, rmId: number) {
    // Clean up empty strings for unique/nullable fields to prevent duplicate entry error
    const cleanedData = { ...data };
    if (cleanedData.gstNumber === '') cleanedData.gstNumber = undefined;
    if (cleanedData.customerCode === '') cleanedData.customerCode = undefined;

    const customer = this.customerRepository.create({
      ...cleanedData,
      rmId,
      status: 'draft',
    });
    const savedCustomer = (await this.customerRepository.save(customer)) as unknown as Customer;

    const workflow = this.workflowRepository.create({
      workflowType: 'CUSTOMER_ONBOARDING',
      customerId: savedCustomer.id,
      currentStatus: 'draft',
      currentApproverRoleName: 'RM',
    });
    const savedWorkflow = await this.workflowRepository.save(workflow);

    // Sync customer status
    await this.customerRepository.update(savedCustomer.id, { status: 'draft' as any });

    await this.logHistory({
      customerId: savedCustomer.id,
      caseWorkflowId: savedWorkflow.id,
      status: 'draft',
      previousStatus: 'None',
      changedBy: rmId,
      remarks: 'Customer created in draft state',
    });

    return { customer: savedCustomer, workflow: savedWorkflow };
  }

  async submitCustomer(customerId: number, userId: number, remarks: string, pushedTo?: string) {
    const customer = await this.customerRepository.findOne({ where: { id: customerId } });
    if (!customer) throw new Error('Customer not found');

    const workflow = await this.getOrCreateWorkflow(customerId);
    if (workflow.currentStatus !== 'draft') throw new Error('Can only submit from draft status');

    /* ----------------------------------------
     🔁 SILENT BUREAU (NON-BLOCKING)
  ---------------------------------------- */
  this.runAllBureausForCustomer(customerId)
    .catch(err => {
      console.error(
        `❌ Bureau failed silently for customer=${customerId}`,
        err,
      );
    });

    const previousStatus = workflow.currentStatus;
    workflow.currentStatus = 'submitted';
    workflow.currentApproverRoleName = 'CREDIT_TEAM_L1';
    workflow.remarks = remarks;
    await this.workflowRepository.save(workflow);

    // Sync customer status and pushedTo
    const updateData: any = { status: 'submitted' };
    if (pushedTo) updateData.pushedTo = pushedTo;

    await this.customerRepository.update(customerId, updateData);

    await this.logHistory({
      customerId,
      caseWorkflowId: workflow.id,
      status: 'submitted',
      previousStatus,
      changedBy: userId,
      remarks: remarks + (pushedTo ? ` (Submitted to: ${pushedTo})` : ''),
    });

    return workflow;
  }

  async creditL1Approve(customerId: number, userId: number, remarks: string, approved: boolean, sanctionData?: any) {
    const customer = await this.customerRepository.findOne({ where: { id: customerId } });
    if (!customer) throw new Error('Customer not found');

    const workflow = await this.getOrCreateWorkflow(customerId);
    console.log("currentStatus:", workflow.currentStatus.toLowerCase());
    if (workflow.currentStatus.toLowerCase() !== 'submitted') throw new Error('Cannot approve: Pending at Credit Team L1');

    const previousStatus = workflow.currentStatus;
    workflow.currentStatus = approved ? 'credit_l1_approved' : 'rejected';
    workflow.currentApproverRoleName = approved ? 'CREDIT_TEAM_L2' : 'RM';
    if (!approved) workflow.isRejected = true;
    workflow.remarks = remarks;
    await this.workflowRepository.save(workflow);

    if (approved && sanctionData) {
      const { partnerSanctions } = sanctionData;

      // Get existing sanction values for comparison
      const existingSanction = await this.sanctionRepository.findOne({ where: { customerId } });
      const oldValues = existingSanction || {};

      // Check if we have multiple partner sanctions (new format)
      if (partnerSanctions && Array.isArray(partnerSanctions) && partnerSanctions.length > 0) {
        // Save sanctions for each partner in credit_sanctions table
        for (const ps of partnerSanctions) {
          const partner = ps.partner || 'FFPL';
          
          // Find existing sanction for this customer+partner or create new
          let creditSanction = await this.sanctionRepository.findOne({ 
            where: { customerId, partner } 
          });
          
          if (!creditSanction) {
            const newSanction = this.sanctionRepository.create({
              customerId,
              partner,
              creditOfficerId: userId,
              sanctionAmount: ps.sanctionAmount,
              tenure: ps.tenure || 0,
              interestRate: ps.interestRate || 0,
              conditions: ps.conditions || null,
              penalCharges: ps.penalCharges || 0,
              processingFees: ps.processingFees || 0,
              status: 'pending',
            });
            await this.sanctionRepository.save(newSanction);
          } else {
            // Only update sanctionAmount for Credit L1 (they can only modify this)
            await this.sanctionRepository.update(creditSanction.id, {
              sanctionAmount: ps.sanctionAmount,
              creditOfficerId: userId,
            });
          }
        }

        // Insert into sanction_limit_history ONLY if financial values changed
        const firstPartner = partnerSanctions[0];
        await this.insertSanctionHistoryIfChanged(
          customerId,
          oldValues,
          firstPartner,
          userId,
          'CREDIT_L1',
          remarks
        );
      } else if (sanctionData.sanctionAmount) {
        // Legacy format: single sanction (backward compatibility)
        const lender = sanctionData.lender || 'FFPL';
        
        // Save sanction to credit_sanctions table (loan accounts created after MD approval)
        let sanction = await this.sanctionRepository.findOne({ where: { customerId, partner: lender } });
        if (!sanction) {
          const newSanction = this.sanctionRepository.create({
            customerId,
            partner: lender,
            creditOfficerId: userId,
            ...sanctionData,
            status: 'pending' // Pending full approval
          });
          await this.sanctionRepository.save(newSanction);
        } else {
          // Credit L1 can only update sanctionAmount
          await this.sanctionRepository.update(sanction.id, {
            sanctionAmount: sanctionData.sanctionAmount,
            creditOfficerId: userId
          });
        }

        // Get old values and insert history only if financial values changed
        const oldSanction = await this.sanctionRepository.findOne({ where: { customerId } });
        await this.insertSanctionHistoryIfChanged(
          customerId,
          oldSanction || {},
          sanctionData,
          userId,
          'CREDIT_L1',
          remarks
        );
      }
    }

    // Sync customer status
    await this.customerRepository.update(customerId, { status: workflow.currentStatus as any });

    await this.logHistory({
      customerId,
      caseWorkflowId: workflow.id,
      status: workflow.currentStatus,
      previousStatus,
      changedBy: userId,
      remarks,
      sanctionData
    });

    return workflow;
  }

  /**
   * Get all sanction limits for a customer based on customerId
   * Returns all available partner sanctions (FFPL, MFL, KITE, etc.) from both sanction_limit_history and credit_sanctions
   */
  async getSanctionLimitsByCustomerId(customerId: number): Promise<any[]> {
    // First try to get from sanction_limit_history (has partner column now)
    const historySanctions = await this.sanctionHistoryRepository.find({
      where: { customerId },
      order: { createdAt: 'DESC' },
    });

    // Get all active partners from credit_sanctions table
    const creditSanctions = await this.sanctionRepository.find({
      where: { customerId },
      order: { createdAt: 'DESC' },
    });

    // If we have credit_sanctions data, combine with history
    // This ensures MD sees all partners even if history wasn't recorded properly
    if (creditSanctions && creditSanctions.length > 0) {
      // Get unique partners from credit_sanctions
      const partnerCodes = [...new Set(creditSanctions.map(cs => cs.partner))];
      
      // For each partner, get the latest history entry or use credit_sanctions data
      const result: any[] = [];
      
      for (const partnerCode of partnerCodes) {
        // Try to find history for this partner
        const partnerHistory = historySanctions.find(h => h.partner === partnerCode);
        
        if (partnerHistory) {
          result.push(partnerHistory);
        } else {
          // Use credit_sanctions data if no history exists
          const cs = creditSanctions.find(c => c.partner === partnerCode);
          if (cs) {
            result.push({
              id: cs.id,
              customerId: cs.customerId,
              partner: cs.partner,
              sanctionAmount: cs.sanctionAmount,
              tenure: cs.tenure,
              interestRate: cs.interestRate,
              penalCharges: cs.penalCharges,
              processingFees: cs.processingFees,
              conditions: cs.conditions,
              remarks: 'Loaded from credit_sanctions',
              changedByRole: cs.status,
              createdAt: cs.updatedAt || cs.createdAt
            });
          }
        }
      }
      
      return result;
    }

    return historySanctions;
  }

  private async getNextLanId(lender: string = 'FFPL'): Promise<string> {
    // Look up partner dynamically from database
    const partner = await this.partnerRepository.findOne({
      where: { code: lender.toUpperCase() }
    });
    
    if (!partner) {
      throw new Error(`Unsupported lender: ${lender}`);
    }

    const prefix = partner.lanPrefix || partner.code;
    const startNumber = 10000101; // Default start number

    // Get the maximum lanId for this lender from loan_accounts table
    const result = await this.loanAccountRepository
      .createQueryBuilder('loan')
      .select('MAX(CAST(SUBSTRING(loan.lanId, :prefixLength + 1) AS UNSIGNED))', 'maxId')
      .where('loan.lanId LIKE :prefix AND CAST(SUBSTRING(loan.lanId, :prefixLength + 1) AS UNSIGNED) >= :start', { 
        prefix: `${prefix}%`, 
        prefixLength: prefix.length,
        start: startNumber 
      })
      .getRawOne();

    const nextNumber = (result?.maxId || startNumber - 1) + 1;
    return `${prefix}${nextNumber.toString().padStart(8, '0')}`;
  }

  async creditL2Approve(customerId: number, userId: number, remarks: string, approved: boolean, sanctionData?: any) {
    const customer = await this.customerRepository.findOne({ where: { id: customerId } });
    if (!customer) throw new Error('Customer not found');

    const workflow = await this.getOrCreateWorkflow(customerId);
    if (workflow.currentStatus.toLowerCase() !== 'credit_l1_approved') throw new Error('Cannot approve: Pending at Credit Team L2');

    const previousStatus = workflow.currentStatus;

    if (approved && sanctionData) {
      // Get existing sanction values for comparison
      const existingSanction = await this.sanctionRepository.findOne({ where: { customerId } });
      const oldValues = existingSanction || {};

      // Check if partnerSanctions array is provided (new format for multi-partner support)
      if (sanctionData.partnerSanctions && Array.isArray(sanctionData.partnerSanctions)) {
        // Save sanctions for each partner - Credit L2 can ONLY edit sanctionAmount
        for (const partnerSanction of sanctionData.partnerSanctions) {
          const partner = partnerSanction.partner || 'FFPL';
          
          // Get or create credit sanction for this customer+partner
          let sanction = await this.sanctionRepository.findOne({ where: { customerId, partner } });
          if (!sanction) {
            const newSanction = this.sanctionRepository.create({
              customerId,
              partner,
              creditOfficerId: userId,
              sanctionAmount: partnerSanction.sanctionAmount,
              tenure: 0,
              interestRate: 0,
              penalCharges: 0,
              processingFees: 0,
              conditions: '',
              status: 'pending'
            });
            await this.sanctionRepository.save(newSanction);
          } else {
            // Credit L2 can only update sanctionAmount - keep existing tenure/ROI
            await this.sanctionRepository.update(sanction.id, {
              sanctionAmount: partnerSanction.sanctionAmount,
              creditOfficerId: userId,
            });
          }
        }

        // Insert into sanction_limit_history ONLY if financial values changed
        const firstPartner = sanctionData.partnerSanctions[0];
        await this.insertSanctionHistoryIfChanged(
          customerId,
          oldValues,
          firstPartner,
          userId,
          'CREDIT_L2',
          remarks
        );
      } else {
        // Legacy format: single sanction (backward compatibility)
        // Credit L2 can only update sanctionAmount
        const lenderCode = sanctionData?.lender || 'FFPL';
        
        let sanction = await this.sanctionRepository.findOne({ where: { customerId, partner: lenderCode } });
        if (!sanction) {
          const newSanction = this.sanctionRepository.create({
            customerId,
            partner: lenderCode,
            creditOfficerId: userId,
            sanctionAmount: sanctionData.sanctionAmount,
            tenure: 0,
            interestRate: 0,
            status: 'pending'
          });
          await this.sanctionRepository.save(newSanction);
        } else {
          // Credit L2 can only update sanctionAmount
          await this.sanctionRepository.update(sanction.id, {
            sanctionAmount: sanctionData.sanctionAmount,
            creditOfficerId: userId,
          });
        }

        // Insert history only if financial values changed
        await this.insertSanctionHistoryIfChanged(
          customerId,
          oldValues,
          { sanctionAmount: sanctionData.sanctionAmount },
          userId,
          'CREDIT_L2',
          remarks
        );
      }
    }

    workflow.currentStatus = approved ? 'credit_l2_approved' : 'rejected';
    workflow.currentApproverRoleName = approved ? 'CEO' : 'RM';
    if (!approved) workflow.isRejected = true;
    workflow.remarks = remarks;
    await this.workflowRepository.save(workflow);

    // Sync customer status
    await this.customerRepository.update(customerId, { status: workflow.currentStatus as any });

    await this.logHistory({
      customerId,
      caseWorkflowId: workflow.id,
      status: workflow.currentStatus,
      previousStatus,
      changedBy: userId,
      remarks,
      sanctionData
    });

    return workflow;
  }

  async ceoApprove(customerId: number, userId: number, remarks: string, approved: boolean, sanctionData?: any) {
    const workflow = await this.getOrCreateWorkflow(customerId);
    if (workflow.currentStatus.toLowerCase() !== 'credit_l2_approved') throw new Error('Cannot approve: Pending at CEO');

    const previousStatus = workflow.currentStatus;

    if (approved && sanctionData) {
      // Get existing sanction values for comparison
      const existingSanction = await this.sanctionRepository.findOne({ where: { customerId } });
      const oldValues = existingSanction || {};

      // Check if partnerSanctions array is provided (new format for multi-partner support)
      // CEO can edit: sanctionAmount, tenure, interestRate
      if (sanctionData.partnerSanctions && Array.isArray(sanctionData.partnerSanctions)) {
        // Save sanctions for each partner
        for (const partnerSanction of sanctionData.partnerSanctions) {
          const partner = partnerSanction.partner || 'FFPL';
          
          // Get or create credit sanction for this customer+partner
          let sanction = await this.sanctionRepository.findOne({ where: { customerId, partner } });
          if (!sanction) {
            const newSanction = this.sanctionRepository.create({
              customerId,
              partner,
              creditOfficerId: userId,
              sanctionAmount: partnerSanction.sanctionAmount,
              tenure: partnerSanction.tenure || 0,
              interestRate: partnerSanction.interestRate || 0,
              penalCharges: 0,
              processingFees: 0,
              conditions: '',
              status: 'pending'
            });
            await this.sanctionRepository.save(newSanction);
          } else {
            // CEO can update: sanctionAmount, tenure, interestRate
            await this.sanctionRepository.update(sanction.id, {
              sanctionAmount: partnerSanction.sanctionAmount,
              tenure: partnerSanction.tenure || 0,
              interestRate: partnerSanction.interestRate || 0,
              creditOfficerId: userId,
            });
          }
        }

        // Insert into sanction_limit_history ONLY if financial values changed
        const firstPartner = sanctionData.partnerSanctions[0];
        await this.insertSanctionHistoryIfChanged(
          customerId,
          oldValues,
          firstPartner,
          userId,
          'CEO',
          remarks
        );
      } else {
        // Legacy format: single sanction (backward compatibility)
        // CEO can edit: sanctionAmount, tenure, interestRate
        const lender = sanctionData.lender || 'FFPL';
        
        let sanction = await this.sanctionRepository.findOne({ where: { customerId, partner: lender } });
        if (!sanction) {
          const newSanction = this.sanctionRepository.create({
            customerId,
            partner: lender,
            creditOfficerId: userId,
            sanctionAmount: sanctionData.sanctionAmount,
            tenure: sanctionData.tenure || 0,
            interestRate: sanctionData.interestRate || 0,
            status: 'pending'
          });
          await this.sanctionRepository.save(newSanction);
        } else {
          // CEO can update: sanctionAmount, tenure, interestRate
          await this.sanctionRepository.update(sanction.id, {
            sanctionAmount: sanctionData.sanctionAmount,
            tenure: sanctionData.tenure || 0,
            interestRate: sanctionData.interestRate || 0,
            creditOfficerId: userId,
          });
        }

        // Insert history only if financial values changed
        await this.insertSanctionHistoryIfChanged(
          customerId,
          oldValues,
          sanctionData,
          userId,
          'CEO',
          remarks
        );
      }
    }

    workflow.currentStatus = approved ? 'ceo_approved' : 'rejected';
    workflow.currentApproverRoleName = approved ? 'MD' : 'RM';
    if (!approved) workflow.isRejected = true;
    workflow.remarks = remarks;
    await this.workflowRepository.save(workflow);

    // Sync customer status
    await this.customerRepository.update(customerId, { status: workflow.currentStatus as any });

    await this.logHistory({
      customerId,
      caseWorkflowId: workflow.id,
      status: workflow.currentStatus,
      previousStatus,
      changedBy: userId,
      remarks,
      sanctionData
    });

    return workflow;
  }

  async rmSubmitToMD(customerId: number, rmId: number, remarks: string, sanctionData?: any) {
    const workflow = await this.getOrCreateWorkflow(customerId);
    
    // RM can modify final terms only when status is md_pending_terms (after MD reviewed and sent back to RM)
    if (workflow.currentStatus.toLowerCase() !== 'md_pending_terms') {
      throw new Error('Case must be MD pending terms before RM can modify final terms');
    }

    const previousStatus = workflow.currentStatus;

    // Handle partner-specific sanctions (new format for multi-partner support)
    if (sanctionData && sanctionData.partnerSanctions && Array.isArray(sanctionData.partnerSanctions)) {
      // Update sanctions for each partner
      for (const partnerSanction of sanctionData.partnerSanctions) {
        const partner = partnerSanction.partner || 'FFPL';
        
        // Get existing credit sanction for this customer+partner
        const existingSanction = await this.sanctionRepository.findOne({ where: { customerId, partner } });
        
        if (existingSanction) {
          // Update existing sanction
          await this.sanctionRepository.update(existingSanction.id, {
            sanctionAmount: partnerSanction.sanctionAmount,
            tenure: partnerSanction.tenure || 0,
            interestRate: partnerSanction.interestRate || 0,
            penalCharges: partnerSanction.penalCharges || 0,
            processingFees: partnerSanction.processingFees || 0,
            conditions: partnerSanction.conditions || '',
            status: 'approved',
            creditOfficerId: rmId,
          });
        } else {
          // Create new sanction if not exists
          const newSanction = this.sanctionRepository.create({
            customerId,
            partner,
            creditOfficerId: rmId,
            sanctionAmount: partnerSanction.sanctionAmount,
            tenure: partnerSanction.tenure || 0,
            interestRate: partnerSanction.interestRate || 0,
            penalCharges: partnerSanction.penalCharges || 0,
            processingFees: partnerSanction.processingFees || 0,
            conditions: partnerSanction.conditions || '',
            status: 'approved'
          });
          await this.sanctionRepository.save(newSanction);
        }
      }

      // Record history for ALL partners
      for (const partnerSanction of sanctionData.partnerSanctions) {
        await this.sanctionHistoryRepository.save(this.sanctionHistoryRepository.create({
          customerId,
          partner: partnerSanction.partner || 'FFPL',
          changedByUserId: rmId,
          changedByRole: 'RM',
          remarks: remarks || 'Final terms submitted by RM',
          sanctionAmount: partnerSanction.sanctionAmount,
          tenure: partnerSanction.tenure,
          interestRate: partnerSanction.interestRate,
          penalCharges: partnerSanction.penalCharges || 0,
          processingFees: partnerSanction.processingFees || 0,
          conditions: partnerSanction.conditions || ''
        }));
      }
    } else if (sanctionData) {
      // Legacy single sanction format
      await this.sanctionRepository.update({ customerId }, sanctionData);
      // Record history
      await this.sanctionHistoryRepository.save(this.sanctionHistoryRepository.create({
        customerId,
        partner: sanctionData.lender || 'FFPL',
        changedByUserId: rmId,
        changedByRole: 'RM',
        remarks: remarks || 'Final terms submitted by RM',
        ...sanctionData
      }));
    }

    workflow.currentStatus = 'md_terms_submitted';
    workflow.currentApproverRoleName = 'MD';
    workflow.remarks = remarks;
    await this.workflowRepository.save(workflow);

    // Sync customer status
    await this.customerRepository.update(customerId, { status: workflow.currentStatus as any });

    await this.logHistory({
      customerId,
      caseWorkflowId: workflow.id,
      status: workflow.currentStatus,
      previousStatus,
      changedBy: rmId,
      remarks,
      sanctionData
    });

    return workflow;
  }

  async mdApprove(customerId: number, userId: number, remarks: string, approved: boolean, sanctionData?: any) {
    const workflow = await this.getOrCreateWorkflow(customerId);
    const status = workflow.currentStatus.toLowerCase();
    if (status !== 'ceo_approved' && status !== 'md_terms_submitted') {
      throw new Error('Case not pending at MD for review or final terms');
    }

    const previousStatus = workflow.currentStatus;

    if (approved && sanctionData) {
      // Get existing sanction values for comparison
      const existingSanction = await this.sanctionRepository.findOne({ where: { customerId } });
      const oldValues = existingSanction || {};

      // Check if partnerSanctions array is provided (new format for multi-partner support)
      // MD can edit ALL fields: sanctionAmount, tenure, interestRate, penalCharges, processingFees, conditions
      if (sanctionData.partnerSanctions && Array.isArray(sanctionData.partnerSanctions)) {
        // Save sanctions for each partner
        for (const partnerSanction of sanctionData.partnerSanctions) {
          const partner = partnerSanction.partner || 'FFPL';
          
          // Get or create credit sanction for this customer+partner
          let sanction = await this.sanctionRepository.findOne({ where: { customerId, partner } });
          if (!sanction) {
            const newSanction = this.sanctionRepository.create({
              customerId,
              partner,
              creditOfficerId: userId,
              sanctionAmount: partnerSanction.sanctionAmount,
              tenure: partnerSanction.tenure || 0,
              interestRate: partnerSanction.interestRate || 0,
              penalCharges: partnerSanction.penalCharges || 0,
              processingFees: partnerSanction.processingFees || 0,
              conditions: partnerSanction.conditions || '',
              status: 'approved'
            });
            await this.sanctionRepository.save(newSanction);
          } else {
            // MD can update ALL fields
            await this.sanctionRepository.update(sanction.id, {
              sanctionAmount: partnerSanction.sanctionAmount,
              tenure: partnerSanction.tenure || 0,
              interestRate: partnerSanction.interestRate || 0,
              penalCharges: partnerSanction.penalCharges || 0,
              processingFees: partnerSanction.processingFees || 0,
              conditions: partnerSanction.conditions || '',
              status: 'approved',
              creditOfficerId: userId,
            });
          }
        }

        // Insert into sanction_limit_history ONLY if financial values changed
        const firstPartner = sanctionData.partnerSanctions[0];
        await this.insertSanctionHistoryIfChanged(
          customerId,
          oldValues,
          firstPartner,
          userId,
          'MD',
          remarks
        );
      } else {
        // Legacy format: single sanction (backward compatibility)
        // MD can edit ALL fields
        const lender = sanctionData.lender || 'FFPL';
        
        let sanction = await this.sanctionRepository.findOne({ where: { customerId, partner: lender } });
        if (!sanction) {
          const newSanction = this.sanctionRepository.create({
            customerId,
            partner: lender,
            creditOfficerId: userId,
            sanctionAmount: sanctionData.sanctionAmount,
            tenure: sanctionData.tenure || 0,
            interestRate: sanctionData.interestRate || 0,
            penalCharges: sanctionData.penalCharges || 0,
            processingFees: sanctionData.processingFees || 0,
            conditions: sanctionData.conditions || '',
            status: 'approved'
          });
          await this.sanctionRepository.save(newSanction);
        } else {
          // MD can update ALL fields
          await this.sanctionRepository.update(sanction.id, {
            sanctionAmount: sanctionData.sanctionAmount,
            tenure: sanctionData.tenure || 0,
            interestRate: sanctionData.interestRate || 0,
            penalCharges: sanctionData.penalCharges || 0,
            processingFees: sanctionData.processingFees || 0,
            conditions: sanctionData.conditions || '',
            status: 'approved',
            creditOfficerId: userId,
          });
        }

        // Insert history only if financial values changed
        const existingSanction = await this.sanctionRepository.findOne({ where: { customerId } });
        await this.insertSanctionHistoryIfChanged(
          customerId,
          existingSanction || {},
          sanctionData,
          userId,
          'MD',
          remarks
        );
      }
    }

    if (status === 'ceo_approved') {
      workflow.currentStatus = approved ? 'md_pending_terms' : 'rejected';
    } else {
      workflow.currentStatus = approved ? 'md_approved' : 'rejected';
    }

    // After MD approval (either 1st or 2nd), it returns to RM bucket (RM role)
    workflow.currentApproverRoleName = 'RM';
    if (!approved) workflow.isRejected = true;
    workflow.remarks = remarks;
    await this.workflowRepository.save(workflow);

    // AFTER MD APPROVAL: Create loan accounts from credit_sanctions table
    if (approved) {
      // Read all credit_sanctions for this customer and create loan accounts
      const allSanctions = await this.sanctionRepository.find({ where: { customerId } });
      for (const sanction of allSanctions) {
        const partner = sanction.partner || 'FFPL';
        await this.upsertLoanAccount(customerId, partner, Number(sanction.sanctionAmount));
      }
    }

    // Sync customer status
    await this.customerRepository.update(customerId, { status: workflow.currentStatus as any });

    await this.logHistory({
      customerId,
      caseWorkflowId: workflow.id,
      status: workflow.currentStatus,
      previousStatus,
      changedBy: userId,
      remarks,
      sanctionData
    });

    return workflow;
  }

  async submitForOperationsApproval(customerId: number, rmId: number, remarks: string) {
    const workflow = await this.getOrCreateWorkflow(customerId);
    if (workflow.currentStatus.toLowerCase() !== 'md_approved') throw new Error('Can only submit to Operations after MD Approval');

    const previousStatus = workflow.currentStatus;
    workflow.currentStatus = 'ops_l1_review';
    workflow.currentApproverRoleName = 'OPERATIONS_TEAM_L1';
    workflow.remarks = remarks;
    await this.workflowRepository.save(workflow);

    // Sync customer status
    await this.customerRepository.update(customerId, { status: 'ops_l1_review' as any });

    await this.logHistory({
      customerId,
      caseWorkflowId: workflow.id,
      status: 'ops_l1_review',
      previousStatus,
      changedBy: rmId,
      remarks,
    });

    return workflow;
  }

  async opsL1Approve(customerId: number, userId: number, remarks: string, approved: boolean) {
    const workflow = await this.getOrCreateWorkflow(customerId);
    if (workflow.currentStatus.toLowerCase() !== 'ops_l1_review') throw new Error('Cannot approve: Pending at Operations L1');

    const previousStatus = workflow.currentStatus;
    workflow.currentStatus = approved ? 'ops_l1_approved' : 'rejected';
    workflow.currentApproverRoleName = approved ? 'OPERATIONS_HEAD' : 'RM';
    if (!approved) workflow.isRejected = true;
    workflow.remarks = remarks;
    await this.workflowRepository.save(workflow);

    // Sync customer status
    await this.customerRepository.update(customerId, { status: workflow.currentStatus as any });

    await this.logHistory({
      customerId,
      caseWorkflowId: workflow.id,
      status: workflow.currentStatus,
      previousStatus,
      changedBy: userId,
      remarks,
    });

    return workflow;
  }

  async opsHeadApprove(customerId: number, userId: number, remarks: string) {
    const workflow = await this.getOrCreateWorkflow(customerId);
    if (workflow.currentStatus.toLowerCase() !== 'ops_l1_approved') throw new Error('Cannot approve: Pending at Operations Head');

    const previousStatus = workflow.currentStatus;
    workflow.currentStatus = 'completed';
    workflow.currentApproverRoleName = 'None';
    workflow.isCompleted = true;
    workflow.completedDate = new Date();
    workflow.remarks = remarks;
    await this.workflowRepository.save(workflow);

    // Update customer status to COMPLETED
    const customer = await this.customerRepository.findOne({ where: { id: customerId } });
    if (customer) {
      customer.status = 'completed';
      await this.customerRepository.save(customer);
    }

    await this.logHistory({
      customerId,
      caseWorkflowId: workflow.id,
      status: 'completed',
      previousStatus,
      changedBy: userId,
      remarks,
    });

    return workflow;
  }

  async getRMDashboard(rmId: number) {
    const customers = await this.customerRepository.find({
      where: { rmId },
      relations: ['workflows']
    });

    return {
      totalCustomers: customers?.length || 0,
      draft: customers?.filter((c) => (c.status as string).toLowerCase() === 'draft').length || 0,
      submitted: customers?.filter((c) => !['draft', 'completed', 'rejected'].includes((c.status as string).toLowerCase())).length || 0,
      approved: customers?.filter((c) => (c.status as string).toLowerCase() === 'completed').length || 0,
      rejected: customers?.filter((c) => c.rejectionReason !== null).length || 0,
      customers,
    };
  }

  async getCreditTeamPending(role: string, userId?: number) {
    const r = role.toUpperCase();
    const statusFilter = r === 'CREDIT_TEAM_L2' ? 'credit_l1_approved' : 'submitted';
    console.log(r)  ; 
     console.log(statusFilter)
    // Pending cases
    const pendingWorkflows = await this.workflowRepository.find({
      where: {
        workflowType: 'CUSTOMER_ONBOARDING',
        currentStatus: statusFilter as any,
        currentApproverRoleName: r
      },
      relations: ['customer'],
    });
//  console.log(pendingWorkflows)
    // Handled cases (read-only)
    let handledWorkflows: any[] = [];
    if (userId) {
      const history = await this.historyRepository.find({
        where: { changedBy: userId },
        relations: ['customer', 'caseWorkflow'],
      });
      const handledIds = Array.from(new Set(history.map(h => h.caseWorkflowId).filter(Boolean)));

      handledWorkflows = await this.workflowRepository.find({
        where: { id: handledIds.length > 0 ? In(handledIds) : -1 },
        relations: ['customer'],
      });

      // Filter out those already in pending
      const pendingIds = pendingWorkflows.map(w => w.id);
      handledWorkflows = handledWorkflows.filter(w => !pendingIds.includes(w.id));
    }

    return { pending: pendingWorkflows, handled: handledWorkflows };
  }

  async getExecutivePending(role: string, userId?: number) {
    const r = role.toUpperCase();
    let statusFilter: any = r === 'MD' ? In(['ceo_approved', 'md_terms_submitted']) : 'credit_l2_approved';

    // Pending cases
    const pendingWorkflows = await this.workflowRepository.find({
      where: {
        workflowType: 'CUSTOMER_ONBOARDING',
        currentStatus: statusFilter,
        currentApproverRoleName: r
      },
      relations: ['customer'],
    });

    // Handled cases
    let handledWorkflows: any[] = [];
    if (userId) {
      const history = await this.historyRepository.find({
        where: { changedBy: userId },
        relations: ['customer', 'caseWorkflow'],
      });
      const handledIds = Array.from(new Set(history.map(h => h.caseWorkflowId).filter(Boolean)));

      handledWorkflows = await this.workflowRepository.find({
        where: { id: handledIds.length > 0 ? In(handledIds) : -1 },
        relations: ['customer'],
      });

      const pendingIds = pendingWorkflows.map(w => w.id);
      handledWorkflows = handledWorkflows.filter(w => !pendingIds.includes(w.id));
    }

    return { pending: pendingWorkflows, handled: handledWorkflows };
  }

  async getOperationsPending(role: string, userId?: number) {
    const r = role.toUpperCase();
    const statusFilter = r === 'OPERATIONS_HEAD' ? 'ops_l1_approved' : 'ops_l1_review';

    // Pending cases
    const pendingWorkflows = await this.workflowRepository.find({
      where: {
        workflowType: 'CUSTOMER_ONBOARDING',
        currentStatus: statusFilter as any,
        currentApproverRoleName: r
      },
      relations: ['customer'],
    });

    // Handled cases
    let handledWorkflows: any[] = [];
    if (userId) {
      const history = await this.historyRepository.find({
        where: { changedBy: userId },
        relations: ['customer', 'caseWorkflow'],
      });
      const handledIds = Array.from(new Set(history.map(h => h.caseWorkflowId).filter(Boolean)));

      handledWorkflows = await this.workflowRepository.find({
        where: { id: handledIds.length > 0 ? In(handledIds) : -1 },
        relations: ['customer'],
      });

      const pendingIds = pendingWorkflows.map(w => w.id);
      handledWorkflows = handledWorkflows.filter(w => !pendingIds.includes(w.id));
    }

    return { pending: pendingWorkflows, handled: handledWorkflows };
  }

  async updateBankDetails(customerId: number, data: any) {
    const customer = await this.customerRepository.findOne({ where: { id: customerId } });
    if (!customer) throw new Error('Customer not found');

    const { bankAccountNo, bankIfscCode, bankName, bankBranch, eNachStatus, eSignStatus, sanctionData } = data;

    if (bankAccountNo) customer.bankAccountNo = bankAccountNo;
    if (bankIfscCode) customer.bankIfscCode = bankIfscCode;
    if (bankName) customer.bankName = bankName;
    if (bankBranch) customer.bankBranch = bankBranch;
    if (data.bankType) customer.bankType = data.bankType;
    if (eNachStatus) customer.eNachStatus = eNachStatus;
    if (eSignStatus) customer.eSignStatus = eSignStatus;

    if (sanctionData) {
      await this.sanctionRepository.update({ customerId }, sanctionData);
    }

    return await this.customerRepository.save(customer);
  }
}

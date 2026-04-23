import { In } from "typeorm";
import { AppDataSource } from "../config/database";
import { Customer } from "../entities/Customer";
import { CaseWorkflow } from "../entities/CaseWorkflow";
import { CaseStatusHistory } from "../entities/CaseStatusHistory";
import { CreditSanction } from "../entities/CreditSanction";
import { SanctionLimitHistory } from "../entities/SanctionLimitHistory";
import { LoanAccount, LENDER } from "../entities/LoanAccount";
import { KycOwnerType } from "../entities/KycVerificationStatus";
import { CoApplicant } from "../entities/CoApplicant";
import { Partner } from "../entities/Partner";
import { KycDetail } from "../entities/KycDetail";
import { CustomerAddress } from "../entities/CustomerAddress";
import { OnboardingIntegrationService } from "./onboarding-integration.service";
import { TaskDistributionService } from "./task-distribution.service";
import { DEFAULT_PARTNER_CODES } from "../config/constants";
import { WorkflowValidatorService } from "./workflow-validator.service";
import { AuditService } from "./audit.service";
import { RewardService } from "./reward.service";
import axios from "axios";

/**
 * LMS Supply Chain API Payload interfaces
 */
interface LMSSupplyChainPayload {
  partner_loan_id: string;
  applicant: {
    name: string;
    pan: string;
    aadhaar: string;
    mobile: string;
    address: string;
  };
  co_applicant?: {
    name: string;
    pan: string;
    aadhaar: string;
    mobile: string;
    address: string;
  };
  company: {
    name: string;
    pan: string;
    gst: string;
    address: string;
  };
  sanctions: Array<{
    lan: string;
    lender: string;
    sanction_amount: number;
    tenure_months: number;
    interest_rate: number;
    penal_rate: number;
    processing_fee: number;
  }>;
}

export class CustomerOnboardingService {
  private customerRepository = AppDataSource.getRepository(Customer);
  private workflowRepository = AppDataSource.getRepository(CaseWorkflow);
  private historyRepository = AppDataSource.getRepository(CaseStatusHistory);
  private sanctionRepository = AppDataSource.getRepository(CreditSanction);
  private sanctionHistoryRepository =
    AppDataSource.getRepository(SanctionLimitHistory);
  private loanAccountRepository = AppDataSource.getRepository(LoanAccount);
  private coApplicantRepository = AppDataSource.getRepository(CoApplicant);
  private partnerRepository = AppDataSource.getRepository(Partner);
  private kycDetailRepository = AppDataSource.getRepository(KycDetail);
  private customerAddressRepository =
    AppDataSource.getRepository(CustomerAddress);

  // LAN ID sequence - now uses dynamic Partner table

  private onboardingService: OnboardingIntegrationService;
  private rewardService = new RewardService();

  constructor() {
    this.onboardingService = new OnboardingIntegrationService();
  }

  private async getOrCreateWorkflow(
    customerId: number,
    workflowType: string = "CUSTOMER_ONBOARDING",
  ): Promise<CaseWorkflow> {
    let workflow = await this.workflowRepository.findOne({
      where: { customerId, workflowType: workflowType as any },
    });

    if (!workflow) {
      const customer = await this.customerRepository.findOne({
        where: { id: customerId },
      });
      if (!customer) throw new Error("Customer not found");

      const status = (customer.status || "draft").toLowerCase();
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
      case "draft":
        return "RM";
      case "submitted":
        return "CREDIT_TEAM_L1";
      case "credit_l1_approved":
        return "CREDIT_TEAM_L2";
      case "credit_l2_approved":
        return "CEO";
      case "ceo_approved":
        return "MD";
      case "md_approved":
        return "RM";
      case "ops_l1_review":
        return "OPERATIONS_TEAM_L1";
      case "ops_l1_approved":
        return "OPERATIONS_HEAD";
      case "completed":
        return "None";
      default:
        return "RM";
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
      ...(data.sanctionData || {}),
    });
    return await this.historyRepository.save(history);
  }

  /**
   * Check if financial sanction values have changed
   * Returns true if any of these fields changed: sanctionAmount, tenure, interestRate, penalCharges, processingFees, conditions
   */
  private hasFinancialValuesChanged(oldValues: any, newValues: any): boolean {
    const financialFields = [
      "sanctionAmount",
      "tenure",
      "interestRate",
      "penalCharges",
      "processingFees",
      "conditions",
    ];

    for (const field of financialFields) {
      const oldValue = oldValues[field];
      const newValue = newValues[field];

      // Handle null/undefined/empty string comparisons
      const oldStr =
        oldValue === null || oldValue === undefined ? "" : String(oldValue);
      const newStr =
        newValue === null || newValue === undefined ? "" : String(newValue);

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
    remarks?: string,
  ): Promise<boolean> {
    // Check if financial values changed
    if (!this.hasFinancialValuesChanged(oldValues, newValues)) {
      console.log(
        `[SanctionHistory] No financial values changed for customer ${customerId}, skipping history insert`,
      );
      return false;
    }

    // Insert into sanction_limit_history
    await this.sanctionHistoryRepository.save(
      this.sanctionHistoryRepository.create({
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
      }),
    );

    console.log(
      `[SanctionHistory] Inserted history for customer ${customerId} due to financial value changes`,
    );
    return true;
  }

  /**
   * Create or update loan account for a lender
   */
  private async upsertLoanAccount(
    customerId: number,
    lender: string,
    sanctionedAmount: number,
  ): Promise<string> {
    const partner = await this.partnerRepository.findOne({
      where: { code: lender.toUpperCase() },
    });

    const partnerId = partner?.id || null;

    // FIRST check if account exists
    const existingAccount = await this.loanAccountRepository.findOne({
      where: { customerId, lender: lender as any },
    });

    if (existingAccount) {
      await this.loanAccountRepository.update(existingAccount.id, {
        sanctionedAmount,
        status: "active",
        partnerId: existingAccount.partnerId || partnerId,
      });

      console.log(
        `[LoanAccount] Updated loan account ${existingAccount.lanId}`,
      );
      return existingAccount.lanId;
    }

    // ONLY generate LAN when creating new account
    const lanId = await this.getNextLanId(lender);

    await this.loanAccountRepository.save(
      this.loanAccountRepository.create({
        customerId,
        partnerId,
        lender: lender as any,
        lanId,
        sanctionedAmount,
        disbursedAmount: 0,
        status: "active",
      }),
    );

    console.log(`[LoanAccount] Created new loan account ${lanId}`);

    return lanId;
  }

  async runAllBureausForCustomer(customerId: number) {
    console.log("🔥 runbureaufor customer started", {
      customerId,
    });
    // Applicant
    await this.onboardingService.checkBureau(
      customerId,
      KycOwnerType.APPLICANT,
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
        coApp.id,
      );
    }
  }

  async createCustomer(data: any, rmId: number) {
    // Clean up empty strings for unique/nullable fields to prevent duplicate entry error
    const cleanedData = { ...data };
    if (cleanedData.gstNumber === "") cleanedData.gstNumber = undefined;
    if (cleanedData.customerCode === "") cleanedData.customerCode = undefined;

    const customer = this.customerRepository.create({
      ...cleanedData,
      rmId,
      status: "draft",
    });
    const savedCustomer = (await this.customerRepository.save(
      customer,
    )) as unknown as Customer;

    const workflow = this.workflowRepository.create({
      workflowType: "CUSTOMER_ONBOARDING",
      customerId: savedCustomer.id,
      currentStatus: "draft",
      currentApproverRoleName: "RM",
    });
    const savedWorkflow = await this.workflowRepository.save(workflow);

    // Sync customer status
    await this.customerRepository.update(savedCustomer.id, {
      status: "draft" as any,
    });

    await this.logHistory({
      customerId: savedCustomer.id,
      caseWorkflowId: savedWorkflow.id,
      status: "draft",
      previousStatus: "None",
      changedBy: rmId,
      remarks: "Customer created in draft state",
    });

    return { customer: savedCustomer, workflow: savedWorkflow };
  }

  async submitCustomer(
    customerId: number,
    userId: number,
    remarks: string,
    pushedTo?: string,
  ) {
    const customer = await this.customerRepository.findOne({
      where: { id: customerId },
    });
    if (!customer) throw new Error("Customer not found");

    const workflow = await this.getOrCreateWorkflow(customerId);
    if (workflow.currentStatus !== "draft" &&
  workflow.currentStatus !== "returned_to_rm" )
    throw new Error("Submission allowed only from draft or returned cases");
   
  // throw new Error("Can only submit from draft status");

    /* ----------------------------------------
     🔁 SILENT BUREAU (NON-BLOCKING)
   ---------------------------------------- */
    this.runAllBureausForCustomer(customerId).catch((err) => {
      console.error(
        `❌ Bureau failed silently for customer=${customerId}`,
        err,
      );
    });

    const previousStatus = workflow.currentStatus;
    // workflow.currentStatus = "submitted";
    // workflow.currentApproverRoleName = "CREDIT_TEAM_L1";
    let newStatus = "submitted";
let approverRole = "CREDIT_TEAM_L1";

if (pushedTo === "rm") {
  newStatus = "returned_to_rm";
  approverRole = "RELATIONSHIP_MANAGER";
}

workflow.currentStatus = newStatus;
workflow.currentApproverRoleName = approverRole;
workflow.remarks = remarks;
    workflow.remarks = remarks;

    // 🔧 FIX: Trigger task distribution and assign user
    try {
      const taskDistributionService = new TaskDistributionService();
      // const workflowStage =
      //   taskDistributionService.getWorkflowStageFromStatus("submitted");
const workflowStage =
  taskDistributionService.getWorkflowStageFromStatus(newStatus);

let assignedUserId: number | undefined =
  workflow.assignedUserId ?? undefined;

  // If case already had a Credit user earlier → reuse same user
  if (!assignedUserId && newStatus === "submitted") {
    const assignmentResult =
      await taskDistributionService.assignCase(
        customerId.toString(),
        "CUSTOMER_ONBOARDING",
        newStatus,
        // "submitted",
        workflowStage,
      );

    assignedUserId = assignmentResult.assignedUserId ?? undefined;
  }

  if (assignedUserId) {
    workflow.assignedUserId = assignedUserId;
    workflow.assignedStage = workflowStage;

    await this.customerRepository.update(customerId, {
      assignedUserId,
      assignedStage: workflowStage,
    });
      // const assignmentResult = await taskDistributionService.assignCase(
      //   customerId.toString(),
      //   "CUSTOMER_ONBOARDING",
      //   "submitted",
      //   workflowStage,
      // );

      // if (assignmentResult.assignedUserId) {
      //   // Update workflow with assigned user
      //   workflow.assignedUserId = assignmentResult.assignedUserId;
      //   workflow.assignedStage = workflowStage;

      //   // Also update customer record
      //   await this.customerRepository.update(customerId, {
      //     assignedUserId: assignmentResult.assignedUserId,
      //     assignedStage: workflowStage,
      //   });

        console.log(
          `[TaskDistribution] Case ${customerId} assigned to user ${assignedUserId})`,
        );
      } else {
        console.warn(
          `[TaskDistribution] No eligible user found for case ${customerId}`,
        );
      }
    } catch (assignmentError) {
      console.error(
        "[TaskDistribution] Error assigning case:",
        assignmentError,
      );
    }

    await this.workflowRepository.save(workflow);

    // Sync customer status and pushedTo
    const updateData: any = { status: newStatus };
   // const updateData: any = { status: "submitted" };
    if (pushedTo) updateData.pushedTo = pushedTo;

    await this.customerRepository.update(customerId, updateData);

    await this.logHistory({
      customerId,
      caseWorkflowId: workflow.id,
      status: newStatus,
     // status: "submitted",
      previousStatus,
      changedBy: userId,
      remarks: remarks + (pushedTo ? ` (Submitted to: ${pushedTo})` : ""),
    });

    // Award reward points for RM submitting case
    await this.awardOpsApprovalRewards(
      customerId,
      userId,
      previousStatus,
      //"submitted",
        newStatus,

    );

    return workflow;
  }

  async creditL1Approve(
    customerId: number,
    userId: number,
    remarks: string,
    approved: boolean,
    sanctionData?: any,
  ) {
    const customer = await this.customerRepository.findOne({
      where: { id: customerId },
    });
    if (!customer) throw new Error("Customer not found");

    const workflow = await this.getOrCreateWorkflow(customerId);
    console.log("currentStatus:", workflow.currentStatus.toLowerCase());
    if (workflow.currentStatus.toLowerCase() !== "submitted")
      throw new Error("Cannot approve: Pending at Credit Team L1");

    const previousStatus = workflow.currentStatus;
    workflow.currentStatus = approved ? "credit_l1_approved" : "rejected";
    workflow.currentApproverRoleName = approved ? "CREDIT_TEAM_L2" : "RM";
    if (!approved) workflow.isRejected = true;
    workflow.remarks = remarks;
    if (approved) {
      workflow.assignedUserId = undefined as any;
      workflow.assignedStage = "credit_l2";
      await this.customerRepository.update(customerId, {
        assignedUserId: undefined as any,
        assignedStage: "credit_l2",
      });
    }
    await this.workflowRepository.save(workflow);

    if (approved && sanctionData) {
      const { partnerSanctions } = sanctionData;

      // Get existing sanction values for comparison
      const existingSanction = await this.sanctionRepository.findOne({
        where: { customerId },
      });
      const oldValues = existingSanction || {};

      // Check if we have multiple partner sanctions (new format)
      if (
        partnerSanctions &&
        Array.isArray(partnerSanctions) &&
        partnerSanctions.length > 0
      ) {
        // Save sanctions for each partner in credit_sanctions table
        for (const ps of partnerSanctions) {
          const partner = ps.partner || "FFPL";

          // Find existing sanction for this customer+partner or create new
          let creditSanction = await this.sanctionRepository.findOne({
            where: { customerId, partner },
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
              status: "pending",
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
          "CREDIT_L1",
          remarks,
        );
      } else if (sanctionData.sanctionAmount) {
        // Legacy format: single sanction (backward compatibility)
        const lender = sanctionData.lender || "FFPL";

        // Save sanction to credit_sanctions table (loan accounts created after MD approval)
        let sanction = await this.sanctionRepository.findOne({
          where: { customerId, partner: lender },
        });
        if (!sanction) {
          const newSanction = this.sanctionRepository.create({
            customerId,
            partner: lender,
            creditOfficerId: userId,
            ...sanctionData,
            status: "pending", // Pending full approval
          });
          await this.sanctionRepository.save(newSanction);
        } else {
          // Credit L1 can only update sanctionAmount
          await this.sanctionRepository.update(sanction.id, {
            sanctionAmount: sanctionData.sanctionAmount,
            creditOfficerId: userId,
          });
        }

        // Get old values and insert history only if financial values changed
        const oldSanction = await this.sanctionRepository.findOne({
          where: { customerId },
        });
        await this.insertSanctionHistoryIfChanged(
          customerId,
          oldSanction || {},
          sanctionData,
          userId,
          "CREDIT_L1",
          remarks,
        );
      }
    }

    // Sync customer status
    await this.customerRepository.update(customerId, {
      status: workflow.currentStatus as any,
    });

    await this.logHistory({
      customerId,
      caseWorkflowId: workflow.id,
      status: workflow.currentStatus,
      previousStatus,
      changedBy: userId,
      remarks,
      sanctionData,
    });

    return workflow;
  }



  async returnToRM(
  customerId: number,
  userId: number,
  remarks: string
) {
  const workflow = await this.getOrCreateWorkflow(customerId);

  if (workflow.currentStatus !== "submitted") {
    throw new Error("Only submitted cases can be returned to RM");
  }

  const previousStatus = workflow.currentStatus;

  workflow.currentStatus = "returned_to_rm";
  workflow.currentApproverRoleName = "RELATIONSHIP_MANAGER";
  
  workflow.remarks = remarks;

  await this.workflowRepository.save(workflow);

  // await this.customerRepository.update(customerId, {
  //   status: "returned_to_rm",
  //   assignedStage: "rm",
  // });
  const customer = await this.customerRepository.findOne({
  where: { id: customerId },
});

if (!customer) {
  throw new Error("Customer not found while updating status");
}
  customer.status = "draft";
// customer.status = "returned_to_rm";
customer.assignedStage = "rm";

await this.customerRepository.save(customer);

  await this.logHistory({
    customerId,
    caseWorkflowId: workflow.id,
    status: "returned_to_rm",
    previousStatus,
    changedBy: userId,
    remarks,
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
      order: { createdAt: "DESC" },
    });

    // Get all active partners from credit_sanctions table
    const creditSanctions = await this.sanctionRepository.find({
      where: { customerId },
      order: { createdAt: "DESC" },
    });

    // If we have credit_sanctions data, combine with history
    // This ensures MD sees all partners even if history wasn't recorded properly
    if (creditSanctions && creditSanctions.length > 0) {
      // Get unique partners from credit_sanctions
      const partnerCodes = [
        ...new Set(creditSanctions.map((cs) => cs.partner)),
      ];

      // For each partner, get the latest history entry or use credit_sanctions data
      const result: any[] = [];

      for (const partnerCode of partnerCodes) {
        // Try to find history for this partner
        const partnerHistory = historySanctions.find(
          (h) => h.partner === partnerCode,
        );

        if (partnerHistory) {
          result.push(partnerHistory);
        } else {
          // Use credit_sanctions data if no history exists
          const cs = creditSanctions.find((c) => c.partner === partnerCode);
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
              remarks: "Loaded from credit_sanctions",
              changedByRole: cs.status,
              createdAt: cs.updatedAt || cs.createdAt,
            });
          }
        }
      }

      return result;
    }

    return historySanctions;
  }

  private async getNextLanId(lender: string): Promise<string> {
    const partner = await this.partnerRepository.findOne({
      where: { code: lender.toUpperCase() },
    });

    if (!partner) {
      throw new Error(`Unsupported lender: ${lender}`);
    }

    const prefix = partner.lanPrefix || partner.code;
    const startNumber = 10000101;

    const lanId = await AppDataSource.transaction(async (manager) => {
      const loanRepo = manager.getRepository(LoanAccount);

      const result = await loanRepo
        .createQueryBuilder("loan")
        .setLock("pessimistic_write")
        .select(
          'MAX(CAST(REPLACE(loan.lanId, :prefix, "") AS UNSIGNED))',
          "maxId",
        )
        .where("loan.lanId LIKE :likePrefix")
        .setParameters({
          prefix: prefix,
          likePrefix: `${prefix}%`,
        })
        .getRawOne();

      const currentMaxId = result?.maxId ? parseInt(result.maxId, 10) : 0;
      const nextNumber = currentMaxId > 0 ? currentMaxId + 1 : startNumber;

      return `${prefix}${nextNumber}`;
    });

    return lanId;
  }

  async creditL2Approve(
    customerId: number,
    userId: number,
    remarks: string,
    approved: boolean,
    sanctionData?: any,
  ) {
    const customer = await this.customerRepository.findOne({
      where: { id: customerId },
    });
    if (!customer) throw new Error("Customer not found");

    const workflow = await this.getOrCreateWorkflow(customerId);
    if (workflow.currentStatus.toLowerCase() !== "credit_l1_approved")
      throw new Error("Cannot approve: Pending at Credit Team L2");

    const previousStatus = workflow.currentStatus;

    if (approved && sanctionData) {
      // Get existing sanction values for comparison
      const existingSanction = await this.sanctionRepository.findOne({
        where: { customerId },
      });
      const oldValues = existingSanction || {};

      // Check if partnerSanctions array is provided (new format for multi-partner support)
      if (
        sanctionData.partnerSanctions &&
        Array.isArray(sanctionData.partnerSanctions)
      ) {
        // Save sanctions for each partner - Credit L2 can ONLY edit sanctionAmount
        for (const partnerSanction of sanctionData.partnerSanctions) {
          const partner = partnerSanction.partner || "FFPL";

          // Get or create credit sanction for this customer+partner
          let sanction = await this.sanctionRepository.findOne({
            where: { customerId, partner },
          });
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
              conditions: "",
              status: "pending",
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
          "CREDIT_L2",
          remarks,
        );
      } else {
        // Legacy format: single sanction (backward compatibility)
        // Credit L2 can only update sanctionAmount
        const lenderCode = sanctionData?.lender || "FFPL";

        let sanction = await this.sanctionRepository.findOne({
          where: { customerId, partner: lenderCode },
        });
        if (!sanction) {
          const newSanction = this.sanctionRepository.create({
            customerId,
            partner: lenderCode,
            creditOfficerId: userId,
            sanctionAmount: sanctionData.sanctionAmount,
            tenure: 0,
            interestRate: 0,
            status: "pending",
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
          "CREDIT_L2",
          remarks,
        );
      }
    }

    workflow.currentStatus = approved ? "credit_l2_approved" : "rejected";
    workflow.currentApproverRoleName = approved ? "CEO" : "RM";
    if (!approved) workflow.isRejected = true;
    workflow.remarks = remarks;
    await this.workflowRepository.save(workflow);

    // Sync customer status
    await this.customerRepository.update(customerId, {
      status: workflow.currentStatus as any,
    });

    await this.logHistory({
      customerId,
      caseWorkflowId: workflow.id,
      status: workflow.currentStatus,
      previousStatus,
      changedBy: userId,
      remarks,
      sanctionData,
    });

    return workflow;
  }

  async ceoApprove(
    customerId: number,
    userId: number,
    remarks: string,
    approved: boolean,
    sanctionData?: any,
  ) {
    const workflow = await this.getOrCreateWorkflow(customerId);
    if (workflow.currentStatus.toLowerCase() !== "credit_l2_approved")
      throw new Error("Cannot approve: Pending at CEO");

    const previousStatus = workflow.currentStatus;

    if (approved && sanctionData) {
      // Get existing sanction values for comparison
      const existingSanction = await this.sanctionRepository.findOne({
        where: { customerId },
      });
      const oldValues = existingSanction || {};

      // Check if partnerSanctions array is provided (new format for multi-partner support)
      // CEO can edit: sanctionAmount, tenure, interestRate
      if (
        sanctionData.partnerSanctions &&
        Array.isArray(sanctionData.partnerSanctions)
      ) {
        // Save sanctions for each partner
        for (const partnerSanction of sanctionData.partnerSanctions) {
          const partner = partnerSanction.partner || "FFPL";

          // Get or create credit sanction for this customer+partner
          let sanction = await this.sanctionRepository.findOne({
            where: { customerId, partner },
          });
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
              conditions: "",
              status: "pending",
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
          "CEO",
          remarks,
        );
      } else {
        // Legacy format: single sanction (backward compatibility)
        // CEO can edit: sanctionAmount, tenure, interestRate
        const lender = sanctionData.lender || "FFPL";

        let sanction = await this.sanctionRepository.findOne({
          where: { customerId, partner: lender },
        });
        if (!sanction) {
          const newSanction = this.sanctionRepository.create({
            customerId,
            partner: lender,
            creditOfficerId: userId,
            sanctionAmount: sanctionData.sanctionAmount,
            tenure: sanctionData.tenure || 0,
            interestRate: sanctionData.interestRate || 0,
            status: "pending",
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
          "CEO",
          remarks,
        );
      }
    }

    workflow.currentStatus = approved ? "ceo_approved" : "rejected";
    workflow.currentApproverRoleName = approved ? "MD" : "RM";
    if (!approved) workflow.isRejected = true;
    workflow.remarks = remarks;
    await this.workflowRepository.save(workflow);

    // Sync customer status
    await this.customerRepository.update(customerId, {
      status: workflow.currentStatus as any,
    });

    await this.logHistory({
      customerId,
      caseWorkflowId: workflow.id,
      status: workflow.currentStatus,
      previousStatus,
      changedBy: userId,
      remarks,
      sanctionData,
    });

    return workflow;
  }

  async rmSubmitToMD(
    customerId: number,
    rmId: number,
    remarks: string,
    sanctionData?: any,
  ) {
    const workflow = await this.getOrCreateWorkflow(customerId);

    // RM can modify final terms only when status is md_pending_terms (after MD reviewed and sent back to RM)
    if (workflow.currentStatus.toLowerCase() !== "md_pending_terms") {
      throw new Error(
        "Case must be MD pending terms before RM can modify final terms",
      );
    }

    const previousStatus = workflow.currentStatus;

    // Handle partner-specific sanctions (new format for multi-partner support)
    if (
      sanctionData &&
      sanctionData.partnerSanctions &&
      Array.isArray(sanctionData.partnerSanctions)
    ) {
      // Update sanctions for each partner
      for (const partnerSanction of sanctionData.partnerSanctions) {
        const partner = partnerSanction.partner || "FFPL";

        // Get existing credit sanction for this customer+partner
        const existingSanction = await this.sanctionRepository.findOne({
          where: { customerId, partner },
        });

        if (existingSanction) {
          // Update existing sanction
          await this.sanctionRepository.update(existingSanction.id, {
            sanctionAmount: partnerSanction.sanctionAmount,
            tenure: partnerSanction.tenure || 0,
            interestRate: partnerSanction.interestRate || 0,
            penalCharges: partnerSanction.penalCharges || 0,
            processingFees: partnerSanction.processingFees || 0,
            conditions: partnerSanction.conditions || "",
            status: "approved",
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
            conditions: partnerSanction.conditions || "",
            status: "approved",
          });
          await this.sanctionRepository.save(newSanction);
        }
      }

      // Record history for ALL partners
      for (const partnerSanction of sanctionData.partnerSanctions) {
        await this.sanctionHistoryRepository.save(
          this.sanctionHistoryRepository.create({
            customerId,
            partner: partnerSanction.partner || "FFPL",
            changedByUserId: rmId,
            changedByRole: "RM",
            remarks: remarks || "Final terms submitted by RM",
            sanctionAmount: partnerSanction.sanctionAmount,
            tenure: partnerSanction.tenure,
            interestRate: partnerSanction.interestRate,
            penalCharges: partnerSanction.penalCharges || 0,
            processingFees: partnerSanction.processingFees || 0,
            conditions: partnerSanction.conditions || "",
          }),
        );
      }
    } else if (sanctionData) {
      // Legacy single sanction format
      await this.sanctionRepository.update({ customerId }, sanctionData);
      // Record history
      await this.sanctionHistoryRepository.save(
        this.sanctionHistoryRepository.create({
          customerId,
          partner: sanctionData.lender || "FFPL",
          changedByUserId: rmId,
          changedByRole: "RM",
          remarks: remarks || "Final terms submitted by RM",
          ...sanctionData,
        }),
      );
    }

    workflow.currentStatus = "md_terms_submitted";
    workflow.currentApproverRoleName = "MD";
    workflow.remarks = remarks;
    await this.workflowRepository.save(workflow);

    // Sync customer status
    await this.customerRepository.update(customerId, {
      status: workflow.currentStatus as any,
    });

    await this.logHistory({
      customerId,
      caseWorkflowId: workflow.id,
      status: workflow.currentStatus,
      previousStatus,
      changedBy: rmId,
      remarks,
      sanctionData,
    });

    return workflow;
  }

  // async mdApprove(customerId: number, userId: number, remarks: string, approved: boolean, sanctionData?: any) {
  //   const workflow = await this.getOrCreateWorkflow(customerId);
  //   const status = workflow.currentStatus.toLowerCase();
  //   if (status !== 'ceo_approved' && status !== 'md_terms_submitted') {
  //     throw new Error('Case not pending at MD for review or final terms');
  //   }

  //   const previousStatus = workflow.currentStatus;

  //   if (approved && sanctionData) {
  //     // Get existing sanction values for comparison
  //     const existingSanction = await this.sanctionRepository.findOne({ where: { customerId } });
  //     const oldValues = existingSanction || {};

  //     // Check if partnerSanctions array is provided (new format for multi-partner support)
  //     // MD can edit ALL fields: sanctionAmount, tenure, interestRate, penalCharges, processingFees, conditions
  //     if (sanctionData.partnerSanctions && Array.isArray(sanctionData.partnerSanctions)) {
  //       // Save sanctions for each partner
  //       for (const partnerSanction of sanctionData.partnerSanctions) {
  //         const partner = partnerSanction.partner || 'FFPL';

  //         // Get or create credit sanction for this customer+partner
  //         let sanction = await this.sanctionRepository.findOne({ where: { customerId, partner } });
  //         if (!sanction) {
  //           const newSanction = this.sanctionRepository.create({
  //             customerId,
  //             partner,
  //             creditOfficerId: userId,
  //             sanctionAmount: partnerSanction.sanctionAmount,
  //             tenure: partnerSanction.tenure || 0,
  //             interestRate: partnerSanction.interestRate || 0,
  //             penalCharges: partnerSanction.penalCharges || 0,
  //             processingFees: partnerSanction.processingFees || 0,
  //             conditions: partnerSanction.conditions || '',
  //             status: 'approved'
  //           });
  //           await this.sanctionRepository.save(newSanction);
  //         } else {
  //           // MD can update ALL fields
  //           await this.sanctionRepository.update(sanction.id, {
  //             sanctionAmount: partnerSanction.sanctionAmount,
  //             tenure: partnerSanction.tenure || 0,
  //             interestRate: partnerSanction.interestRate || 0,
  //             penalCharges: partnerSanction.penalCharges || 0,
  //             processingFees: partnerSanction.processingFees || 0,
  //             conditions: partnerSanction.conditions || '',
  //             status: 'approved',
  //             creditOfficerId: userId,
  //           });
  //         }
  //       }

  //       // Insert into sanction_limit_history ONLY if financial values changed
  //       const firstPartner = sanctionData.partnerSanctions[0];
  //       await this.insertSanctionHistoryIfChanged(
  //         customerId,
  //         oldValues,
  //         firstPartner,
  //         userId,
  //         'MD',
  //         remarks
  //       );
  //     } else {
  //       // Legacy format: single sanction (backward compatibility)
  //       // MD can edit ALL fields
  //       const lender = sanctionData.lender || 'FFPL';

  //       let sanction = await this.sanctionRepository.findOne({ where: { customerId, partner: lender } });
  //       if (!sanction) {
  //         const newSanction = this.sanctionRepository.create({
  //           customerId,
  //           partner: lender,
  //           creditOfficerId: userId,
  //           sanctionAmount: sanctionData.sanctionAmount,
  //           tenure: sanctionData.tenure || 0,
  //           interestRate: sanctionData.interestRate || 0,
  //           penalCharges: sanctionData.penalCharges || 0,
  //           processingFees: sanctionData.processingFees || 0,
  //           conditions: sanctionData.conditions || '',
  //           status: 'approved'
  //         });
  //         await this.sanctionRepository.save(newSanction);
  //       } else {
  //         // MD can update ALL fields
  //         await this.sanctionRepository.update(sanction.id, {
  //           sanctionAmount: sanctionData.sanctionAmount,
  //           tenure: sanctionData.tenure || 0,
  //           interestRate: sanctionData.interestRate || 0,
  //           penalCharges: sanctionData.penalCharges || 0,
  //           processingFees: sanctionData.processingFees || 0,
  //           conditions: sanctionData.conditions || '',
  //           status: 'approved',
  //           creditOfficerId: userId,
  //         });
  //       }

  //       // Insert history only if financial values changed
  //       const existingSanction = await this.sanctionRepository.findOne({ where: { customerId } });
  //       await this.insertSanctionHistoryIfChanged(
  //         customerId,
  //         existingSanction || {},
  //         sanctionData,
  //         userId,
  //         'MD',
  //         remarks
  //       );
  //     }
  //   }

  //   if (status === 'ceo_approved') {
  //     workflow.currentStatus = approved ? 'md_pending_terms' : 'rejected';
  //   } else {
  //     workflow.currentStatus = approved ? 'md_approved' : 'rejected';
  //   }

  //   // After MD approval (either 1st or 2nd), it returns to RM bucket (RM role)
  //   workflow.currentApproverRoleName = 'RM';
  //   if (!approved) workflow.isRejected = true;
  //   workflow.remarks = remarks;
  //   await this.workflowRepository.save(workflow);
  //    console.log("customerId",customerId)
  //   // AFTER MD APPROVAL: Create loan accounts from credit_sanctions table
  //   if (approved) {
  //     // Read all credit_sanctions for this customer and create loan accounts
  //     const allSanctions = await this.sanctionRepository.find({ where: { customerId } });
  //     for (const sanction of allSanctions) {
  //       const partner = sanction.partner || 'FFPL';
  //       await this.upsertLoanAccount(customerId, partner, Number(sanction.sanctionAmount));
  //     }
  //   }

  //   // Sync customer status
  //   await this.customerRepository.update(customerId, { status: workflow.currentStatus as any });

  //   await this.logHistory({
  //     customerId,
  //     caseWorkflowId: workflow.id,
  //     status: workflow.currentStatus,
  //     previousStatus,
  //     changedBy: userId,
  //     remarks,
  //     sanctionData
  //   });

  //   return workflow;
  // }
  async mdApprove(
    customerId: number,
    userId: number,
    remarks: string,
    approved: boolean,
    sanctionData?: any,
  ) {
    const workflow = await this.getOrCreateWorkflow(customerId);
    const status = workflow.currentStatus.toLowerCase();

    if (status !== "ceo_approved" && status !== "md_terms_submitted") {
      throw new Error("Case not pending at MD for review or final terms");
    }

    const previousStatus = workflow.currentStatus;

    /* ---------------------------------------
     SAVE / UPDATE SANCTIONS
  --------------------------------------- */

    if (approved && sanctionData) {
      const existingSanction = await this.sanctionRepository.findOne({
        where: { customerId },
      });

      const oldValues = existingSanction || {};

      if (
        sanctionData.partnerSanctions &&
        Array.isArray(sanctionData.partnerSanctions)
      ) {
        for (const partnerSanction of sanctionData.partnerSanctions) {
          const partner = partnerSanction.partner || "FFPL";

          let sanction = await this.sanctionRepository.findOne({
            where: { customerId, partner },
          });

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
              conditions: partnerSanction.conditions || "",
              status: "approved",
            });

            await this.sanctionRepository.save(newSanction);
          } else {
            await this.sanctionRepository.update(sanction.id, {
              sanctionAmount: partnerSanction.sanctionAmount,
              tenure: partnerSanction.tenure || 0,
              interestRate: partnerSanction.interestRate || 0,
              penalCharges: partnerSanction.penalCharges || 0,
              processingFees: partnerSanction.processingFees || 0,
              conditions: partnerSanction.conditions || "",
              status: "approved",
              creditOfficerId: userId,
            });
          }
        }

        const firstPartner = sanctionData.partnerSanctions[0];

        await this.insertSanctionHistoryIfChanged(
          customerId,
          oldValues,
          firstPartner,
          userId,
          "MD",
          remarks,
        );
      } else {
        const lender = sanctionData.lender || "FFPL";

        let sanction = await this.sanctionRepository.findOne({
          where: { customerId, partner: lender },
        });

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
            conditions: sanctionData.conditions || "",
            status: "approved",
          });

          await this.sanctionRepository.save(newSanction);
        } else {
          await this.sanctionRepository.update(sanction.id, {
            sanctionAmount: sanctionData.sanctionAmount,
            tenure: sanctionData.tenure || 0,
            interestRate: sanctionData.interestRate || 0,
            penalCharges: sanctionData.penalCharges || 0,
            processingFees: sanctionData.processingFees || 0,
            conditions: sanctionData.conditions || "",
            status: "approved",
            creditOfficerId: userId,
          });
        }

        const existingSanction = await this.sanctionRepository.findOne({
          where: { customerId },
        });

        await this.insertSanctionHistoryIfChanged(
          customerId,
          existingSanction || {},
          sanctionData,
          userId,
          "MD",
          remarks,
        );
      }
    }

    /* ---------------------------------------
     WORKFLOW STATUS CHANGE
  --------------------------------------- */

    if (status === "ceo_approved") {
      workflow.currentStatus = approved ? "md_pending_terms" : "rejected";
    } else {
      workflow.currentStatus = approved ? "md_approved" : "rejected";
    }

    workflow.currentApproverRoleName = "RM";

    if (!approved) {
      workflow.isRejected = true;
    }

    workflow.remarks = remarks;

    /* ---------------------------------------
     CREATE LOAN ACCOUNTS ONLY AFTER FINAL MD APPROVAL
  --------------------------------------- */

    if (approved && workflow.currentStatus === "md_approved") {
      const allSanctions = await this.sanctionRepository.find({
        where: { customerId },
      });

      for (const sanction of allSanctions) {
        const partner = sanction.partner || "FFPL";

        await this.upsertLoanAccount(
          customerId,
          partner,
          Number(sanction.sanctionAmount),
        );
      }
    }

    /* ---------------------------------------
     SYNC CUSTOMER STATUS
  --------------------------------------- */

    await this.customerRepository.update(customerId, {
      status: workflow.currentStatus as any,
    });

    /* ---------------------------------------
     HISTORY LOG
  --------------------------------------- */

    await this.logHistory({
      customerId,
      caseWorkflowId: workflow.id,
      status: workflow.currentStatus,
      previousStatus,
      changedBy: userId,
      remarks,
      sanctionData,
    });

    await this.workflowRepository.save(workflow);

    return workflow;
  }
  async submitForOperationsApproval(
    customerId: number,
    rmId: number,
    remarks: string,
  ) {
    const workflow = await this.getOrCreateWorkflow(customerId);
    if (workflow.currentStatus.toLowerCase() !== "md_approved")
      throw new Error("Can only submit to Operations after MD Approval");

    const previousStatus = workflow.currentStatus;
    workflow.currentStatus = "ops_l1_review";
    workflow.currentApproverRoleName = "OPERATIONS_TEAM_L1";
    workflow.remarks = remarks;
    await this.workflowRepository.save(workflow);

    // Sync customer status
    await this.customerRepository.update(customerId, {
      status: "ops_l1_review" as any,
    });

    await this.logHistory({
      customerId,
      caseWorkflowId: workflow.id,
      status: "ops_l1_review",
      previousStatus,
      changedBy: rmId,
      remarks,
    });

    return workflow;
  }

  async opsL1Approve(
    customerId: number,
    userId: number,
    remarks: string,
    approved: boolean,
  ) {
    const workflow = await this.getOrCreateWorkflow(customerId);
    if (workflow.currentStatus.toLowerCase() !== "ops_l1_review")
      throw new Error("Cannot approve: Pending at Operations L1");

    const previousStatus = workflow.currentStatus;
    workflow.currentStatus = approved ? "ops_l1_approved" : "rejected";
    workflow.currentApproverRoleName = approved ? "OPERATIONS_HEAD" : "RM";
    if (!approved) workflow.isRejected = true;
    workflow.remarks = remarks;
    await this.workflowRepository.save(workflow);

    // Sync customer status
    await this.customerRepository.update(customerId, {
      status: workflow.currentStatus as any,
    });

    await this.logHistory({
      customerId,
      caseWorkflowId: workflow.id,
      status: workflow.currentStatus,
      previousStatus,
      changedBy: userId,
      remarks,
    });

    // Award reward points for Operations L1 approval
    if (approved) {
      await this.awardOpsApprovalRewards(
        customerId,
        userId,
        previousStatus,
        workflow.currentStatus,
      );
    }

    return workflow;
  }

  /**
   * Award reward points for approval status changes
   * Points are calculated based on TIME TAKEN to complete the approval
   * Using reward configuration table:
   * - Fast (0-30 min): 5 points
   * - Medium (31-120 min): 3 points
   * - Slow (121+ min): 1 point
   */
  private async awardOpsApprovalRewards(
    customerId: number,
    userId: number,
    previousStatus: string,
    newStatus: string,
  ): Promise<void> {
    try {
      // Define approval milestones (only status transitions, points from config)
      const approvalTransitions: Record<
        string,
        { from: string; to: string; description: string }
      > = {
        rm_submit: {
          from: "draft",
          to: "submitted",
          description: "RM submitted case for credit review",
        },
        ops_l1_approve: {
          from: "ops_l1_review",
          to: "ops_l1_approved",
          description: "Operations L1 approved the case",
        },
        ops_head_approve: {
          from: "ops_l1_approved",
          to: "ops_head_approved",
          description: "Operations Head approved the case",
        },
        ops_completed: {
          from: "ops_head_approved",
          to: "completed",
          description: "Case fully onboarded and completed",
        },
      };

      // Find matching approval transition
      for (const key of Object.keys(approvalTransitions)) {
        const transition = approvalTransitions[key];
        if (previousStatus === transition.from && newStatus === transition.to) {
          // Calculate time taken for this approval stage
          const timeTakenMinutes = await this.calculateApprovalTime(
            customerId,
            previousStatus,
          );

          // Get points based on time using reward configuration
          const { category, points } =
            await this.rewardService.calculatePoints(timeTakenMinutes);

          // Award points to the person who performed the action
          await this.rewardService.awardApprovalPoints({
            userId: userId,
            taskId: `approval_${customerId}_${newStatus}`,
            points: points,
            description: `${transition.description} (${category}: ${timeTakenMinutes} min)`,
            taskType: "APPROVAL",
          });

          console.log(
            `[CustomerOnboardingService] Reward awarded: userId=${userId}, points=${points}, category=${category}, timeTaken=${timeTakenMinutes}min`,
          );
          break;
        }
      }
    } catch (error) {
      console.error(
        "[CustomerOnboardingService] Error awarding approval rewards:",
        error,
      );
    }
  }

  /**
   * Calculate time taken for approval based on previous status timestamp
   */
  private async calculateApprovalTime(
    customerId: number,
    previousStatus: string,
  ): Promise<number> {
    try {
      const historyRepo = AppDataSource.getRepository(CaseStatusHistory);
      const history = await historyRepo.find({
        where: { customerId },
        order: { createdAt: "DESC" },
        take: 10,
      });

      // Find the entry where status matches previousStatus
      for (const entry of history) {
        if (entry.status === previousStatus) {
          const diff =
            new Date().getTime() - new Date(entry.createdAt).getTime();
          return Math.round(diff / 60000); // Convert to minutes
        }
      }

      // If no history found, assume it was quick (fast category = 5 points)
      return 0;
    } catch (error) {
      console.error(
        "[CustomerOnboardingService] Error calculating approval time:",
        error,
      );
      return 0;
    }
  }

  // async opsHeadApprove(customerId: number, userId: number, remarks: string) {
  //   const workflow = await this.getOrCreateWorkflow(customerId);
  //   // if (workflow.currentStatus.toLowerCase() !== 'ops_l1_approved') throw new Error('Cannot approve: Pending at Operations Head');

  //   const previousStatus = workflow.currentStatus;
  //   workflow.currentStatus = 'completed';
  //   workflow.currentApproverRoleName = 'None';
  //   workflow.isCompleted = true;
  //   workflow.completedDate = new Date();
  //   workflow.remarks = remarks;
  //   await this.workflowRepository.save(workflow);

  //   // Update customer status to COMPLETED
  //   const customer = await this.customerRepository.findOne({ where: { id: customerId } });
  //   if (customer) {
  //     customer.status = 'completed';
  //     await this.customerRepository.save(customer);
  //   }

  //   await this.logHistory({
  //     customerId,
  //     caseWorkflowId: workflow.id,
  //     status: 'completed',
  //     previousStatus,
  //     changedBy: userId,
  //     remarks,
  //   });

  //   // Send customer data to LMS after successful onboarding
  //   // This is a non-blocking call - we don't want to break the LOS flow if LMS fails
  //   console.log(`[LMS Supply Chain] Triggering LMS integration for customer ${customerId} after successful onboarding`);

  //   try {
  //     const lmsResult = await this.sendCustomerToLMS(customerId);
  //     if (lmsResult.success) {
  //       console.log(`[LMS Supply Chain] Successfully sent customer ${customerId} to LMS: ${lmsResult.message}`);
  //     } else {
  //       console.warn(`[LMS Supply Chain] Failed to send customer ${customerId} to LMS: ${lmsResult.message}`);
  //       // Don't throw - LOS flow should not be affected by LMS failure
  //     }
  //   } catch (lmsError: any) {
  //     // Log error but don't break the flow
  //     console.error(`[LMS Supply Chain] Error during LMS integration for customer ${customerId}:`, lmsError.message);
  //     // Don't throw - LOS flow should not be affected by LMS failure
  //   }

  //   return workflow;
  // }

  async opsHeadApprove(customerId: number, userId: number, remarks: string) {
    const workflow = await this.getOrCreateWorkflow(customerId);

    const previousStatus = workflow.currentStatus;

    console.log(
      `[LMS Supply Chain] Triggering LMS integration for customer ${customerId}`,
    );

    // 🚨 BLOCK WORKFLOW UNTIL LMS SUCCESS
    let lmsResult;

    try {
      lmsResult = await this.sendCustomerToLMS(customerId);

      if (!lmsResult.success) {
        throw new Error(lmsResult.message || "Customer sync failed with LMS");
      }

      console.log(
        `[LMS Supply Chain] Successfully sent customer ${customerId} to LMS`,
      );
    } catch (lmsError: any) {
      console.error(
        `[LMS Supply Chain] LMS integration failed for customer ${customerId}:`,
        lmsError.message,
      );

      // 🚫 STOP APPROVAL FLOW HERE
      throw new Error(
        `Ops Head approval blocked: LMS sync failed → ${lmsError.message}`,
      );
    }

    // ✅ ONLY RUNS IF LMS SUCCESS
    workflow.currentStatus = "completed";
    workflow.currentApproverRoleName = "None";
    workflow.isCompleted = true;
    workflow.completedDate = new Date();
    workflow.remarks = remarks;

    await this.workflowRepository.save(workflow);

    const customer = await this.customerRepository.findOne({
      where: { id: customerId },
    });

    if (customer) {
      customer.status = "completed";

      await this.customerRepository.save(customer);
    }

    await this.logHistory({
      customerId,
      caseWorkflowId: workflow.id,
      status: "completed",
      previousStatus,
      changedBy: userId,
      remarks,
    });

    return workflow;
  }

  async getRMDashboard(rmId: number) {
    const customers = await this.customerRepository.find({
      where: { rmId },
      relations: ["workflows"],
    });

    return {
      totalCustomers: customers?.length || 0,
      draft:
        customers?.filter((c) => (c.status as string).toLowerCase() === "draft")
          .length || 0,
      submitted:
        customers?.filter(
          (c) =>
            !["draft", "completed", "rejected"].includes(
              (c.status as string).toLowerCase(),
            ),
        ).length || 0,
      approved:
        customers?.filter(
          (c) => (c.status as string).toLowerCase() === "completed",
        ).length || 0,
      rejected:
        customers?.filter((c) => c.rejectionReason !== null).length || 0,
      customers,
    };
  }

  async getCreditTeamPending(role: string, userId?: number) {
    const r = role.toUpperCase();
    const statusFilter =
      r === "CREDIT_TEAM_L2" ? "credit_l1_approved" : "submitted";
    console.log(r);
    console.log("status-->",statusFilter);

    // 🔧 FIX: Filter by assignedUserId for user-specific visibility
    // If userId provided, only show cases assigned to this user
    const whereConditions: any = {
      workflowType: "CUSTOMER_ONBOARDING",
      currentStatus: statusFilter as any,
      currentApproverRoleName: r,
    };

    // Get pending workflows (base query)
    const pendingWorkflows = await this.workflowRepository.find({
      where: whereConditions,
      relations: ["customer"],
    });

    // 🔧 FIX: Filter by assignedUserId - only show cases assigned to this specific user
    // Check both case_workflow.assignedUserId and customer.assignedUserId
    let filteredPending = pendingWorkflows;
    if (userId && statusFilter=='submitted' ) {
      filteredPending = pendingWorkflows.filter(
        (w) =>
          w.assignedUserId === userId ||
          w.customer?.assignedUserId === userId ||
          (!w.assignedUserId && !w.customer?.assignedUserId),
      );
    }

    // Handled cases (read-only)
    let handledWorkflows: any[] = [];
    if (userId) {
      const history = await this.historyRepository.find({
        where: { changedBy: userId },
        relations: ["customer", "caseWorkflow"],
      });
      const handledIds = Array.from(
        new Set(history.map((h) => h.caseWorkflowId).filter(Boolean)),
      );

      handledWorkflows = await this.workflowRepository.find({
        where: { id: handledIds.length > 0 ? In(handledIds) : -1 },
        relations: ["customer"],
      });

      // Filter out those already in pending
      const pendingIds = filteredPending.map((w) => w.id);
      handledWorkflows = handledWorkflows.filter(
        (w) => !pendingIds.includes(w.id),
      );
    }

    return { pending: filteredPending, handled: handledWorkflows };
  }

  async getExecutivePending(role: string, userId?: number) {
    const r = role.toUpperCase();
    let statusFilter: any =
      r === "MD"
        ? In(["ceo_approved", "md_terms_submitted"])
        : "credit_l2_approved";

    // Pending cases
    const pendingWorkflows = await this.workflowRepository.find({
      where: {
        workflowType: "CUSTOMER_ONBOARDING",
        currentStatus: statusFilter,
        currentApproverRoleName: r,
      },
      relations: ["customer"],
    });

    // Handled cases
    let handledWorkflows: any[] = [];
    if (userId) {
      const history = await this.historyRepository.find({
        where: { changedBy: userId },
        relations: ["customer", "caseWorkflow"],
      });
      const handledIds = Array.from(
        new Set(history.map((h) => h.caseWorkflowId).filter(Boolean)),
      );

      handledWorkflows = await this.workflowRepository.find({
        where: { id: handledIds.length > 0 ? In(handledIds) : -1 },
        relations: ["customer"],
      });

      const pendingIds = pendingWorkflows.map((w) => w.id);
      handledWorkflows = handledWorkflows.filter(
        (w) => !pendingIds.includes(w.id),
      );
    }

    return { pending: pendingWorkflows, handled: handledWorkflows };
  }

  async getCreditHeadPending(userId?: number) {
    const creditHeadVisibleStatuses = ["submitted", "credit_l1_approved"];

    const allWorkflows = await this.workflowRepository.find({
      where: {
        workflowType: "CUSTOMER_ONBOARDING",
        currentStatus: In(creditHeadVisibleStatuses as any),
      },
      relations: ["customer", "assignedUser", "customer.assignedUser"],
      order: { createdAt: "DESC" },
    });

    const workflowsWithAssignedUserName = allWorkflows.map((workflow: any) => {
      const assignedUserName =
        workflow.assignedUser?.name || workflow.customer?.assignedUser?.name || null;

      const { assignedUser, ...workflowWithoutAssignedUser } = workflow;
      const customer = workflow.customer
        ? (() => {
            const {
              assignedUser: customerAssignedUser,
              ...customerWithoutAssignedUser
            } = workflow.customer;

            return {
              ...customerWithoutAssignedUser,
              assignedUserName:
                customerAssignedUser?.name || assignedUserName,
            };
          })()
        : workflow.customer;

      return {
        ...workflowWithoutAssignedUser,
        customer,
      };
    });

    const pending = workflowsWithAssignedUserName;
    const handled: any[] = [];

    return { pending, handled };
  }

  async getOperationsPending(role: string, userId?: number) {
    const r = role.toUpperCase();
    const statusFilter =
      r === "OPERATIONS_HEAD" ? "ops_l1_approved" : "ops_l1_review";

    // Pending cases
    const pendingWorkflows = await this.workflowRepository.find({
      where: {
        workflowType: "CUSTOMER_ONBOARDING",
        currentStatus: statusFilter as any,
        currentApproverRoleName: r,
      },
      relations: ["customer"],
    });

    // Handled cases
    let handledWorkflows: any[] = [];
    if (userId) {
      const history = await this.historyRepository.find({
        where: { changedBy: userId },
        relations: ["customer", "caseWorkflow"],
      });
      const handledIds = Array.from(
        new Set(history.map((h) => h.caseWorkflowId).filter(Boolean)),
      );

      handledWorkflows = await this.workflowRepository.find({
        where: { id: handledIds.length > 0 ? In(handledIds) : -1 },
        relations: ["customer"],
      });

      const pendingIds = pendingWorkflows.map((w) => w.id);
      handledWorkflows = handledWorkflows.filter(
        (w) => !pendingIds.includes(w.id),
      );
    }

    return { pending: pendingWorkflows, handled: handledWorkflows };
  }

  async updateBankDetails(customerId: number, data: any) {
    const customer = await this.customerRepository.findOne({
      where: { id: customerId },
    });
    if (!customer) throw new Error("Customer not found");

    const {
      bankAccountNo,
      bankIfscCode,
      bankName,
      bankBranch,
      eNachStatus,
      eSignStatus,
      sanctionData,
    } = data;

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

  /**
   * Send customer data to LMS after successful onboarding
   * This is called after opsHeadApprove completes the onboarding process
   * Does NOT break LOS flow if LMS call fails - just logs the error
   */
  async sendCustomerToLMS(customerId: number): Promise<{
    success: boolean;
    message: string;
    response?: any;
  }> {
    console.log(
      `[LMS Supply Chain] Starting LMS integration for customer ${customerId}`,
    );

    try {
      // Fetch customer with all related data
      const customer = await this.customerRepository.findOne({
        where: { id: customerId },
      });

      if (!customer) {
        console.error(`[LMS Supply Chain] Customer not found: ${customerId}`);
        return { success: false, message: "Customer not found" };
      }

      console.log(
        `[LMS Supply Chain] Customer found: ${customer.name}, Status: ${customer.status}`,
      );

      // Get applicant KYC details (PAN, Aadhaar)
      const applicantKycDetails = await this.kycDetailRepository.find({
        where: { customerId, applicantType: "applicant" },
      });

      const applicantPan =
        applicantKycDetails.find((k) => k.kycType === "PAN")?.kycNumber || "";
      const applicantAadhaar =
        applicantKycDetails.find((k) => k.kycType === "AADHAAR")?.kycNumber ||
        "";

      // Get applicant address
      const applicantAddress = await this.customerAddressRepository.findOne({
        where: { customerId, type: "Residence" as any },
      });
      const applicantAddressStr = applicantAddress
        ? `${applicantAddress.fullAddress}, ${applicantAddress.city}, ${applicantAddress.state} - ${applicantAddress.pincode}`
        : "";

      // Get co-applicant if exists
      const coApplicant = await this.coApplicantRepository.findOne({
        where: { customerId },
      });

      let coApplicantData: LMSSupplyChainPayload["co_applicant"] | undefined;
      if (coApplicant) {
        const coApplicantKycDetails = await this.kycDetailRepository.find({
          where: { coApplicantId: coApplicant.id },
        });

        const coApplicantPan =
          coApplicantKycDetails.find((k) => k.kycType === "PAN")?.kycNumber ||
          "";
        const coApplicantAadhaar =
          coApplicantKycDetails.find((k) => k.kycType === "AADHAAR")
            ?.kycNumber || "";

        coApplicantData = {
          name: coApplicant.name || "",
          pan: coApplicantPan,
          aadhaar: coApplicantAadhaar,
          mobile: coApplicant.mobile || "",
          address: "", // Co-applicant address not available in current schema
        };
      }

      // Get company address
      const companyAddress = await this.customerAddressRepository.findOne({
        where: { customerId, type: "Shop" as any },
      });
      const companyAddressStr = companyAddress
        ? `${companyAddress.fullAddress}, ${companyAddress.city}, ${companyAddress.state} - ${companyAddress.pincode}`
        : applicantAddressStr;

      // Get loan accounts (LANs) for this customer - these represent the sanctions
      const loanAccounts = await this.loanAccountRepository.find({
        where: { customerId, status: "active" },
        relations: ["partner"],
      });

      console.log(
        `[LMS Supply Chain] Found ${loanAccounts.length} loan accounts for customer ${customerId}`,
      );

      if (loanAccounts.length === 0) {
        console.warn(
          `[LMS Supply Chain] No active loan accounts found for customer ${customerId}`,
        );
        return { success: false, message: "No active loan accounts found" };
      }

      // Get sanctions for all loan accounts
      const sanctions = await Promise.all(
        loanAccounts.map(async (loanAccount) => {
          // Get the credit sanction for this loan account
          const creditSanction = await this.sanctionRepository.findOne({
            where: {
              customerId,
              partner: loanAccount.lender,
              status: "approved",
            },
            order: { createdAt: "DESC" },
          });

          return {
            lan: loanAccount.lanId,
            lender: loanAccount.partner?.code || "",
            sanction_amount: Number(loanAccount.sanctionedAmount),
            tenure_months: creditSanction?.tenure || 0,
            interest_rate: Number(creditSanction?.interestRate || 0),
            penal_rate: Number(creditSanction?.penalCharges || 0),
            processing_fee: Number(creditSanction?.processingFees || 0),
          };
        }),
      );

      console.log(
        `[LMS Supply Chain] Prepared ${sanctions.length} sanctions for customer ${customerId}`,
      );

      // Build the LMS payload
      const payload: LMSSupplyChainPayload = {
        partner_loan_id: String(customerId),
        applicant: {
          name: customer.name || "",
          pan: applicantPan ?? customer.pan,
          aadhaar: applicantAadhaar ?? "9968xxxxxx",
          mobile: customer.mobile || "",
          address: applicantAddressStr,
        },
        co_applicant: coApplicantData,
        company: {
          name: customer.companyName || customer.companyName || "",
          pan: customer.companyPan || "",
          gst: customer.gstNumber || "",
          address: companyAddressStr,
        },
        sanctions: sanctions,
      };

      console.log(
        `[LMS Supply Chain] Payload prepared for customer ${customerId}:`,
        JSON.stringify(payload, null, 2),
      );

      // Send to LMS API
      const baseUrl = process.env.LMS_API_BASE_URL;
      const apiKey = process.env.LMS_API_KEY;

      if (!baseUrl || !apiKey) {
        console.warn(
          `[LMS Supply Chain] LMS API configuration missing. Set LMS_API_BASE_URL and LMS_API_KEY in environment.`,
        );
        throw new Error(
          "LMS API configuration missing. Set LMS_API_BASE_URL and LMS_API_KEY in environment.",
        );
      }

      console.log(
        `[LMS Supply Chain] Calling LMS API at: ${baseUrl}v1/supply-chain`,
      );
      let response;
      try {
        response = await axios.post<any>(
          `${baseUrl}loan-booking/v1/supply-chain`,
          payload,
          {
            headers: {
              "Content-Type": "application/json",
              "x-api-key": apiKey,
            },
            timeout: 30000, // 30 second timeout
          },
        );

        console.log(
          `[LMS Supply Chain] LMS API response status: ${response.status}`,
        );
      } catch (error: any) {
        if (error.response) {
          throw new Error(
            `LMS API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`,
          );
        } else if (error.request) {
          throw new Error("LMS API unreachable - no response received");
        } else {
          throw new Error(`Failed to send to LMS: ${error.message}`);
        }
      }

      console.log(
        `[LMS Supply Chain] LMS response for customer ${customerId}:`,
        JSON.stringify(response.data),
      );

      return {
        success: response.data?.success ?? true,
        message: response.data?.message || "Customer sent to LMS successfully",
        response,
      };
    } catch (error: any) {
      // Log error but don't throw - we don't want to break the LOS flow
      console.error(
        `[LMS Supply Chain] Error sending customer ${customerId} to LMS:`,
        error.message,
      );

      if (error.response) {
        console.error(
          `[LMS Supply Chain] LMS API error response:`,
          JSON.stringify(error.response.data),
        );
      } else if (error.request) {
        console.error(
          `[LMS Supply Chain] LMS API unreachable - no response received`,
        );
      }

      return {
        success: false,
        message: error.message || "Failed to send to LMS",
      };
    }
  }
}

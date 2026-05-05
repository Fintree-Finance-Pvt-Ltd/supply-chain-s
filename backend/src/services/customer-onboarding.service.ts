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
import { DEFAULT_PARTNER_CODES, ROLES } from "../config/constants";
import { WorkflowValidatorService } from "./workflow-validator.service";
import { AuditService } from "./audit.service";
import { RewardService } from "./reward.service";
import axios from "axios";


import { getRepository } from "typeorm";
import { User } from "../entities/User";
import { sendMail } from "../utils/emailService";
import { Role, UserRole } from "../entities";
const customerRepository = AppDataSource.getRepository(Customer);
const userRepository = AppDataSource.getRepository(User);
// const roleRepository = AppDataSource.getRepository(Role);
// const userRoleRepository = AppDataSource.getRepository(UserRole);


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

export class 
CustomerOnboardingService {
  private userRepository = AppDataSource.getRepository(User);
  private roleRepository = AppDataSource.getRepository(Role);
  private userRoleRepository = AppDataSource.getRepository(UserRole);


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
      "legalCharges",
      "serviceFee",
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
        partner: newValues.partner || oldValues.partner || null,
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

  private normalizePartnerCode(partner?: string): string {
    return (partner || "FFPL").trim().toUpperCase();
  }

  private normalizePartnerSanctionInput(partnerSanction: any): any {
    return {
      ...partnerSanction,
      partner: this.normalizePartnerCode(partnerSanction.partner),
      sanctionAmount: Number(partnerSanction.sanctionAmount || 0),
      tenure: Number(partnerSanction.tenure || partnerSanction.tenor || 0),
      interestRate: Number(
        partnerSanction.interestRate || partnerSanction.roi || 0,
      ),
      penalCharges: Number(partnerSanction.penalCharges || 0),
      processingFees: Number(partnerSanction.processingFees || 0),
      legalCharges: Number(partnerSanction.legalCharges || 0),
      serviceFee: Number(partnerSanction.serviceFee || 0),
      conditions: partnerSanction.conditions || "",
    };
  }

  private hasLockedSanctionChanged(
    existingSanction: CreditSanction,
    incomingSanction: any,
  ): boolean {
    const numericFields = [
      "sanctionAmount",
      "tenure",
      "interestRate",
      "penalCharges",
      "processingFees",
      "legalCharges",
      "serviceFee",
    ];

    for (const field of numericFields) {
      if (
        incomingSanction[field] !== undefined &&
        incomingSanction[field] !== null &&
        incomingSanction[field] !== ""
      ) {
        const oldValue = Number((existingSanction as any)[field] || 0);
        const newValue = Number(incomingSanction[field] || 0);
        if (oldValue !== newValue) return true;
      }
    }

    if (
      incomingSanction.conditions !== undefined &&
      incomingSanction.conditions !== null
    ) {
      const oldConditions = existingSanction.conditions || "";
      const newConditions = incomingSanction.conditions || "";
      if (oldConditions !== newConditions) return true;
    }

    return false;
  }

  private async getEditablePartnerSanctions(
    customerId: number,
    partnerSanctions: any[],
  ): Promise<any[]> {
    const existingSanctions = await this.sanctionRepository.find({
      where: { customerId },
    });
    const caseHasApprovedSanctions = existingSanctions.some(
      (sanction) => sanction.status?.toLowerCase() === "approved",
    );
    const existingByPartner = new Map(
      existingSanctions.map((sanction) => [
        this.normalizePartnerCode(sanction.partner),
        sanction,
      ]),
    );

    const editablePartnerSanctions: any[] = [];

    for (const rawPartnerSanction of partnerSanctions) {
      const partnerSanction =
        this.normalizePartnerSanctionInput(rawPartnerSanction);
      const existingSanction = existingByPartner.get(partnerSanction.partner);
      const isLocked =
        existingSanction?.status?.toLowerCase() === "approved";

      if (caseHasApprovedSanctions && !existingSanction) {
        throw new Error(
          `Partner ${partnerSanction.partner} was not assigned for this fresh sanction request.`,
        );
      }

      if (isLocked && existingSanction) {
        if (
          this.hasLockedSanctionChanged(existingSanction, partnerSanction)
        ) {
          throw new Error(
            `Partner ${partnerSanction.partner} has already given sanction and is locked. Resend only to a new partner section.`,
          );
        }

        continue;
      }

      editablePartnerSanctions.push(partnerSanction);
    }

    return editablePartnerSanctions;
  }

  async resendToNewPartnerSections(
    customerId: number,
    rmId: number,
    partnerCodes: string[],
    remarks: string,
  ) {
    const customer = await this.customerRepository.findOne({
      where: { id: customerId },
    });
    if (!customer) throw new Error("Customer not found");

    const uniquePartnerCodes = Array.from(
      new Set(
        partnerCodes
          .map((partnerCode) => this.normalizePartnerCode(partnerCode))
          .filter(Boolean),
      ),
    );

    if (uniquePartnerCodes.length === 0) {
      throw new Error("Select at least one new partner section");
    }

    const existingSanctions = await this.sanctionRepository.find({
      where: { customerId },
    });
    const existingByPartner = new Map(
      existingSanctions.map((sanction) => [
        this.normalizePartnerCode(sanction.partner),
        sanction,
      ]),
    );

    for (const partnerCode of uniquePartnerCodes) {
      const partner = await this.partnerRepository.findOne({
        where: { code: partnerCode },
      });
      if (!partner) throw new Error(`Partner not found: ${partnerCode}`);
      if (partner.status !== "ACTIVE") {
        throw new Error(`Partner is not active: ${partnerCode}`);
      }

      const existingSanction = existingByPartner.get(partnerCode);
      if (existingSanction?.status?.toLowerCase() === "approved") {
        throw new Error(
          `Partner ${partnerCode} has already given sanction and cannot be resent.`,
        );
      }
      if (existingSanction) {
        throw new Error(
          `Partner ${partnerCode} already has a sanction request on this case.`,
        );
      }
    }

    for (const partnerCode of uniquePartnerCodes) {
      const newSanction = this.sanctionRepository.create({
        customerId,
        partner: partnerCode,
        creditOfficerId: rmId,
        sanctionAmount: 0,
        tenure: 0,
        interestRate: 0,
        penalCharges: 0,
        processingFees: 0,
        legalCharges: 0,
        serviceFee: 0,
        conditions: "",
        status: "pending",
      });
      await this.sanctionRepository.save(newSanction);
    }

    const workflow = await this.getOrCreateWorkflow(customerId);
    const previousStatus = workflow.currentStatus;

    workflow.currentStatus = "submitted";
    workflow.currentApproverRoleName = "CREDIT_TEAM_L1";
    workflow.remarks =
      remarks ||
      `Resent for fresh sanction: ${uniquePartnerCodes.join(", ")}`;
    workflow.assignedUserId = undefined as any;
    workflow.assignedStage = "credit_l1";

    await this.workflowRepository.save(workflow);

    const pushedToValues = new Set(
      (customer.pushedTo || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    );
    uniquePartnerCodes.forEach((partnerCode) => pushedToValues.add(partnerCode));

    await this.customerRepository.update(customerId, {
      status: "submitted" as any,
      pushedTo: Array.from(pushedToValues).join(","),
      assignedUserId: undefined as any,
      assignedStage: "credit_l1",
    });

    await this.logHistory({
      customerId,
      caseWorkflowId: workflow.id,
      status: "submitted",
      previousStatus,
      changedBy: rmId,
      remarks:
        remarks ||
        `Resent for fresh sanction: ${uniquePartnerCodes.join(", ")}`,
    });

    return workflow;
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
      workflow.currentStatus !== "returned_to_rm")
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
  previousStatus,
  changedBy: userId,
  remarks: remarks + (pushedTo ? ` (Submitted to: ${pushedTo})` : ""),
});



if (newStatus === "submitted") {
  // ✅ 1. Send to assigned CREDIT_TEAM_L1
  if (workflow.assignedUserId) {
    const assignedUser = await this.userRepository.findOne({
      where: {
        id: workflow.assignedUserId,
        defaultRole: "CREDIT_TEAM_L1",
      },
      select: ["email"],
    });

    if (assignedUser?.email) {
      await sendMail({
        to: assignedUser.email,
        subject: "New Case Assigned - Credit L1",
        text: `Customer ID: ${customerId} is assigned to you for review.`,
      });
    }
  }

  // ✅ 2. Send to ALL MD users
  const mdUsers = await this.userRepository.find({
    where: {
      defaultRole: "MD",
    },
    select: ["email"],
  });

  for (const md of mdUsers) {
    if (md.email) {
      await sendMail({
        to: md.email,
        subject: "New Case Submitted",
        text: `Customer ID: ${customerId} has been submitted and assigned to Credit L1.`,
      });
    }
  }
}

// Existing logic
await this.awardOpsApprovalRewards(
  customerId,
  userId,
  previousStatus,
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
      // select: ["id", "companyName"],

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



//coorect one with role based email notification to credit team L2

    if (approved) {
      const customerName = customer?.companyName || customer?.customerName || `ID ${customerId}`;

      // Step 1: Get roleId from roles table
      const role = await this.roleRepository.findOne({
        where: { name: "CREDIT_TEAM_L2" }, // change if column name differs
        select: ["id"], // primary key column
      });

      if (!role) {
        throw new Error("CREDIT_TEAM_L2 role not found");
      }

      // Step 2: Get all userIds mapped to this roleId from user_roles table
      const userRoles = await this.userRoleRepository.find({
        where: { roleId: role.id }, // IMPORTANT: use role.id unless schema differs
        select: ["userId"],
      });

      if (!userRoles.length) {
        console.log("No users assigned to CREDIT_TEAM_L2 role");
        return;
      }

      // Step 3: Extract userIds
      const userIds = userRoles.map((ur) => ur.userId);

      // Step 4: Fetch emails from users table
      const creditUsers = await this.userRepository.find({
        where: {
          id: In(userIds),
        },
        select: ["id", "email"],
      });

      // Step 5: Send email to each user
      for (const user of creditUsers) {
        if (user.email) {
          await sendMail({
            to: user.email,
            subject: "Case Pending for Credit L2 Approval",
            // text: `Customer case ${customerName} approved by Credit L1 and pending your review.`,
            text: `
Dear Team,

The credit case for customer ${customerName} has been approved by Credit L1 and is now pending your review and approval at the Credit L2 stage.

Please log in to the LMS and take the necessary action.

Customer Name : ${customerName}
Case ID       : ${customerId}
Current Stage : Credit L2 Approval

Regards,
Credit Workflow System
Fintree Finance Pvt. Ltd.
`,
          });
        }
      }
    }

    
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
        const editablePartnerSanctions =
          await this.getEditablePartnerSanctions(customerId, partnerSanctions);

        if (editablePartnerSanctions.length === 0) {
          throw new Error(
            "No new or pending partner sanction request found for Credit L1 approval",
          );
        }

        // Save sanctions for each partner in credit_sanctions table
        for (const ps of editablePartnerSanctions) {
          const partner = ps.partner;

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
              legalCharges: ps.legalCharges || 0,
              serviceFee: ps.serviceFee || 0,
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
        const firstPartner = editablePartnerSanctions[0];
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


    //correct one with role based email notification to CEO
    if (approved) {
      const customerName = customer?.companyName || customer?.customerName || `ID ${customerId}`;

      // Step 1: Get roleId from roles table
      const role = await this.roleRepository.findOne({
        where: { name: "CEO" }, // change if column name differs
        select: ["id"], // primary key column
      });

      if (!role) {
        throw new Error("CEO role not found");
      }

      // Step 2: Get all userIds mapped to this roleId from user_roles table
      const userRoles = await this.userRoleRepository.find({
        where: { roleId: role.id }, // IMPORTANT: use role.id unless schema differs
        select: ["userId"],
      });

      if (!userRoles.length) {
        console.log("No users assigned to CREDIT_TEAM_L2 role");
        return;
      }

      // Step 3: Extract userIds
      const userIds = userRoles.map((ur) => ur.userId);

      // Step 4: Fetch emails from users table
      const creditUsers = await this.userRepository.find({
        where: {
          id: In(userIds),
        },
        select: ["id", "email"],
      });

      // Step 5: Send email to each user
      for (const user of creditUsers) {
        if (user.email) {
          await sendMail({
            to: user.email,
            subject: "Case Pending for CEO Approval",
            // text: `Customer case ${customerName} approved by Credit L1 and pending your review.`,
            text: `
Dear Team,

The credit case for customer ${customerName} has been approved by Credit L2 and is now pending your review and approval at the CEO stage.

Please log in to the LMS and take the necessary action.

Customer Name : ${customerName}
Case ID       : ${customerId}
Current Stage : CEO Approval

Regards,
Credit Workflow System
Fintree Finance Pvt. Ltd.
`,
          });
        }
      }
    }




    // if (approved) {
    //   const creditUsers = await this.userRepository.find({
    //     where: {
    //       defaultRole: "CEO",
    //     },
    //     select: ["id", "email"],
    //   });

    //   for (const user of creditUsers) {
    //     if (user.email) {
    //       await sendMail({
    //         to: user.email,
    //         subject: "Case Pending for CEO Approval",
    //         text: `Customer case ${customerId} approved by Credit L2 and pending your review.`,
    //       });
    //     }
    //   }
    // }
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
        const editablePartnerSanctions =
          await this.getEditablePartnerSanctions(
            customerId,
            sanctionData.partnerSanctions,
          );

        if (editablePartnerSanctions.length === 0) {
          throw new Error(
            "No new or pending partner sanction request found for Credit L2 approval",
          );
        }

        // Save sanctions for each partner - Credit L2 can ONLY edit sanctionAmount
        for (const partnerSanction of editablePartnerSanctions) {
          const partner = partnerSanction.partner;

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
        const firstPartner = editablePartnerSanctions[0];
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
     const customer = await this.customerRepository.findOne({
      where: { id: customerId },
    });
    if (!customer) throw new Error("Customer not found");
    const workflow = await this.getOrCreateWorkflow(customerId);
    if (workflow.currentStatus.toLowerCase() !== "credit_l2_approved")
      throw new Error("Cannot approve: Pending at CEO");

    const previousStatus = workflow.currentStatus;
    //correct one with role based email notification to MD
    // if (approved) {
    //   const creditUsers = await this.userRepository.find({
    //     where: {
    //       defaultRole: "MD",
    //     },
    //     select: ["id", "email"],
    //   });

    //   for (const user of creditUsers) {
    //     if (user.email) {
    //       await sendMail({
    //         to: user.email,
    //         subject: "Case Pending for MD Approval",
    //         text: `Customer case ${customerId} approved by Ceo and pending your review.`,
    //       });
    //     }
    //   }
    // }



    if (approved) {
      const customerName = customer?.companyName || customer?.customerName || `ID ${customerId}`;

      // Step 1: Get roleId from roles table
      const role = await this.roleRepository.findOne({
        where: { name: "md" }, // change if column name differs
        select: ["id"], // primary key column
      });

      if (!role) {
        throw new Error("md role not found");
      }

      // Step 2: Get all userIds mapped to this roleId from user_roles table
      const userRoles = await this.userRoleRepository.find({
        where: { roleId: role.id }, // IMPORTANT: use role.id unless schema differs
        select: ["userId"],
      });

      if (!userRoles.length) {
        console.log("No users assigned to md role");
        return;
      }

      // Step 3: Extract userIds
      const userIds = userRoles.map((ur) => ur.userId);

      // Step 4: Fetch emails from users table
      const creditUsers = await this.userRepository.find({
        where: {
          id: In(userIds),
        },
        select: ["id", "email"],
      });

      // Step 5: Send email to each user
      for (const user of creditUsers) {
        if (user.email) {
          await sendMail({
            to: user.email,
            subject: "Case Pending for MD Approval",
            // text: `Customer case ${customerName} approved by Credit L1 and pending your review.`,
            text: `
Dear Team,

The credit case for customer ${customerName} has been approved by CEO and is now pending your review and approval at the MD stage.

Please log in to the LMS and take the necessary action.

Customer Name : ${customerName}
Case ID       : ${customerId}
Current Stage : MD Approval

Regards,
Credit Workflow System
Fintree Finance Pvt. Ltd.
`,
          });
        }
      }
    }

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
        const editablePartnerSanctions =
          await this.getEditablePartnerSanctions(
            customerId,
            sanctionData.partnerSanctions,
          );

        if (editablePartnerSanctions.length === 0) {
          throw new Error(
            "No new or pending partner sanction request found for CEO approval",
          );
        }

        // Save sanctions for each partner
        for (const partnerSanction of editablePartnerSanctions) {
          const partner = partnerSanction.partner;

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
        const firstPartner = editablePartnerSanctions[0];
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
      const editablePartnerSanctions =
        await this.getEditablePartnerSanctions(
          customerId,
          sanctionData.partnerSanctions,
        );

      if (editablePartnerSanctions.length === 0) {
        throw new Error(
          "No new or pending partner sanction request found for RM submission",
        );
      }

      // Update sanctions for each partner
      for (const partnerSanction of editablePartnerSanctions) {
        const partner = partnerSanction.partner;

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
            legalCharges: partnerSanction.legalCharges || 0,
            serviceFee: partnerSanction.serviceFee || 0,
            conditions: partnerSanction.conditions || "",
            status: "pending",
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
            legalCharges: partnerSanction.legalCharges || 0,
            serviceFee: partnerSanction.serviceFee || 0,
            conditions: partnerSanction.conditions || "",
            status: "pending",
          });
          await this.sanctionRepository.save(newSanction);
        }
      }

      // Record history for newly submitted pending partners only.
      for (const partnerSanction of editablePartnerSanctions) {
        await this.sanctionHistoryRepository.save(
          this.sanctionHistoryRepository.create({
            customerId,
            partner: partnerSanction.partner,
            changedByUserId: rmId,
            changedByRole: "RM",
            remarks: remarks || "Final terms submitted by RM",
            sanctionAmount: partnerSanction.sanctionAmount,
            tenure: partnerSanction.tenure,
            interestRate: partnerSanction.interestRate,
            penalCharges: partnerSanction.penalCharges || 0,
            processingFees: partnerSanction.processingFees || 0,
              legalCharges: partnerSanction.legalCharges || 0,
              serviceFee: partnerSanction.serviceFee || 0,
            conditions: partnerSanction.conditions || "",
          }),
        );
      }
    } else if (sanctionData) {
      // Legacy single sanction format
      const partner = this.normalizePartnerCode(
        sanctionData.partner || sanctionData.lender,
      );
      const existingSanction = await this.sanctionRepository.findOne({
        where: { customerId, partner },
      });

      if (existingSanction?.status?.toLowerCase() === "approved") {
        if (
          this.hasLockedSanctionChanged(
            existingSanction,
            this.normalizePartnerSanctionInput({ ...sanctionData, partner }),
          )
        ) {
          throw new Error(
            `Partner ${partner} has already given sanction and is locked.`,
          );
        }
      } else {
        const normalizedSanction = this.normalizePartnerSanctionInput({
          ...sanctionData,
          partner,
        });
        await this.sanctionRepository.update(
          { customerId, partner },
          {
            sanctionAmount: normalizedSanction.sanctionAmount,
            tenure: normalizedSanction.tenure,
            interestRate: normalizedSanction.interestRate,
            penalCharges: normalizedSanction.penalCharges,
            processingFees: normalizedSanction.processingFees,
            legalCharges: normalizedSanction.legalCharges,
            serviceFee: normalizedSanction.serviceFee,
            conditions: normalizedSanction.conditions,
            status: "pending",
            creditOfficerId: rmId,
          },
        );
        // Record history
        await this.sanctionHistoryRepository.save(
          this.sanctionHistoryRepository.create({
            customerId,
            partner,
            changedByUserId: rmId,
            changedByRole: "RM",
            remarks: remarks || "Final terms submitted by RM",
            ...sanctionData,
          }),
        );
      }
    }

    workflow.currentStatus = "md_terms_submitted";
    workflow.currentApproverRoleName = "MD";
    workflow.remarks = remarks;
    await this.workflowRepository.save(workflow);

    await this.workflowRepository.save(workflow);



    
  if ( workflow.currentStatus === "md_terms_submitted") {

      // // Step 1: Get RM id from customer table
      const customer = await this.customerRepository.findOne({
        where: { id: customerId },
        select: ["id", "rmId","customerName","companyName"],
      });


    if (workflow.currentStatus = "md_terms_submitted") {
      const customerName = customer?.companyName || customer?.customerName || `ID ${customerId}`;

      // Step 1: Get roleId from roles table
      const role = await this.roleRepository.findOne({
        where: { name: "md" }, // change if column name differs
        select: ["id"], // primary key column
      });

      if (!role) {
        throw new Error("md role not found");
      }

      // Step 2: Get all userIds mapped to this roleId from user_roles table
      const userRoles = await this.userRoleRepository.find({
        where: { roleId: role.id }, // IMPORTANT: use role.id unless schema differs
        select: ["userId"],
      });

      if (!userRoles.length) {
        console.log("No users assigned to md role");
        return;
      }

      // Step 3: Extract userIds
      const userIds = userRoles.map((ur) => ur.userId);

      // Step 4: Fetch emails from users table
      const creditUsers = await this.userRepository.find({
        where: {
          id: In(userIds),
        },
        select: ["id", "email"],
      });

      // Step 5: Send email to each user
      for (const user of creditUsers) {
        if (user.email) {
          await sendMail({
            to: user.email,
            subject: "Case Pending for MD Approval",
            // text: `Customer case ${customerName} approved by Credit L1 and pending your review.`,
            text: `
Dear Team,

The credit case for customer ${customerName} has been approved by CEO and is now pending your review and approval at the MD stage.

Please log in to the LMS and take the necessary action.

Customer Name : ${customerName}
Case ID       : ${customerId}
Current Stage : MD Approval

Regards,
Credit Workflow System
Fintree Finance Pvt. Ltd.
`,
          });
        }
      }
    }
  }
    
    // Notify MD after RM submits final terms
    
    // if (workflow.currentStatus === "md_terms_submitted") {
    //   const mdUsers = await this.userRepository.find({
    //     where: {
    //       defaultRole: "MD",
    //     },
    //     select: ["id", "email"],
    //   });

    //   for (const user of mdUsers) {
    //     if (user.email) {
    //       await sendMail({
    //         to: user.email,
    //         subject: "Case Pending for MD Approval",
    //         text: `Customer case ${customerId} final terms submitted by RM and pending your approval.`,
    //       });
    //     }
    //   }
    // }
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
        const editablePartnerSanctions =
          await this.getEditablePartnerSanctions(
            customerId,
            sanctionData.partnerSanctions,
          );

        if (editablePartnerSanctions.length === 0) {
          throw new Error(
            "No new or pending partner sanction request found for MD approval",
          );
        }

        const sanctionStatus =
          status === "md_terms_submitted" ? "approved" : "pending";

        for (const partnerSanction of editablePartnerSanctions) {
          const partner = partnerSanction.partner;

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
              legalCharges: partnerSanction.legalCharges || 0,
              serviceFee: partnerSanction.serviceFee || 0,
              conditions: partnerSanction.conditions || "",
              status: sanctionStatus,
            });

            await this.sanctionRepository.save(newSanction);
          } else {
            await this.sanctionRepository.update(sanction.id, {
              sanctionAmount: partnerSanction.sanctionAmount,
              tenure: partnerSanction.tenure || 0,
              interestRate: partnerSanction.interestRate || 0,
              penalCharges: partnerSanction.penalCharges || 0,
              processingFees: partnerSanction.processingFees || 0,
              legalCharges: partnerSanction.legalCharges || 0,
              serviceFee: partnerSanction.serviceFee || 0,
              conditions: partnerSanction.conditions || "",
              status: sanctionStatus,
              creditOfficerId: userId,
            });
          }
        }

        const firstPartner = editablePartnerSanctions[0];

        await this.insertSanctionHistoryIfChanged(
          customerId,
          oldValues,
          firstPartner,
          userId,
          "MD",
          remarks,
        );
      } else {
        const lender = this.normalizePartnerCode(
          sanctionData.partner || sanctionData.lender,
        );
        const sanctionStatus =
          status === "md_terms_submitted" ? "approved" : "pending";

        let sanction = await this.sanctionRepository.findOne({
          where: { customerId, partner: lender },
        });

        if (sanction?.status?.toLowerCase() === "approved") {
          if (
            this.hasLockedSanctionChanged(
              sanction,
              this.normalizePartnerSanctionInput({ ...sanctionData, partner: lender }),
            )
          ) {
            throw new Error(
              `Partner ${lender} has already given sanction and is locked.`,
            );
          }
        } else if (!sanction) {
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
            status: sanctionStatus,
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
            status: sanctionStatus,
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

  // ---------------------------------------
// WORKFLOW STATUS CHANGE
// ---------------------------------------

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


// // ✅ ✅ ADD EMAIL LOGIC HERE (IMPORTANT)
if (approved && workflow.currentStatus === "md_pending_terms") {
  const customer = await this.customerRepository.findOne({
    where: { id: customerId },
    select: ["rmId"],
  });

  if (customer?.rmId) {
    const rmUser = await this.userRepository.findOne({
      where: {
        id: customer.rmId,
        defaultRole: "RELATIONSHIP_MANAGER",
      },
      select: ["email"],
    });

    if (rmUser?.email) {
      await sendMail({
        to: rmUser.email,
        subject: "Case Returned by MD for Final Terms",
        text: `Customer ID: ${customerId} has been reviewed by MD and is now pending final terms submission from you.`,
      });
    }
  }
}
    /* ---------------------------------------
     CREATE LOAN ACCOUNTS ONLY AFTER FINAL MD APPROVAL
  --------------------------------------- */

    if (approved && workflow.currentStatus === "md_approved") {

      // // Step 1: Get RM id from customer table
      const customer = await this.customerRepository.findOne({
        where: { id: customerId },
        select: ["id", "rmId","customerName","companyName"],
      });

      // // Step 2: Fetch RM email from users table
      if (customer?.rmId) {
        const rmUser = await this.userRepository.findOne({
          where: { id: customer.rmId },
          select: ["id", "email"],
        });

        // Step 3: Send email to RM
        if (rmUser?.email) {
          await sendMail({
            to: rmUser.email,
            subject: "Case Approved by MD",
            // text: `Customer case ${customerId} has been approved by MD and pending your review.`,
             text: `
Dear Team,

The credit case for customer ${customer?.customerName || customer?.companyName || `ID ${customerId}`} has been approved by MD and is now pending your review and approval at the RM stage.

Please log in to the LMS and take the necessary action.

Customer Name : ${customer?.customerName || customer?.companyName || `ID ${customerId}`}
Case ID       : ${customerId}
Current Stage : RM Approval

Regards,
Credit Workflow System
Fintree Finance Pvt. Ltd.
`,
          });
        }
      }
      

//           if (approved) {
//       const customerName = customer?.companyName || customer?.customerName || `ID ${customerId}`;

//       // Step 1: Get roleId from roles table
//       const role = await this.roleRepository.findOne({
//         where: { name: "relationship_manager" }, // change if column name differs
//         select: ["id"], // primary key column
//       });

//       if (!role) {
//         throw new Error("relationship_manager role not found");
//       }

//       // Step 2: Get all userIds mapped to this roleId from user_roles table
//       const userRoles = await this.userRoleRepository.find({
//         where: { roleId: role.id }, // IMPORTANT: use role.id unless schema differs
//         select: ["userId"],
//       });

//       if (!userRoles.length) {
//         console.log("No users assigned to relationship_manager role");
//         return;
//       }

//       // Step 3: Extract userIds
//       const userIds = userRoles.map((ur) => ur.userId);

//       // Step 4: Fetch emails from users table
//       const creditUsers = await this.userRepository.find({
//         where: {
//           id: In(userIds),
//         },
//         select: ["id", "email"],
//       });

//       // Step 5: Send email to each user
//       for (const user of creditUsers) {
//         if (user.email) {
//           await sendMail({
//             to: user.email,
//             subject: "Case Pending for RM Approval",
//             // text: `Customer case ${customerName} approved by Credit L1 and pending your review.`,
//             text: `
// Dear Team,

// The credit case for customer ${customerName} has been approved by MD and is now pending your review and approval at the RM stage.

// Please log in to the LMS and take the necessary action.

// Customer Name : ${customerName}
// Case ID       : ${customerId}
// Current Stage : RM Approval

// Regards,
// Credit Workflow System
// Fintree Finance Pvt. Ltd.
// `,
//           });
//         }
//       }
//     }



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
/**
   * RM adds a new partner and submits directly to MD
   * Bypasses Credit L1/L2 approval
   * Flow: RM selects partner → enters sanction terms → direct to MD → MD approves → eSign/eNach → Loan Accounts
   */
  // async rmSubmitDirectToMD(
  //   customerId: number,
  //   rmId: number,
  //   partner: string,
  //   sanctionAmount: number,
  //   tenure: number,
  //   interestRate: number,
  //   conditions?: string,
  //   penalCharges?: number,
  //   processingFees?: number,
  //   remarks?: string,
  // ) {
  //   const customer = await this.customerRepository.findOne({
  //     where: { id: customerId },
  //   });
  //   if (!customer) throw new Error("Customer not found");

  //   // Allow from completed or md_approved status only
  //   const validStatuses = ["completed", "md_approved", "ops_l1_review", "ops_l1_approved"];
  //   const workflow = await this.getOrCreateWorkflow(customerId);
  //   const currentStatus = workflow.currentStatus.toLowerCase();
    
  //   if (!validStatuses.includes(currentStatus)) {
  //     throw new Error(
  //       `Cannot add new partner. Case must be completed or MD approved. Current status: ${currentStatus}`
  //     );
  //   }

  //   const partnerCode = partner.toUpperCase();
    
  //   // Validate partner exists
  //   const validPartner = await this.partnerRepository.findOne({
  //     where: { code: partnerCode },
  //   });
  //   if (!validPartner) {
  //     throw new Error(`Invalid partner: ${partner}. Valid partners are: FFPL, MFL, KITE`);
  //   }

  //   // Check if this partner already has a sanctioned limit for this customer
  //   const existingPartnerSanction = await this.sanctionRepository.findOne({
  //     where: { customerId, partner: partnerCode, status: "approved" },
  //   });
  //   if (existingPartnerSanction) {
  //     throw new Error(
  //       `Partner ${partnerCode} already has active sanction for this customer. ` +
  //       `Existing limit: ₹${existingPartnerSanction.sanctionAmount}`
  //     );
  //   }

  //   // Check if partner already has any record (not just approved)
  //   const existingAnyRecord = await this.sanctionRepository.findOne({
  //     where: { customerId, partner: partnerCode },
  //   });
  //   if (existingAnyRecord) {
  //     throw new Error(
  //       `Partner ${partnerCode} already has a record for this customer. Please use different partner.`
  //     );
  //   }

  //   const previousStatus = workflow.currentStatus;

  //   // Step 1: Create new credit_sanction for the partner
  //   const newSanction = this.sanctionRepository.create({
  //     customerId,
  //     partner: partnerCode,
  //     creditOfficerId: rmId,
  //     sanctionAmount,
  //     tenure: tenure || 12,
  //     interestRate: interestRate || 0,
  //     penalCharges: penalCharges || 0,
  //     processingFees: processingFees || 0,
  //     legalCharges: 0,
  //     serviceFee: 0,
  //     conditions: conditions || "",
  //     status: "pending", // Will be marked approved after MD finalizes
  //   });
  //   await this.sanctionRepository.save(newSanction);

  //   // Step 2: Generate LAN and create loan account for this partner
  //   const lanId = await this.getNextLanId(partnerCode);
    
  //   // Check if loan account already exists for this partner
  //   let loanAccount = await this.loanAccountRepository.findOne({
  //     where: { customerId, lender: partnerCode as any },
  //   });
    
  //   if (loanAccount) {
  //     // Update existing
  //     await this.loanAccountRepository.update(loanAccount.id, {
  //       sanctionedAmount,
  //       status: "active",
  //     });
  //   } else {
  //     // Create new
  //     loanAccount = this.loanAccountRepository.create({
  //       customerId,
  //       partnerId: validPartner.id,
  //       lender: partnerCode as any,
  //       lanId,
  //       sanctionedAmount,
  //       disbursedAmount: 0,
  //       status: "active",
  //     });
  //     await this.loanAccountRepository.save(loanAccount);
  //   }

  //   // Step 3: Record in sanction_limit_history (pending MD approval)
  //   await this.sanctionHistoryRepository.save(
  //     this.sanctionHistoryRepository.create({
  //       customerId,
  //       partner: partnerCode,
  //       changedByUserId: rmId,
  //       changedByRole: "RM",
  //       remarks: remarks || "New partner submission directly to MD",
  //       sanctionAmount,
  //       tenure: tenure || 12,
  //       interestRate: interestRate || 0,
  //       penalCharges: penalCharges || 0,
  //       processingFees: processingFees || 0,
  //       conditions: conditions || "",
  //     })
  //   );

  //   // Step 4: Update workflow to route to MD directly
  //   // Set status to ceo_approved so MD can approve (bypass credit L1/L2)
  //   workflow.currentStatus = "ceo_approved";
  //   workflow.currentApproverRoleName = "MD";
  //   workflow.remarks = remarks || `New partner ${partnerCode} added - direct to MD`;
  //   await this.workflowRepository.save(workflow);

  //   // Step 5: Update customer status
  //   customer.status = "ceo_approved";
  //   await this.customerRepository.save(customer);

  //   // Step 6: Log history
  //   await this.logHistory({
  //     customerId,
  //     caseWorkflowId: workflow.id,
  //     status: "ceo_approved",
  //     previousStatus,
  //     changedBy: rmId,
  //     remarks: remarks || `New partner ${partnerCode} submitted directly to MD`,
  //     sanctionData: {
  //       partner: partnerCode,
  //       sanctionAmount,
  //       tenure: tenure || 12,
  //       interestRate: interestRate || 0,
  //       penalCharges: penalCharges || 0,
  //       processingFees: processingFees || 0,
  //     },
  //   });

  //   console.log(
  //     `[CustomerOnboardingService] New partner ${partnerCode} added for customer ${customerId}, ` +
  //     `LAN: ${lanId}, submitted directly to MD for approval`
  //   );

  //   return workflow;
  // }

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


    
    if ( workflow.currentStatus === "ops_l1_review") {

      // // Step 1: Get RM id from customer table
      const customer = await this.customerRepository.findOne({
        where: { id: customerId },
        select: ["id", "rmId","customerName","companyName"],
      });



          if (workflow.currentStatus === "ops_l1_review") {
      const customerName = customer?.companyName || customer?.customerName || `ID ${customerId}`;

      // Step 1: Get roleId from roles table
      const role = await this.roleRepository.findOne({
        where: { name: "operations_team_l1" }, // change if column name differs
        select: ["id"], // primary key column
      });

      if (!role) {
        throw new Error("operations_team_l1 role not found");
      }

      // Step 2: Get all userIds mapped to this roleId from user_roles table
      const userRoles = await this.userRoleRepository.find({
        where: { roleId: role.id }, // IMPORTANT: use role.id unless schema differs
        select: ["userId"],
      });

      if (!userRoles.length) {
        console.log("No users assigned to operations_team_l1 role");
        return;
      }

      // Step 3: Extract userIds
      const userIds = userRoles.map((ur) => ur.userId);

      // Step 4: Fetch emails from users table
      const creditUsers = await this.userRepository.find({
        where: {
          id: In(userIds),
        },
        select: ["id", "email"],
      });

      // Step 5: Send email to each user
      for (const user of creditUsers) {
        if (user.email) {
          await sendMail({
            to: user.email,
            subject: "Case Pending for operations_team_l1 Approval",
            // text: `Customer case ${customerName} approved by Credit L1 and pending your review.`,
            text: `
Dear Team,

The credit case for customer ${customerName} has been send by RM and is now pending your review and approval at the operations_team_l1 stage.

Please log in to the LMS and take the necessary action.

Customer Name : ${customerName}
Case ID       : ${customerId}
Current Stage : Operations L1 Review

Regards,
Credit Workflow System
Fintree Finance Pvt. Ltd.
`,
          });
        }
      }
    }
  }
    // const opsUsers = await this.userRepository.find({
    //   where: {
    //     defaultRole: "operations_team_l1",
    //   },
    //   select: ["id", "email"],
    // });

    // for (const user of opsUsers) {
    //   if (user.email) {
    //     await sendMail({
    //       to: user.email,
    //       subject: "Case Pending for Operations L1 Review",
    //       text: `Customer case ${customerId} is approved by MD and pending Operations L1 review.`,
    //     });
    //   }
    // }

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

    // const opsUsers = await this.userRepository.find({
    //   where: {
    //     defaultRole: "operations_head",
    //   },
    //   select: ["id", "email"],
    // });

    // for (const user of opsUsers) {
    //   if (user.email) {
    //     await sendMail({
    //       to: user.email,
    //       subject: "Case Pending for Operations head Review",
    //       text: `Customer case ${customerId} is approved by Operations team l1 and pending Operations L1 review.`,
    //     });
    //   }
    // }

  if ( workflow.currentStatus === "ops_l1_approved") {

      // // Step 1: Get RM id from customer table
      const customer = await this.customerRepository.findOne({
        where: { id: customerId },
        select: ["id", "rmId","customerName","companyName"],
      });

    
    if (approved) {
      const customerName = customer?.companyName || customer?.customerName || `ID ${customerId}`;

      // Step 1: Get roleId from roles table
      const role = await this.roleRepository.findOne({
        where: { name: "operations_team_l2" }, // change if column name differs
        select: ["id"], // primary key column
      });

      if (!role) {
        throw new Error("operations_team_l2 role not found");
      }

      // Step 2: Get all userIds mapped to this roleId from user_roles table
      const userRoles = await this.userRoleRepository.find({
        where: { roleId: role.id }, // IMPORTANT: use role.id unless schema differs
        select: ["userId"],
      });

      if (!userRoles.length) {
        console.log("No users assigned to operations_team_l2 role");
        return;
      }

      // Step 3: Extract userIds
      const userIds = userRoles.map((ur) => ur.userId);

      // Step 4: Fetch emails from users table
      const creditUsers = await this.userRepository.find({
        where: {
          id: In(userIds),
        },
        select: ["id", "email"],
      });

      // Step 5: Send email to each user
      for (const user of creditUsers) {
        if (user.email) {
          await sendMail({
            to: user.email,
            subject: "Case Pending for Operations Team L2 Review",
            // text: `Customer case ${customerName} approved by Credit L1 and pending your review.`,
            text: `
Dear Team,

The credit case for customer ${customerName} has been approved by operations_team_l1 and is now pending your review and approval at the operations_team_l2 stage.

Please log in to the LMS and take the necessary action.

Customer Name : ${customerName}
Case ID       : ${customerId}
Current Stage : Operations Team L2 Review

Regards,
Credit Workflow System
Fintree Finance Pvt. Ltd.
`,
          });
        }
      }
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

    if (workflow.currentStatus === "completed") {
  const customer = await this.customerRepository.findOne({
    where: { id: customerId },
    select: ["customerName", "companyName"],
  });

  const customerName =
    customer?.companyName ||
    customer?.customerName ||
    `ID ${customerId}`;

  // ✅ Hardcoded email (you can add multiple if needed)
  const recipients = [
    "opshead@fintreefinance.com", 
    "harish.l@fintreefinance.com",
    "pratik.sonawane@fintreefinance.com",
    "vishal.y@fintreefinance.com",
    "aachal.d@fintreefinance.com"// change to actual email
    // "second@email.com"
  ];

  for (const email of recipients) {
    await sendMail({
      to: email,
      subject: "Customer Successfully Onboarded",
      text: `
Dear Sir/Madam,

This is to inform you that the customer ${customerName} has been successfully onboarded after completion of all approval stages.

Customer Name : ${customerName}
Case ID       : ${customerId}


Regards,

Fintree Finance Pvt. Ltd.
`,
    });
  }
}

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
    console.log("status-->", statusFilter);

    // 🔧 FIX: Filter by assignedUserId for user-specific visibility
    // If userId provided, only show cases assigned to this user
    // Get pending workflows (base query)
    const pendingWorkflows = await this.workflowRepository.find({
      where: {
      workflowType: "CUSTOMER_ONBOARDING",
      currentStatus: statusFilter as any,
      currentApproverRoleName: r,
    },
      relations: ["customer"],
    });

    // 🔧 FIX: Filter by assignedUserId - only show cases assigned to this specific user
    // Check both case_workflow.assignedUserId and customer.assignedUserId
    let filteredPending = pendingWorkflows;
    if (userId && statusFilter == 'submitted') {
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
        where: { customerId, status: "active",isOnboarded:false },
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
        await this.loanAccountRepository.update({ customerId, status: "active",isOnboarded:false }, { isOnboarded: true });
        
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

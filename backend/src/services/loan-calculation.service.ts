import { AppDataSource } from '../config/database';
import {
  DEMAND_STATUS,
  DISBURSEMENT_STATUS,
  LEDGER_ENTRY_TYPE,
  LoanAccount,
  LoanAccountSnapshot,
  LoanDemand,
  LoanDisbursement,
  LoanLedgerEntry,
  Repayment,
  RepaymentAllocation,
  REPAYMENT_STATUS,
} from '../entities';
import { Invoice } from '../entities/Invoice';
import { EntityManager, In, Not } from 'typeorm';

type MoneyBreakup = {
  principal: number;
  interest: number;
  penal: number;
  fee: number;
};

type AccrualRules = {
  includeDisbursementDate: boolean;
  penalStartDay: number;
};

type CollectionInput = {
  lan: string;
  collectionDate: string | Date;
  collectionUtr: string;
  collectionAmount: number;
  repaymentUploadId?: number | null;
  userId?: number | null;
};

const CLOSED_DEMAND_STATUSES = [DEMAND_STATUS.PAID, DEMAND_STATUS.REVERSED];
const DEFAULT_BILL_TENURE_DAYS = 90;
const DEFAULT_ACCRUAL_RULES: AccrualRules = {
  includeDisbursementDate: false,
  penalStartDay: 92,
};
const MUTHOOT_ACCRUAL_RULES: AccrualRules = {
  includeDisbursementDate: true,
  penalStartDay: 90,
};

type AccruedDemandCharges = {
  principal: number;
  interestDue: number;
  feeDue: number;
  penalDue: number;
  dayCount: number;
};

export class InternalLmsService {
  private loanAccountRepository = AppDataSource.getRepository(LoanAccount);
  private invoiceRepository = AppDataSource.getRepository(Invoice);
  private disbursementRepository = AppDataSource.getRepository(LoanDisbursement);
  private demandRepository = AppDataSource.getRepository(LoanDemand);
  private repaymentRepository = AppDataSource.getRepository(Repayment);
  private allocationRepository = AppDataSource.getRepository(RepaymentAllocation);
  private ledgerRepository = AppDataSource.getRepository(LoanLedgerEntry);
  private snapshotRepository = AppDataSource.getRepository(LoanAccountSnapshot);

  private toNumber(value: unknown): number {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private roundMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private toDate(value: string | Date): Date {
    if (value instanceof Date) return value;
    return new Date(value);
  }

  private toDateOnly(value: string | Date): Date {
    const date = this.toDate(value);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  private daysBetween(start: Date, end: Date): number {
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.max(0, Math.round((this.toDateOnly(end).getTime() - this.toDateOnly(start).getTime()) / msPerDay));
  }

  private calculatePercentageAmount(amount: number, annualRate: number, dayCount: number): number {
    return this.roundMoney(this.calculatePercentageAmountRaw(amount, annualRate, dayCount));
  }

  private calculatePercentageAmountRaw(amount: number, annualRate: number, dayCount: number): number {
    return (amount * annualRate * dayCount) / (365 * 100);
  }

  private getInterestDayCount(
    disbursementDate: string | Date,
    asOfDate: string | Date = new Date(),
    rules: AccrualRules = DEFAULT_ACCRUAL_RULES,
  ): number {
    const elapsedDays = this.daysBetween(this.toDateOnly(disbursementDate), this.toDateOnly(asOfDate));
    return rules.includeDisbursementDate ? elapsedDays + 1 : Math.max(1, elapsedDays);
  }

  private getOverdueDayCount(dueDate: string | Date, asOfDate: string | Date = new Date()): number {
    return Math.max(0, this.daysBetween(this.toDateOnly(dueDate), this.toDateOnly(asOfDate)));
  }

  private getAccrualDate(disbursementDate: string | Date, day: number, rules: AccrualRules): Date {
    return this.addDays(this.toDateOnly(disbursementDate), rules.includeDisbursementDate ? day - 1 : day);
  }

  private isMuthootLoanAccount(loanAccount: LoanAccount | null | undefined): boolean {
    const values = [
      loanAccount?.partner?.code,
      loanAccount?.partner?.name,
      loanAccount?.partner?.lanPrefix,
      loanAccount?.lender,
    ]
      .filter(Boolean)
      .map(value => String(value).trim().toUpperCase());

    return values.some(value => value === 'MFL' || value.includes('MUTHOOT'));
  }

  private getAccrualRules(loanAccount: LoanAccount | null | undefined): AccrualRules {
    return this.isMuthootLoanAccount(loanAccount) ? MUTHOOT_ACCRUAL_RULES : DEFAULT_ACCRUAL_RULES;
  }

  private calculateAccruedCharges(
    demand: LoanDemand,
    disbursement: LoanDisbursement | null | undefined,
    invoice: Invoice | null | undefined,
    asOfDate: string | Date = new Date(),
    rules: AccrualRules = DEFAULT_ACCRUAL_RULES,
  ): AccruedDemandCharges {
    const interestRate = this.toNumber(disbursement?.interestRate);
    const serviceFeeRate = this.toNumber(invoice?.serviceFee);
    const penalRate = this.toNumber(disbursement?.penalRate);
    const disbursementDate = disbursement?.disbursementDate || demand.demandDate;
    const dayCount = this.getInterestDayCount(disbursementDate, asOfDate, rules);
    const allocations = [...(demand.allocations || [])]
      .filter(allocation => allocation.repayment?.status !== REPAYMENT_STATUS.REVERSED)
      .sort((a, b) => {
        const dateDiff = this.toDateOnly(a.allocationDate).getTime() - this.toDateOnly(b.allocationDate).getTime();
        return dateDiff || this.toNumber(a.id) - this.toNumber(b.id);
      });

    let principal = this.roundMoney(this.toNumber(demand.principalDue));
    let accumulatedInterest = 0;
    let accumulatedFee = 0;
    let accumulatedPenal = 0;
    let allocationIndex = 0;

    for (let day = 1; day <= dayCount; day += 1) {
      const accrualDate = this.getAccrualDate(disbursementDate, day, rules);
      while (
        allocationIndex < allocations.length &&
        this.toDateOnly(allocations[allocationIndex].allocationDate).getTime() <= accrualDate.getTime()
      ) {
        principal = this.roundMoney(Math.max(principal - this.toNumber(allocations[allocationIndex].principalAmount), 0));
        allocationIndex += 1;
      }

      accumulatedInterest += this.calculatePercentageAmountRaw(principal, interestRate, 1);
      accumulatedFee += this.calculatePercentageAmountRaw(principal, serviceFeeRate, 1);
      if (day >= rules.penalStartDay) {
        accumulatedPenal += this.calculatePercentageAmountRaw(principal + accumulatedInterest, penalRate, 1);
      }
    }

    return {
      principal: this.roundMoney(principal),
      interestDue: this.roundMoney(accumulatedInterest),
      feeDue: this.roundMoney(accumulatedFee),
      penalDue: this.roundMoney(accumulatedPenal),
      dayCount,
    };
  }

  private async refreshAccruedInterestForOpenDemands(
    manager: EntityManager,
    loanAccountId: number,
    asOfDate: string | Date = new Date(),
  ): Promise<void> {
    const demandRepository = manager.getRepository(LoanDemand);
    const disbursementRepository = manager.getRepository(LoanDisbursement);
    const loanAccount = await manager.getRepository(LoanAccount).findOne({
      where: { id: loanAccountId },
      relations: ['partner'],
    });
    const accrualRules = this.getAccrualRules(loanAccount);
    const openDemands = await demandRepository.find({
      where: {
        loanAccountId,
        status: Not(In(CLOSED_DEMAND_STATUSES)),
      },
      relations: ['disbursement', 'invoice', 'allocations', 'allocations.repayment'],
      order: { dueDate: 'ASC', id: 'ASC' },
    });

    for (const demand of openDemands) {
      const disbursement = demand.disbursement || await disbursementRepository.findOne({
        where: { id: demand.loanDisbursementId },
      });
      const charges = this.calculateAccruedCharges(demand, disbursement, demand.invoice, asOfDate, accrualRules);
      const totalDue = this.roundMoney(
        this.toNumber(demand.principalDue) +
        charges.interestDue +
        charges.penalDue,
      );

      demand.interestDue = charges.interestDue;
      demand.penalDue = charges.penalDue;
      demand.feeDue = charges.feeDue;
      demand.totalDue = totalDue;
      demand.outstandingAmount = this.roundMoney(Math.max(totalDue - this.toNumber(demand.totalPaid), 0));
      demand.status = this.getDemandStatus(demand);
      await demandRepository.save(demand);

      if (disbursement) {
        disbursement.interestAmount = charges.interestDue;
        disbursement.principalOutstanding = charges.principal;
        await disbursementRepository.save(disbursement);
      }

      if (demand.invoice) {
        demand.invoice.roiAmount = charges.interestDue;
        demand.invoice.emiAmount = totalDue;
        await manager.getRepository(Invoice).save(demand.invoice);
      }
    }
  }

  private async getRunningBalance(manager: EntityManager, loanAccountId: number): Promise<number> {
    const lastEntry = await manager.getRepository(LoanLedgerEntry).findOne({
      where: { loanAccountId },
      order: { id: 'DESC' },
    });
    return this.toNumber(lastEntry?.runningBalance);
  }

  private async createLedgerEntry(
    manager: EntityManager,
    data: {
      loanAccountId: number;
      lan: string;
      entryType: LEDGER_ENTRY_TYPE;
      debit?: number;
      credit?: number;
      valueDate: Date;
      loanDisbursementId?: number | null;
      demandId?: number | null;
      repaymentId?: number | null;
      invoiceId?: number | null;
      referenceType?: string | null;
      referenceId?: string | null;
      narration?: string | null;
      createdByUserId?: number | null;
    },
  ): Promise<LoanLedgerEntry> {
    const previousBalance = await this.getRunningBalance(manager, data.loanAccountId);
    const debit = this.roundMoney(this.toNumber(data.debit));
    const credit = this.roundMoney(this.toNumber(data.credit));
    const runningBalance = this.roundMoney(previousBalance + debit - credit);

    const entry = manager.getRepository(LoanLedgerEntry).create({
      loanAccountId: data.loanAccountId,
      loanDisbursementId: data.loanDisbursementId ?? null,
      demandId: data.demandId ?? null,
      repaymentId: data.repaymentId ?? null,
      invoiceId: data.invoiceId ?? null,
      lan: data.lan,
      entryType: data.entryType,
      debit,
      credit,
      runningBalance,
      valueDate: data.valueDate,
      referenceType: data.referenceType ?? null,
      referenceId: data.referenceId ?? null,
      narration: data.narration ?? null,
      createdByUserId: data.createdByUserId ?? null,
    });

    return manager.getRepository(LoanLedgerEntry).save(entry);
  }

  async bookInvoiceDisbursement(
    invoiceId: number,
    userId?: number,
  ): Promise<{
    disbursement: LoanDisbursement;
    demand: LoanDemand;
    snapshot: LoanAccountSnapshot;
    alreadyBooked: boolean;
  }> {
    return AppDataSource.transaction(async (manager) => {
      const existing = await manager.getRepository(LoanDisbursement).findOne({
        where: { invoiceId },
        relations: ['demands'],
      });

      if (existing) {
        const existingDemand = existing.demands?.[0] || await manager.getRepository(LoanDemand).findOne({
          where: { loanDisbursementId: existing.id },
          order: { id: 'ASC' },
        });
        if (!existingDemand) {
          throw new Error(`Internal LMS disbursement ${existing.id} exists without a demand`);
        }
        const snapshot = await this.refreshSnapshot(manager, existing.loanAccountId);
        return { disbursement: existing, demand: existingDemand, snapshot, alreadyBooked: true };
      }

      const invoice = await manager.getRepository(Invoice).findOne({
        where: { id: invoiceId },
        relations: ['loanAccount', 'loanAccount.partner', 'supplier', 'customer'],
      });
      console.log(invoice)
      if (!invoice) throw new Error('Invoice not found for internal LMS booking');
      if (!invoice.loanAccountId) throw new Error('Invoice is not linked to a LAN');
      if (!invoice.disbursementDate) throw new Error('Disbursement date is required before LMS booking');
      if (!invoice.disbursementUtr) throw new Error('Disbursement UTR is required before LMS booking');

      const loanAccount = invoice.loanAccount || await manager.getRepository(LoanAccount).findOne({
        where: { id: invoice.loanAccountId },
        relations: ['partner'],
      });
      if (!loanAccount) throw new Error('Loan account not found for internal LMS booking');
      if (String(loanAccount.status || '').toLowerCase() !== 'active') {
        throw new Error(`LAN ${loanAccount.lanId} is not active`);
      }

      const disbursementAmount = this.roundMoney(this.toNumber(invoice.disbursementAmount));
      if (disbursementAmount <= 0) throw new Error('Disbursement amount must be greater than zero');

      const disbursementDate = this.toDateOnly(invoice.disbursementDate);
      const dueDate = invoice.invoiceDueDate
        ? this.toDateOnly(invoice.invoiceDueDate)
        : this.addDays(disbursementDate, DEFAULT_BILL_TENURE_DAYS);
      const tenureDays = Math.max(1, this.daysBetween(disbursementDate, dueDate));
      const interestRate = this.toNumber(invoice.roiPercentage);
      const penalRate = this.toNumber(invoice.penalCharges);
      const accrualRules = this.getAccrualRules(loanAccount);
      const initialCharges = this.calculateAccruedCharges(
        {
          principalDue: disbursementAmount,
          principalPaid: 0,
          demandDate: disbursementDate,
          dueDate,
          allocations: [],
        } as unknown as LoanDemand,
        {
          disbursementDate,
          interestRate,
          penalRate,
        } as LoanDisbursement,
        invoice,
        new Date(),
        accrualRules,
      );
      const interestAmount = initialCharges.interestDue;
      const feeDue = initialCharges.feeDue;
      const penalDue = initialCharges.penalDue;

      const disbursement = await manager.getRepository(LoanDisbursement).save(
        manager.getRepository(LoanDisbursement).create({
          loanAccountId: loanAccount.id,
          customerId: invoice.customerId,
          invoiceId: invoice.id,
          lan: loanAccount.lanId,
          disbursementAmount,
          disbursementDate,
          disbursementUtr: invoice.disbursementUtr,
          tenureDays,
          dueDate,
          interestRate,
          penalRate,
          interestAmount,
          principalOutstanding: disbursementAmount,
          status: DISBURSEMENT_STATUS.POSTED,
          createdByUserId: userId ?? null,
        }),
      );

      const demandPrincipal = disbursementAmount;
      const totalDue = this.roundMoney(demandPrincipal + interestAmount + penalDue);
      const demand = await manager.getRepository(LoanDemand).save(
        manager.getRepository(LoanDemand).create({
          loanAccountId: loanAccount.id,
          loanDisbursementId: disbursement.id,
          invoiceId: invoice.id,
          lan: loanAccount.lanId,
          demandDate: disbursementDate,
          dueDate,
          principalDue: demandPrincipal,
          interestDue: interestAmount,
          penalDue,
          feeDue,
          totalDue,
          outstandingAmount: totalDue,
          status: DEMAND_STATUS.PENDING,
        }),
      );

      await this.createLedgerEntry(manager, {
        loanAccountId: loanAccount.id,
        lan: loanAccount.lanId,
        entryType: LEDGER_ENTRY_TYPE.DISBURSEMENT,
        debit: disbursementAmount,
        valueDate: disbursementDate,
        loanDisbursementId: disbursement.id,
        invoiceId: invoice.id,
        referenceType: 'INVOICE',
        referenceId: String(invoice.id),
        narration: `Invoice ${invoice.invoiceNumber} disbursement booked`,
        createdByUserId: userId ?? null,
      });

      invoice.roiAmount = interestAmount;
      invoice.emiAmount = totalDue;
      invoice.disbursedAmount = disbursementAmount;
      invoice.disbursedDate = disbursementDate;
      invoice.invoiceDueDate = dueDate;
      await manager.getRepository(Invoice).save(invoice);

      const snapshot = await this.refreshSnapshot(manager, loanAccount.id);
      return { disbursement, demand, snapshot, alreadyBooked: false };
    });
  }

  async recordCollection(input: CollectionInput): Promise<{
    repayment: Repayment;
    allocations: RepaymentAllocation[];
    snapshot: LoanAccountSnapshot;
  }> {
    return AppDataSource.transaction(async (manager) => {
      const lan = String(input.lan || '').trim();
      if (!lan) throw new Error('LAN is required for repayment posting');

      const loanAccount = await manager.getRepository(LoanAccount).findOne({ where: { lanId: lan } });
      if (!loanAccount) throw new Error(`LAN ${lan} was not found in internal loan accounts`);

      const utr = String(input.collectionUtr || '').trim();
      if (!utr) throw new Error('Collection UTR is required');

      const amount = this.roundMoney(this.toNumber(input.collectionAmount));
      if (amount <= 0) throw new Error('Collection amount must be greater than zero');

      const existing = await manager.getRepository(Repayment).findOne({
        where: { lan, utr },
        relations: ['allocations'],
      });
      if (existing) {
        const snapshot = await this.refreshSnapshot(manager, loanAccount.id);
        return {
          repayment: existing,
          allocations: existing.allocations || [],
          snapshot,
        };
      }

      const repaymentDate = this.toDateOnly(input.collectionDate);
      const repayment = await manager.getRepository(Repayment).save(
        manager.getRepository(Repayment).create({
          loanAccountId: loanAccount.id,
          repaymentUploadId: input.repaymentUploadId ?? null,
          lan,
          repaymentDate,
          utr,
          amount,
          allocatedAmount: 0,
          unappliedAmount: amount,
          status: REPAYMENT_STATUS.POSTED,
          createdByUserId: input.userId ?? null,
        }),
      );

      await this.createLedgerEntry(manager, {
        loanAccountId: loanAccount.id,
        lan,
        entryType: LEDGER_ENTRY_TYPE.REPAYMENT,
        credit: amount,
        valueDate: repaymentDate,
        repaymentId: repayment.id,
        referenceType: 'UTR',
        referenceId: utr,
        narration: `Collection received: ${utr}`,
        createdByUserId: input.userId ?? null,
      });

      await this.refreshAccruedInterestForOpenDemands(manager, loanAccount.id, repaymentDate);
      const allocations = await this.allocateRepayment(manager, repayment, loanAccount.id);
      const allocatedAmount = allocations.reduce((sum, allocation) => sum + this.toNumber(allocation.totalAmount), 0);
      repayment.allocatedAmount = this.roundMoney(allocatedAmount);
      repayment.unappliedAmount = this.roundMoney(amount - allocatedAmount);
      repayment.status =
        repayment.unappliedAmount <= 0
          ? REPAYMENT_STATUS.ALLOCATED
          : repayment.allocatedAmount > 0
            ? REPAYMENT_STATUS.PARTIALLY_ALLOCATED
            : REPAYMENT_STATUS.POSTED;
      await manager.getRepository(Repayment).save(repayment);

      const snapshot = await this.refreshSnapshot(manager, loanAccount.id);
      return { repayment, allocations, snapshot };
    });
  }

  private async allocateRepayment(
    manager: EntityManager,
    repayment: Repayment,
    loanAccountId: number,
  ): Promise<RepaymentAllocation[]> {
    let available = this.roundMoney(this.toNumber(repayment.amount));
    const allocations: RepaymentAllocation[] = [];
    const demandRepository = manager.getRepository(LoanDemand);

    const demands = await demandRepository.find({
      where: {
        lan: repayment.lan,
        status: Not(In(CLOSED_DEMAND_STATUSES)),
      },
      order: { dueDate: 'ASC', id: 'ASC' },
    });

    for (const demand of demands) {
      if (available <= 0) break;

      const applied = this.allocateDemandComponents(demand, available);
      const totalApplied = this.roundMoney(applied.principal + applied.interest + applied.penal + applied.fee);
      if (totalApplied <= 0) continue;

      demand.principalPaid = this.roundMoney(this.toNumber(demand.principalPaid) + applied.principal);
      demand.interestPaid = this.roundMoney(this.toNumber(demand.interestPaid) + applied.interest);
      demand.penalPaid = this.roundMoney(this.toNumber(demand.penalPaid) + applied.penal);
      demand.feePaid = this.roundMoney(this.toNumber(demand.feePaid) + applied.fee);
      demand.totalPaid = this.roundMoney(this.toNumber(demand.totalPaid) + totalApplied);
      demand.outstandingAmount = this.roundMoney(this.toNumber(demand.totalDue) - this.toNumber(demand.totalPaid));
      demand.status = this.getDemandStatus(demand);
      await demandRepository.save(demand);

      if (applied.principal > 0) {
        const disbursement = await manager.getRepository(LoanDisbursement).findOne({
          where: { id: demand.loanDisbursementId },
        });
        if (disbursement) {
          disbursement.principalOutstanding = this.roundMoney(
            Math.max(this.toNumber(disbursement.principalOutstanding) - applied.principal, 0),
          );
          await manager.getRepository(LoanDisbursement).save(disbursement);
        }
      }

      const allocation = await manager.getRepository(RepaymentAllocation).save(
        manager.getRepository(RepaymentAllocation).create({
          repaymentId: repayment.id,
          demandId: demand.id,
          loanAccountId,
          invoiceId: demand.invoiceId,
          lan: repayment.lan,
          allocationDate: repayment.repaymentDate,
          principalAmount: applied.principal,
          interestAmount: applied.interest,
          penalAmount: applied.penal,
          feeAmount: applied.fee,
          totalAmount: totalApplied,
        }),
      );
      allocations.push(allocation);

      await this.createLedgerEntry(manager, {
        loanAccountId,
        lan: repayment.lan,
        entryType: LEDGER_ENTRY_TYPE.ALLOCATION,
        debit: 0,
        credit: totalApplied,
        valueDate: repayment.repaymentDate,
        repaymentId: repayment.id,
        demandId: demand.id,
        invoiceId: demand.invoiceId,
        referenceType: 'ALLOCATION',
        referenceId: String(allocation.id),
        narration: `Collection ${repayment.utr} allocated to demand ${demand.id}`,
        createdByUserId: repayment.createdByUserId ?? null,
      });

      available = this.roundMoney(available - totalApplied);
    }

    return allocations;
  }

  private allocateDemandComponents(demand: LoanDemand, availableAmount: number): MoneyBreakup {
    let available = this.roundMoney(availableAmount);
    const applied: MoneyBreakup = { principal: 0, interest: 0, penal: 0, fee: 0 };

    const applyComponent = (key: keyof MoneyBreakup, due: number, paid: number) => {
      if (available <= 0) return;
      const remaining = this.roundMoney(Math.max(due - paid, 0));
      const amount = this.roundMoney(Math.min(available, remaining));
      applied[key] = amount;
      available = this.roundMoney(available - amount);
    };

    applyComponent('principal', this.toNumber(demand.principalDue), this.toNumber(demand.principalPaid));
    applyComponent('interest', this.toNumber(demand.interestDue), this.toNumber(demand.interestPaid));
    applyComponent('penal', this.toNumber(demand.penalDue), this.toNumber(demand.penalPaid));

    return applied;
  }

  private getDemandStatus(demand: LoanDemand): DEMAND_STATUS {
    if (this.toNumber(demand.outstandingAmount) <= 0) return DEMAND_STATUS.PAID;
    if (this.toNumber(demand.totalPaid) > 0) return DEMAND_STATUS.PARTIAL;
    if (this.toDateOnly(demand.dueDate).getTime() < this.toDateOnly(new Date()).getTime()) {
      return DEMAND_STATUS.OVERDUE;
    }
    return DEMAND_STATUS.PENDING;
  }

  async refreshSnapshot(managerOrLoanAccountId: EntityManager | number, maybeLoanAccountId?: number): Promise<LoanAccountSnapshot> {
    const manager = typeof managerOrLoanAccountId === 'number' ? AppDataSource.manager : managerOrLoanAccountId;
    const loanAccountId = typeof managerOrLoanAccountId === 'number' ? managerOrLoanAccountId : maybeLoanAccountId;
    if (!loanAccountId) throw new Error('loanAccountId is required to refresh LMS snapshot');

    const loanAccountRepository = manager.getRepository(LoanAccount);
    const loanAccount = await loanAccountRepository.findOne({ where: { id: loanAccountId } });
    if (!loanAccount) throw new Error('Loan account not found for LMS snapshot');

    await this.refreshAccruedInterestForOpenDemands(manager, loanAccount.id);

    const [disbursements, demands, repayments] = await Promise.all([
      manager.getRepository(LoanDisbursement).find({
        where: { loanAccountId, status: DISBURSEMENT_STATUS.POSTED },
      }),
      manager.getRepository(LoanDemand).find({
        where: { loanAccountId, status: Not(In([DEMAND_STATUS.REVERSED])) },
        order: { dueDate: 'ASC', id: 'ASC' },
      }),
      manager.getRepository(Repayment).find({
        where: { loanAccountId, status: Not(In([REPAYMENT_STATUS.REVERSED])) },
        order: { repaymentDate: 'DESC', id: 'DESC' },
      }),
    ]);

    const totalDisbursed = this.roundMoney(
      disbursements.reduce((sum, item) => sum + this.toNumber(item.disbursementAmount), 0),
    );

    const openDemands = demands.filter(demand => demand.status !== DEMAND_STATUS.PAID);
    const principalOutstanding = this.roundMoney(
      openDemands.reduce((sum, demand) => sum + Math.max(this.toNumber(demand.principalDue) - this.toNumber(demand.principalPaid), 0), 0),
    );
    const interestOutstanding = this.roundMoney(
      openDemands.reduce((sum, demand) => sum + Math.max(this.toNumber(demand.interestDue) - this.toNumber(demand.interestPaid), 0), 0),
    );
    const penalOutstanding = this.roundMoney(
      openDemands.reduce((sum, demand) => sum + Math.max(this.toNumber(demand.penalDue) - this.toNumber(demand.penalPaid), 0), 0),
    );
    const feeOutstanding = this.roundMoney(
      openDemands.reduce((sum, demand) => sum + Math.max(this.toNumber(demand.feeDue) - this.toNumber(demand.feePaid), 0), 0),
    );
    const totalOutstanding = this.roundMoney(principalOutstanding + interestOutstanding + penalOutstanding);
    const totalCollected = this.roundMoney(
      repayments.reduce((sum, repayment) => sum + this.toNumber(repayment.amount), 0),
    );

    const today = this.toDateOnly(new Date());
    const overdueDemands = openDemands.filter(demand => this.toDateOnly(demand.dueDate).getTime() < today.getTime());
    const overdueAmount = this.roundMoney(
      overdueDemands.reduce((sum, demand) => sum + this.toNumber(demand.outstandingAmount), 0),
    );
    const dpd = overdueDemands.reduce((max, demand) => Math.max(max, this.daysBetween(this.toDateOnly(demand.dueDate), today)), 0);
    const nextDemand = openDemands[0] || null;
    const lastDemand = demands[demands.length - 1] || null;
    const lastRepayment = repayments[0] || null;
    const utilizedLimit = principalOutstanding;
    const unutilizedLimit = this.roundMoney(Math.max(this.toNumber(loanAccount.sanctionedAmount) - utilizedLimit, 0));

    let snapshot = await manager.getRepository(LoanAccountSnapshot).findOne({ where: { loanAccountId } });
    if (!snapshot) {
      snapshot = manager.getRepository(LoanAccountSnapshot).create({
        loanAccountId,
        lan: loanAccount.lanId,
      });
    }

    Object.assign(snapshot, {
      lan: loanAccount.lanId,
      sanctionedAmount: this.toNumber(loanAccount.sanctionedAmount),
      totalDisbursed,
      principalOutstanding,
      interestOutstanding,
      penalOutstanding,
      feeOutstanding,
      totalOutstanding,
      totalCollected,
      utilizedLimit,
      unutilizedLimit,
      overdueAmount,
      dpd,
      nextDueDate: nextDemand?.dueDate || null,
      lastDemandDate: lastDemand?.demandDate || null,
      lastCollectionDate: lastRepayment?.repaymentDate || null,
      status: totalOutstanding <= 0 && totalDisbursed > 0 ? 'CLOSED' : loanAccount.status?.toUpperCase?.() || 'ACTIVE',
    });

    loanAccount.disbursedAmount = totalDisbursed;
    loanAccount.utilizedLimit = utilizedLimit;
    loanAccount.unutilizedLimit = unutilizedLimit;
    await loanAccountRepository.save(loanAccount);

    return manager.getRepository(LoanAccountSnapshot).save(snapshot);
  }

  async getLoanAccountSummary(lan: string): Promise<{
    loanAccount: LoanAccount;
    snapshot: LoanAccountSnapshot;
    demands: LoanDemand[];
    disbursements: LoanDisbursement[];
  }> {
    const loanAccount = await this.loanAccountRepository.findOne({ where: { lanId: lan }, relations: ['customer', 'partner'] });
    if (!loanAccount) throw new Error(`LAN ${lan} not found`);
    const snapshot = await this.refreshSnapshot(loanAccount.id);
    const [demands, disbursements] = await Promise.all([
      this.demandRepository.find({ where: { loanAccountId: loanAccount.id }, order: { dueDate: 'ASC', id: 'ASC' } }),
      this.disbursementRepository.find({ where: { loanAccountId: loanAccount.id }, order: { disbursementDate: 'DESC', id: 'DESC' } }),
    ]);

    return { loanAccount, snapshot, demands, disbursements };
  }

  async getCustomerLoanSummary(customerId: number): Promise<any> {
    const loanAccounts = await this.loanAccountRepository.find({
      where: { customerId },
      relations: ['partner'],
      order: { createdAt: 'DESC' },
    });

    const rows = await Promise.all(
      loanAccounts.map(async (loanAccount) => {
        const snapshot = await this.refreshSnapshot(loanAccount.id);
        return {
          id: loanAccount.id,
          lan: loanAccount.lanId,
          partnerId: loanAccount.partnerId,
          partnerName: loanAccount.partner?.name || loanAccount.lender,
          sanctionedAmount: this.toNumber(loanAccount.sanctionedAmount),
          status: loanAccount.status,
          snapshot,
        };
      }),
    );

    return {
      success: true,
      data: rows,
    };
  }

  async getCustomerDashboard(customerId: number): Promise<any> {
    const summary = await this.getCustomerLoanSummary(customerId);
    const rows = summary.data || [];
    const loanAccountIds = rows.map((row: any) => row.id);
    const repayments = loanAccountIds.length > 0
      ? await this.repaymentRepository.find({
          where: { loanAccountId: In(loanAccountIds), status: Not(In([REPAYMENT_STATUS.REVERSED])) },
          order: { repaymentDate: 'DESC', id: 'DESC' },
          take: 5,
        })
      : [];
    const totalSanctioned = this.roundMoney(rows.reduce((sum: number, row: any) => sum + this.toNumber(row.snapshot?.sanctionedAmount), 0));
    const totalUtilized = this.roundMoney(rows.reduce((sum: number, row: any) => sum + this.toNumber(row.snapshot?.utilizedLimit), 0));
    const totalAvailable = this.roundMoney(rows.reduce((sum: number, row: any) => sum + this.toNumber(row.snapshot?.unutilizedLimit), 0));
    const totalOutstanding = this.roundMoney(rows.reduce((sum: number, row: any) => sum + this.toNumber(row.snapshot?.totalOutstanding), 0));
    const totalCollected = this.roundMoney(rows.reduce((sum: number, row: any) => sum + this.toNumber(row.snapshot?.totalCollected), 0));
    const totalDisbursed = this.roundMoney(rows.reduce((sum: number, row: any) => sum + this.toNumber(row.snapshot?.totalDisbursed), 0));

    return {
      success: true,
      data: {
        totalSanctioned,
        totalUtilized,
        totalAvailable,
        totalOutstanding,
        totalToPay: totalOutstanding,
        totalCollected,
        totalDisbursed,
        activeLoans: rows.filter((row: any) => String(row.status || '').toLowerCase() === 'active').length,
        totalLoans: rows.length,
        recentRepayments: repayments.map(repayment => ({
          id: repayment.id,
          lan: repayment.lan,
          collection_date: repayment.repaymentDate,
          collection_amount: this.toNumber(repayment.amount),
          collection_utr: repayment.utr,
          status: repayment.status,
        })),
        isLmsData: false,
        source: 'INTERNAL_LMS',
      },
    };
  }

  async getForeclosurePreview(lan: string): Promise<any> {
    const cleanLan = String(lan || '').trim();
    if (!cleanLan) throw new Error('LAN is required');

    const loanAccount = await this.loanAccountRepository.findOne({ where: { lanId: cleanLan } });
    if (!loanAccount) throw new Error(`LAN ${cleanLan} not found`);

    const snapshot = await this.refreshSnapshot(loanAccount.id);
    const totalToPay = this.toNumber(snapshot.totalOutstanding);

    return {
      success: true,
      data: {
        lan: cleanLan,
        principal: this.toNumber(snapshot.principalOutstanding),
        interest: this.toNumber(snapshot.interestOutstanding),
        penal: this.toNumber(snapshot.penalOutstanding),
        fee: this.toNumber(snapshot.feeOutstanding),
        totalToPay,
        totalForeclosureAmount: totalToPay,
        totalCollected: this.toNumber(snapshot.totalCollected),
        overdueAmount: this.toNumber(snapshot.overdueAmount),
        dpd: this.toNumber(snapshot.dpd),
        nextDueDate: snapshot.nextDueDate || null,
        lastCollectionDate: snapshot.lastCollectionDate || null,
      },
    };
  }

  async getDemandSchedule(lan: string): Promise<any> {
    const loanAccount = await this.loanAccountRepository.findOne({ where: { lanId: lan } });
    if (loanAccount) {
      await this.refreshAccruedInterestForOpenDemands(AppDataSource.manager, loanAccount.id);
    }

    const demands = await this.demandRepository.find({
      where: { lan },
      relations: ['invoice'],
      order: { dueDate: 'ASC', id: 'ASC' },
    });

    return {
      success: true,
      data: demands.map(demand => ({
        id: demand.id,
        lan: demand.lan,
        invoiceId: demand.invoiceId,
        invoiceNumber: demand.invoice?.invoiceNumber || null,
        demandDate: demand.demandDate,
        dueDate: demand.dueDate,
        principalDue: this.toNumber(demand.principalDue),
        interestDue: this.toNumber(demand.interestDue),
        penalDue: this.toNumber(demand.penalDue),
        feeDue: this.toNumber(demand.feeDue),
        totalDue: this.toNumber(demand.totalDue),
        totalPaid: this.toNumber(demand.totalPaid),
        outstandingAmount: this.toNumber(demand.outstandingAmount),
        status: demand.status,
      })),
    };
  }

  async getStatement(lan: string, filters?: { startDate?: string; endDate?: string }): Promise<any> {
    const entries = await this.ledgerRepository.find({
      where: { lan },
      order: { valueDate: 'ASC', id: 'ASC' },
    });

    let runningBalance = 0;
    const statementRows = entries
      .filter(entry => entry.entryType !== LEDGER_ENTRY_TYPE.DEMAND)
      .map(entry => {
        runningBalance = this.roundMoney(
          runningBalance + this.toNumber(entry.debit) - this.toNumber(entry.credit),
        );
        return { entry, runningBalance };
      });

    const startTime = filters?.startDate ? this.toDateOnly(filters.startDate).getTime() : null;
    const endTime = filters?.endDate ? this.toDateOnly(filters.endDate).getTime() : null;
    const filtered = statementRows.filter(({ entry }) => {
      const valueTime = this.toDateOnly(entry.valueDate).getTime();
      if (startTime !== null && valueTime < startTime) return false;
      if (endTime !== null && valueTime > endTime) return false;
      return true;
    });

    return {
      success: true,
      data: filtered.map(({ entry, runningBalance }) => ({
        id: entry.id,
        lan: entry.lan,
        valueDate: entry.valueDate,
        entryType: entry.entryType,
        debit: this.toNumber(entry.debit),
        credit: this.toNumber(entry.credit),
        runningBalance,
        narration: entry.narration,
        referenceType: entry.referenceType,
        referenceId: entry.referenceId,
      })),
    };
  }

  async getStatementByLoanAccountId(
    loanAccountId: number,
    filters?: { startDate?: string; endDate?: string },
  ): Promise<any> {
    const loanAccount = await this.loanAccountRepository.findOne({ where: { id: loanAccountId } });
    if (!loanAccount) throw new Error('Loan account not found');
    return this.getStatement(loanAccount.lanId, filters);
  }

  async getTransactionsByLan(lan: string): Promise<any> {
    const repayments = await this.repaymentRepository.find({
      where: { lan, status: Not(In([REPAYMENT_STATUS.REVERSED])) },
      order: { repaymentDate: 'DESC', id: 'DESC' },
    });

    return {
      success: true,
      data: repayments.map(repayment => ({
        lan: repayment.lan,
        collection_date: repayment.repaymentDate,
        collection_amount: this.toNumber(repayment.amount),
        collection_utr: repayment.utr,
        allocated_amount: this.toNumber(repayment.allocatedAmount),
        unapplied_amount: this.toNumber(repayment.unappliedAmount),
        status: repayment.status,
      })),
    };
  }

  async getCollectionDetail(lan: string, utr: string): Promise<any> {
    const repayment = await this.repaymentRepository.findOne({
      where: { lan, utr },
      relations: ['allocations', 'allocations.demand', 'allocations.invoice'],
    });

    if (!repayment) {
      return {
        success: true,
        data: {
          lan,
          collection_utr: utr,
          total_collected: 0,
          allocation_breakup: {
            allocated_principal: 0,
            allocated_interest: 0,
            allocated_penal_interest: 0,
            allocated_fee: 0,
            excess_payment: 0,
          },
          invoice_wise_allocation: [],
        },
      };
    }

    const allocations = repayment.allocations || [];
    const principal = this.roundMoney(allocations.reduce((sum, item) => sum + this.toNumber(item.principalAmount), 0));
    const interest = this.roundMoney(allocations.reduce((sum, item) => sum + this.toNumber(item.interestAmount), 0));
    const penal = this.roundMoney(allocations.reduce((sum, item) => sum + this.toNumber(item.penalAmount), 0));
    const fee = this.roundMoney(allocations.reduce((sum, item) => sum + this.toNumber(item.feeAmount), 0));

    return {
      success: true,
      data: {
        lan,
        collection_utr: utr,
        total_collected: this.toNumber(repayment.amount),
        allocation_breakup: {
          allocated_principal: principal,
          allocated_interest: interest,
          allocated_penal_interest: penal,
          allocated_fee: fee,
          excess_payment: this.toNumber(repayment.unappliedAmount),
        },
        invoice_wise_allocation: allocations.map(allocation => ({
          invoice_number: allocation.invoice?.invoiceNumber || allocation.demand?.invoiceId || null,
          allocated_principal: this.toNumber(allocation.principalAmount),
          allocated_interest: this.toNumber(allocation.interestAmount),
          allocated_penal_interest: this.toNumber(allocation.penalAmount),
          allocated_fee: this.toNumber(allocation.feeAmount),
        })),
      },
    };
  }

  async getPortfolioReport(): Promise<any> {
    const loanAccounts = await this.loanAccountRepository.find();
    await Promise.all(loanAccounts.map(loanAccount => this.refreshSnapshot(loanAccount.id)));

    const snapshots = await this.snapshotRepository.find({ relations: ['loanAccount'] });
    return {
      success: true,
      data: {
        accounts: snapshots.length,
        sanctionedAmount: this.roundMoney(snapshots.reduce((sum, row) => sum + this.toNumber(row.sanctionedAmount), 0)),
        totalDisbursed: this.roundMoney(snapshots.reduce((sum, row) => sum + this.toNumber(row.totalDisbursed), 0)),
        totalOutstanding: this.roundMoney(snapshots.reduce((sum, row) => sum + this.toNumber(row.totalOutstanding), 0)),
        totalCollected: this.roundMoney(snapshots.reduce((sum, row) => sum + this.toNumber(row.totalCollected), 0)),
        overdueAmount: this.roundMoney(snapshots.reduce((sum, row) => sum + this.toNumber(row.overdueAmount), 0)),
        rows: snapshots,
      },
    };
  }

  async getDisbursementReport(filters?: { startDate?: string; endDate?: string }): Promise<any> {
    const disbursements = await this.disbursementRepository.find({
      where: { status: DISBURSEMENT_STATUS.POSTED },
      relations: ['invoice', 'loanAccount', 'customer'],
      order: { disbursementDate: 'DESC', id: 'DESC' },
    });
    const rows = this.filterByDateRange(disbursements, 'disbursementDate', filters);
    return {
      success: true,
      data: {
        totalAmount: this.roundMoney(rows.reduce((sum, row) => sum + this.toNumber(row.disbursementAmount), 0)),
        count: rows.length,
        rows,
      },
    };
  }

  async getCollectionReport(filters?: { startDate?: string; endDate?: string }): Promise<any> {
    const repayments = await this.repaymentRepository.find({
      where: { status: Not(In([REPAYMENT_STATUS.REVERSED])) },
      order: { repaymentDate: 'DESC', id: 'DESC' },
    });
    const rows = this.filterByDateRange(repayments, 'repaymentDate', filters);
    return {
      success: true,
      data: {
        totalAmount: this.roundMoney(rows.reduce((sum, row) => sum + this.toNumber(row.amount), 0)),
        allocatedAmount: this.roundMoney(rows.reduce((sum, row) => sum + this.toNumber(row.allocatedAmount), 0)),
        unappliedAmount: this.roundMoney(rows.reduce((sum, row) => sum + this.toNumber(row.unappliedAmount), 0)),
        count: rows.length,
        rows,
      },
    };
  }

  private filterByDateRange<T extends Record<string, any>>(
    rows: T[],
    field: keyof T,
    filters?: { startDate?: string; endDate?: string },
  ): T[] {
    const startTime = filters?.startDate ? this.toDateOnly(filters.startDate).getTime() : null;
    const endTime = filters?.endDate ? this.toDateOnly(filters.endDate).getTime() : null;
    return rows.filter((row) => {
      const value = row[field];
      if (!value) return true;
      const time = this.toDateOnly(value).getTime();
      if (startTime !== null && time < startTime) return false;
      if (endTime !== null && time > endTime) return false;
      return true;
    });
  }
}

export const internalLmsService = new InternalLmsService();

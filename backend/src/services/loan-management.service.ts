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
  RepaymentUpload,
  REPAYMENT_STATUS,
} from '../entities';
import { Invoice } from '../entities/Invoice';
import { EntityManager, In, Not } from 'typeorm';
import { calculateMonthlyPenalAmountRaw, normalizeMonthlyPenalRate } from '../utils/penalCharges';
import { Customer } from '../entities/Customer';
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

type ScfReportFilters = {
  startDate?: string;
  endDate?: string;
  asOfDate?: string;
  lan?: string;
  allCases?: boolean;
};

type WorkbookFormulaCell = {
  formula: string;
  result?: number;
};

type WorkbookCellValue = string | number | Date | WorkbookFormulaCell | null | undefined;

type WorkbookSheet = {
  name: string;
  rows: WorkbookCellValue[][];
};

type LedgerStatementSourceRow = {
  id: string;
  sequence: number;
  sortOrder: number;
  lan: string;
  product: string;
  invoiceId: string | number | null;
  transactionDate: Date;
  remarks: string;
  debit: number;
  credit: number;
};

const CLOSED_DEMAND_STATUSES = [DEMAND_STATUS.PAID, DEMAND_STATUS.REVERSED];
const DEFAULT_BILL_TENURE_DAYS = 90;
const DEFAULT_ACCRUAL_RULES: AccrualRules = {
  includeDisbursementDate: false,
  penalStartDay: 91,
};
const MUTHOOT_ACCRUAL_RULES: AccrualRules = {
  includeDisbursementDate: true,
  penalStartDay: 92,
};

type AccruedDemandCharges = {
  principal: number;
  interestDue: number;
  feeDue: number;
  penalDue: number;
  dayCount: number;
};

export class LoanManagementService {
  private loanAccountRepository = AppDataSource.getRepository(LoanAccount);
  private invoiceRepository = AppDataSource.getRepository(Invoice);
  private disbursementRepository = AppDataSource.getRepository(LoanDisbursement);
  private demandRepository = AppDataSource.getRepository(LoanDemand);
  private repaymentRepository = AppDataSource.getRepository(Repayment);
  private allocationRepository = AppDataSource.getRepository(RepaymentAllocation);
  private ledgerRepository = AppDataSource.getRepository(LoanLedgerEntry);
  private snapshotRepository = AppDataSource.getRepository(LoanAccountSnapshot);
  private crc32Table: number[] | null = null;
  private customerRepository = AppDataSource.getRepository(Customer);
  private toNumber(value: unknown): number {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private roundMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private toDate(value: string | Date): Date {
    if (value instanceof Date) return new Date(value.getTime());

    const text = String(value || '').trim();
    const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (dateOnlyMatch) {
      const year = Number(dateOnlyMatch[1]);
      const monthIndex = Number(dateOnlyMatch[2]) - 1;
      const day = Number(dateOnlyMatch[3]);
      const date = new Date(year, monthIndex, day);
      if (
        date.getFullYear() !== year ||
        date.getMonth() !== monthIndex ||
        date.getDate() !== day
      ) {
        return new Date(Number.NaN);
      }
      return date;
    }

    return new Date(text);
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

  async assertDisbursementUtrDateConsistent(params: {
    disbursementUtr: string;
    disbursementDate: string | Date;
    invoiceId?: number | null;
    manager?: EntityManager;
  }): Promise<void> {
    const manager = params.manager || AppDataSource.manager;
    const disbursementUtr = String(params.disbursementUtr || '').trim();
    if (!disbursementUtr) throw new Error('Disbursement UTR is required');
    const requestedDate = this.formatDateOnly(params.disbursementDate);

    const disbursementRows = await manager.getRepository(LoanDisbursement)
      .createQueryBuilder('disbursement')
      .select('disbursement.id', 'id')
      .addSelect('disbursement.invoiceId', 'invoiceId')
      .addSelect('disbursement.disbursementDate', 'disbursementDate')
      .where('disbursement.disbursementUtr = :disbursementUtr', { disbursementUtr })
      .andWhere('disbursement.disbursementDate IS NOT NULL')
      .andWhere(
        params.invoiceId
          ? '(disbursement.invoiceId IS NULL OR disbursement.invoiceId <> :invoiceId)'
          : '1 = 1',
        { invoiceId: params.invoiceId },
      )
      .getRawMany();

    const invoiceRows = await manager.getRepository(Invoice)
      .createQueryBuilder('invoice')
      .select('invoice.id', 'id')
      .addSelect('invoice.invoiceNumber', 'invoiceNumber')
      .addSelect('invoice.disbursementDate', 'disbursementDate')
      .where('invoice.disbursementUtr = :disbursementUtr', { disbursementUtr })
      .andWhere('invoice.disbursementDate IS NOT NULL')
      .andWhere(params.invoiceId ? 'invoice.id <> :invoiceId' : '1 = 1', { invoiceId: params.invoiceId })
      .getRawMany();

    const conflictingRow = [...disbursementRows, ...invoiceRows].find((row: any) => {
      const existingDate = row.disbursementDate ? this.formatDateOnly(row.disbursementDate) : null;
      return existingDate !== null && existingDate !== requestedDate;
    });

    if (conflictingRow) {
      const existingDate = this.formatDateOnly(conflictingRow.disbursementDate);
      throw new Error(
        `Disbursement UTR ${disbursementUtr} already exists with disbursement date ${existingDate}. Use the same date ${existingDate} for this UTR.`,
      );
    }
  }

  // private calculateAccruedCharges(
  //   demand: LoanDemand,
  //   disbursement: LoanDisbursement | null | undefined,
  //   invoice: Invoice | null | undefined,
  //   asOfDate: string | Date = new Date(),
  //   rules: AccrualRules = DEFAULT_ACCRUAL_RULES,
  // ): AccruedDemandCharges {
  //   const interestRate = this.toNumber(disbursement?.interestRate);
  //   const serviceFeeRate = this.toNumber(invoice?.serviceFee);
  //   const penalRate = this.toNumber(disbursement?.penalRate);
  //   const disbursementDate = disbursement?.disbursementDate || demand.demandDate;
  //   const dayCount = this.getInterestDayCount(disbursementDate, asOfDate, rules);
  //   const allocations = [...(demand.allocations || [])]
  //     .filter(allocation => allocation.repayment?.status !== REPAYMENT_STATUS.REVERSED)
  //     .sort((a, b) => {
  //       const dateDiff = this.toDateOnly(a.allocationDate).getTime() - this.toDateOnly(b.allocationDate).getTime();
  //       return dateDiff || this.toNumber(a.id) - this.toNumber(b.id);
  //     });

  //   let principal = this.roundMoney(this.toNumber(demand.principalDue));
  //   let accumulatedInterest = 0;
  //   let accumulatedFee = 0;
  //   let accumulatedPenal = 0;
  //   let allocationIndex = 0;

  //   for (let day = 1; day <= dayCount; day += 1) {
  //     const accrualDate = this.getAccrualDate(disbursementDate, day, rules);
  //     while (
  //       allocationIndex < allocations.length &&
  //       this.toDateOnly(allocations[allocationIndex].allocationDate).getTime() <= accrualDate.getTime()
  //     ) {
  //       principal = this.roundMoney(Math.max(principal - this.toNumber(allocations[allocationIndex].principalAmount), 0));
  //       allocationIndex += 1;
  //     }

  //     accumulatedInterest += this.calculatePercentageAmountRaw(principal, interestRate, 1);
  //     accumulatedFee += this.calculatePercentageAmountRaw(principal, serviceFeeRate, 1);
  //     if (day >= rules.penalStartDay) {
  //       accumulatedPenal += this.calculatePercentageAmountRaw(principal + accumulatedInterest, penalRate, 1);
  //     }
  //   }

  //   return {
  //     principal: this.roundMoney(principal),
  //     interestDue: this.roundMoney(accumulatedInterest),
  //     feeDue: this.roundMoney(accumulatedFee),
  //     penalDue: this.roundMoney(accumulatedPenal),
  //     dayCount,
  //   };
  // }

  //new fixes for muthoot allocation

// private calculateAccruedCharges(
//   demand: LoanDemand,
//   disbursement: LoanDisbursement | null | undefined,
//   invoice: Invoice | null | undefined,
//   asOfDate: string | Date = new Date(),
//   rules: AccrualRules = DEFAULT_ACCRUAL_RULES,
// ): AccruedDemandCharges {
//   const interestRate = this.toNumber(disbursement?.interestRate);
//   const serviceFeeRate = this.toNumber(invoice?.serviceFee);
//   const penalMonthlyRate = normalizeMonthlyPenalRate(disbursement?.penalRate);
//   const disbursementDate = disbursement?.disbursementDate || demand.demandDate;
//   const dayCount = this.getInterestDayCount(disbursementDate, asOfDate, rules);
//   const allocations = [...(demand.allocations || [])]
//     .filter(allocation => allocation.repayment?.status !== REPAYMENT_STATUS.REVERSED)
//     .sort((a, b) => {
//       const dateDiff = this.toDateOnly(a.allocationDate).getTime() - this.toDateOnly(b.allocationDate).getTime();
//       return dateDiff || this.toNumber(a.id) - this.toNumber(b.id);
//     });

//   let principal = this.roundMoney(this.toNumber(demand.principalDue));
//   let accumulatedInterest = 0;
//   let accumulatedFee = 0;
//   let accumulatedPenal = 0;
//   let allocationIndex = 0;

//   for (let day = 1; day <= dayCount; day += 1) {
//     const accrualDate = this.getAccrualDate(disbursementDate, day, rules);

//     // 1. Apply allocations strictly BEFORE this day (all products)
//     while (
//       allocationIndex < allocations.length &&
//       this.toDateOnly(allocations[allocationIndex].allocationDate).getTime() < accrualDate.getTime()
//     ) {
//       principal = this.roundMoney(
//         Math.max(principal - this.toNumber(allocations[allocationIndex].principalAmount), 0),
//       );
//       allocationIndex += 1;
//     }

//     // 2. Accrue interest / fee / penal on the opening principal of the day
//     accumulatedInterest += this.calculatePercentageAmountRaw(principal, interestRate, 1);
//     accumulatedFee += this.calculatePercentageAmountRaw(principal, serviceFeeRate, 1);
//     if (day >= rules.penalStartDay) {
//       accumulatedPenal += calculateMonthlyPenalAmountRaw(
//         principal + accumulatedInterest,
//         penalMonthlyRate,
//         1,
//       );
//     }

//     // 3. ONLY for MFL (includeDisbursementDate = true) –
//     //    apply allocations that fall ON this day AFTER accruing,
//     //    so collection-day charges are calculated on pre-payment principal
//     if (rules.includeDisbursementDate) {
//       while (
//         allocationIndex < allocations.length &&
//         this.toDateOnly(allocations[allocationIndex].allocationDate).getTime() <= accrualDate.getTime()
//       ) {
//         principal = this.roundMoney(
//           Math.max(principal - this.toNumber(allocations[allocationIndex].principalAmount), 0),
//         );
//         allocationIndex += 1;
//       }
//     }
//   }

//   return {
//     principal: this.roundMoney(principal),
//     interestDue: this.roundMoney(accumulatedInterest),
//     feeDue: this.roundMoney(accumulatedFee),
//     penalDue: this.roundMoney(accumulatedPenal),
//     dayCount,
//   };
// }

private calculateAccruedCharges(
  demand: LoanDemand,
  disbursement: LoanDisbursement | null | undefined,
  invoice: Invoice | null | undefined,
  asOfDate: string | Date = new Date(),
  rules: AccrualRules = DEFAULT_ACCRUAL_RULES,
): AccruedDemandCharges {
  const interestRate = this.toNumber(disbursement?.interestRate);
  const serviceFeeRate = this.toNumber(invoice?.serviceFee);
  const penalMonthlyRate = normalizeMonthlyPenalRate(disbursement?.penalRate);
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
  let settledInterest = 0;
  let allocationIndex = 0;

  const applyAllocationToOutstanding = (allocation: RepaymentAllocation): void => {
    principal = this.roundMoney(
      Math.max(principal - this.toNumber(allocation.principalAmount), 0),
    );
    settledInterest = this.roundMoney(
      settledInterest + this.toNumber(allocation.interestAmount),
    );
  };

  for (let day = 1; day <= dayCount; day += 1) {
    const accrualDate = this.getAccrualDate(disbursementDate, day, rules);

    // Apply collections before the day starts. Once overdue, interest and
    // penal both use outstanding principal plus unpaid accrued interest.
    while (
      allocationIndex < allocations.length &&
      this.toDateOnly(allocations[allocationIndex].allocationDate).getTime() < accrualDate.getTime()
    ) {
      applyAllocationToOutstanding(allocations[allocationIndex]);
      allocationIndex += 1;
    }

    const openingInterestOutstanding = this.roundMoney(
      Math.max(accumulatedInterest - settledInterest, 0),
    );
    const overdueBase = this.roundMoney(principal + openingInterestOutstanding);

    const interestBase = day >= rules.penalStartDay ? overdueBase : principal;

    accumulatedInterest += this.calculatePercentageAmountRaw(interestBase, interestRate, 1);
    accumulatedFee += this.calculatePercentageAmountRaw(principal, serviceFeeRate, 1);

    if (day >= rules.penalStartDay && overdueBase > 0) {
      accumulatedPenal += calculateMonthlyPenalAmountRaw(
        overdueBase,
        penalMonthlyRate,
        1,
      );
    }

    // For MFL, apply same-day allocations after accruing.
    if (rules.includeDisbursementDate) {
      while (
        allocationIndex < allocations.length &&
        this.toDateOnly(allocations[allocationIndex].allocationDate).getTime() <= accrualDate.getTime()
      ) {
        applyAllocationToOutstanding(allocations[allocationIndex]);
        allocationIndex += 1;
      }
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

  private async recalculateLedgerRunningBalances(
    manager: EntityManager,
    loanAccountId: number,
  ): Promise<void> {
    const ledgerRepository = manager.getRepository(LoanLedgerEntry);
    const entries = await ledgerRepository.find({
      where: { loanAccountId },
      order: { id: 'ASC' },
    });

    let runningBalance = 0;
    const changedEntries: LoanLedgerEntry[] = [];

    entries.forEach((entry) => {
      runningBalance = this.roundMoney(
        runningBalance + this.toNumber(entry.debit) - this.toNumber(entry.credit),
      );

      if (this.toNumber(entry.runningBalance) !== runningBalance) {
        entry.runningBalance = runningBalance;
        changedEntries.push(entry);
      }
    });

    if (changedEntries.length > 0) {
      await ledgerRepository.save(changedEntries);
    }
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
          throw new Error(`Loan Management disbursement ${existing.id} exists without a demand`);
        }
        const snapshot = await this.refreshSnapshot(manager, existing.loanAccountId);
        return { disbursement: existing, demand: existingDemand, snapshot, alreadyBooked: true };
      }

      const invoice = await manager.getRepository(Invoice).findOne({
        where: { id: invoiceId },
        relations: ['loanAccount', 'loanAccount.partner', 'supplier', 'customer'],
      });
      if (!invoice) throw new Error('Invoice not found for loan management booking');
      if (!invoice.loanAccountId) throw new Error('Invoice is not linked to a LAN');
      if (!invoice.disbursementDate) throw new Error('Disbursement date is required before LMS booking');
      const disbursementUtr = String(invoice.disbursementUtr || '').trim();
      if (!disbursementUtr) throw new Error('Disbursement UTR is required before LMS booking');

      const loanAccount = invoice.loanAccount || await manager.getRepository(LoanAccount).findOne({
        where: { id: invoice.loanAccountId },
        relations: ['partner'],
      });
      if (!loanAccount) throw new Error('Loan account not found for loan management booking');
      if (String(loanAccount.status || '').toLowerCase() !== 'active') {
        throw new Error(`LAN ${loanAccount.lanId} is not active`);
      }
      await this.assertDisbursementUtrDateConsistent({
        manager,
        disbursementUtr,
        disbursementDate: invoice.disbursementDate,
        invoiceId: invoice.id,
      });

      const disbursementAmount = this.roundMoney(this.toNumber(invoice.disbursementAmount));
      if (disbursementAmount <= 0) throw new Error('Disbursement amount must be greater than zero');

      const disbursementDate = this.toDateOnly(invoice.disbursementDate);
      const dueDate = invoice.invoiceDueDate
        ? this.toDateOnly(invoice.invoiceDueDate)
        : this.addDays(disbursementDate, DEFAULT_BILL_TENURE_DAYS);
      const tenureDays = Math.max(1, this.daysBetween(disbursementDate, dueDate));
      const interestRate = this.toNumber(invoice.roiPercentage);
      const penalRate = normalizeMonthlyPenalRate(invoice.penalCharges);
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
          disbursementUtr,
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

  async deleteCollectionsByLan(lan: string): Promise<{
    lan: string;
    deletedCollections: number;
    deletedAllocations: number;
    deletedUploadRows: number;
    deletedLedgerEntries: number;
    snapshot: LoanAccountSnapshot;
  }> {
    return AppDataSource.transaction(async (manager) => {
      const cleanLan = String(lan || '').trim().toUpperCase();
      if (!cleanLan) throw new Error('LAN is required');

      const loanAccount = await manager.getRepository(LoanAccount).findOne({
        where: { lanId: cleanLan },
      });
      if (!loanAccount) throw new Error(`LAN ${cleanLan} not found`);

      const repaymentRepository = manager.getRepository(Repayment);
      const allocationRepository = manager.getRepository(RepaymentAllocation);
      const demandRepository = manager.getRepository(LoanDemand);
      const disbursementRepository = manager.getRepository(LoanDisbursement);
      const uploadRepository = manager.getRepository(RepaymentUpload);

      const repayments = await repaymentRepository.find({
        where: { lan: cleanLan },
        order: { repaymentDate: 'ASC', id: 'ASC' },
      });
      const repaymentIds = repayments.map((repayment) => repayment.id);

      const allocations = repaymentIds.length > 0
        ? await allocationRepository.find({
            where: { repaymentId: In(repaymentIds) },
            relations: ['demand'],
          })
        : [];

      const demandReversals = new Map<number, MoneyBreakup & { total: number }>();
      allocations.forEach((allocation) => {
        const demandId = this.toNumber(allocation.demandId);
        if (!demandId) return;

        const current = demandReversals.get(demandId) || {
          principal: 0,
          interest: 0,
          penal: 0,
          fee: 0,
          total: 0,
        };

        current.principal = this.roundMoney(current.principal + this.toNumber(allocation.principalAmount));
        current.interest = this.roundMoney(current.interest + this.toNumber(allocation.interestAmount));
        current.penal = this.roundMoney(current.penal + this.toNumber(allocation.penalAmount));
        current.fee = this.roundMoney(current.fee + this.toNumber(allocation.feeAmount));
        current.total = this.roundMoney(current.total + this.toNumber(allocation.totalAmount));
        demandReversals.set(demandId, current);
      });

      const demandIds = Array.from(demandReversals.keys());
      const demands = demandIds.length > 0
        ? await demandRepository.find({ where: { id: In(demandIds) } })
        : [];
      const demandById = new Map(demands.map((demand) => [demand.id, demand]));

      demands.forEach((demand) => {
        const reversal = demandReversals.get(demand.id);
        if (!reversal) return;

        demand.principalPaid = this.roundMoney(
          Math.max(this.toNumber(demand.principalPaid) - reversal.principal, 0),
        );
        demand.interestPaid = this.roundMoney(
          Math.max(this.toNumber(demand.interestPaid) - reversal.interest, 0),
        );
        demand.penalPaid = this.roundMoney(
          Math.max(this.toNumber(demand.penalPaid) - reversal.penal, 0),
        );
        demand.feePaid = this.roundMoney(
          Math.max(this.toNumber(demand.feePaid) - reversal.fee, 0),
        );
        demand.totalPaid = this.roundMoney(
          Math.max(this.toNumber(demand.totalPaid) - reversal.total, 0),
        );
        demand.outstandingAmount = this.roundMoney(
          Math.max(this.toNumber(demand.totalDue) - this.toNumber(demand.totalPaid), 0),
        );
        demand.status = this.getDemandStatus(demand);
      });

      if (demands.length > 0) {
        await demandRepository.save(demands);
      }

      const disbursementPrincipalReversals = new Map<number, number>();
      allocations.forEach((allocation) => {
        const principalAmount = this.toNumber(allocation.principalAmount);
        if (principalAmount <= 0) return;

        const demand = allocation.demand || demandById.get(allocation.demandId);
        const disbursementId = this.toNumber(demand?.loanDisbursementId);
        if (!disbursementId) return;

        disbursementPrincipalReversals.set(
          disbursementId,
          this.roundMoney((disbursementPrincipalReversals.get(disbursementId) || 0) + principalAmount),
        );
      });

      const disbursementIds = Array.from(disbursementPrincipalReversals.keys());
      const disbursements = disbursementIds.length > 0
        ? await disbursementRepository.find({ where: { id: In(disbursementIds) } })
        : [];

      disbursements.forEach((disbursement) => {
        const principalAmount = disbursementPrincipalReversals.get(disbursement.id) || 0;
        disbursement.principalOutstanding = this.roundMoney(
          Math.min(
            this.toNumber(disbursement.disbursementAmount),
            this.toNumber(disbursement.principalOutstanding) + principalAmount,
          ),
        );
      });

      if (disbursements.length > 0) {
        await disbursementRepository.save(disbursements);
      }

      const ledgerDeleteResult = await manager
        .createQueryBuilder()
        .delete()
        .from(LoanLedgerEntry)
        .where('lan = :lan', { lan: cleanLan })
        .andWhere('entryType IN (:...entryTypes)', {
          entryTypes: [LEDGER_ENTRY_TYPE.REPAYMENT, LEDGER_ENTRY_TYPE.ALLOCATION],
        })
        .execute();

      if (allocations.length > 0) {
        await allocationRepository.delete({ id: In(allocations.map((allocation) => allocation.id)) });
      }

      if (repaymentIds.length > 0) {
        await repaymentRepository.delete({ id: In(repaymentIds) });
      }

      const uploadDeleteResult = await uploadRepository.delete({ lan: cleanLan });

      await this.recalculateLedgerRunningBalances(manager, loanAccount.id);
      const snapshot = await this.refreshSnapshot(manager, loanAccount.id);

      return {
        lan: cleanLan,
        deletedCollections: repaymentIds.length,
        deletedAllocations: allocations.length,
        deletedUploadRows: uploadDeleteResult.affected || 0,
        deletedLedgerEntries: ledgerDeleteResult.affected || 0,
        snapshot,
      };
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
    const cleanLan = String(lan || '').trim().toUpperCase();
    const loanAccount = await this.loanAccountRepository.findOne({
      where: { lanId: cleanLan },
      relations: ['partner'],
    });
    const product = this.getProductName(loanAccount);

    const [disbursements, demands, repayments] = await Promise.all([
      this.disbursementRepository.find({
        where: { lan: cleanLan, status: DISBURSEMENT_STATUS.POSTED },
        relations: ['invoice'],
        order: { disbursementDate: 'ASC', id: 'ASC' },
      }),
      this.demandRepository.find({
        where: { lan: cleanLan, status: Not(In([DEMAND_STATUS.REVERSED])) },
        relations: ['invoice'],
        order: { demandDate: 'ASC', id: 'ASC' },
      }),
      this.repaymentRepository.find({
        where: { lan: cleanLan, status: Not(In([REPAYMENT_STATUS.REVERSED])) },
        relations: ['allocations', 'allocations.invoice', 'allocations.demand', 'allocations.demand.invoice'],
        order: { repaymentDate: 'ASC', id: 'ASC' },
      }),
    ]);

    const getInvoiceId = (invoice: Invoice | null | undefined, invoiceId: number | null | undefined): string | number | null => (
      invoice?.invoiceNumber || invoiceId || null
    );
    const getRepaymentInvoiceIds = (repayment: Repayment): string | null => {
      const invoiceIds = (repayment.allocations || [])
        .map(allocation => (
          allocation.invoice?.invoiceNumber ||
          allocation.demand?.invoice?.invoiceNumber ||
          allocation.invoiceId ||
          allocation.demand?.invoiceId ||
          null
        ))
        .filter((value): value is string | number => value !== null && value !== undefined)
        .map(value => String(value));

      return Array.from(new Set(invoiceIds)).join(', ') || null;
    };

    const statementRows: LedgerStatementSourceRow[] = [];

    disbursements.forEach((disbursement) => {
      statementRows.push({
        id: `DISBURSEMENT-${disbursement.id}`,
        sequence: disbursement.id,
        sortOrder: 1,
        lan: cleanLan,
        product,
        invoiceId: getInvoiceId(disbursement.invoice, disbursement.invoiceId),
        transactionDate: disbursement.disbursementDate,
        remarks: 'Disbursement',
        debit: this.roundMoney(this.toNumber(disbursement.disbursementAmount)),
        credit: 0,
      });
    });

    demands.forEach((demand) => {
      const interestDue = this.roundMoney(this.toNumber(demand.interestDue));
      const penalDue = this.roundMoney(this.toNumber(demand.penalDue));
      const invoiceId = getInvoiceId(demand.invoice, demand.invoiceId);

      if (interestDue > 0) {
        statementRows.push({
          id: `INTEREST-${demand.id}`,
          sequence: demand.id,
          sortOrder: 2,
          lan: cleanLan,
          product,
          invoiceId,
          transactionDate: demand.demandDate,
          remarks: 'Interest Charged',
          debit: interestDue,
          credit: 0,
        });
      }

      if (penalDue > 0) {
        statementRows.push({
          id: `PENAL-${demand.id}`,
          sequence: demand.id,
          sortOrder: 3,
          lan: cleanLan,
          product,
          invoiceId,
          transactionDate: demand.demandDate,
          remarks: 'Penal Charges',
          debit: penalDue,
          credit: 0,
        });
      }
    });

    repayments.forEach((repayment) => {
      statementRows.push({
        id: `COLLECTION-${repayment.id}`,
        sequence: repayment.id,
        sortOrder: 4,
        lan: cleanLan,
        product,
        invoiceId: getRepaymentInvoiceIds(repayment),
        transactionDate: repayment.repaymentDate,
        remarks: 'Collection',
        debit: 0,
        credit: this.roundMoney(this.toNumber(repayment.amount)),
      });
    });

    const startTime = filters?.startDate ? this.toDateOnly(filters.startDate).getTime() : null;
    const endTime = filters?.endDate ? this.toDateOnly(filters.endDate).getTime() : null;
    const filtered = statementRows
      .filter((row) => {
        const valueTime = this.toDateOnly(row.transactionDate).getTime();
        if (startTime !== null && valueTime < startTime) return false;
        if (endTime !== null && valueTime > endTime) return false;
        return true;
      })
      .sort((a, b) => {
        const dateDiff = this.toDateOnly(a.transactionDate).getTime() - this.toDateOnly(b.transactionDate).getTime();
        return dateDiff || a.sortOrder - b.sortOrder || a.sequence - b.sequence;
      });

    let closingBalance = 0;

    return {
      success: true,
      data: filtered.map(({ sortOrder, sequence, ...row }) => {
        closingBalance = this.roundMoney(closingBalance + row.debit - row.credit);
        return {
          ...row,
          closingBalance,
          valueDate: row.transactionDate,
          entryType: row.remarks,
          runningBalance: closingBalance,
          narration: row.remarks,
        };
      }),
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

  private getValidatedReportDate(value: string | undefined, label: string): string | undefined {
    const raw = String(value || '').trim();
    if (!raw) return undefined;

    const date = this.toDateOnly(raw);
    if (Number.isNaN(date.getTime())) {
      throw new Error(`${label} must be a valid date`);
    }

    return this.formatDateOnly(date);
  }

  private normalizeScfReportFilters(filters?: ScfReportFilters): ScfReportFilters {
    const startDate = this.getValidatedReportDate(filters?.startDate, 'From date');
    const endDate = this.getValidatedReportDate(filters?.endDate, 'To date');
    const asOfDate = this.getValidatedReportDate(filters?.asOfDate, 'As-of date');
    const lan = this.getOptionalScfReportLan(filters) || undefined;

    if (
      startDate &&
      endDate &&
      this.toDateOnly(startDate).getTime() > this.toDateOnly(endDate).getTime()
    ) {
      throw new Error('From date cannot be after To date');
    }

    return {
      ...filters,
      startDate,
      endDate,
      asOfDate,
      lan,
      allCases: Boolean(filters?.allCases),
    };
  }

  private async resolveScfReportFilters(
    filters?: ScfReportFilters,
  ): Promise<ScfReportFilters> {
    const normalizedFilters = this.normalizeScfReportFilters(filters);

    if (!normalizedFilters.allCases) {
      return normalizedFilters;
    }

    const earliestCase = await this.customerRepository
      .createQueryBuilder('customer')
      .select('MIN(customer.createdAt)', 'startDate')
      .getRawOne();

    const today = this.formatDateOnly(new Date());
    let earliestDate: string | undefined;

    if (earliestCase?.startDate) {
      const parsed = this.toDateOnly(earliestCase.startDate);

      if (!Number.isNaN(parsed.getTime())) {
        earliestDate = this.formatDateOnly(parsed);
      }
    }

    return {
      ...normalizedFilters,
      startDate: normalizedFilters.startDate || earliestDate,
      endDate: normalizedFilters.endDate || today,
      asOfDate: normalizedFilters.asOfDate || today,
      lan: undefined,
      allCases: true,
    };
  }

  private getScfReportAsOfDate(filters?: ScfReportFilters): Date {
    const asOfDate = filters?.asOfDate ? this.toDateOnly(filters.asOfDate) : this.toDateOnly(new Date());
    if (Number.isNaN(asOfDate.getTime())) {
      throw new Error('As-of date must be a valid date');
    }
    return asOfDate;
  }

  private getRequiredScfReportLan(filters?: ScfReportFilters): string {
    const cleanLan = String(filters?.lan || '').trim().toUpperCase();
    if (!cleanLan) {
      throw new Error('LAN is required for SCF report export');
    }
    return cleanLan;
  }

  private getOptionalScfReportLan(filters?: ScfReportFilters): string | null {
    const cleanLan = String(filters?.lan || '').trim().toUpperCase();
    return cleanLan || null;
  }

  private getCustomerCode(loanAccount: LoanAccount | null | undefined): string | null {
    return loanAccount?.customer?.customerCode || null;
  }

  private getCustomerName(loanAccount: LoanAccount | null | undefined): string | null {
    const customer = loanAccount?.customer;
    return customer?.companyName || customer?.customerName || customer?.name || null;
  }

  private formatDateDmy(value: string | Date): string {
    const date = this.toDateOnly(value);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }

  private async getRequiredScfLoanAccount(filters?: ScfReportFilters): Promise<LoanAccount> {
    const cleanLan = this.getRequiredScfReportLan(filters);
    const loanAccount = await this.loanAccountRepository.findOne({
      where: { lanId: cleanLan },
      relations: ['customer', 'partner'],
    });
    if (!loanAccount) throw new Error(`LAN ${cleanLan} not found`);
    return loanAccount;
  }

  private getProductName(loanAccount: LoanAccount | null | undefined): string {
    return loanAccount?.partner?.name || loanAccount?.partner?.code || loanAccount?.lender || 'SCF';
  }

  private getInvoiceDisplayId(demand: LoanDemand | null | undefined): string | number | null {
    return demand?.invoice?.invoiceNumber || demand?.invoiceId || null;
  }

  private getAllocationTotals(demand: LoanDemand, asOfDate: Date): MoneyBreakup & { total: number; lastPaymentDate: Date | null } {
    const asOfTime = this.toDateOnly(asOfDate).getTime();
    const allocations = [...(demand.allocations || [])]
      .filter(allocation => allocation.repayment?.status !== REPAYMENT_STATUS.REVERSED)
      .filter(allocation => this.toDateOnly(allocation.allocationDate).getTime() <= asOfTime)
      .sort((a, b) => {
        const dateDiff = this.toDateOnly(a.allocationDate).getTime() - this.toDateOnly(b.allocationDate).getTime();
        return dateDiff || this.toNumber(a.id) - this.toNumber(b.id);
      });

    return {
      principal: this.roundMoney(allocations.reduce((sum, allocation) => sum + this.toNumber(allocation.principalAmount), 0)),
      interest: this.roundMoney(allocations.reduce((sum, allocation) => sum + this.toNumber(allocation.interestAmount), 0)),
      penal: this.roundMoney(allocations.reduce((sum, allocation) => sum + this.toNumber(allocation.penalAmount), 0)),
      fee: this.roundMoney(allocations.reduce((sum, allocation) => sum + this.toNumber(allocation.feeAmount), 0)),
      total: this.roundMoney(allocations.reduce((sum, allocation) => sum + this.toNumber(allocation.totalAmount), 0)),
      lastPaymentDate: allocations.length > 0 ? allocations[allocations.length - 1].allocationDate : null,
    };
  }

  private getSettledDemandAllocations(demand: LoanDemand): RepaymentAllocation[] {
    return [...(demand.allocations || [])]
      .filter(allocation => allocation.repayment?.status !== REPAYMENT_STATUS.REVERSED)
      .sort((a, b) => {
        const dateDiff = this.toDateOnly(a.allocationDate).getTime() - this.toDateOnly(b.allocationDate).getTime();
        const repaymentDiff = this.toNumber(a.repaymentId) - this.toNumber(b.repaymentId);
        return dateDiff || repaymentDiff || this.toNumber(a.id) - this.toNumber(b.id);
      });
  }

  private getPreviousDemandAllocation(
    demand: LoanDemand,
    currentAllocation: RepaymentAllocation,
  ): RepaymentAllocation | null {
    const currentDateTime = this.toDateOnly(currentAllocation.allocationDate).getTime();
    const currentRepaymentId = this.toNumber(currentAllocation.repaymentId);
    const currentId = this.toNumber(currentAllocation.id);

    const previousAllocations = this.getSettledDemandAllocations(demand).filter((allocation) => {
      const allocationDateTime = this.toDateOnly(allocation.allocationDate).getTime();
      if (allocationDateTime !== currentDateTime) return allocationDateTime < currentDateTime;

      const repaymentId = this.toNumber(allocation.repaymentId);
      if (repaymentId !== currentRepaymentId) return repaymentId < currentRepaymentId;

      return this.toNumber(allocation.id) < currentId;
    });

    return previousAllocations[previousAllocations.length - 1] || null;
  }

  private getScfSoaChargeWindow(
    demand: LoanDemand,
    allocation: RepaymentAllocation,
    collectionDate: Date,
  ): { interestDays: number; interest: number; chargesDays: number; charges: number } {
    const loanAccount = demand.loanAccount;
    const disbursement = demand.disbursement || null;
    const rules = this.getAccrualRules(loanAccount);
    const currentCharges = this.calculateAccruedCharges(demand, disbursement, demand.invoice, collectionDate, rules);
    const previousAllocation = this.getPreviousDemandAllocation(demand, allocation);

    if (!previousAllocation) {
      return {
        interestDays: currentCharges.dayCount,
        interest: this.roundMoney(currentCharges.interestDue),
        chargesDays: Math.max(0, currentCharges.dayCount - rules.penalStartDay + 1),
        charges: this.roundMoney(currentCharges.penalDue),
      };
    }

    const previousCharges = this.calculateAccruedCharges(
      demand,
      disbursement,
      demand.invoice,
      this.toDateOnly(previousAllocation.allocationDate),
      rules,
    );
    const currentChargesDays = Math.max(0, currentCharges.dayCount - rules.penalStartDay + 1);
    const previousChargesDays = Math.max(0, previousCharges.dayCount - rules.penalStartDay + 1);

    return {
      interestDays: Math.max(0, currentCharges.dayCount - previousCharges.dayCount),
      interest: this.roundMoney(Math.max(currentCharges.interestDue - previousCharges.interestDue, 0)),
      chargesDays: Math.max(0, currentChargesDays - previousChargesDays),
      charges: this.roundMoney(Math.max(currentCharges.penalDue - previousCharges.penalDue, 0)),
    };
  }

  private buildScfDemandState(
    demand: LoanDemand,
    asOfDate: Date,
    options: { closePaidDemands?: boolean } = {},
  ): any {
    const loanAccount = demand.loanAccount;
    const disbursement = demand.disbursement || null;
    const disbursementDate = disbursement?.disbursementDate || demand.demandDate;
    const rules = this.getAccrualRules(loanAccount);
    const charges = this.calculateAccruedCharges(demand, disbursement, demand.invoice, asOfDate, rules);
    const allocations = this.getAllocationTotals(demand, asOfDate);
    const isPaidClosedDemand = options.closePaidDemands === true && demand.status === DEMAND_STATUS.PAID;
    const interestAccrued = this.toNumber(charges.interestDue);
    const chargesAccrued = this.toNumber(charges.penalDue);
    const interestOutstanding = isPaidClosedDemand
      ? 0
      : this.roundMoney(Math.max(interestAccrued - allocations.interest, 0));
    const chargesOutstanding = isPaidClosedDemand
      ? 0
      : this.roundMoney(Math.max(chargesAccrued - allocations.penal, 0));
    const principalOutstanding = isPaidClosedDemand
      ? 0
      : this.roundMoney(Math.max(charges.principal, 0));
    const interestDays = isPaidClosedDemand ? 0 : charges.dayCount;
    const chargesDays = isPaidClosedDemand ? 0 : Math.max(0, charges.dayCount - rules.penalStartDay + 1);
    const calculationTill = isPaidClosedDemand
      ? allocations.lastPaymentDate || asOfDate
      : asOfDate;
    const totalOutstanding = isPaidClosedDemand
      ? 0
      : this.roundMoney(principalOutstanding + interestOutstanding + chargesOutstanding);

    return {
      customerCode: this.getCustomerCode(loanAccount),
      customerName: this.getCustomerName(loanAccount),
      product: this.getProductName(loanAccount),
      lan: demand.lan,
      invoiceId: this.getInvoiceDisplayId(demand),
      status: demand.status,
      dueDate: demand.dueDate,
      dpd: isPaidClosedDemand ? 0 : this.getOverdueDayCount(demand.dueDate, asOfDate),
      disbursementDate,
      disbursementAmount: disbursement ? this.toNumber(disbursement.disbursementAmount) : this.toNumber(demand.principalDue),
      principalOutstanding,
      roi: this.toNumber(disbursement?.interestRate ?? demand.invoice?.roiPercentage),
      penalRate: normalizeMonthlyPenalRate(disbursement?.penalRate ?? demand.invoice?.penalCharges),
      lastPaymentDate: allocations.lastPaymentDate,
      calculationTill,
      interestDays,
      interest: interestOutstanding,
      previousInterest: allocations.interest,
      chargesDays,
      charges: chargesOutstanding,
      previousCharges: allocations.penal,
      principalSettled: allocations.principal,
      interestSettled: allocations.interest,
      chargesSettled: allocations.penal,
      totalSettled: allocations.total,
      principalDue: principalOutstanding,
      interestDue: interestOutstanding,
      chargesDue: chargesOutstanding,
      totalOutstanding,
      demand,
    };
  }

  private async getScfDemandStates(
    filters?: ScfReportFilters,
    options?: { dueWithinDays?: number; onlyOutstanding?: boolean },
  ): Promise<any[]> {
    const reportFilters = this.normalizeScfReportFilters(filters);
    const asOfDate = this.getScfReportAsOfDate(reportFilters);
    const cleanLan = this.getOptionalScfReportLan(reportFilters);
    const where: any = { status: Not(In([DEMAND_STATUS.REVERSED])) };
    if (cleanLan) {
      where.lan = cleanLan;
    }

  const demands = await this.demandRepository.find({
      where,
      relations: [
        'loanAccount',
        'loanAccount.customer',
        'loanAccount.partner',
        'invoice',
        'disbursement',
        'allocations',
        'allocations.repayment',
      ],
      order: { dueDate: 'ASC', id: 'ASC',},
    });

  let filteredDemands = this.filterByDateRange(demands, 'dueDate', reportFilters);

   if (options?.dueWithinDays) {
  const asOfTime =
    asOfDate.getTime();

  const dueWindowEnd =
    this.addDays(
      asOfDate,
      options.dueWithinDays
    ).getTime();

  filteredDemands =
    filteredDemands.filter((demand) => {
      if (!demand.dueDate) {
        return false;
      }

      const dueTime =
        this.toDateOnly(
          demand.dueDate
        ).getTime();

      return (
        dueTime >= asOfTime &&
        dueTime <= dueWindowEnd
      );
    });
}

  const rows =
    filteredDemands.map(
      (demand) =>
        this.buildScfDemandState(
          demand,
          asOfDate,
          { closePaidDemands: true },
        )
    );

  if (
    options?.onlyOutstanding === false
  ) {
    return rows;
  }

  return rows.filter(
    (row) =>
      this.toNumber(
        row.totalOutstanding
      ) > 0
  );
}
  
private async getScfCollectionRows(filters?: ScfReportFilters,): Promise<any[]> {
  const reportFilters = this.normalizeScfReportFilters(filters);

  const where: any = {};

  const cleanLan = this.getOptionalScfReportLan(reportFilters);
  if (cleanLan) {
    where.lan = cleanLan;
  }

  const allocations =
    await this.allocationRepository.find({
      where,
      relations: [
        'repayment',
        'demand',
        'demand.loanAccount',
        'demand.loanAccount.customer',
        'demand.loanAccount.partner',
        'demand.invoice',
        'demand.disbursement',
        'demand.allocations',
        'demand.allocations.repayment',
        'invoice',
      ],
      order: { allocationDate: 'ASC', repaymentId: 'ASC', id: 'ASC', },
    });

  const startTime =
    reportFilters.startDate
      ? this.toDateOnly(
          reportFilters.startDate
        ).getTime()
      : null;

  const endTime =
    reportFilters.endDate
      ? this.toDateOnly(
          reportFilters.endDate
        ).getTime()
      : null;

  const remainingByRepayment = new Map<number, number>();

  return allocations

    .filter(
      allocation =>
        Boolean(allocation.demand) &&
        Boolean(allocation.repayment)
    )

    .filter(
      allocation =>
        allocation.repayment?.status !==
        REPAYMENT_STATUS.REVERSED
    )

    .filter((allocation) => {
      const collectionDate =
        allocation.repayment
          ?.repaymentDate ||
        allocation.allocationDate;

      const time =
        this.toDateOnly(
          collectionDate
        ).getTime();

      if (
        startTime !== null &&
        time < startTime
      ) {
        return false;
      }

      if (
        endTime !== null &&
        time > endTime
      ) {
        return false;
      }

      return true;
    })

    .map((allocation) => {
      const demand =
        allocation.demand;

      const repayment =
        allocation.repayment;

      const repaymentId =
        this.toNumber(
          repayment?.id ||
          allocation.repaymentId
        );

      const collectionAmount =
        this.roundMoney(
          this.toNumber(
            repayment?.amount
          )
        );

      const amountUsed =
        this.roundMoney(
          this.toNumber(
            allocation.totalAmount
          )
        );

      const openingRemaining =
        remainingByRepayment.has(repaymentId)
          ? remainingByRepayment.get(repaymentId) || 0
          : collectionAmount;

      const amountRemaining =
        this.roundMoney(
          Math.max(
            openingRemaining - amountUsed,
            0
          )
        );

      remainingByRepayment.set(
        repaymentId,
        amountRemaining
      );

      const collectionDate =
        repayment?.repaymentDate ||
        allocation.allocationDate;

      const state =
        this.buildScfDemandState(
          demand,
          this.toDateOnly(
            collectionDate
          )
        );

      const soaChargeWindow =
        this.getScfSoaChargeWindow(
          demand,
          allocation,
          this.toDateOnly(
            collectionDate
          )
        );

      // keep your existing return object here

      return {
        customerCode:
          state.customerCode,

        lan: allocation.lan,

        transactionSerial:
          repayment?.id ||
          allocation.repaymentId,

        product:
          state.product,

        collectionDate,

        collectionSerial:
          repayment?.utr || null,

        collectionAmount:
          collectionAmount,

        amountRemaining:
          amountRemaining,

        amountUsed:
          amountUsed,

        invoiceNumber:
          allocation.invoice
            ?.invoiceNumber ||
          state.invoiceId,

        disbursementDate:
          state.disbursementDate,

        lastPaymentDate:
          state.lastPaymentDate ||
          collectionDate,

        principal:
          this.toNumber(
            allocation.principalAmount
          ),

        soaPrincipal:
          state.disbursementAmount,

        soaInterestDays:
          soaChargeWindow.interestDays,

        soaInterest:
          soaChargeWindow.interest,

        soaInterestSettled:
          soaChargeWindow.interest,

        soaChargesDays:
          soaChargeWindow.chargesDays,

        soaCharges:
          soaChargeWindow.charges,

        soaChargesSettled:
          soaChargeWindow.charges,

        tenureUpdated:
          state.interestDays,

        interest:
          this.toNumber(
            allocation.interestAmount
          ),

        previousInterestAccrued:
          state.previousInterest,

        charges:
          this.toNumber(
            allocation.penalAmount
          ),

        principalSettled:
          this.toNumber(
            allocation.principalAmount
          ),

        interestSettled:
          this.toNumber(
            allocation.interestAmount
          ),

        chargesSettled:
          this.toNumber(
            allocation.penalAmount
          ),

        chargesDays:
          state.chargesDays,

        interestDue:
          state.interestDue,

        principalDue:
          state.principalDue,

        previousChargesDue:
          state.previousCharges,

        chargesDue:
          state.chargesDue,

        amountBalance:
          amountRemaining,
      };
    });
}


  async generateScf15DReportWorkbook(filters?: ScfReportFilters): Promise<Buffer> {
    const rows = await this.getScfDemandStates(filters, { dueWithinDays: 15, onlyOutstanding: false });
    return this.createXlsxWorkbook([{
      name: 'Sheet1',
      rows: [
        [
          'Customer',
          'Customer Name',
          'Product',
          'LAN',
          'Invoice ID',
          'Status',
          'Due Date',
          'DPD',
          'Disbursement Date',
          'Disbursement Amount',
          'Outstanding Principal',
          'ROI',
          'Overdue Charges (% Monthly)',
          'Last Payment Date',
          'Calculation Till',
          'Interest Days',
          'Interest',
          'Previous Interest',
          'Charges Days',
          'Charges',
          'Previous Charges',
          'Total Outstanding',
        ],
        ...rows.map((row, index) => {
          const rowNumber = index + 2;
          return [
          row.customerCode,
          row.customerName,
          row.product,
          row.lan,
          row.invoiceId,
          row.status,
          row.dueDate,
          row.dpd,
          row.disbursementDate,
          row.disbursementAmount,
          row.principalOutstanding,
          row.roi,
          row.penalRate,
          row.lastPaymentDate,
          row.calculationTill,
          row.interestDays,
          row.interest,
          row.previousInterest,
          row.chargesDays,
          row.charges,
          row.previousCharges,
          {
            formula: `IF(F${rowNumber}="PAID",0,K${rowNumber}+Q${rowNumber}+T${rowNumber})`,
            result: row.totalOutstanding,
          },
        ];
        }),
      ],
    }]);
  }

  async generateScfAsOfNowReportWorkbook(filters?: ScfReportFilters): Promise<Buffer> {
    const rows = await this.getScfDemandStates(filters, { onlyOutstanding: false });
    return this.createXlsxWorkbook([{
      name: 'Sheet1',
      rows: [
        [
          'LAN',
          'Invoice ID',
          'Customer',
          'Name',
          'Product',
          'Disb. Date',
          'Due Date',
          'Status',
          'DPD',
          'Disb. Amt',
          'O/S Principal',
          'ROI %',
          'Int. Days',
          'Interest',
          'Prev. Interest',
          'Chg. Days',
          'OD Charges',
          'Prev. Charges',
          'Prin. Settled',
          'Int. Settled',
          'Chg. Settled',
          'Total O/S',
          'Last Payment',
          'Calc. Till',
        ],
        ...rows.map((row, index) => {
          const rowNumber = index + 2;
          return [
          row.lan,
          row.invoiceId,
          row.customerCode,
          row.customerName,
          row.product,
          row.disbursementDate,
          row.dueDate,
          row.status,
          row.dpd,
          row.disbursementAmount,
          row.principalOutstanding,
          row.roi,
          row.interestDays,
          row.interest,
          row.previousInterest,
          row.chargesDays,
          row.charges,
          row.previousCharges,
          row.principalSettled,
          row.interestSettled,
          row.chargesSettled,
          {
            formula: `IF(H${rowNumber}="PAID",0,K${rowNumber}+N${rowNumber}+Q${rowNumber})`,
            result: row.totalOutstanding,
          },
          row.lastPaymentDate,
          row.calculationTill,
        ];
        }),
      ],
    }]);
  }

  async generateScfCollectionReportWorkbook(filters?: ScfReportFilters): Promise<Buffer> {
    const rows = await this.getScfCollectionRows(filters);
    return this.createXlsxWorkbook([{
      name: 'Sheet1',
      rows: [
        [
          'Customer',
          'Account ID',
          'Transaction Serial',
          'Product',
          'Collection Date',
          'Collection Serial',
          'Collection Amount',
          'Amount Remaining',
          'Amount Used',
          'Invoice Number',
          'Disbursement Date',
          'Last Payment Date',
          'Principal',
          'Tenure Updated',
          'Interest',
          'Previous Interest Accrued',
          'Charges',
          'Principal Settled',
          'Interest Settled',
          'Charges Settled',
          'Charges Days',
          'Interest Due',
          'Principal Due',
          'Previous Charges Due',
          'Charges Due',
          'Amount Balance',
        ],
        ...rows.map(row => [
          row.customerCode,
          row.lan,
          row.transactionSerial,
          row.product,
          row.collectionDate,
          row.collectionSerial,
          row.collectionAmount,
          row.amountRemaining,
          row.amountUsed,
          row.invoiceNumber,
          row.disbursementDate,
          row.lastPaymentDate,
          row.principal,
          row.tenureUpdated,
          row.interest,
          row.previousInterestAccrued,
          row.charges,
          row.principalSettled,
          row.interestSettled,
          row.chargesSettled,
          row.chargesDays,
          row.interestDue,
          row.principalDue,
          row.previousChargesDue,
          row.chargesDue,
          row.amountBalance,
        ]),
      ],
    }]);
  }

 async generateScfSoaReportWorkbook(
  filters?: ScfReportFilters
): Promise<Buffer> {

  const resolvedFilters =
    await this.resolveScfReportFilters(
      filters
    );

  const loanAccount =
    resolvedFilters.allCases
      ? null
      : await this.getRequiredScfLoanAccount(
          resolvedFilters
        );

  const rows =
    await this.getScfCollectionRows(
      resolvedFilters
    );

  const asOfDate =
    this.getScfReportAsOfDate(
      resolvedFilters
    );

  return this.createXlsxWorkbook([
    {
      name:
        'transaction_ledger_report (88)',

      rows: [
        ['Transaction Ledger Report'],

        [
          `Doc Name: ${
            resolvedFilters.allCases
              ? 'ALL CASES'
              : loanAccount?.lanId || ''
          }`
        ],

        [
          `Customer: ${
            resolvedFilters.allCases
              ? 'All Customers'
              : this.getCustomerName(
                  loanAccount
                ) || ''
          }`
        ],

        [
          `Date: ${this.formatDateDmy(
            asOfDate
          )}`
        ],

        [],
        [],
        [],

        [
          'Collection Serial',
          'Transaction Serial',
          'Collection Date',
          'Collection Amount',
          'Used in This Txn',
          'Invoice',
          'Disbursement Date',
          'Last Payment Date',
          'Principal',
          'Principal Settled',
          'Interest Days',
          'Interest',
          'Interest Settled',
          'Charges Days',
          'Charges',
          'Charges Settled',
        ],

        ...rows.map(row => [
          row.collectionSerial,
          row.transactionSerial,
          row.collectionDate,
          row.collectionAmount,
          row.amountUsed,
          row.invoiceNumber,
          row.disbursementDate,
          row.lastPaymentDate,
          row.soaPrincipal,
          row.principalSettled,
          row.soaInterestDays,
          row.soaInterest,
          row.soaInterestSettled,
          row.soaChargesDays,
          row.soaCharges,
          row.soaChargesSettled,
        ]),
      ],
    },
  ]);
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

  private createXlsxWorkbook(sheets: WorkbookSheet[]): Buffer {
    const safeSheets = sheets.map((sheet, index) => ({
      name: this.sanitizeWorksheetName(sheet.name || `Sheet ${index + 1}`),
      rows: sheet.rows || [],
    }));

    const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    ${safeSheets.map((sheet, index) => `<sheet name="${this.escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('')}
  </sheets>
  <calcPr calcId="0" fullCalcOnLoad="1" forceFullCalc="1"/>
</workbook>`;

    const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${safeSheets.map((_sheet, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('')}
  <Relationship Id="rId${safeSheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

    const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${safeSheets.map((_sheet, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}
</Types>`;

    const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

    const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="1"><fill><patternFill patternType="none"/></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

    const files = [
      { path: '[Content_Types].xml', content: contentTypesXml },
      { path: '_rels/.rels', content: rootRelsXml },
      { path: 'xl/workbook.xml', content: workbookXml },
      { path: 'xl/_rels/workbook.xml.rels', content: workbookRelsXml },
      { path: 'xl/styles.xml', content: stylesXml },
      ...safeSheets.map((sheet, index) => ({
        path: `xl/worksheets/sheet${index + 1}.xml`,
        content: this.buildWorksheetXml(sheet.rows),
      })),
    ];

    return this.createZip(files);
  }

  private buildWorksheetXml(rows: WorkbookCellValue[][]): string {
    const sheetRows = rows.map((row, rowIndex) => {
      const rowNumber = rowIndex + 1;
      const cells = row.map((cell, cellIndex) => this.buildCellXml(cell, rowNumber, cellIndex + 1)).join('');
      return `<row r="${rowNumber}">${cells}</row>`;
    }).join('');

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${sheetRows}</sheetData>
</worksheet>`;
  }

  private buildCellXml(value: WorkbookCellValue, rowNumber: number, columnNumber: number): string {
    const cellRef = `${this.getExcelColumnName(columnNumber)}${rowNumber}`;
    if (value === null || value === undefined || value === '') {
      return `<c r="${cellRef}"/>`;
    }

    if (typeof value === 'object' && !(value instanceof Date) && 'formula' in value) {
      const formula = String(value.formula || '').replace(/^=/, '');
      const result = typeof value.result === 'number' && Number.isFinite(value.result)
        ? `<v>${value.result}</v>`
        : '';
      return `<c r="${cellRef}"><f>${this.escapeXml(formula)}</f>${result}</c>`;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return `<c r="${cellRef}"><v>${value}</v></c>`;
    }

    const text = value instanceof Date ? this.formatDateOnly(value) : String(value);
    return `<c r="${cellRef}" t="inlineStr"><is><t xml:space="preserve">${this.escapeXml(text)}</t></is></c>`;
  }

  private getExcelColumnName(columnNumber: number): string {
    let name = '';
    let current = columnNumber;
    while (current > 0) {
      const remainder = (current - 1) % 26;
      name = String.fromCharCode(65 + remainder) + name;
      current = Math.floor((current - 1) / 26);
    }
    return name;
  }

  private formatDateOnly(value: string | Date): string {
    const date = this.toDateOnly(value);
    if (isNaN(date.getTime())) {
      throw new Error('Disbursement date must be a valid date');
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private sanitizeWorksheetName(name: string): string {
    const sanitized = name.replace(/[\\/?*\[\]:]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31);
    return sanitized || 'Sheet';
  }

  private createZip(files: Array<{ path: string; content: string | Buffer }>): Buffer {
    const localParts: Buffer[] = [];
    const centralParts: Buffer[] = [];
    let offset = 0;
    const dosDateTime = this.getZipDateTime(new Date());

    files.forEach((file) => {
      const nameBuffer = Buffer.from(file.path, 'utf8');
      const dataBuffer = Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content, 'utf8');
      const crc = this.crc32(dataBuffer);

      const localHeader = Buffer.alloc(30);
      localHeader.writeUInt32LE(0x04034b50, 0);
      localHeader.writeUInt16LE(20, 4);
      localHeader.writeUInt16LE(0x0800, 6);
      localHeader.writeUInt16LE(0, 8);
      localHeader.writeUInt16LE(dosDateTime.time, 10);
      localHeader.writeUInt16LE(dosDateTime.date, 12);
      localHeader.writeUInt32LE(crc, 14);
      localHeader.writeUInt32LE(dataBuffer.length, 18);
      localHeader.writeUInt32LE(dataBuffer.length, 22);
      localHeader.writeUInt16LE(nameBuffer.length, 26);
      localHeader.writeUInt16LE(0, 28);

      localParts.push(localHeader, nameBuffer, dataBuffer);

      const centralHeader = Buffer.alloc(46);
      centralHeader.writeUInt32LE(0x02014b50, 0);
      centralHeader.writeUInt16LE(20, 4);
      centralHeader.writeUInt16LE(20, 6);
      centralHeader.writeUInt16LE(0x0800, 8);
      centralHeader.writeUInt16LE(0, 10);
      centralHeader.writeUInt16LE(dosDateTime.time, 12);
      centralHeader.writeUInt16LE(dosDateTime.date, 14);
      centralHeader.writeUInt32LE(crc, 16);
      centralHeader.writeUInt32LE(dataBuffer.length, 20);
      centralHeader.writeUInt32LE(dataBuffer.length, 24);
      centralHeader.writeUInt16LE(nameBuffer.length, 28);
      centralHeader.writeUInt16LE(0, 30);
      centralHeader.writeUInt16LE(0, 32);
      centralHeader.writeUInt16LE(0, 34);
      centralHeader.writeUInt16LE(0, 36);
      centralHeader.writeUInt32LE(0, 38);
      centralHeader.writeUInt32LE(offset, 42);
      centralParts.push(centralHeader, nameBuffer);

      offset += localHeader.length + nameBuffer.length + dataBuffer.length;
    });

    const centralDirectory = Buffer.concat(centralParts);
    const endRecord = Buffer.alloc(22);
    endRecord.writeUInt32LE(0x06054b50, 0);
    endRecord.writeUInt16LE(0, 4);
    endRecord.writeUInt16LE(0, 6);
    endRecord.writeUInt16LE(files.length, 8);
    endRecord.writeUInt16LE(files.length, 10);
    endRecord.writeUInt32LE(centralDirectory.length, 12);
    endRecord.writeUInt32LE(offset, 16);
    endRecord.writeUInt16LE(0, 20);

    return Buffer.concat([...localParts, centralDirectory, endRecord]);
  }

  private getZipDateTime(date: Date): { date: number; time: number } {
    const year = Math.max(date.getFullYear(), 1980);
    return {
      date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
      time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    };
  }

  private crc32(buffer: Buffer): number {
    const table = this.getCrc32Table();
    let crc = 0xffffffff;
    for (const byte of buffer) {
      crc = (crc >>> 8) ^ table[(crc ^ byte) & 0xff];
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  private getCrc32Table(): number[] {
    if (this.crc32Table) return this.crc32Table;

    this.crc32Table = Array.from({ length: 256 }, (_value, index) => {
      let crc = index;
      for (let bit = 0; bit < 8; bit += 1) {
        crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
      }
      return crc >>> 0;
    });
    return this.crc32Table;
  }

  private escapeXml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}


export const loanManagementService = new LoanManagementService();

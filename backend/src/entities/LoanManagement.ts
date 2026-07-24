import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Customer } from './Customer';
import { Invoice } from './Invoice';
import { LoanAccount } from './LoanAccount';
import { Partner } from './Partner';
import { RepaymentUpload } from './RepaymentUpload';
import { User } from './User';

export enum LMS_RECORD_STATUS {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum DISBURSEMENT_STATUS {
  POSTED = 'POSTED',
  REVERSED = 'REVERSED',
}

export enum DEMAND_STATUS {
  PENDING = 'PENDING',
  PARTIAL = 'PARTIAL',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  REVERSED = 'REVERSED',
}

export enum REPAYMENT_STATUS {
  POSTED = 'POSTED',
  PARTIALLY_ALLOCATED = 'PARTIALLY_ALLOCATED',
  ALLOCATED = 'ALLOCATED',
  REVERSED = 'REVERSED',
}

export enum LEDGER_ENTRY_TYPE {
  SANCTION = 'SANCTION',
  DISBURSEMENT = 'DISBURSEMENT',
  DEMAND = 'DEMAND',
  REPAYMENT = 'REPAYMENT',
  ALLOCATION = 'ALLOCATION',
  CHARGE = 'CHARGE',
  REVERSAL = 'REVERSAL',
  ADJUSTMENT = 'ADJUSTMENT',
}

export enum REPORT_RUN_STATUS {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

@Entity('loan_products')
@Index(['code'], { unique: true })
export class LoanProduct {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'varchar', length: 50 })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'int', default: 90 })
  defaultTenureDays: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  defaultInterestRate: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  defaultPenalRate: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  defaultServiceFee: number;

  @Column({
    type: 'enum',
    enum: LMS_RECORD_STATUS,
    default: LMS_RECORD_STATUS.ACTIVE,
  })
  status: LMS_RECORD_STATUS;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('loan_disbursements')
@Index(['lan'])
@Index(['partnerId'])
@Index(['loanAccountId'])
@Index(['invoiceId'], { unique: true })
@Index(['disbursementUtr'])
@Index(['partnerId', 'disbursementUtr'], { unique: true })
export class LoanDisbursement {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'int' })
  loanAccountId: number;

  @Column({ type: 'int', nullable: true })
  partnerId: number | null;

  @Column({ type: 'int' })
  customerId: number;

  @Column({ type: 'int', nullable: true })
  invoiceId: number | null;

  @Column({ type: 'varchar', length: 50 })
  lan: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  disbursementAmount: number;

  @Column({ type: 'date' })
  disbursementDate: Date;

  @Column({ type: 'varchar', length: 100 })
  disbursementUtr: string;

  @Column({ type: 'int', default: 90 })
  tenureDays: number;

  @Column({ type: 'date' })
  dueDate: Date;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  interestRate: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  penalRate: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  interestAmount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  principalOutstanding: number;

  @Column({
    type: 'enum',
    enum: DISBURSEMENT_STATUS,
    default: DISBURSEMENT_STATUS.POSTED,
  })
  status: DISBURSEMENT_STATUS;

  @Column({ type: 'int', nullable: true })
  createdByUserId: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => LoanAccount, { nullable: false })
  @JoinColumn({ name: 'loanAccountId' })
  loanAccount: LoanAccount;

  @ManyToOne(() => Partner, { nullable: true })
  @JoinColumn({ name: 'partnerId' })
  partner: Partner | null;

  @ManyToOne(() => Customer, { nullable: false })
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @OneToOne(() => Invoice, { nullable: true })
  @JoinColumn({ name: 'invoiceId' })
  invoice: Invoice | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'createdByUserId' })
  createdBy: User | null;

  @OneToMany(() => LoanDemand, demand => demand.disbursement)
  demands: LoanDemand[];
}

@Entity('loan_demands')
@Index(['lan'])
@Index(['loanAccountId'])
@Index(['dueDate'])
@Index(['status'])
export class LoanDemand {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'int' })
  loanAccountId: number;

  @Column({ type: 'int' })
  loanDisbursementId: number;

  @Column({ type: 'int', nullable: true })
  invoiceId: number | null;

  @Column({ type: 'varchar', length: 50 })
  lan: string;

  @Column({ type: 'date' })
  demandDate: Date;

  @Column({ type: 'date' })
  dueDate: Date;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  principalDue: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  interestDue: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  penalDue: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  feeDue: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  totalDue: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  principalPaid: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  interestPaid: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  penalPaid: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  feePaid: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalPaid: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  outstandingAmount: number;

  @Column({
    type: 'enum',
    enum: DEMAND_STATUS,
    default: DEMAND_STATUS.PENDING,
  })
  status: DEMAND_STATUS;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => LoanAccount, { nullable: false })
  @JoinColumn({ name: 'loanAccountId' })
  loanAccount: LoanAccount;

  @ManyToOne(() => LoanDisbursement, disbursement => disbursement.demands, { nullable: false })
  @JoinColumn({ name: 'loanDisbursementId' })
  disbursement: LoanDisbursement;

  @ManyToOne(() => Invoice, { nullable: true })
  @JoinColumn({ name: 'invoiceId' })
  invoice: Invoice | null;

  @OneToMany(() => RepaymentAllocation, allocation => allocation.demand)
  allocations: RepaymentAllocation[];
}

@Entity('repayments')
@Index(['lan'])
@Index(['lan', 'utr'], { unique: true })
@Index(['status'])
export class Repayment {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'int' })
  loanAccountId: number;

  @Column({ type: 'int', nullable: true })
  repaymentUploadId: number | null;

  @Column({ type: 'varchar', length: 50 })
  lan: string;

  @Column({ type: 'date' })
  repaymentDate: Date;

  @Column({ type: 'varchar', length: 100 })
  utr: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  allocatedAmount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  unappliedAmount: number;

  @Column({
    type: 'enum',
    enum: REPAYMENT_STATUS,
    default: REPAYMENT_STATUS.POSTED,
  })
  status: REPAYMENT_STATUS;

  @Column({ type: 'varchar', length: 50, default: 'OPS_UPLOAD' })
  source: string;

  @Column({ type: 'int', nullable: true })
  createdByUserId: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => LoanAccount, { nullable: false })
  @JoinColumn({ name: 'loanAccountId' })
  loanAccount: LoanAccount;

  @ManyToOne(() => RepaymentUpload, { nullable: true })
  @JoinColumn({ name: 'repaymentUploadId' })
  upload: RepaymentUpload | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'createdByUserId' })
  createdBy: User | null;

  @OneToMany(() => RepaymentAllocation, allocation => allocation.repayment)
  allocations: RepaymentAllocation[];
}

@Entity('repayment_allocations')
@Index(['lan'])
@Index(['repaymentId'])
@Index(['demandId'])
export class RepaymentAllocation {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'int' })
  repaymentId: number;

  @Column({ type: 'int' })
  demandId: number;

  @Column({ type: 'int' })
  loanAccountId: number;

  @Column({ type: 'int', nullable: true })
  invoiceId: number | null;

  @Column({ type: 'varchar', length: 50 })
  lan: string;

  @Column({ type: 'date' })
  allocationDate: Date;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  principalAmount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  interestAmount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  penalAmount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  feeAmount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  totalAmount: number;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Repayment, repayment => repayment.allocations, { nullable: false })
  @JoinColumn({ name: 'repaymentId' })
  repayment: Repayment;

  @ManyToOne(() => LoanDemand, demand => demand.allocations, { nullable: false })
  @JoinColumn({ name: 'demandId' })
  demand: LoanDemand;

  @ManyToOne(() => LoanAccount, { nullable: false })
  @JoinColumn({ name: 'loanAccountId' })
  loanAccount: LoanAccount;

  @ManyToOne(() => Invoice, { nullable: true })
  @JoinColumn({ name: 'invoiceId' })
  invoice: Invoice | null;
}

@Entity('loan_ledger_entries')
@Index(['lan'])
@Index(['loanAccountId'])
@Index(['valueDate'])
@Index(['entryType'])
export class LoanLedgerEntry {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'int' })
  loanAccountId: number;

  @Column({ type: 'int', nullable: true })
  loanDisbursementId: number | null;

  @Column({ type: 'int', nullable: true })
  demandId: number | null;

  @Column({ type: 'int', nullable: true })
  repaymentId: number | null;

  @Column({ type: 'int', nullable: true })
  invoiceId: number | null;

  @Column({ type: 'varchar', length: 50 })
  lan: string;

  @Column({
    type: 'enum',
    enum: LEDGER_ENTRY_TYPE,
  })
  entryType: LEDGER_ENTRY_TYPE;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  debit: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  credit: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  runningBalance: number;

  @Column({ type: 'date' })
  valueDate: Date;

  @Column({ type: 'varchar', length: 100, nullable: true })
  referenceType: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  referenceId: string | null;

  @Column({ type: 'text', nullable: true })
  narration: string | null;

  @Column({ type: 'int', nullable: true })
  createdByUserId: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => LoanAccount, { nullable: false })
  @JoinColumn({ name: 'loanAccountId' })
  loanAccount: LoanAccount;
}

@Entity('loan_account_snapshots')
@Index(['loanAccountId'], { unique: true })
@Index(['lan'], { unique: true })
export class LoanAccountSnapshot {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'int' })
  loanAccountId: number;

  @Column({ type: 'varchar', length: 50 })
  lan: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  sanctionedAmount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalDisbursed: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  principalOutstanding: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  interestOutstanding: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  penalOutstanding: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  feeOutstanding: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalOutstanding: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalCollected: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  utilizedLimit: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  unutilizedLimit: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  overdueAmount: number;

  @Column({ type: 'int', default: 0 })
  dpd: number;

  @Column({ type: 'date', nullable: true })
  nextDueDate: Date | null;

  @Column({ type: 'date', nullable: true })
  lastDemandDate: Date | null;

  @Column({ type: 'date', nullable: true })
  lastCollectionDate: Date | null;

  @Column({ type: 'varchar', length: 30, default: 'ACTIVE' })
  status: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => LoanAccount, { nullable: false })
  @JoinColumn({ name: 'loanAccountId' })
  loanAccount: LoanAccount;
}

@Entity('report_runs')
@Index(['reportType'])
@Index(['status'])
export class ReportRun {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'varchar', length: 100 })
  reportType: string;

  @Column({ type: 'json', nullable: true })
  filters: Record<string, any> | null;

  @Column({
    type: 'enum',
    enum: REPORT_RUN_STATUS,
    default: REPORT_RUN_STATUS.PENDING,
  })
  status: REPORT_RUN_STATUS;

  @Column({ type: 'varchar', length: 500, nullable: true })
  filePath: string | null;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'int', nullable: true })
  requestedByUserId: number | null;

  @Column({ type: 'datetime', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

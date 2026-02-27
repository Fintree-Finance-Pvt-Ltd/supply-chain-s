import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Customer } from './Customer';
import { Drawdown } from './Drawdown';

/**
 * Loan Entity
 * Represents a loan/sanction given to a customer in the SCF system
 */
@Entity('loans')
export class Loan {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'int' })
  customerId: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  loanNumber: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  sanctionedAmount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  disbursedAmount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  outstandingAmount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  interestRate: number;

  @Column({ type: 'int' })
  tenureMonths: number;

  @Column({ 
    type: 'enum', 
    enum: ['SANCTIONED', 'ACTIVE', 'DISBURSED', 'REPAID', 'FORECLOSED', 'NPA', 'DEFAULTED'],
    default: 'SANCTIONED' 
  })
  status: string;

  @Column({ type: 'date' })
  sanctionDate: Date;

  @Column({ type: 'date', nullable: true })
  firstDisbursementDate: Date;

  @Column({ type: 'date', nullable: true })
  maturityDate: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  purpose: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  loanType: string; // Working Capital, Invoice Financing, etc.

  @Column({ type: 'varchar', length: 50, nullable: true })
  repaymentType: string; // EMI, Bullet, Revolving

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  processingFee: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  penalInterestRate: number;

  @Column({ type: 'text', nullable: true })
  termsAndConditions: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Customer, customer => customer.loans)
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @OneToMany(() => LoanSchedule, schedule => schedule.loan)
  schedules: LoanSchedule[];

  @OneToMany(() => LoanTransaction, transactions => transactions.loan)
  transactions: LoanTransaction[];

  @OneToMany(() => Drawdown, drawdown => drawdown.loan)
  drawdowns: Drawdown[];
}

/**
 * Loan Schedule Entity
 * EMI/Bullet payment schedule for a loan
 */
@Entity('loan_schedules')
export class LoanSchedule {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'int' })
  loanId: number;

  @Column({ type: 'int' })
  installmentNumber: number;

  @Column({ type: 'date' })
  dueDate: Date;

  @Column({ type: 'date', nullable: true })
  paidDate: Date;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  principalAmount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  interestAmount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  totalAmount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  paidAmount: number;

  @Column({ 
    type: 'enum', 
    enum: ['PENDING', 'PAID', 'PARTIAL', 'OVERDUE', 'WAIVED'],
    default: 'PENDING' 
  })
  status: string;

  @Column({ type: 'int', nullable: true })
  daysOverdue: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  latePenaltyAmount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Loan, loan => loan.schedules)
  @JoinColumn({ name: 'loanId' })
  loan: Loan;
}

/**
 * Loan Transaction Entity
 * Records all transactions (disbursements, repayments, interest, etc.)
 */
@Entity('loan_transactions')
export class LoanTransaction {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'int' })
  loanId: number;

  @Column({ type: 'int', nullable: true })
  customerId: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  transactionNumber: string;

  @Column({ 
    type: 'enum', 
    enum: ['DISBURSEMENT', 'REPAYMENT', 'INTEREST_CHARGE', 'PENAL_CHARGE', 'FEE_CHARGE', 'REFUND', 'ADJUSTMENT', 'FORECLOSURE'],
    nullable: true 
  })
  type: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  principalAmount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  interestAmount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  penaltyAmount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  feeAmount: number;

  @Column({ type: 'date' })
  transactionDate: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  referenceNumber: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  mode: string; // UPI, NEFT, RTGS, Cash, Cheque

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ 
    type: 'enum', 
    enum: ['PENDING', 'COMPLETED', 'FAILED', 'REVERSED'],
    default: 'PENDING' 
  })
  status: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  utrNumber: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  receiptUrl: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Loan, loan => loan.transactions)
  @JoinColumn({ name: 'loanId' })
  loan: Loan;

  @ManyToOne(() => Customer, { nullable: true })
  @JoinColumn({ name: 'customerId' })
  customer: Customer;
}

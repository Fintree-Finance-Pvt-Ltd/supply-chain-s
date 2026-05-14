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
import { Supplier } from './Supplier';
import { User } from './User';
import { CaseStatusHistory } from './CaseStatusHistory';
import { LoanAccount } from './LoanAccount';

@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'int' })
  customerId: number;

  @Column({ type: 'int', nullable: true })
  loanAccountId: number; // LAN reference

  @Column({ type: 'int' })
  supplierId: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  invoiceNumber: string;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
serviceFee: number;
  
  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
sanctionAmount: number;
  @Column({ type: 'date' })
  invoiceDate: Date;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  invoiceAmount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  disbursementAmount: number;

  @Column({ type: 'date', nullable: true })
  dueDate: Date;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  invoiceFilePath: string; // Document upload path

  @Column({ 
    type: 'enum', 
    enum: [
      'DRAFT', 
      'SUBMITTED', 
      'PENDING_CUSTOMER_APPROVAL',
      'REJECTED_BY_CUSTOMER',
      'PENDING_OPS_L1_APPROVAL',
      'PENDING_OPS_L2_APPROVAL',
      'PENDING_MD_APPROVAL',
      'PENDING_OPS_HEAD_APPROVAL',
      'DISBURSEMENT_DATA_ENTRY',
      'PENDING_FINAL_OPS_L2_APPROVAL',
      'ACTIVE',
      'OPS_L1_VERIFIED', 
      'OPS_L2_VERIFIED', 
      'OPS_HEAD_APPROVED', 
      'CEO_APPROVED', 
      'MD_APPROVED', 
      'DISBURSED', 
      'REJECTED'
    ], 
    default: 'DRAFT' 
  })
  status: string;

  // Disbursement Details
  @Column({ type: 'varchar', length: 50, nullable: true })
  disbursementUtr: string;

  @Column({ type: 'date', nullable: true })
  disbursementDate: Date;

  @Column({ type: 'date', nullable: true })
  invoiceDueDate: Date;

  // ROI Details (fetched from credit_sanction based on LAN)
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  roiPercentage: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  roiAmount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  emiAmount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  penalCharges: number;

  // Customer Approval Fields
  @Column({ type: 'enum', enum: ['pending', 'approved', 'rejected'], nullable: true })
  customerApprovalStatus: string;

  @Column({ type: 'text', nullable: true })
  customerRemarks: string;

  @Column({ type: 'datetime', nullable: true })
  customerApprovedAt: Date;

  @Column({ type: 'int', nullable: true })
  approvedByCustomerId: number;

  // Email Approval Fields
  @Column({ type: 'varchar', length: 255, nullable: true })
  approvalToken: string;

  @Column({ type: 'datetime', nullable: true })
  approvalTokenExpiry: Date;

  @Column({ type: 'enum', enum: ['mobile', 'email'], nullable: true })
  approvedVia: string;

  @Column({ type: 'boolean', default: false })
  emailApprovalSent: boolean;

  @Column({ type: 'datetime', nullable: true })
  emailApprovalSentAt: Date;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  disbursedAmount: number;

  @Column({ type: 'date', nullable: true })
  disbursedDate: Date;

  @Column({ type: 'int', nullable: true })
  createdByUserId: number; // RM who created

  @Column({ type: 'varchar', length: 255, nullable: true })
  rejectionReason: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Customer, customer => customer.invoices)
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @ManyToOne(() => LoanAccount, loanAccount => loanAccount.invoices, { nullable: true })
  @JoinColumn({ name: 'loanAccountId' })
  loanAccount: LoanAccount;

  @ManyToOne(() => Supplier, supplier => supplier.invoices)
  @JoinColumn({ name: 'supplierId' })
  supplier: Supplier;

  @ManyToOne(() => User, user => user.createdInvoices)
  @JoinColumn({ name: 'createdByUserId' })
  createdBy: User;

  @OneToMany(() => CaseStatusHistory, history => history.invoice)
  statusHistory: CaseStatusHistory[];

}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Customer } from './Customer';
import { User } from './User';
import { Invoice } from './Invoice';

export const INVOICE_APPROVAL_BATCH_STATUS = {
  PENDING_CUSTOMER_APPROVAL: 'PENDING_CUSTOMER_APPROVAL',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
} as const;

@Entity('invoice_approval_batches')
export class InvoiceApprovalBatch {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 80 })
  batchCode: string;

  @Column({ type: 'int' })
  customerId: number;

  @Column({
    type: 'enum',
    enum: Object.values(INVOICE_APPROVAL_BATCH_STATUS),
    default: INVOICE_APPROVAL_BATCH_STATUS.PENDING_CUSTOMER_APPROVAL,
  })
  status: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  expectedDisbursementUtr: string | null;

  @Column({ type: 'date', nullable: true })
  expectedDisbursementDate: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  approvalToken: string | null;

  @Column({ type: 'datetime', nullable: true })
  approvalTokenExpiry: Date | null;

  @Column({ type: 'datetime', nullable: true })
  customerApprovedAt: Date | null;

  @Column({ type: 'enum', enum: ['mobile', 'email'], nullable: true })
  approvedVia: string | null;

  @Column({ type: 'text', nullable: true })
  customerRemarks: string | null;

  @Column({ type: 'int', nullable: true })
  createdByUserId: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Customer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'createdByUserId' })
  createdBy: User | null;

  @OneToMany(() => Invoice, (invoice) => invoice.approvalBatch)
  invoices: Invoice[];
}

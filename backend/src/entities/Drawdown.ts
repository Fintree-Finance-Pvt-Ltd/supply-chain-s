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
import { Loan } from './Loan';

/**
 * Drawdown Entity
 * Represents a drawdown/disbursement request from a customer against their sanctioned loan limit
 */
@Entity('drawdowns')
export class Drawdown {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'int' })
  customerId: number;

  @Column({ type: 'int', nullable: true })
  loanId: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  drawdownNumber: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  requestedAmount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  approvedAmount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  disbursedAmount: number;

  @Column({ 
    type: 'enum', 
    enum: ['DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'DISBURSED', 'CANCELLED'],
    default: 'DRAFT' 
  })
  status: string;

  @Column({ type: 'date' })
  requestDate: Date;

  @Column({ type: 'date', nullable: true })
  approvalDate: Date;

  @Column({ type: 'date', nullable: true })
  disbursementDate: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  purpose: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  invoiceNumber: string;

  @Column({ type: 'int', nullable: true })
  invoiceId: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  beneficiaryName: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  beneficiaryBankAccount: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  beneficiaryIfsc: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  utrNumber: string;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string;

  @Column({ type: 'int', nullable: true })
  approvedBy: number;

  @Column({ type: 'int', nullable: true })
  createdByUserId: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Customer, customer => customer.drawdowns)
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @ManyToOne(() => Loan, loan => loan.drawdowns, { nullable: true })
  @JoinColumn({ name: 'loanId' })
  loan: Loan;
}

// Add drawdowns relation to Loan entity (need to update Loan.ts later)
// For now, we'll add it to the entity definition

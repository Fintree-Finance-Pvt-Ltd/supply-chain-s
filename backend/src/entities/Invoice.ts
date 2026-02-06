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

@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'int' })
  customerId: number;

  @Column({ type: 'int' })
  supplierId: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  invoiceNumber: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  invoiceAmount: number;

  @Column({ type: 'date' })
  invoiceDate: Date;

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

  @ManyToOne(() => Supplier, supplier => supplier.invoices)
  @JoinColumn({ name: 'supplierId' })
  supplier: Supplier;

  @ManyToOne(() => User, user => user.createdInvoices)
  @JoinColumn({ name: 'createdByUserId' })
  createdBy: User;

  @OneToMany(() => CaseStatusHistory, history => history.invoice)
  statusHistory: CaseStatusHistory[];
}

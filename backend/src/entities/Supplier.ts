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
import { User } from './User';
import { Invoice } from './Invoice';
import { CaseStatusHistory } from './CaseStatusHistory';

@Entity('suppliers')
export class Supplier {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'int' })
  customerId: number; // Customer LAN reference

  @Column({ type: 'varchar', length: 255 })
  supplierName: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  supplierCode: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 20 })
  contactNumber: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  gstNumber: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  panNumber: string;

  @Column({ 
    type: 'enum', 
    enum: ['DRAFT', 'SUBMITTED', 'OPS_L1_APPROVED', 'OPS_HEAD_APPROVED', 'COMPLETED', 'REJECTED'], 
    default: 'DRAFT' 
  })
  status: string;

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
  @ManyToOne(() => Customer, customer => customer.suppliers)
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @ManyToOne(() => User, user => user.createdSuppliers)
  @JoinColumn({ name: 'createdByUserId' })
  createdBy: User;

  @OneToMany(() => Invoice, invoice => invoice.supplier)
  invoices: Invoice[];

  @OneToMany(() => CaseStatusHistory, history => history.supplier)
  statusHistory: CaseStatusHistory[];
}

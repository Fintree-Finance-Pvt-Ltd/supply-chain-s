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
import { Invoice } from './Invoice';
import { User } from './User';
import { Role } from './Role';
import { CaseStatusHistory } from './CaseStatusHistory';

@Entity('case_workflows')
export class CaseWorkflow {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'enum', enum: ['CUSTOMER_ONBOARDING', 'SUPPLIER_ONBOARDING', 'INVOICE_DISCOUNTING'] })
  workflowType: string;

  @Column({ type: 'int', nullable: true })
  customerId: number;

  @Column({ type: 'int', nullable: true })
  supplierId: number;

  @Column({ type: 'int', nullable: true })
  invoiceId: number;

  @Column({ type: 'varchar', length: 100 })
  currentStatus: string;

  @Column({ type: 'int', nullable: true })
  currentApproverRoleId: number; // Role awaiting approval

  @Column({ type: 'int', nullable: true })
  assignedUserId: number; // User assigned to this case

  @Column({ type: 'varchar', length: 50, nullable: true })
  assignedStage: string; // Current assignment stage

  @Column({ type: 'varchar', length: 500, nullable: true })
  currentApproverRoleName: string; // Cache for quick access

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  rejectionReason: string;

  @Column({ type: 'boolean', default: false })
  isRejected: boolean;

  @Column({ type: 'int', nullable: true })
  rejectedByUserId: number;

  @Column({ type: 'date', nullable: true })
  rejectedDate: Date;

  @Column({ type: 'boolean', default: false })
  isCompleted: boolean;

  @Column({ type: 'date', nullable: true })
  completedDate: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Customer, customer => customer.workflows, { nullable: true })
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @ManyToOne(() => Supplier, { nullable: true })
  @JoinColumn({ name: 'supplierId' })
  supplier: Supplier;

  @ManyToOne(() => Invoice, { nullable: true })
  @JoinColumn({ name: 'invoiceId' })
  invoice: Invoice;

  @ManyToOne(() => Role, { nullable: true })
  @JoinColumn({ name: 'currentApproverRoleId' })
  currentApproverRole: Role;

  @ManyToOne(() => User, (user) => user.assignedWorkflows, { nullable: true })
  @JoinColumn({ name: 'assignedUserId' })
  assignedUser: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'rejectedByUserId' })
  rejectedBy: User;

  @OneToMany(() => CaseStatusHistory, history => history.caseWorkflow)
  statusHistory: CaseStatusHistory[];
}

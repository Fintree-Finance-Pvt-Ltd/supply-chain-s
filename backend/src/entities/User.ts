import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { UserRole } from './UserRole';
import { Document } from './Document';
import { Customer } from './Customer';
import { Supplier } from './Supplier';
import { Invoice } from './Invoice';
import { CreditSanction } from './CreditSanction';
import { ApprovalAction } from './ApprovalAction';
import { CaseStatusHistory } from './CaseStatusHistory';
import { CaseWorkflow } from './CaseWorkflow';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  password: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  mobile: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'varchar', length: 50, nullable: true })
  defaultRole: string; // For quick access, but UserRole is source of truth

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @OneToMany(() => UserRole, (userRole) => userRole.user)
  userRoles: UserRole[];

  @OneToMany(() => Document, (document) => document.uploadedBy)
  uploadedDocuments: Document[];

  @OneToMany(() => Customer, (customer) => customer.rm)
  customers: Customer[];

  @OneToMany(() => Customer, (customer) => customer.assignedUser)
  assignedCustomers: Customer[];

  @OneToMany(() => Supplier, (supplier) => supplier.createdBy)
  createdSuppliers: Supplier[];

  @OneToMany(() => Invoice, (invoice) => invoice.createdBy)
  createdInvoices: Invoice[];

  @OneToMany(() => CreditSanction, (sanction) => sanction.creditOfficer)
  creditSanctions: CreditSanction[];

  @OneToMany(() => ApprovalAction, (action) => action.approver)
  approvalActions: ApprovalAction[];

  @OneToMany(() => CaseStatusHistory, (history) => history.changedBy)
  statusHistory: CaseStatusHistory[];

  @OneToMany(() => CaseWorkflow, (workflow) => workflow.assignedUser)
  assignedWorkflows: CaseWorkflow[];
}




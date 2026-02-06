import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Customer } from './Customer';
import { User } from './User';
import { Supplier } from './Supplier';
import { Invoice } from './Invoice';
import { CaseWorkflow } from './CaseWorkflow';
import { CASE_STATUS } from '../config/constants';

@Entity('case_status_history')
export class CaseStatusHistory {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'int' })
  customerId: number;

  @Column({ type: 'int', nullable: true })
  supplierId: number;

  @Column({ type: 'int', nullable: true })
  invoiceId: number;

  @Column({ type: 'int', nullable: true })
  caseWorkflowId: number;

  @Column({ type: 'enum', enum: Object.values(CASE_STATUS) })
  status: string;

  @Column({ type: 'enum', enum: Object.values(CASE_STATUS), nullable: true })
  previousStatus: string;

  @Column({ type: 'int' })
  changedBy: number;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @ManyToOne(() => Customer, (customer) => customer.statusHistory)
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @ManyToOne(() => Supplier, (supplier) => supplier.statusHistory, { nullable: true })
  @JoinColumn({ name: 'supplierId' })
  supplier: Supplier;

  @ManyToOne(() => Invoice, (invoice) => invoice.statusHistory, { nullable: true })
  @JoinColumn({ name: 'invoiceId' })
  invoice: Invoice;

  @ManyToOne(() => CaseWorkflow, (workflow) => workflow.statusHistory, { nullable: true })
  @JoinColumn({ name: 'caseWorkflowId' })
  caseWorkflow: CaseWorkflow;

  @ManyToOne(() => User, (user) => user.statusHistory)
  @JoinColumn({ name: 'changedBy' })
  changedByUser: User;
}



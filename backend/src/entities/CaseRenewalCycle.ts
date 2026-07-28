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
import { Document } from './Document';
import { CreditSanction } from './CreditSanction';

export const RENEWAL_CYCLE_STATUS = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

@Entity('case_renewal_cycles')
@Index(['customerId', 'cycleNumber'], { unique: true })
export class CaseRenewalCycle {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'int' })
  customerId: number;

  @Column({ type: 'int' })
  cycleNumber: number;

  @Column({ type: 'varchar', length: 30, default: RENEWAL_CYCLE_STATUS.ACTIVE })
  status: string;

  @Column({ type: 'date', nullable: true })
  sourceExpiryDate: Date | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  previousWorkflowStatus: string | null;

  @Column({ type: 'int', nullable: true })
  initiatedByUserId: number | null;

  @Column({ type: 'timestamp', nullable: true })
  initiatedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Customer, (customer) => customer.renewalCycles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'initiatedByUserId' })
  initiatedBy: User | null;

  @OneToMany(() => Document, (document) => document.renewalCycle)
  documents: Document[];

  @OneToMany(() => CreditSanction, (sanction) => sanction.renewalCycle)
  creditSanctions: CreditSanction[];
}

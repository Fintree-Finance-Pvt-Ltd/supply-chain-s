import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Customer } from './Customer';
import { User } from './User';
import { ApprovalInstance } from './ApprovalInstance';

@Entity('credit_sanctions')
@Unique(['customerId', 'partner']) // Each partner can have one sanction per customer
export class CreditSanction {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'int' })
  customerId: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  partner: string; // Partner code (FFPL, KF, MFL, etc.)

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  sanctionAmount: number;

  @Column({ type: 'int' })
  tenure: number; // in months

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  interestRate: number; // percentage

  @Column({ type: 'text', nullable: true })
  conditions: string;

  @Column({ type: 'text', nullable: true })
  creditRemarks: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  penalCharges: number; // percentage

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  processingFees: number; // percentage

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
legalCharges: number; // flat amount (₹)

  @Column({ type: 'int' })
  creditOfficerId: number;

  @Column({ type: 'varchar', length: 50, default: 'pending' })
  status: string; // pending, approved, rejected

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Customer, (customer) => customer.creditSanctions)
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @ManyToOne(() => User, (user) => user.creditSanctions)
  @JoinColumn({ name: 'creditOfficerId' })
  creditOfficer: User;

  @OneToMany(() => ApprovalInstance, (instance) => instance.creditSanction)
  approvalInstances: ApprovalInstance[];
}



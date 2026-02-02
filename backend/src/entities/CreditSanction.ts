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
import { ApprovalInstance } from './ApprovalInstance';

@Entity('credit_sanctions')
export class CreditSanction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  customerId: string;

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

  @Column({ type: 'uuid' })
  creditOfficerId: string;

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


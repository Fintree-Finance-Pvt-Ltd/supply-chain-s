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

@Entity('operations_checks')
export class OperationsCheck {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  customerId: string;

  @Column({ type: 'boolean', default: false })
  documentsVerified: boolean;

  @Column({ type: 'boolean', default: false })
  esignVerified: boolean;

  @Column({ type: 'boolean', default: false })
  enachVerified: boolean;

  @Column({ type: 'text', nullable: true })
  opsRemarks: string;

  @Column({ type: 'uuid', nullable: true })
  opsUserId: string;

  @Column({ type: 'varchar', length: 50, default: 'pending' })
  status: string; // pending, approved, rejected

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Customer, (customer) => customer.operationsChecks)
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'opsUserId' })
  opsUser: User;

  @OneToMany(() => ApprovalInstance, (instance) => instance.operationsCheck)
  approvalInstances: ApprovalInstance[];
}


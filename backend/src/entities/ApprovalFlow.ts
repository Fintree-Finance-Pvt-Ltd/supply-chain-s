import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ApprovalStep } from './ApprovalStep';
import { ApprovalInstance } from './ApprovalInstance';
import { APPROVAL_FLOW_TYPES } from '../config/constants';

@Entity('approval_flows')
export class ApprovalFlow {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'varchar', length: 255 })
  name: string; // e.g., 'Credit Sanction Approval'

  @Column({ type: 'enum', enum: Object.values(APPROVAL_FLOW_TYPES) })
  flowType: string; // credit_sanction, operations

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: true })
  isSequential: boolean; // true = sequential, false = parallel (future use)

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @OneToMany(() => ApprovalStep, (step) => step.approvalFlow, { cascade: true })
  steps: ApprovalStep[];

  @OneToMany(() => ApprovalInstance, (instance) => instance.approvalFlow)
  instances: ApprovalInstance[];
}



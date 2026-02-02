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
import { ApprovalFlow } from './ApprovalFlow';
import { CreditSanction } from './CreditSanction';
import { OperationsCheck } from './OperationsCheck';
import { ApprovalAction } from './ApprovalAction';
import { APPROVAL_STATUS } from '../config/constants';

@Entity('approval_instances')
export class ApprovalInstance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  approvalFlowId: string;

  @Column({ type: 'uuid', nullable: true })
  creditSanctionId: string; // For credit sanction approvals

  @Column({ type: 'uuid', nullable: true })
  operationsCheckId: string; // For operations approvals

  @Column({ type: 'enum', enum: Object.values(APPROVAL_STATUS), default: APPROVAL_STATUS.PENDING })
  status: string;

  @Column({ type: 'int', default: 0 })
  currentStep: number; // Current step in the approval flow (0-indexed)

  @Column({ type: 'int', nullable: true })
  currentApproverId: number | null; // User who should approve next

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  // Relations
  @ManyToOne(() => ApprovalFlow, (flow) => flow.instances)
  @JoinColumn({ name: 'approvalFlowId' })
  approvalFlow: ApprovalFlow;

  @ManyToOne(() => CreditSanction, (sanction) => sanction.approvalInstances, { nullable: true })
  @JoinColumn({ name: 'creditSanctionId' })
  creditSanction: CreditSanction;

  @ManyToOne(() => OperationsCheck, (opsCheck) => opsCheck.approvalInstances, { nullable: true })
  @JoinColumn({ name: 'operationsCheckId' })
  operationsCheck: OperationsCheck;

  @OneToMany(() => ApprovalAction, (action) => action.approvalInstance, { cascade: true })
  actions: ApprovalAction[];
}


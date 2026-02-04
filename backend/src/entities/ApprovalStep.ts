import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApprovalFlow } from './ApprovalFlow';
import { Role } from './Role';

@Entity('approval_steps')
export class ApprovalStep {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'int' })
  approvalFlowId: number;

  @Column({ type: 'int', nullable: true })
  approverRoleId: number; // Role that can approve at this step

  @Column({ type: 'int' })
  stepOrder: number; // 1, 2, 3... for sequential approval

  @Column({ type: 'varchar', length: 255, nullable: true })
  stepName: string; // e.g., 'Credit Team Review', 'CFO Approval'

  @Column({ type: 'boolean', default: true })
  isRequired: boolean; // Can this step be skipped?

  @Column({ type: 'boolean', default: false })
  isParallel: boolean; // For future: parallel approval support

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => ApprovalFlow, (flow) => flow.steps, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'approvalFlowId' })
  approvalFlow: ApprovalFlow;

  @ManyToOne(() => Role, (role) => role.approvalSteps, { nullable: true })
  @JoinColumn({ name: 'approverRoleId' })
  approverRole: Role;
}


